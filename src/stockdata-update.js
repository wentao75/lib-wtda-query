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
    // readStockList,
    // readStockIndexList,
    readStockDaily,
    readStockAdjustFactor,
    readStockDailyBasic,
    checkDataPath,
    getDataRoot,
    DAILYHISTORY_PATH,
    INFO_PATH,
    STOCKLIST_FILE,
    INDEXLIST_FILE,
} from "./stockdata-query";

// const os = require("os")
const path = require("path");
const fs = require("fs");
const fp = fs.promises;

const QUEUE_MAX = 20;
// const updateControl = new FlowControl(QUEUE_MAX, 0, "更新数据控制池");

/**
 * 数据更新，如果force为true，则需要将所有数据更新为最新（相当于全部重新读取）
 * @param {boolean} force 强制更新所有数据，表示忽略本地数据，重新获取全部历史数据
 * @param {boolean} includeStock 是否更新股票日线数据，默认不更新
 * @param {boolean} includeFactor 是否更新日线复权因子数据，默认不更新
 * @param {boolean} includeBasic 是否更新股票基本面资料，默认不更新
 * @param {boolean} includeIndex 是否更新指数日线，默认不更新
 */
async function updateData(
    force = false,
    includeStock = false,
    includeFactor = false,
    includeBasic = false,
    includeIndex = false,
    all = false
) {
    let now = moment();
    // let endDate = now.format("YYYYMMDD")

    logger.info("获取和更新股票列表数据 ...");
    logger.debug(
        `参数：强制更新 ${force}, 全部更新 ${all}，更新股票日线 ${includeStock}, 更新指数日线 ${includeIndex}`
    );
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

    // logger.debug("开始请求指数数据：")
    let allIndexData = await Promise.all(
        tushare.indexMarketList.map(async (market) => {
            return tushare.indexBasic(market.code);
            // logger.debug("返回指数基础数据：", indexBasicData)
            // return indexBasicData
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

    if (all || includeStock) {
        logger.info("开始更新股票日线数据...");
        // 这里直接采用Promise的方式
        if (_.isArray(stockBasicData) && stockBasicData.length > 0) {
            let tasks = stockBasicData.map((item) => {
                return {
                    caller: updateDailyData,
                    args: [item.ts_code, force, "S"],
                };
            });

            let workers = executeTasks(tasks, 20, "股票日线更新任务");

            try {
                logger.debug("等待股票日线更新队列完成...");
                await Promise.all(workers);
                logger.debug("股票日线更新队列全部执行完毕！");
            } catch (error) {
                logger.error(`股票日线任务执行 错误！${error}`);
            }
        }
        logger.info(tushare.showInfo());
        logger.info("股票日线数据更新完毕!");
    }

    if (all || includeFactor) {
        logger.info("开始更新股票复权因子数据...");
        // 这里直接采用Promise的方式
        if (_.isArray(stockBasicData) && stockBasicData.length > 0) {
            let tasks = stockBasicData.map((item) => {
                return {
                    caller: updateAdjustFactorData,
                    args: [item.ts_code, force],
                };
            });
            let workers = executeTasks(tasks, 20, "股票复权因子更新任务");
            try {
                logger.debug("等待股票日线复权因子更新队列完成...");
                await Promise.all(workers);
                logger.debug("股票日线复权因子更新队列全部执行完毕！");
            } catch (error) {
                logger.error(`股票日线复权因子任务执行 错误！${error}`);
            }
        }

        logger.info(tushare.showInfo());
        logger.info("股票复权因子数据更新完毕!");
    }

    if (all || includeBasic) {
        logger.info("开始更新基本面数据...");
        // 这里直接采用Promise的方式
        if (_.isArray(stockBasicData) && stockBasicData.length > 0) {
            let tasks = stockBasicData.map((item) => {
                return {
                    caller: updateDailyBasicData,
                    args: [item.ts_code, force],
                };
            });
            let workers = executeTasks(tasks, 20, "基本面更新任务");
            try {
                logger.debug("等待基本面数据更新队列完成...");
                await Promise.all(workers);
                logger.debug("基本面数据更新队列全部执行完毕！");
            } catch (error) {
                logger.error(`股票基本面更新任务执行 错误！${error}`);
            }
        }

        logger.info(tushare.showInfo());
        logger.info("股票基本面数据更新完毕!");
    }

    // For test
    // let tmp = stockBasicData[0]
    // await updateDailyData(tmp, force
    if (all || includeIndex) {
        logger.info("指数日线数据更新开始 ...");
        if (_.isArray(indexList.data) && indexList.data.length > 0) {
            // indexList.data.forEach((data) => {
            //     updateControl.call(updateDailyData, data.ts_code, force, "I");
            // });
            let tasks = indexList.data.map((data) => {
                return {
                    caller: updateDailyData,
                    args: [data.ts_code, force, "I"],
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

            logger.info(tushare.showInfo());
            logger.info("指数日线数据更新完毕！");
        }
    }

    // logger.log(tushare.showInfo());
}

/**
 * 更新指定代码的日历史数据
 * @param {string} tsCode 代码
 * @param {boolean} force 是否强制更新
 * @param {string} type 股票类型，S表示普通股票，I表示指数
 */
async function updateDailyData(tsCode, force = false, type = "S") {
    // logger.log("更新日线：", tsCode, force)
    if (_.isEmpty(tsCode)) {
        return { data: [] };
    }
    if (type !== "S" && type !== "I") {
        return { data: [] };
    }

    // let tsCode = data.ts_code
    // logger.log("执行更新日线：", tsCode, force)
    let dailyData;
    try {
        if (force) {
            logger.debug(`force update ${tsCode}`);
            let data;
            if (type === "S") {
                data = await tushare.stockDaily(tsCode);
            } else {
                data = await tushare.indexDaily(tsCode);
            }
            dailyData = {
                updateTime: moment().toISOString(),
                data,
            };
            logger.info(
                `日线数据强制更新，代码 ${tsCode}, 更新时间：${
                    dailyData.updateTime
                }, 总条数：${dailyData.data && dailyData.data.length}`
            );
        } else {
            dailyData = await readStockDaily(tsCode);

            let startDate = "";
            if (dailyData.data && dailyData.data.length > 0) {
                let lastDate = dailyData.data[0].trade_date;
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

            let newData;
            if (type === "S") {
                newData = await tushare.stockDaily(tsCode, startDate);
            } else {
                newData = await tushare.indexDaily(tsCode, startDate);
            }
            if (newData && newData.length > 0) {
                dailyData.updateTime = moment().toISOString();
                dailyData.data.unshift(...newData);
                logger.info(
                    `日线数据更新，代码 ${tsCode}, 更新时间：${
                        dailyData.updateTime
                    }, 更新条数：${newData && newData.length}，总条数：${
                        dailyData.data && dailyData.data.length
                    }`
                );
            } else {
                dailyData = null;
                logger.info(`日线数据没有更新，代码 ${tsCode}`);
            }
        }
    } catch (error) {
        logger.error(`${tsCode} 日线数据更新时发生错误，${error}`);
        throw error;
    }

    try {
        if (dailyData) {
            await checkDataPath();

            let jsonStr = JSON.stringify(dailyData);
            let stockDailyFile = path.join(
                getDataRoot(),
                DAILYHISTORY_PATH,
                tsCode + ".json"
            );
            await fp.writeFile(stockDailyFile, jsonStr, "utf-8");
        }
    } catch (error) {
        throw new Error(
            "保存日线历史数据时出现错误，请检查后重新执行：" +
                tsCode +
                "," +
                error
        );
    }
}

/**
 * 更新指定代码的复权因子历史数据
 * @param {string} tsCode 代码
 * @param {boolean} force 是否强制更新
 */
async function updateAdjustFactorData(tsCode, force = false) {
    // logger.log("更新日线：", tsCode, force)
    if (_.isEmpty(tsCode)) {
        return { data: [] };
    }

    // let tsCode = data.ts_code
    // logger.log("执行更新日线：", tsCode, force)
    let adjData;
    try {
        if (force) {
            logger.debug(`force update ${tsCode}`);
            adjData = {
                updateTime: moment().toISOString(),
                data: await tushare.adjustFactor(tsCode),
            };

            logger.info(
                `股票复权因子数据强制更新，代码 ${tsCode}, 总条数：${
                    adjData.data && adjData.data.length
                }`
            );
        } else {
            adjData = await readStockAdjustFactor(tsCode);

            let startDate = "";
            if (adjData.data && adjData.data.length > 0) {
                let lastDate = adjData.data[0].trade_date;
                startDate = moment(lastDate, "YYYYMMDD")
                    .add(1, "days")
                    .format("YYYYMMDD");
                let now = moment();
                if (now.diff(startDate, "days") <= 0 && now.hours() < 15) {
                    // 还没有最新一天的数据，不需要
                    logger.debug(`没有新的复权因子数据，不需要更新 ${tsCode}`);
                    return;
                }
            }

            let newAdjData = await tushare.adjustFactor(tsCode, startDate);
            logger.debug(
                `${tsCode} 复权因子数据返回：${newAdjData && newAdjData.length}`
            );
            if (newAdjData && newAdjData.length > 0) {
                adjData.updateTime = moment().toISOString();
                adjData.data.unshift(...newAdjData);
                logger.info(
                    `日线复权因子数据更新，代码 ${tsCode}, 更新条数：${
                        newAdjData && newAdjData.length
                    }，总条数：${adjData.data && adjData.data.length}`
                );
            } else {
                adjData = null;
                logger.info(`日线复权因子数据没有更新，代码 ${tsCode}`);
                return;
            }
        }
    } catch (error) {
        logger.error(`${tsCode} 日线复权因子数据更新时发生错误，${error}`);
        throw error;
    }

    try {
        if (adjData && adjData.data && adjData.data.length > 0) {
            let jsonStr = JSON.stringify(adjData);
            let adjFile = path.join(
                getDataRoot(),
                DAILYHISTORY_PATH,
                tsCode + ".adj.json"
            );
            await fp.writeFile(adjFile, jsonStr, "utf-8");
        }
    } catch (error) {
        throw new Error(
            "保存复权因子数据时出现错误，请检查后重新执行：" +
                tsCode +
                "," +
                error
        );
    }
}

async function updateDailyBasicData(tsCode, force = false) {
    if (_.isEmpty(tsCode)) {
        return { data: [] };
    }

    let adjData;
    try {
        if (force) {
            logger.debug(`force update ${tsCode}`);
            adjData = {
                updateTime: moment().toISOString(),
                data: await tushare.dailyBasic(tsCode),
            };

            logger.info(
                `股票基本面数据强制更新，代码 ${tsCode}, 总条数：${
                    adjData.data && adjData.data.length
                }`
            );
        } else {
            adjData = await readStockDailyBasic(tsCode);

            let startDate = "";
            if (adjData && adjData.data && adjData.data.length > 0) {
                let lastDate = adjData.data[0].trade_date;
                startDate = moment(lastDate, "YYYYMMDD")
                    .add(1, "days")
                    .format("YYYYMMDD");
                let now = moment();
                if (now.diff(startDate, "days") <= 0 && now.hours() < 15) {
                    // 还没有最新一天的数据，不需要
                    logger.debug(
                        `没有新的股票基本面数据，不需要更新 ${tsCode}`
                    );
                    return;
                }
            }

            let newData = await tushare.dailyBasic(tsCode, startDate);
            logger.debug(
                `${tsCode} 基本面数据返回：${newData && newData.length}`
            );
            if (newData && newData.length > 0) {
                adjData.updateTime = moment().toISOString();
                adjData.data.unshift(...newData);
                logger.info(
                    `基本面数据更新，代码 ${tsCode}, 更新条数：${
                        newData && newData.length
                    }，总条数：${adjData.data && adjData.data.length}`
                );
            } else {
                adjData = null;
                logger.info(`基本面数据没有更新，代码 ${tsCode}`);
                return;
            }
        }
    } catch (error) {
        logger.error(`${tsCode} 基本面数据更新时发生错误，${error}`);
        throw error;
    }

    try {
        if (adjData && adjData.data && adjData.data.length > 0) {
            let jsonStr = JSON.stringify(adjData);
            let adjFile = path.join(
                getDataRoot(),
                INFO_PATH,
                tsCode + ".basic.json"
            );
            await fp.writeFile(adjFile, jsonStr, "utf-8");
        }
    } catch (error) {
        throw new Error(
            "保存基本面数据时出现错误，请检查后重新执行：" +
                tsCode +
                "," +
                error
        );
    }
}

/**
 * 通过日期将复权因子数据合并到日线数据中，可以在后续的使用中直接使用
 * @param {Array} dailyData 日线数据
 * @param {Array} adjData 复权因子数据
 */
async function combineAdjustFactors(dailyData, adjData) {
    // let retData = [];
    if (dailyData && dailyData.length > 0) {
        dailyData = dailyData.map((daily) => {
            let findIndex = adjData.findIndex((adj, j) => {
                return adj.trade_date === daily.trade_date;
            });
            if (findIndex >= 0 && findIndex < dailyData.length) {
                let adj = adjData.splice(findIndex, 1)[0];
                daily.adj_factor = adj.adj_factor;
                // logger.debug(
                //     `找到${daily.trade_date} 复权因子 ${adj.adj_factor}, %o`,
                //     adj
                // );
            } else {
                logger.debug(`没有找到${daily.trade_date}的复权因子`);
            }
            return daily;
        });
    }
    return [dailyData, adjData];
}

// async function saveStockList(data) {
//     try {
//         await checkDataPath()

//         let jsonStr = JSON.stringify(data)
//         let stockListPath = path.join(getDataRoot(), STOCKLIST_FILE)

//         await fp.writeFile(stockListPath, jsonStr, {encoding: "utf-8"})
//     } catch (error) {
//         throw new Error("保存股票列表数据时出现错误，请检查后重新执行：" + error)
//     }
// }

async function saveListFile(data, fileName) {
    try {
        await checkDataPath();

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
        await checkDataPath();

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
        let stockDailyHistoryPath = path.join(getDataRoot(), DAILYHISTORY_PATH);
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
    } catch (error) {
        throw new Error("清除所有已经同步数据发生错误：" + error);
    }
}

export {
    clearAllData,
    updateData,
    updateDailyData,
    updateAdjustFactorData,
    updateDailyBasicData,
};
