/**
 * TODO:
 * 1. 数据结构（对应到本地或远程存储结构）
 *
 *
 * 股票数据访问层，主要用于计算和一些处理
 * 1. 后续会将数据的远程访问，本地访问在这里集成
 * 2.
 */

const _ = require("lodash");
const moment = require("moment");
const executeTasks = require("@wt/lib-taskqueue");
const tushare = require("@wt/lib-tushare");

const pino = require("pino");

const logger = pino({
    level: process.env.LOGGER || "info",
    prettyPrint: {
        levelFirst: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
        crlf: true,
    },
    prettifier: require("pino-pretty"),
});

import {
    readStockData,
    getDataRoot,
    getStockDataFile,
    DATA_PATH,
    STOCKLIST_FILE,
    INDEXLIST_FILE,
    stockDataNames,
} from "./stockdata-query";

// const os = require("os")
const path = require("path");
const fs = require("fs");
const fp = fs.promises;

const stockInfo2Names = {
    [stockDataNames.dividend]: stockDataNames.dividend,
    [stockDataNames.pledgeStat]: stockDataNames.pledgeStat,
    [stockDataNames.pledgeDetail]: stockDataNames.pledgeDetail,
};

/**
 * 更新个股信息数据，包括个股的日数据，基本面，复权因子，财务相关的各种数据；
 *
 * @param {string} dataName 数据名称
 * @param {string} tsCode 股票代码
 * @param {boolean} force 是否强制全部更新
 */
async function updateStockInfoData(dataName, tsCode, force = false) {
    // logger.log("更新日线：", tsCode, force)

    // dividend 比较特殊，单独调用
    if (stockInfo2Names[dataName]) {
        return updateStockInfo2Data(tsCode);
    }

    if (_.isEmpty(dataName) || !stockDataNames[dataName]) {
        throw Error("请填写正确的个股数据名称！" + dataName);
    }
    if (_.isEmpty(tsCode)) {
        throw Error(`请填写正确的股票代码！${tsCode}`);
    }

    let stockData;
    try {
        if (force) {
            logger.debug(`需要强制更新数据：${tsCode}`);
            try {
                let [data, endDate, startDate] = await tushare.queryStockInfo(
                    dataName,
                    tsCode
                );

                stockData = {
                    updateTime: moment().toISOString(),
                    startDate,
                    endDate,
                    data,
                };
                logger.info(
                    `个股数据${dataName}强制更新，代码 ${tsCode}, 更新时间：${
                        stockData.updateTime
                    }, 更新时间范围: ${startDate} - ${endDate}, 总条数：${
                        stockData.data && stockData.data.length
                    }`
                );
            } catch (error) {
                logger.error(
                    `强制更新个股${tsCode}数据${dataName}时出现错误：${error}`
                );
                throw error;
            }
        } else {
            stockData = await readStockData(dataName, tsCode);

            logger.debug(
                `读取本地数据${tsCode}.${dataName}：${stockData.updateTime}, ${
                    stockData.startDate
                }, ${stockData.endDate}, ${
                    stockData.data && stockData.data.length
                }`
            );
            let startDate = "";
            if (stockData.data && stockData.data.length > 0) {
                let lastDate = stockData.endDate;
                startDate = moment(lastDate, "YYYYMMDD")
                    .add(1, "days")
                    .format("YYYYMMDD");
                let now = moment();
                if (now.diff(startDate, "days") <= 0 && now.hours() < 15) {
                    // 还没有最新一天的数据，不需要
                    logger.log(`没有新的数据，不需要更新 ${tsCode}`);
                    return;
                }
            }

            let [
                newData,
                endDate,
                queryStartDate,
            ] = await tushare.queryStockInfo(dataName, tsCode, startDate);

            // 如果通过查询获得的数据不存在，需要更新一下startDate
            if (stockData && !stockData.startDate) {
                stockData.startDate = queryStartDate;
            }

            if (newData && newData.length > 0) {
                stockData.updateTime = moment().toISOString();
                //stockData.startDate = startDate;
                stockData.endDate = endDate;
                stockData.data.unshift(...newData);
                logger.info(
                    `个股数据${dataName}更新，代码 ${tsCode}, 更新时间：${
                        stockData.updateTime
                    }, 更新时间范围: ${queryStartDate} - ${endDate}, 更新条数：${
                        newData && newData.length
                    }，总条数：${stockData.data && stockData.data.length}`
                );
            } else {
                stockData = null;
                logger.info(`个股数据${dataName}没有更新，代码 ${tsCode}`);
            }
        }
    } catch (error) {
        logger.error(`${tsCode} 个股数据${dataName}更新时发生错误，${error}`);
        throw error;
    }

    try {
        if (stockData && stockData.data && stockData.data.length > 0) {
            // await checkDataPath();

            let jsonStr = JSON.stringify(stockData);
            let stockDataFile = getStockDataFile(dataName, tsCode);
            logger.debug(
                `保存个股${tsCode}数据${dataName}到：${stockDataFile}`
            );
            await fp.writeFile(stockDataFile, jsonStr, "utf-8");
        }
    } catch (error) {
        throw new Error(
            `保存个股${tsCode}数据${dataName}时出现错误，请检查后重新执行：${error}`
        );
    }
}

