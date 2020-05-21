(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global['@wt/lib-wtda'] = {}));
}(this, (function (exports) { 'use strict';

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
      level: process.env.LOGGER || "info",
      prettyPrint: {
        levelFirst: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
        crlf: true
      },
      prettifier: require("pino-pretty")
    });
    const DATA_PATH_ROOT = ".wtda";
    const DATA_PATH = {
      daily: "daily",
      info: "info",
      financial: "fin"
    }; // const DAILYHISTORY_PATH = "daily";
    // const INFO_PATH = "info";

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
        await checkDataPath(); // 首先从目录中读取对应的列表文件，然后根据文件当中的信息决定是否需要更新

        let stockListPath = path.join(getDataRoot(), STOCKLIST_FILE);
        retData = JSON.parse(await fp.readFile(stockListPath, "utf-8"));

        if (!_.isEmpty(retData)) {
          logger.debug(`股票列表更新时间 @${retData.updateTime}`);
        }
      } catch (error) {
        logger.error(`读取股票列表数据错误：${error}`);
        throw new Error("读取股票列表过程中出现错误，请检查后重新运行：" + error); // retData = null
      }

      if (_.isEmpty(retData)) {
        // 读取数据不存在
        return {
          updateTime: "",
          data: []
        };
      }

      return retData;
    }

    async function readStockIndexList() {
      let retData = null;

      try {
        await checkDataPath(); // 首先从目录中读取对应的列表文件，然后根据文件当中的信息决定是否需要更新

        let stockIndexListPath = path.join(getDataRoot(), INDEXLIST_FILE);
        retData = JSON.parse(await fp.readFile(stockIndexListPath, "utf-8"));

        if (!_.isEmpty(retData)) {
          logger.debug(`指数列表更新时间 @${retData.updateTime}`);
        }
      } catch (error) {
        logger.error(`读取指数列表数据错误：${error}`);
        throw new Error("读取指数列表过程中出现错误，请检查后重新运行：" + error); // retData = null
      }

      if (_.isEmpty(retData)) {
        // 读取数据不存在
        return {
          updateTime: "",
          data: []
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
      disclosureDate: "disclosureDate"
    };
    const stockDataParams = {
      // 日数据
      daily: {
        name: "daily",
        path: DATA_PATH.daily,
        ext: ""
      },
      // 复权因子
      adjustFactor: {
        name: "adjustFactor",
        path: DATA_PATH.daily,
        ext: ".adj"
      },
      // 停复牌信息
      suspendInfo: {
        name: "suspendInfo",
        path: DATA_PATH.info,
        ext: ".sus"
      },
      // 基本面信息
      dailyBasic: {
        name: "dailyBasic",
        path: DATA_PATH.info,
        ext: ".bsc"
      },
      // 个股资金流向
      moneyFlow: {
        name: "moneyFlow",
        path: DATA_PATH.info,
        ext: ".mf"
      },
      // // 指数
      // indexDailyBasic: "indexDailyBasic",
      // 指数日线
      indexDaily: {
        name: "indexDaily",
        path: DATA_PATH.daily,
        ext: ""
      },
      // 利润表
      income: {
        name: "income",
        path: DATA_PATH.financial,
        ext: ".ic"
      },
      // 负债表
      balanceSheet: {
        name: "balanceSheet",
        path: DATA_PATH.financial,
        ext: ".bs"
      },
      // 现金流
      cashFlow: {
        name: "cashFlow",
        path: DATA_PATH.financial,
        ext: ".cf"
      },
      // 业绩预告
      forecast: {
        name: "forecast",
        path: DATA_PATH.financial,
        ext: ".fc"
      },
      // 业绩快报
      express: {
        name: "express",
        path: DATA_PATH.financial,
        ext: ".ep"
      },
      // 分红送股
      dividend: {
        name: "dividend",
        path: DATA_PATH.financial,
        ext: ".dd"
      },
      // 财务指标数据
      financialIndicator: {
        name: "financialIndicator",
        path: DATA_PATH.financial,
        ext: ".id"
      },
      // 主营业务构成
      financialMainbiz: {
        name: "financialMainbiz",
        path: DATA_PATH.financial,
        ext: ".mb"
      },
      // 财报披露日期
      disclosureDate: {
        name: "disclosureDate",
        path: DATA_PATH.financial,
        ext: ".dt"
      }
    };

    async function getStockDataFile(dataName, tsCode) {
      // logger.debug(`计算文件名：${dataName}, ${tsCode}`);
      let params = stockDataParams[dataName]; // logger.debug("获取参数：%o", params);

      if (!params) {
        throw new Error("不支持的数据类型" + dataName);
      }

      if (_.isEmpty(tsCode)) {
        throw new Error("未设置读取股票代码");
      }

      return path.join(getDataRoot(), params.path, tsCode + params.ext + ".json");
    }

    async function readStockDaily(tsCode) {
      if (_.isEmpty(tsCode)) {
        throw new Error("未设置读取股票代码");
      }

      let dailyData = {
        updateTime: null,
        data: []
      };

      try {
        await checkDataPath();
        let stockDailyHistoryFile = path.join(getDataRoot(), DATA_PATH.daily, tsCode + ".json");

        try {
          // await fp.access(stockDailyHistoryFile, fs.constants.F_OK)
          dailyData = JSON.parse(await fp.readFile(stockDailyHistoryFile, "utf-8"));
        } catch (error) {
          // logger.debug("读取本地日线数据错误", error)
          // 文件不存在，不考虑其它错误
          dailyData = {
            data: []
          };
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

      let adjData = {
        updateTime: null,
        data: []
      };

      try {
        await checkDataPath();
        let stockAdjFile = path.join(getDataRoot(), DATA_PATH.daily, tsCode + ".adj.json");

        try {
          adjData = JSON.parse(await fp.readFile(stockAdjFile, "utf-8"));
        } catch (error) {
          logger.debug(`读取股票复权因子文件${stockAdjFile} 错误：${error}`);
          adjData = {
            updateTime: null,
            data: []
          };
        }
      } catch (error) {
        logger.error(`从本地读取日线复权因子数据时发生错误 ${error}`);
      }

      return adjData;
    }

    async function readStockDailyBasic(tsCode) {
      if (_.isEmpty(tsCode)) {
        throw new Error("未设置读取股票代码");
      }

      let basicData = {
        updateTime: null,
        data: []
      };

      try {
        await checkDataPath();
        let stockBasicFile = path.join(getDataRoot(), DATA_PATH.info, tsCode + ".info.json");

        try {
          basicData = JSON.parse(await fp.readFile(stockBasicFile, "utf-8"));
        } catch (error) {
          logger.debug(`读取基本面文件${stockBasicFile} 错误：${error}`);
          basicData = {
            updateTime: null,
            data: []
          };
        }
      } catch (error) {
        logger.error(`从本地读取基本面数据时发生错误 ${error}`);
      }

      return basicData;
    }

    async function checkDataPath() {
      let dataPath = getDataRoot(); // 做基础的目录访问检查

      try {
        await fp.access(dataPath, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK);
      } catch (error) {
        logger.debug(`检查数据根目录错误 ${error}`);
        await fp.mkdir(dataPath, {
          recursive: true
        });
      }

      for (let key of Object.keys(DATA_PATH)) {
        let tmpPath = path.join(dataPath, DATA_PATH[key]);

        try {
          await fp.access(tmpPath, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK);
        } catch (error) {
          logger.debug(`检查目录${DATA_PATH[key]}错误 ${error}`);
          await fp.mkdir(tmpPath, {
            recursive: true
          });
        }
      } // let dailyPath = path.join(dataPath, DATA_PATH.daily);
      // try {
      //     await fp.access(
      //         dailyPath,
      //         fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK
      //     );
      // } catch (error) {
      //     logger.debug(`检查日线历史目录错误 ${error}`);
      //     await fp.mkdir(dailyPath, { recursive: true });
      // }
      // let infoPath = path.join(dataPath, DATA_PATH.info);
      // try {
      //     await fp.access(
      //         infoPath,
      //         fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK
      //     );
      // } catch (error) {
      //     logger.debug(`检查信息数据目录错误 ${error}`);
      //     await fp.mkdir(infoPath, { recursive: true });
      // }

    }

    /**
     * TODO:
     * 1. 数据结构（对应到本地或远程存储结构）
     *
     *
     * 股票数据访问层，主要用于计算和一些处理
     * 1. 后续会将数据的远程访问，本地访问在这里集成
     * 2.
     */
    const _$1 = require("lodash");

    const moment = require("moment");

    const executeTasks = require("@wt/lib-taskqueue");

    const tushare = require("@wt/lib-tushare");

    const pino$1 = require("pino");

    const logger$1 = pino$1({
      level: process.env.LOGGER || "info",
      prettyPrint: {
        levelFirst: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
        crlf: true
      },
      prettifier: require("pino-pretty")
    });

    const path$1 = require("path");

    const fs$1 = require("fs");

    const fp$1 = fs$1.promises;

    /**
     * 更新个股信息数据，包括个股的日数据，基本面，复权因子，财务相关的各种数据；
     *
     * @param {string} dataName 数据名称
     * @param {string} tsCode 股票代码
     * @param {boolean} force 是否强制全部更新
     */

    async function updateStockInfoData(dataName, tsCode, force = false) {
      // logger.log("更新日线：", tsCode, force)
      if (_$1.isEmpty(dataName) || !stockDataNames[dataName]) {
        throw Error("请填写正确的个股数据名称！" + dataName);
      }

      if (_$1.isEmpty(tsCode)) {
        return {
          data: []
        };
      }

      let stockData;

      try {
        if (force) {
          logger$1.debug(`需要强制更新数据：${tsCode}`);

          try {
            let [data, endDate, startDate] = await tushare.queryStockInfo(dataName, tsCode);
            stockData = {
              updateTime: moment().toISOString(),
              startDate,
              endDate,
              data
            };
            logger$1.info(`个股数据${dataName}强制更新，代码 ${tsCode}, 更新时间：${stockData.updateTime}, 更新时间范围: ${startDate} - ${endDate}, 总条数：${stockData.data && stockData.data.length}`);
          } catch (error) {
            logger$1.error(`强制更新个股${tsCode}数据${dataName}时出现错误：${error}`);
            throw error;
          }
        } else {
          stockData = await readStockData(dataName, tsCode);
          let startDate = "";

          if (stockData.data && stockData.data.length > 0) {
            let lastDate = stockData.endDate;
            startDate = moment(lastDate, "YYYYMMDD").add(1, "days").format("YYYYMMDD");
            let now = moment();

            if (now.diff(startDate, "days") <= 0 && now.hours() < 15) {
              // 还没有最新一天的数据，不需要
              logger$1.log(`没有新的数据，不需要更新 ${tsCode}`);
              return;
            }
          }

          let [newData, endDate, queryStartDate] = await tushare.queryStockInfo(dataName, tsCode, startDate);

          if (newData && newData.length > 0) {
            stockData.updateTime = moment().toISOString(); //stockData.startDate = startDate;

            stockData.endDate = endDate;
            stockData.data.unshift(...newData);
            logger$1.info(`个股数据${dataName}更新，代码 ${tsCode}, 更新时间：${dailyData.updateTime}, 更新时间范围: ${queryStartDate} - ${endDate}, 更新条数：${newData && newData.length}，总条数：${dailyData.data && dailyData.data.length}`);
          } else {
            dailyData = null;
            logger$1.info(`个股数据${dataName}没有更新，代码 ${tsCode}`);
          }
        }
      } catch (error) {
        logger$1.error(`${tsCode} 个股数据${dataName}更新时发生错误，${error}`);
        throw error;
      }

      try {
        if (stockData && stockData.data && stockData.data.length > 0) {
          await checkDataPath();
          let jsonStr = JSON.stringify(stockData);
          let stockDataFile = await getStockDataFile(dataName, tsCode);
          logger$1.debug(`保存个股${tsCode}数据${dataName}到：${stockDataFile}`);
          await fp$1.writeFile(stockDataFile, jsonStr, "utf-8");
        }
      } catch (error) {
        throw new Error(`保存个股${tsCode}数据${dataName}时出现错误，请检查后重新执行：${error}`);
      }
    }
    /**
     * 数据更新，如果force为true，则需要将所有数据更新为最新（相当于全部重新读取）
     * @param {boolean} force 强制更新所有数据，表示忽略本地数据，重新获取全部历史数据
     * @param {boolean} includeStock 是否更新股票日线数据，默认不更新
     * @param {boolean} includeFactor 是否更新日线复权因子数据，默认不更新
     * @param {boolean} includeBasic 是否更新股票基本面资料，默认不更新
     * @param {boolean} includeIndex 是否更新指数日线，默认不更新
     */


    async function updateData(force = false, includeStock = false, includeFactor = false, includeBasic = false, includeIndex = false, all = false) {
      let now = moment(); // let endDate = now.format("YYYYMMDD")

      logger$1.info("获取和更新股票列表数据 ...");
      logger$1.debug(`参数：强制更新 ${force}, 全部更新 ${all}，更新股票日线 ${includeStock}, 更新指数日线 ${includeIndex}`); // 首先更新股票列表数据

      let stockBasicData = await tushare.stockBasic();
      let stockList = {
        updateTime: now.toISOString(),
        data: stockBasicData
      };
      await saveListFile(stockList, STOCKLIST_FILE);
      logger$1.info("股票列表数据更新完毕！");
      logger$1.info("获取和更新指数列表数据 ..."); // 更新股票指数列表数据

      let indexList = {
        updateTime: now.toISOString(),
        data: []
      }; // logger.debug("开始请求指数数据：")

      let allIndexData = await Promise.all(tushare.indexMarketList.map(async market => {
        return tushare.indexBasic(market.code); // logger.debug("返回指数基础数据：", indexBasicData)
        // return indexBasicData
      })); // logger.debug("所有指数请求返回！", allIndexData && allIndexData.length)

      if (allIndexData && allIndexData.length > 0) {
        allIndexData.forEach(data => {
          // logger.debug("指数数据：", data && data.length)
          if (data && data.length > 0) {
            // 合并之前做一次数据检查，对于已经终止的指数进行过滤
            let total = data.length;
            data = data.filter(item => {
              return _$1.isEmpty(item.exp_date);
            });
            let filteredTotal = data.length;
            logger$1.debug(`指数过滤，总共${total}, 剩余${filteredTotal}`);
            indexList.data.push(...data);
          }
        });
      } // logger.debug("保存指数数据！")


      await saveListFile(indexList, INDEXLIST_FILE);
      logger$1.info("更新指数列表数据完成！"); // 下面针对已经获取的股票列表和指数列表，按照列表需要更新对应的每日信息，展开方式为每个股票按照时间段（更新或全部）进行
      // 初步的方法采用的是每个列表针对更新的信息，生成任务队列，然后异步排队执行（executeTasks）
      // 因为服务器按照不同的数据接口进行流控，本地队列放置过多的并发执行造成内存和执行效率，因此有并发执行数量以及相同接口流控两层控制
      // 为了加开效率，考虑将并发执行改变为二维数组，即可以考虑一次提交多个流控的队列给executeTasks，流控应当在并行过程中平均分配多个
      // 不同的执行队列，这样可以把执行效率提高到较好的状态

      let totalStockWorkers = [];
      let taskCount = 0;

      if (all) {
        taskCount = 3;
      } else {
        if (includeStock) taskCount++;
        if (includeFactor) taskCount++;
        if (includeBasic) taskCount++;
      } // 这里定义股票任务的序号，根据传入的参数决定


      let taskIndex = 0;

      if (all || includeStock) {
        logger$1.info("开始更新股票日线数据..."); // 这里直接采用Promise的方式

        if (_$1.isArray(stockBasicData) && stockBasicData.length > 0) {
          //let tasks =
          stockBasicData.forEach((item, index) => {
            totalStockWorkers[index * taskCount + taskIndex] = {
              caller: updateDailyData,
              args: [item.ts_code, force, "S"]
            };
          }); // let workers = executeTasks(tasks, 20, "股票日线更新任务");
          // try {
          //     logger.debug("等待股票日线更新队列完成...");
          //     await Promise.all(workers);
          //     logger.debug("股票日线更新队列全部执行完毕！");
          // } catch (error) {
          //     logger.error(`股票日线任务执行 错误！${error}`);
          // }
        } // logger.info(tushare.showInfo());


        logger$1.info("股票日线数据更新完毕!");
        taskIndex++;
      }

      if (all || includeFactor) {
        logger$1.info("开始更新股票复权因子数据..."); // 这里直接采用Promise的方式

        if (_$1.isArray(stockBasicData) && stockBasicData.length > 0) {
          //let tasks =
          stockBasicData.forEach((item, index) => {
            totalStockWorkers[taskCount * index + taskIndex] = {
              caller: updateAdjustFactorData,
              args: [item.ts_code, force]
            };
          }); // let workers = executeTasks(tasks, 20, "股票复权因子更新任务");
          // try {
          //     logger.debug("等待股票日线复权因子更新队列完成...");
          //     await Promise.all(workers);
          //     logger.debug("股票日线复权因子更新队列全部执行完毕！");
          // } catch (error) {
          //     logger.error(`股票日线复权因子任务执行 错误！${error}`);
          // }
        } // logger.info(tushare.showInfo());


        logger$1.info("股票复权因子数据更新完毕!");
        taskIndex++;
      }

      if (all || includeBasic) {
        logger$1.info("开始更新基本面数据..."); // 这里直接采用Promise的方式

        if (_$1.isArray(stockBasicData) && stockBasicData.length > 0) {
          // let tasks =
          stockBasicData.forEach((item, index) => {
            totalStockWorkers[taskCount * index + taskIndex] = {
              caller: updateDailyBasicData,
              args: [item.ts_code, force]
            };
          }); // let workers = executeTasks(tasks, 20, "基本面更新任务");
          // try {
          //     logger.debug("等待基本面数据更新队列完成...");
          //     await Promise.all(workers);
          //     logger.debug("基本面数据更新队列全部执行完毕！");
          // } catch (error) {
          //     logger.error(`股票基本面更新任务执行 错误！${error}`);
          // }
        } // logger.info(tushare.showInfo());


        logger$1.info("股票基本面数据更新完毕!");
        taskIndex++;
      }

      if (totalStockWorkers && totalStockWorkers.length > 0) {
        let workers = executeTasks(totalStockWorkers, 30, "个股信息更新任务");

        try {
          logger$1.debug("等待个股数据更新队列完成...");
          await Promise.all(workers);
          logger$1.info(tushare.showInfo());
          logger$1.debug("个股数据更新队列全部执行完毕！");
        } catch (error) {
          logger$1.error(`个股数据更新任务执行 错误！${error}`);
        }
      } // For test
      // let tmp = stockBasicData[0]
      // await updateDailyData(tmp, force


      if (all || includeIndex) {
        logger$1.info("指数日线数据更新开始 ...");

        if (_$1.isArray(indexList.data) && indexList.data.length > 0) {
          // indexList.data.forEach((data) => {
          //     updateControl.call(updateDailyData, data.ts_code, force, "I");
          // });
          let tasks = indexList.data.map(data => {
            return {
              caller: updateDailyData,
              args: [data.ts_code, force, "I"]
            };
          });
          let workers = executeTasks(tasks, 20, "指数日线更新任务");

          try {
            logger$1.debug("等待指数日线更新队列完成 ...");
            await Promise.all(workers);
            logger$1.debug("指数日线数据更新队列全部完成！");
          } catch (error) {
            logger$1.error(`指数日线任务执行 错误：%o`, error);
          }
        }

        logger$1.info(tushare.showInfo());
        logger$1.info("指数日线数据更新完毕！");
      } // logger.log(tushare.showInfo());

    }
    /**
     * 更新指定代码的日历史数据
     * @param {string} tsCode 代码
     * @param {boolean} force 是否强制更新
     * @param {string} type 股票类型，S表示普通股票，I表示指数
     */


    async function updateDailyData(tsCode, force = false, type = "S") {
      // logger.log("更新日线：", tsCode, force)
      if (_$1.isEmpty(tsCode)) {
        return {
          data: []
        };
      }

      if (type !== "S" && type !== "I") {
        return {
          data: []
        };
      } // let tsCode = data.ts_code
      // logger.log("执行更新日线：", tsCode, force)


      let dailyData;

      try {
        if (force) {
          logger$1.debug(`force update ${tsCode}`);
          let data;

          if (type === "S") {
            data = await tushare.stockDaily(tsCode);
          } else {
            data = await tushare.indexDaily(tsCode);
          }

          dailyData = {
            updateTime: moment().toISOString(),
            data
          };
          logger$1.info(`日线数据强制更新，代码 ${tsCode}, 更新时间：${dailyData.updateTime}, 总条数：${dailyData.data && dailyData.data.length}`);
        } else {
          dailyData = await readStockDaily(tsCode);
          let startDate = "";

          if (dailyData.data && dailyData.data.length > 0) {
            let lastDate = dailyData.data[0].trade_date;
            startDate = moment(lastDate, "YYYYMMDD").add(1, "days").format("YYYYMMDD");
            let now = moment();

            if (now.diff(startDate, "days") <= 0 && now.hours() < 15) {
              // 还没有最新一天的数据，不需要
              logger$1.log(`没有新的数据，不需要更新 ${tsCode}`);
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
            logger$1.info(`日线数据更新，代码 ${tsCode}, 更新时间：${dailyData.updateTime}, 更新条数：${newData && newData.length}，总条数：${dailyData.data && dailyData.data.length}`);
          } else {
            dailyData = null;
            logger$1.info(`日线数据没有更新，代码 ${tsCode}`);
          }
        }
      } catch (error) {
        logger$1.error(`${tsCode} 日线数据更新时发生错误，${error}`);
        throw error;
      }

      try {
        if (dailyData) {
          await checkDataPath();
          let jsonStr = JSON.stringify(dailyData);
          let stockDailyFile = path$1.join(getDataRoot(), DATA_PATH.daily, tsCode + ".json");
          await fp$1.writeFile(stockDailyFile, jsonStr, "utf-8");
        }
      } catch (error) {
        throw new Error("保存日线历史数据时出现错误，请检查后重新执行：" + tsCode + "," + error);
      }
    }
    /**
     * 更新指定代码的复权因子历史数据
     * @param {string} tsCode 代码
     * @param {boolean} force 是否强制更新
     */


    async function updateAdjustFactorData(tsCode, force = false) {
      // logger.log("更新日线：", tsCode, force)
      if (_$1.isEmpty(tsCode)) {
        return {
          data: []
        };
      } // let tsCode = data.ts_code
      // logger.log("执行更新日线：", tsCode, force)


      let adjData;

      try {
        if (force) {
          logger$1.debug(`force update ${tsCode}`);
          adjData = {
            updateTime: moment().toISOString(),
            data: await tushare.adjustFactor(tsCode)
          };
          logger$1.info(`股票复权因子数据强制更新，代码 ${tsCode}, 总条数：${adjData.data && adjData.data.length}`);
        } else {
          adjData = await readStockAdjustFactor(tsCode);
          let startDate = "";

          if (adjData.data && adjData.data.length > 0) {
            let lastDate = adjData.data[0].trade_date;
            startDate = moment(lastDate, "YYYYMMDD").add(1, "days").format("YYYYMMDD");
            let now = moment();

            if (now.diff(startDate, "days") <= 0 && now.hours() < 15) {
              // 还没有最新一天的数据，不需要
              logger$1.debug(`没有新的复权因子数据，不需要更新 ${tsCode}`);
              return;
            }
          }

          let newAdjData = await tushare.adjustFactor(tsCode, startDate);
          logger$1.debug(`${tsCode} 复权因子数据返回：${newAdjData && newAdjData.length}`);

          if (newAdjData && newAdjData.length > 0) {
            adjData.updateTime = moment().toISOString();
            adjData.data.unshift(...newAdjData);
            logger$1.info(`日线复权因子数据更新，代码 ${tsCode}, 更新条数：${newAdjData && newAdjData.length}，总条数：${adjData.data && adjData.data.length}`);
          } else {
            adjData = null;
            logger$1.info(`日线复权因子数据没有更新，代码 ${tsCode}`);
            return;
          }
        }
      } catch (error) {
        logger$1.error(`${tsCode} 日线复权因子数据更新时发生错误，${error}`);
        throw error;
      }

      try {
        if (adjData && adjData.data && adjData.data.length > 0) {
          let jsonStr = JSON.stringify(adjData);
          let adjFile = path$1.join(getDataRoot(), DATA_PATH.daily, tsCode + ".adj.json");
          await fp$1.writeFile(adjFile, jsonStr, "utf-8");
        }
      } catch (error) {
        throw new Error("保存复权因子数据时出现错误，请检查后重新执行：" + tsCode + "," + error);
      }
    }

    async function updateDailyBasicData(tsCode, force = false) {
      if (_$1.isEmpty(tsCode)) {
        return {
          data: []
        };
      }

      let adjData;

      try {
        if (force) {
          logger$1.debug(`force update ${tsCode}`);
          adjData = {
            updateTime: moment().toISOString(),
            data: await tushare.dailyBasic(tsCode)
          };
          logger$1.info(`股票基本面数据强制更新，代码 ${tsCode}, 总条数：${adjData.data && adjData.data.length}`);
        } else {
          adjData = await readStockDailyBasic(tsCode);
          let startDate = "";

          if (adjData && adjData.data && adjData.data.length > 0) {
            let lastDate = adjData.data[0].trade_date;
            startDate = moment(lastDate, "YYYYMMDD").add(1, "days").format("YYYYMMDD");
            let now = moment();

            if (now.diff(startDate, "days") <= 0 && now.hours() < 15) {
              // 还没有最新一天的数据，不需要
              logger$1.debug(`没有新的股票基本面数据，不需要更新 ${tsCode}`);
              return;
            }
          }

          let newData = await tushare.dailyBasic(tsCode, startDate);
          logger$1.debug(`${tsCode} 基本面数据返回：${newData && newData.length}`);

          if (newData && newData.length > 0) {
            adjData.updateTime = moment().toISOString();
            adjData.data.unshift(...newData);
            logger$1.info(`基本面数据更新，代码 ${tsCode}, 更新条数：${newData && newData.length}，总条数：${adjData.data && adjData.data.length}`);
          } else {
            adjData = null;
            logger$1.info(`基本面数据没有更新，代码 ${tsCode}`);
            return;
          }
        }
      } catch (error) {
        logger$1.error(`${tsCode} 基本面数据更新时发生错误，${error}`);
        throw error;
      }

      try {
        if (adjData && adjData.data && adjData.data.length > 0) {
          let jsonStr = JSON.stringify(adjData);
          let adjFile = path$1.join(getDataRoot(), DATA_PATH.info, tsCode + ".basic.json");
          await fp$1.writeFile(adjFile, jsonStr, "utf-8");
        }
      } catch (error) {
        throw new Error("保存基本面数据时出现错误，请检查后重新执行：" + tsCode + "," + error);
      }
    }
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
        let listPath = path$1.join(getDataRoot(), fileName);
        await fp$1.writeFile(listPath, jsonStr, {
          encoding: "utf-8"
        });
      } catch (error) {
        throw new Error("保存列表数据时出现错误，请检查后重新执行：" + error);
      }
    }
    /**
     * 清除所有已经同步的数据
     */


    async function clearAllData() {
      try {
        logger$1.debug("检查根目录状态：");
        await checkDataPath(); // 首先删除股票列表信息文件

        logger$1.info("清理股票列表数据...");
        let stockListPath = path$1.join(getDataRoot(), STOCKLIST_FILE);

        try {
          await fp$1.access(stockListPath, fs$1.constants.F_OK);

          try {
            await fp$1.unlink(stockListPath);
          } catch (error) {
            throw error;
          }
        } catch (error) {// 文件不存在，直接忽略
        }

        logger$1.info("清理股票列表数据完成");
        logger$1.info("清理指数列表数据...");
        let indexListPath = path$1.join(getDataRoot(), INDEXLIST_FILE);

        try {
          await fp$1.access(indexListPath, fs$1.constants.F_OK);

          try {
            await fp$1.unlink(indexListPath);
          } catch (error) {
            throw error;
          }
        } catch (error) {// 文件不存在，直接忽略
        }

        logger$1.info("清理指数列表数据完成");
        logger$1.info("清理股票历史数据..."); // 下面删除股票历史数据目录

        let stockDailyHistoryPath = path$1.join(getDataRoot(), DATA_PATH.daily);

        try {
          await fp$1.access(stockDailyHistoryPath, fs$1.constants.F_OK);

          try {
            let fileList = await fp$1.readdir(stockDailyHistoryPath);
            logger$1.info(`共有${fileList.length}个历史数据文件待删除`);
            fileList.forEach(async filePath => {
              // logger.log("to be remove: ", filePath)
              await fp$1.unlink(path$1.join(stockDailyHistoryPath, filePath));
            });
          } catch (error) {
            throw error;
          }
        } catch (error) {// 没有目录
        }

        logger$1.info("清理股票历史数据完成");
      } catch (error) {
        throw new Error("清除所有已经同步数据发生错误：" + error);
      }
    }

    exports.clearAllData = clearAllData;
    exports.readStockDaily = readStockDaily;
    exports.readStockIndexList = readStockIndexList;
    exports.readStockList = readStockList;
    exports.stockDataNames = stockDataNames;
    exports.updateAdjustFactorData = updateAdjustFactorData;
    exports.updateDailyBasicData = updateDailyBasicData;
    exports.updateDailyData = updateDailyData;
    exports.updateData = updateData;
    exports.updateStockInfoData = updateStockInfoData;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=stockdata.js.map
