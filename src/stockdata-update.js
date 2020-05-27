/**
 * 股票数据获取和更新
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
    readStockList,
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

    await saveStockDataFile(stockData, dataName, tsCode);
}

async function saveStockDataFile(stockData, dataName, tsCode) {
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

/**
 * 根据股票列表和当前原始日线及复权因子数据合并完整的日线数据
 */
async function calculateAllDailyData() {
    let stockList = await readStockList();
    if (!stockList || !stockList.data) {
        logger.error(`没有读取到股票列表，无法处理日线数据`);
        return;
    }

    let dailyDataTasks = stockList.data.map((data) => {
        return {
            caller: calculateDailyData,
            args: [data.ts_code],
        };
    });

    if (dailyDataTasks && dailyDataTasks.length > 0) {
        let workers = executeTasks(dailyDataTasks, 30, "日线数据合并");
        try {
            await Promise.all(workers);
        } catch (error) {
            logger.error(`日线数据合并任务执行发生未知异常：${error}`);
        }
    }
}

async function calculateDailyData(tsCode) {
    if (_.isEmpty(tsCode)) return;
    let dailyData = await readStockData(stockDataNames.daily, tsCode);
    logger.debug(`日线${tsCode}读取到${dailyData.data.length}条数据`);
    let adjData = await readStockData(stockDataNames.adjustFactor, tsCode);
    logger.debug(`复权因子${tsCode}读取到${adjData.data.length}条数据`);

    let latestAdj =
        adjData && adjData.data && adjData.data.length > 0
            ? adjData.data[0].adj_factor
            : 1;
    logger.debug(`${tsCode}最新复权因子: ${latestAdj}`);

    if (dailyData && dailyData.data && dailyData.data.length > 0) {
        dailyData.data = dailyData.data.map((daily) => {
            // 日线数据中需要放入对应日期的复权因子和前复权因子=复权因子/最新复权因子
            let dates = adjData.data.filter((adj) => {
                return adj.trade_date === daily.trade_date;
            });
            logger.debug(`${daily.trade_date}, 寻找到adj：%o`, dates);
            if (dates && dates.length > 0) {
                daily.adj_factor = dates[0].adj_factor;
                daily.prevadj_factor = dates[0].adj_factor / latestAdj;
            }
            return daily;
        });
    }

    await saveStockDataFile(dailyData, stockDataNames.daily, tsCode);
    logger.info(`${tsCode}日线数据合并完成！`);
}

function calculatePrevAdjPrice(dailyData) {
    if (dailyData && dailyData.data && dailyData.data.length > 0) {
        dailyData.data.forEach((item) => {
            if (item.prevadj_factor) {
                item.open *= item.prevadj_factor;
                item.close *= item.prevadj_factor;
                item.high *= item.prevadj_factor;
                item.low *= item.prevadj_factor;
                item.prev_close *= item.prevadj_factor;
                item.change *= item.prevadj_factor;
            }
        });
    }
}

// 这里的data数据应该是原始数据
// 这里要求的数据顺序是按照日期降序的，即0放的是最新的时间
function removeIncludedData(data) {
    let ret = [];
    if (!(data && Array.isArray(data))) return ret;
    if (data.length <= 0) return ret;

    let index = data.length - 1;
    let item = data[index];

    let currentIndex = index - 1;
    while (currentIndex >= 0) {
        let currentItem = data[currentIndex];
        if (currentItem) {
            if (currentItem.high <= item.high && currentItem.low >= item.low) {
                // 内移日 这一天数据去除，也不需要和后续比较
            } else {
                // 非内移日
                let tmp = [currentItem.trade_date, null, 0, currentItem];
                ret.push(tmp);
                index = currentIndex;
                item = currentItem;
            }
            currentIndex = currentIndex - 1;
        }
    }
    return ret;
}

/**
 * 从当前日线数据序列中计算下一级趋势点
 * 如果是第一级查找，则需要已经做好内移日去除
 * @param {Array} data 日线数据，去除内移日的原始日线数据或者某一级趋势点数据
 */