/**
 * 数据更新，如果force为true，则需要将所有数据更新为最新（相当于全部重新读取）
 * @param {boolean} force 强制更新所有数据，表示忽略本地数据，重新获取全部历史数据
 * @param {boolean} updateStock 是否更新个股日线数据，默认不更新
 * @param {boolean} updateFinance 是否更新个股财务数据，默认不更新
 * @param {boolean} updateIndex 是否更新指数信息，默认不更新
 */
async function updateData(
    force = false,
    updateStock = false,
    updateFinance = false,
    updateMainbiz = false,
    updateDividend = false,
    updatePledge = false,
    updateIndex = false
) {
    logger.debug(
        `参数：强制更新 ${force}, 更新股票信息数据 ${updateStock}, 更新股票财务数据 ${updateFinance}, 更新主营业务构成 ${updateMainbiz}, 更新分红送股 ${updateDividend}, 更新股权质押数据 ${updatePledge}，更新指数数据 ${updateIndex}`
    );
    // 首先读取和保存股票列表数据
    let [stockList, indexList] = await updateListData(force);

    if (updateStock) {
        await readAndUpdateStockListInfoData(stockList, force);
    }

    if (updateFinance) {
        await readAndUpdateStockListFinancialData(stockList, force);
    }

    if (updateMainbiz) {
        await readAndUpdateStockListMainbizData(stockList, force);
    }

    if (updateDividend) {
        await readAndUpdateStockListDividendData(stockList);
    }

    if (updatePledge) {
        await readAndUpdateStockListPledgeData(stockList);
    }

    if (updateIndex) {
        await readAndUpdateIndexListInfoData(indexList, force);
    }
}

async function readAndUpdateIndexListInfoData(indexList, force) {
    if (indexList && indexList.data && indexList.data.length > 0) {
        // if (all || includeIndex) {
        logger.info("指数日线数据更新开始 ...");
        // if (_.isArray(indexList.data) && indexList.data.length > 0) {
        let tasks = indexList.data.map((data) => {
            return {
                caller: updateStockInfoData,
                args: [stockDataNames.indexDaily, data.ts_code, force],
            };
        });
        let workers = executeTasks(tasks, 20, "指数日线更新任务");
        try {
            logger.debug("等待指数日线更新队列完成 ...");
            await Promise.all(workers);
            logger.debug("指数日线数据更新队列全部完成！");
        } catch (error) {
            logger.error(`指数日线任务执行 错误：%o`, error);
        }
        // }
        logger.info(tushare.showInfo());
        logger.info("指数日线数据更新完毕！");
    }
}

const stockListInfoApiNames = [
    stockDataNames.daily,
    stockDataNames.adjustFactor,
    stockDataNames.suspendInfo,
    stockDataNames.dailyBasic,
    stockDataNames.moneyFlow,
];

const stockListFinancialApiNames = [
    stockDataNames.income,
    stockDataNames.balanceSheet,
    stockDataNames.cashFlow,
    stockDataNames.forecast,
    stockDataNames.express,
    // stockDataNames.dividend,
    stockDataNames.financialIndicator,
    // stockDataNames.financialMainbiz,
    stockDataNames.disclosureDate,
];

