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

const os = require("os");
const path = require("path");
const fs = require("fs");
const fp = fs.promises;

const pino = require("pino");

const logger = pino({
    // level: ,
    prettyPrint: {
        levelFirst: true,
        translateTime: "SYS:standard",
        crlf: true,
    },
    prettifier: require("pino-pretty"),
});

if (process.env.LOGGER) {
    logger.level = process.env.LOGGER;
}

const DATA_ROOT = ".wtda";
const DAILYHISTORY_PATH = "daily";
const STOCKLIST_FILE = "stock-list.json";
const INDEXLIST_FILE = "index-list.json";

function getDataRoot() {
    return path.join(os.homedir(), DATA_ROOT);
}

/**
 * 读取目前可用的完整股票列表返回，返回数据为对象
 * {
 *    info: {
 *      updateTime,
 *      ...
 *    }
 *    data: stockList[]
 * }
 *
 * stockList: [{
 *    ts_code,
 *    symbol,
 *    name,
 *    area,
 *    industry,
 *    fullname,
 *    enname,
 *    market,
 *    exchange,
 *    curr_type,
 *    list_status,
 *    delist_date,
 *    is_hs
 * }]
 *
 */
async function readStockList() {
    let retData = null;
    try {
        await checkDataPath();

        // 首先从目录中读取对应的列表文件，然后根据文件当中的信息决定是否需要更新
        let stockListPath = path.join(getDataRoot(), STOCKLIST_FILE);
        retData = JSON.parse(await fp.readFile(stockListPath, "utf-8"));
        if (!_.isEmpty(retData)) {
            logger.debug(`股票列表更新时间 @${retData.updateTime}`);
        }
    } catch (error) {
        logger.error(`读取股票列表数据错误：${error}`);
        throw new Error(
            "读取股票列表过程中出现错误，请检查后重新运行：" + error
        );
        // retData = null
    }

    if (_.isEmpty(retData)) {
        // 读取数据不存在
        return {
            updateTime: "",
            data: [],
        };
    }
    return retData;
}

async function readStockIndexList() {
    let retData = null;
    try {
        await checkDataPath();

        // 首先从目录中读取对应的列表文件，然后根据文件当中的信息决定是否需要更新
        let stockIndexListPath = path.join(getDataRoot(), INDEXLIST_FILE);
        retData = JSON.parse(await fp.readFile(stockIndexListPath, "utf-8"));
        if (!_.isEmpty(retData)) {
            logger.debug(`指数列表更新时间 @${retData.updateTime}`);
        }
    } catch (error) {
        logger.error(`读取指数列表数据错误：${error}`);
        throw new Error(
            "读取指数列表过程中出现错误，请检查后重新运行：" + error
        );
        // retData = null
    }

    if (_.isEmpty(retData)) {
        // 读取数据不存在
        return {
            updateTime: "",
            data: [],
        };
    }
    return retData;
}

async function readStockDaily(tsCode) {
    if (_.isEmpty(tsCode)) {
        throw new Error("未设置读取股票代码");
    }
    let dailyData = {
        updateTime: null,
        data: [],
    };
    try {
        await checkDataPath();

        let stockDailyHistoryFile = path.join(
            getDataRoot(),
            DAILYHISTORY_PATH,
            tsCode + ".json"
        );
        try {
            // await fp.access(stockDailyHistoryFile, fs.constants.F_OK)
            dailyData = JSON.parse(
                await fp.readFile(stockDailyHistoryFile, "utf-8")
            );
        } catch (error) {
            // logger.debug("读取本地日线数据错误", error)
            // 文件不存在，不考虑其它错误
            dailyData = { data: [] };
        }
    } catch (error) {
        logger.error(`从本地读取日线数据时发生错误 ${error}`);
    }
    return dailyData;
}

async function readStockAdjustFactor(tsCode) {
    if (_.isEmpty(tsCode)) {
        throw new Error("未设置读取股票代码");
    }
    let adjData = [];
    try {
        await checkDataPath();

        let stockAdjFile = path.join(
            getDataRoot(),
            DAILYHISTORY_PATH,
            tsCode + ".adj.json"
        );
        try {
            adjData = JSON.parse(await fp.readFile(stockAdjFile, "utf-8"));
        } catch (error) {
            logger.debug(`读取股票复权因子文件${stockAdjFile} 错误：${error}`);
            adjData = [];
        }
    } catch (error) {
        logger.error(`从本地读取日线复权因子数据时发生错误 ${error}`);
    }
    return adjData;
}

async function checkDataPath() {
    let dataPath = getDataRoot(); // path.join(os.homedir, DATA_ROOT)

    // 做基础的目录访问检查
    try {
        await fp.access(
            dataPath,
            fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK
        );
    } catch (error) {
        logger.debug(`检查数据根目录错误 ${error}`);
        await fp.mkdir(dataPath, { recursive: true });
    }

    let dailyPath = path.join(dataPath, DAILYHISTORY_PATH);
    try {
        await fp.access(
            dailyPath,
            fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK
        );
    } catch (error) {
        logger.debug(`检查日线历史目录错误 ${error}`);
        await fp.mkdir(dailyPath, { recursive: true });
    }
}

export {
    readStockList,
    readStockIndexList,
    readStockDaily,
    readStockAdjustFactor,
    checkDataPath,
    getDataRoot,
    DATA_ROOT,
    DAILYHISTORY_PATH,
    STOCKLIST_FILE,
    INDEXLIST_FILE,
};