function calculateNextTrendPoints(data) {
    let findPoints = [];
    // let nextType = 0
    // 这里考虑使用forEach是否并行过多？
    //data.forEach((item, index, array) => {
    for (let index = 2; index < data.length - 2; index++) {
        let item = data[index];
        //if (index <= 1 || index >= array.length - 2) return;
        let tmp = null;
        let lastPoint =
            findPoints.length > 0 ? findPoints[findPoints.length - 1] : null;
        let lastType = lastPoint !== null ? lastPoint[2] : 0;
        // findPoints.length > 0 ? findPoints[findPoints.length - 1][2] : 0

        if (
            (item[2] === 0 &&
                item[3].high >= data[index - 1][3].high &&
                item[3].high >= data[index + 1][3].high) ||
            (item[2] === 1 &&
                item[1] >= data[index - 2][1] &&
                item[1] >= data[index + 2][1])
        ) {
            // 发现高点
            tmp = [item[0], item[3].high, 1, item[3]];
            logger.debug(`找到高点，序号${index}, %o`, item);
            if (lastType === 1) {
                logger.debug(
                    `前一个点也是高点：, 当前序号${index}, 当前点：%o, 上一个点：%o`,
                    tmp,
                    lastPoint
                );
                if (lastPoint[1] < tmp[1]) {
                    // 之前的高点比当前高点低，说明中间没有低点，替换之前的高点
                    logger.debug("当前点价格更高，替换前一个点！");
                    findPoints[findPoints.length - 1] = tmp;
                } else {
                    logger.debug("之前的高点比当前点高，忽略这次发现的高点");
                }
                tmp = null;
            }
        }
        if (
            (item[2] === 0 &&
                item[3].low <= data[index - 1][3].low &&
                item[3].low <= data[index + 1][3].low) ||
            (item[2] === -1 &&
                item[1] <= data[index - 2][1] &&
                item[1] <= data[index + 2][1])
        ) {
            // 发现低点
            tmp = [item[0], item[3].low, -1, item[3]];
            logger.debug(`发现低点，序号${index}, %o`, item);
            if (lastType === -1) {
                logger.debug(
                    `前一个点也是低点，当前序号${index}, 当前点：%o, 上一个点：%o`,
                    tmp,
                    lastPoint
                );
                if (lastPoint[1] > tmp[1]) {
                    logger.debug("当前点比上一个点价格更低，替换上一个点！");
                    findPoints[findPoints.length - 1] = tmp;
                } else {
                    logger.debug(
                        "当前点比上一个点价格高，忽略这次发现的低点！"
                    );
                }
                tmp = null;
            }
        }
        if (tmp !== null) {
            //logger.debug("push trend point:", tmp);
            findPoints.push(tmp);
        }
    }
    return findPoints;
}

/**
 * 根据当前数据计算日短期趋势
 * data输入为原始数据，在做短期高点和低点前，先去除内移交易日
 */
async function calculateTrendPoints(tsCode) {
    if (_.isEmpty(tsCode)) return;
    let dailyData = await readStockData(stockDataNames.daily, tsCode);

    logger.debug(
        `去除内移交易日..., ${
            dailyData && dailyData.data && dailyData.data.length
        }`
    );
    let indata = removeIncludedData(dailyData.data);
    dailyData.data = null;
    dailyData = null;
    let trendPoints = [];

    // 从基础数据循环3次，分别获得短期，中期和长期趋势
    for (let i = 0; i < 3; i++) {
        indata = calculateNextTrendPoints(indata);
        trendPoints[i] = indata;
        logger.debug(`趋势等级: ${i}, 趋势点数量 ${trendPoints[i].length}`);
    }

    logger.info(`${tsCode}趋势数据计算完毕！`);

    try {
        let stockData = {
            updateTime: moment().toISOString(),
            ts_code: tsCode,
            data: trendPoints,
        };
        let dataName = "trend";

        // if (stockData && stockData.data && stockData.data.length > 0) {
        // await checkDataPath();
        let jsonStr = JSON.stringify(stockData);
        let stockDataFile = getStockDataFile(dataName, tsCode);
        await fp.writeFile(stockDataFile, jsonStr, "utf-8");
        // }
        logger.info(
            `个股${tsCode}趋势数据保存：${stockDataFile}, 短期：${
                trendPoints && trendPoints[0].length
            }，中期：${trendPoints && trendPoints[1].length}，长期：${
                trendPoints && trendPoints[2].length
            }`
        );
    } catch (error) {
        throw new Error(
            `保存个股${tsCode}数据${dataName}时出现错误，请检查后重新执行：${error}`
        );
    }
    indata = null;

    // return trendPoints;
}

/**
 * TODO: 需要使用前复权方式计算趋势点，目前的计算用的原始数据，对于实际股票交易盈亏而言不正确
 */
async function calculateAllTrendPoints() {
    logger.info("内存使用：%o", process.memoryUsage());
    let stockList = await readStockList();
    if (!stockList || !stockList.data) {
        logger.error(`没有读取到股票列表，无法处理日线数据`);
        return;
    }

    logger.info("内存使用：%o", process.memoryUsage());
    let dailyDataTasks = stockList.data.map((data) => {
        return {
            caller: calculateTrendPoints,
            args: [data.ts_code],
        };
    });

    logger.info("内存使用：%o", process.memoryUsage());
    if (dailyDataTasks && dailyDataTasks.length > 0) {
        let workers = executeTasks(dailyDataTasks, 20, "趋势数据计算");
        try {
            await Promise.all(workers);
        } catch (error) {
            logger.error(`趋势数据合并任务执行发生未知异常：${error}`);
        }
        workers = null;
    }
    logger.info(`趋势数据全部计算完毕！`);
    logger.info("内存使用：%o", process.memoryUsage());
}

export {
    clearAllData,
    updateData,
    updateStockInfoData,
    // updateStockDividendData,
    calculateAllDailyData,
    calculateDailyData,
    calculateAllTrendPoints,
    calculateTrendPoints,
    stockDataNames,
};