/**
 * 读取并更新个股的财务数据
 * @param {Array} stockList 个股列表
 * @param {boolean} force 是否强制更新
 */
async function readAndUpdateStockListFinancialData(stockList, force) {
    let stockBasicData = stockList && stockList.data;
    if (stockBasicData && stockBasicData.length > 0) {
        let tasks = [];
        logger.info("个股财务数据更新准备...");
        for (let i = 0; i < stockBasicData.length; i++) {
            for (let j = 0; j < stockListFinancialApiNames.length; j++) {
                tasks.push({
                    caller: updateStockInfoData,
                    args: [
                        stockListFinancialApiNames[j],
                        stockBasicData[i].ts_code,
                        force,
                    ],
                });
            }
        }
        logger.info("个股财务数据更新准备完毕！");

        if (tasks && tasks.length > 0) {
            let workers = executeTasks(tasks, 30, "个股财务数据任务");
            try {
                logger.debug("等待个股财务数据更新队列完成...");
                await Promise.all(workers);
                logger.info(tushare.showInfo());
                logger.debug("个股财务数据更新队列全部执行完毕！");
            } catch (error) {
                logger.error(`个股财务数据更新任务执行 错误！${error}`);
            }
        }
    }
}

/**
 * 读取并更新个股主营业务数据，这个数据接口流量限制较大，因此单独更新
 * @param {Array} stockList 个股列表
 * @param {boolean}} force 是否强制更新
 */
async function readAndUpdateStockListMainbizData(stockList, force) {
    let stockBasicData = stockList && stockList.data;
    if (stockBasicData && stockBasicData.length > 0) {
        let tasks = [];
        logger.info("个股主营业务数据更新准备...");
        for (let i = 0; i < stockBasicData.length; i++) {
            tasks.push({
                caller: updateStockInfoData,
                args: [
                    stockDataNames.financialMainbiz,
                    stockBasicData[i].ts_code,
                    force,
                ],
            });
        }
        logger.info("个股主营业务数据更新准备完毕！");

        if (tasks && tasks.length > 0) {
            let workers = executeTasks(tasks, 30, "个股主营业务数据任务");
            try {
                logger.debug("等待个股主营业务数据更新队列完成...");
                await Promise.all(workers);
                logger.info(tushare.showInfo());
                logger.debug("个股主营业务数据更新队列全部执行完毕！");
            } catch (error) {
                logger.error(`个股主营业务数据更新任务执行 错误！${error}`);
            }
        }
    }
}

async function readAndUpdateStockListDividendData(stockList) {
    let stockBasicData = stockList && stockList.data;
    if (stockBasicData && stockBasicData.length > 0) {
        let tasks = [];
        logger.info("个股分红送股数据更新准备...");
        for (let i = 0; i < stockBasicData.length; i++) {
            tasks.push({
                caller: updateStockInfo2Data,
                args: [stockDataNames.dividend, stockBasicData[i].ts_code],
            });
        }
        logger.info("个股分红送股数据更新准备完毕！");

        if (tasks && tasks.length > 0) {
            let workers = executeTasks(tasks, 20, "个股分红送股数据任务");
            try {
                logger.debug("等待个股分红送股数据更新队列完成...");
                await Promise.all(workers);
                logger.info(tushare.showInfo());
                logger.debug("个股分红送股数据更新队列全部执行完毕！");
            } catch (error) {
                logger.error(`个股分红送股数据更新任务执行 错误！${error}`);
            }
        }
    }
}

async function readAndUpdateStockListPledgeData(stockList) {
    let stockBasicData = stockList && stockList.data;
    if (stockBasicData && stockBasicData.length > 0) {
        let tasks = [];
        logger.info("个股股权质押数据更新准备...");
        for (let i = 0; i < stockBasicData.length; i++) {
            tasks.push({
                caller: updateStockInfo2Data,
                args: [stockDataNames.pledgeStat, stockBasicData[i].ts_code],
            });
            tasks.push({
                caller: updateStockInfo2Data,
                args: [stockDataNames.pledgeDetail, stockBasicData[i].ts_code],
            });
        }
        logger.info("个股股权质押数据更新准备完毕！");

        if (tasks && tasks.length > 0) {
            let workers = executeTasks(tasks, 20, "个股股权质押数据任务");
            try {
                logger.debug("等待个股股权质押数据更新队列完成...");
                await Promise.all(workers);
                logger.info(tushare.showInfo());
                logger.debug("个股股权质押数据更新队列全部执行完毕！");
            } catch (error) {
                logger.error(`个股股权质押数据更新任务执行 错误！${error}`);
            }
        }
    }
}

