/**
 * TODO:
 * 1. 数据结构（对应到本地或远程存储结构）
 * 本地数据以json格式保存，
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
    level: process.env.LOGGER || "info",
    prettyPrint: {
        levelFirst: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
        crlf: true,
    },
    prettifier: require("pino-pretty"),
});

const DATA_PATH_ROOT = ".wtda";
const DATA_PATH = {
    daily: "daily",
    info: "info",
    financial: "fin",
};
const STOCKLIST_FILE = "stock-list.json";
const INDEXLIST_FILE = "index-list.json";

function getDataRoot() {
    return path.join(os.homedir(), DATA_PATH_ROOT);
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

const stockDataNames = {
    // 日数据
    daily: "daily",
    // 复权因子
    adjustFactor: "adjustFactor",
    // 停复牌信息
    suspendInfo: "suspendInfo",
    // 基本面信息
    dailyBasic: "dailyBasic",
    // 个股资金流向
    moneyFlow: "moneyFlow",
    // // 指数
    // indexDailyBasic: "indexDailyBasic",
    // 指数日线
    indexDaily: "indexDaily",
    // 利润表
    income: "income",
    // 负债表
    balanceSheet: "balanceSheet",
    // 现金流
    cashFlow: "cashFlow",
    // 业绩预告
    forecast: "forecast",
    // 业绩快报
    express: "express",
    // 分红送股
    dividend: "dividend",
    // 财务指标数据
    financialIndicator: "financialIndicator",
    // 主营业务构成
    financialMainbiz: "financialMainbiz",
    // 财报披露日期
    disclosureDate: "disclosureDate",
    // 股权质押统计
    pledgeStat: "pledgeStat",
    // 股权质押明细
    pledgeDetail: "pledgeDetail",
    // 趋势
    trend: "trend",
};

const stockDataParams = {
    // 日数据
    daily: { name: "daily", path: DATA_PATH.daily, ext: "" },
    // 复权因子
    adjustFactor: { name: "adjustFactor", path: DATA_PATH.daily, ext: ".adj" },
    // 停复牌信息
    suspendInfo: { name: "suspendInfo", path: DATA_PATH.info, ext: ".sus" },
    // 基本面信息
    dailyBasic: { name: "dailyBasic", path: DATA_PATH.info, ext: ".bsc" },
    // 个股资金流向
    moneyFlow: { name: "moneyFlow", path: DATA_PATH.info, ext: ".mf" },
    // // 指数
    // indexDailyBasic: "indexDailyBasic",
    // 指数日线
    indexDaily: { name: "indexDaily", path: DATA_PATH.daily, ext: "" },
    // 利润表
    income: { name: "income", path: DATA_PATH.financial, ext: ".ic" },
    // 负债表
    balanceSheet: {
        name: "balanceSheet",
        path: DATA_PATH.financial,
        ext: ".bs",
    },
    // 现金流
    cashFlow: { name: "cashFlow", path: DATA_PATH.financial, ext: ".cf" },
    // 业绩预告
    forecast: { name: "forecast", path: DATA_PATH.financial, ext: ".fc" },
    // 业绩快报
    express: { name: "express", path: DATA_PATH.financial, ext: ".ep" },
    // 分红送股，这个数据不能使用通用方式
    dividend: { name: "dividend", path: DATA_PATH.financial, ext: ".dd" },
    // 财务指标数据
    financialIndicator: {
        name: "financialIndicator",
        path: DATA_PATH.financial,
        ext: ".id",
    },
    // 主营业务构成
    financialMainbiz: {
        name: "financialMainbiz",
        path: DATA_PATH.financial,
        ext: ".mb",
    },
    // 财报披露日期
    disclosureDate: {
        name: "disclosureDate",
        path: DATA_PATH.financial,
        ext: ".dt",
    },
    // 股权质押统计
    pledgeStat: { name: "pledgeStat", path: DATA_PATH.financial, ext: ".ps" },
    // 股权质押明细
    pledgeDetail: {
        name: "pledgeDetail",
        path: DATA_PATH.financial,
        ext: ".pd",
    },
    trend: {
        name: "trend",
        path: DATA_PATH.daily,
        ext: ".tr",
    },
};

async function readStockData(dataName, tsCode) {
    if (!stockDataNames[dataName]) {
        throw new Error("不支持的数据类型：" + dataName);
    }
    if (_.isEmpty(tsCode)) {
        throw new Error("未设置读取股票代码");
    }
    let retData = {
        updateTime: null,
        data: [],
        // 下面考虑放个字段说明
    };

    let params = stockDataParams[dataName];
    try {
        await checkDataPath();

        let dataFile = getStockDataFile(dataName, tsCode);
        logger.debug(
            `读取本地数据 ${tsCode}.${dataName}，参数配置 %o，文件 ${dataFile}`,
            params
        );
        try {
            retData = JSON.parse(await fp.readFile(dataFile, "utf-8"));
        } catch (error) {
            // 文件不存在，不考虑其它错误
            if (!(error && error.code === "ENOENT")) {
                logger.error(
                    `读取${tsCode}的${dataName}文件${dataFile}时发生错误：${error}, %o`,
                    error
                );
            } else {
                logger.debug(
                    `读取${tsCode}的${dataName}文件${dataFile}不存在，%o`,
                    error
                );
            }
            retData = { data: [] };
        }
    } catch (error) {
        logger.error(`从本地读取个股数据${dataName}时发生错误 ${error}`);
    }
    return retData;
}

function getStockDataFile(dataName, tsCode) {
    // logger.debug(`计算文件名：${dataName}, ${tsCode}`);
    let params = stockDataParams[dataName];
    // logger.debug("获取参数：%o", params);
    if (!params) {
        throw new Error("不支持的数据类型" + dataName);
    }
    if (_.isEmpty(tsCode)) {
        throw new Error("未设置读取股票代码");
    }
    return path.join(getDataRoot(), params.path, tsCode + params.ext + ".json");
}

async function checkDataPath() {
    let dataPath = getDataRoot();

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

    for (let key of Object.keys(DATA_PATH)) {
        let tmpPath = path.join(dataPath, DATA_PATH[key]);
        try {
            await fp.access(
                tmpPath,
                fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK
            );
        } catch (error) {
            logger.debug(`检查目录${DATA_PATH[key]}错误 ${error}`);
            await fp.mkdir(tmpPath, { recursive: true });
        }
    }
}

checkDataPath();

export {
    readStockData,
    readStockList,
    readStockIndexList,
    getDataRoot,
    getStockDataFile,
    DATA_PATH,
    STOCKLIST_FILE,
    INDEXLIST_FILE,
    stockDataNames,
};