/**
 * 读取并更新个股信息数据
 * @param {Array} stockList 个股列表
 * @param {boolean} force 是否强制更新
 */
async function readAndUpdateStockListInfoData(stockList, force) {
    let stockBasicData = stockList && stockList.data;
    if (stockBasicData && stockBasicData.length > 0) {
        let totalStockWorkers = [];
        logger.info("个股信息数据更新准备...");
        for (let i = 0; i < stockBasicData.length; i++) {
            for (let j = 0; j < stockListInfoApiNames.length; j++) {
                totalStockWorkers.push({
                    caller: updateStockInfoData,
                    args: [
                        stockListInfoApiNames[j],
                        stockBasicData[i].ts_code,
                        force,
                    ],
                });
            }
        }
        logger.info("个股信息数据更新准备完毕！");
        if (totalStockWorkers && totalStockWorkers.length > 0) {
            let workers = executeTasks(
                totalStockWorkers,
                30,
                "个股数据更新任务"
            );
            try {
                logger.debug("等待个股数据更新队列完成...");
                await Promise.all(workers);
                logger.info(tushare.showInfo());
                logger.debug("个股数据更新队列全部执行完毕！");
            } catch (error) {
                logger.error(`个股数据更新任务执行 错误！${error}`);
            }
        }
    }
}

/**
 * 更新股票和指数列表信息
 * @param {boolean} force 是否强制更新
 */
async function updateListData(force) {
    let now = moment();
    // let endDate = now.format("YYYYMMDD")

    logger.info("获取和更新股票列表数据 ...");
    // 首先更新股票列表数据
    let stockBasicData = await tushare.stockBasic();

    let stockList = {
        updateTime: now.toISOString(),
        data: stockBasicData,
    };
    await saveListFile(stockList, STOCKLIST_FILE);
    logger.info("股票列表数据更新完毕！");

    logger.info("获取和更新指数列表数据 ...");
    // 更新股票指数列表数据
    let indexList = {
        updateTime: now.toISOString(),
        data: [],
    };

    let allIndexData = await Promise.all(
        tushare.indexMarketList.map(async (market) => {
            return tushare.indexBasic(market.code);
        })
    );

    // logger.debug("所有指数请求返回！", allIndexData && allIndexData.length)
    if (allIndexData && allIndexData.length > 0) {
        allIndexData.forEach((data) => {
            // logger.debug("指数数据：", data && data.length)
            if (data && data.length > 0) {
                // 合并之前做一次数据检查，对于已经终止的指数进行过滤
                let total = data.length;
                data = data.filter((item) => {
                    return _.isEmpty(item.exp_date);
                });
                let filteredTotal = data.length;
                logger.debug(`指数过滤，总共${total}, 剩余${filteredTotal}`);
                indexList.data.push(...data);
            }
        });
    }
    // logger.debug("保存指数数据！")
    await saveListFile(indexList, INDEXLIST_FILE);
    logger.info("更新指数列表数据完成！");

    return [stockList, indexList];
}

async function updateStockInfo2Data(dataName, tsCode) {
    let now = moment();

    if (_.isEmpty(tsCode)) {
        throw new Error(`没有设置查询${dataName}的个股代码`);
    }

    logger.info(`个股${tsCode}获取和更新${dataName}数据 ...`);
    // 首先更新股票列表数据
    let data = await tushare.queryStockInfo(dataName, tsCode);
    let stockData = {
        updateTime: now.toISOString(),
        data,
    };
    logger.info(
        `个股${tsCode} 数据${dataName}更新，更新时间：${
            stockData.updateTime
        }, 总条数：${stockData.data && stockData.data.length}`
    );

    try {
        if (stockData && stockData.data && stockData.data.length > 0) {
            let jsonStr = JSON.stringify(stockData);
            let stockDataFile = getStockDataFile(dataName, tsCode);
            logger.debug(
                `保存个股${tsCode}数据${dataName}到：${stockDataFile}`
            );
            await fp.writeFile(stockDataFile, jsonStr, "utf-8");
        }
    } catch (error) {
        logger.error(`保存个股${tsCode}数据${dataName}错误：${error}`);
        throw new Error(
            `保存个股${tsCode}数据${dataName}时出现错误，请检查后重新执行：${error}`
        );
    }
}

/**
 * 保存列表数据到指定文件
 * @param {object} data 列表数据
 * @param {string} fileName 文件名
 */
async function saveListFile(data, fileName) {
    try {
        // await checkDataPath();

        let jsonStr = JSON.stringify(data);
        let listPath = path.join(getDataRoot(), fileName);

        await fp.writeFile(listPath, jsonStr, { encoding: "utf-8" });
    } catch (error) {
        throw new Error("保存列表数据时出现错误，请检查后重新执行：" + error);
    }
}

/**
 * 清除所有已经同步的数据
 */
async function clearAllData() {
    try {
        logger.debug("检查根目录状态：");
        // await checkDataPath();

        // 首先删除股票列表信息文件
        logger.info("清理股票列表数据...");
        let stockListPath = path.join(getDataRoot(), STOCKLIST_FILE);
        try {
            await fp.access(stockListPath, fs.constants.F_OK);
            try {
                await fp.unlink(stockListPath);
            } catch (error) {
                throw error;
            }
        } catch (error) {
            // 文件不存在，直接忽略
        }
        logger.info("清理股票列表数据完成");

        logger.info("清理指数列表数据...");
        let indexListPath = path.join(getDataRoot(), INDEXLIST_FILE);
        try {
            await fp.access(indexListPath, fs.constants.F_OK);
            try {
                await fp.unlink(indexListPath);
            } catch (error) {
                throw error;
            }
        } catch (error) {
            // 文件不存在，直接忽略
        }
        logger.info("清理指数列表数据完成");

        logger.info("清理股票历史数据...");
        // 下面删除股票历史数据目录
        let stockDailyHistoryPath = path.join(getDataRoot(), DATA_PATH.daily);
        try {
            await fp.access(stockDailyHistoryPath, fs.constants.F_OK);

            try {
                let fileList = await fp.readdir(stockDailyHistoryPath);
                logger.info(`共有${fileList.length}个历史数据文件待删除`);
                fileList.forEach(async (filePath) => {
                    // logger.log("to be remove: ", filePath)
                    await fp.unlink(path.join(stockDailyHistoryPath, filePath));
                });
            } catch (error) {
                throw error;
            }
        } catch (error) {
            // 没有目录
        }
        logger.info("清理股票历史数据完成");

        logger.info("清理股票信息数据...");
        // 下面删除股票历史数据目录
        let stockInfoPath = path.join(getDataRoot(), DATA_PATH.info);
        try {
            await fp.access(stockInfoPath, fs.constants.F_OK);

            try {
                let fileList = await fp.readdir(stockInfoPath);
                logger.info(`共有${fileList.length}个历史数据文件待删除`);
                fileList.forEach(async (filePath) => {
                    // logger.log("to be remove: ", filePath)
                    await fp.unlink(path.join(stockInfoPath, filePath));
                });
            } catch (error) {
                throw error;
            }
        } catch (error) {
            // 没有目录
        }
        logger.info("清理股票信息数据完成");

        logger.info("清理股票财务数据...");
        // 下面删除股票历史数据目录
        let stockFinPath = path.join(getDataRoot(), DATA_PATH.financial);
        try {
            await fp.access(stockFinPath, fs.constants.F_OK);

            try {
                let fileList = await fp.readdir(stockFinPath);
                logger.info(`共有${fileList.length}个历史数据文件待删除`);
                fileList.forEach(async (filePath) => {
                    // logger.log("to be remove: ", filePath)
                    await fp.unlink(path.join(stockFinPath, filePath));
                });
            } catch (error) {
                throw error;
            }
        } catch (error) {
            // 没有目录
        }
        logger.info("清理股票财务数据完成");
    } catch (error) {
        throw new Error("清除所有已经同步数据发生错误：" + error);
    }
}

export {
    clearAllData,
    updateData,
    updateStockInfoData,
    // updateStockDividendData,
    stockDataNames,
};
