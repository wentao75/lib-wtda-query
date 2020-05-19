!function(t,a){"object"==typeof exports&&"undefined"!=typeof module?a(exports):"function"==typeof define&&define.amd?define(["exports"],a):a((t=t||self)["@wt/lib-wtda"]={})}(this,(function(t){"use strict";const a=require("lodash"),e=require("os"),i=require("path"),r=require("fs"),n=r.promises,o=require("pino")({level:process.env.LOGGER||"info",prettyPrint:{levelFirst:!0,translateTime:"SYS:yyyy-yy-dd HH:MM:ss.l",crlf:!0},prettifier:require("pino-pretty")});function d(){return i.join(e.homedir(),".wtda")}async function s(t){if(a.isEmpty(t))throw new Error("未设置读取股票代码");let e={updateTime:null,data:[]};try{await l();let a=i.join(d(),"daily",t+".json");try{e=JSON.parse(await n.readFile(a,"utf-8"))}catch(t){e={data:[]}}}catch(t){o.error("从本地读取日线数据时发生错误 "+t)}return e}async function l(){let t=d();try{await n.access(t,r.constants.F_OK|r.constants.R_OK|r.constants.W_OK)}catch(a){o.debug("检查数据根目录错误 "+a),await n.mkdir(t,{recursive:!0})}let a=i.join(t,"daily");try{await n.access(a,r.constants.F_OK|r.constants.R_OK|r.constants.W_OK)}catch(t){o.debug("检查日线历史目录错误 "+t),await n.mkdir(a,{recursive:!0})}let e=i.join(t,"info");try{await n.access(e,r.constants.F_OK|r.constants.R_OK|r.constants.W_OK)}catch(t){o.debug("检查信息数据目录错误 "+t),await n.mkdir(e,{recursive:!0})}}const c=require("lodash"),u=require("moment"),f=require("@wt/lib-taskqueue"),y=require("@wt/lib-tushare"),h=require("pino")({level:process.env.LOGGER||"info",prettyPrint:{levelFirst:!0,translateTime:"SYS:yyyy-yy-dd HH:MM:ss.l",crlf:!0},prettifier:require("pino-pretty")}),w=require("path"),p=require("fs"),g=p.promises;async function m(t,a=!1,e="S"){if(c.isEmpty(t))return{data:[]};if("S"!==e&&"I"!==e)return{data:[]};let i;try{if(a){let a;h.debug("force update "+t),a="S"===e?await y.stockDaily(t):await y.indexDaily(t),i={updateTime:u().toISOString(),data:a},h.info(`日线数据强制更新，代码 ${t}, 更新时间：${i.updateTime}, 总条数：${i.data&&i.data.length}`)}else{i=await s(t);let a,r="";if(i.data&&i.data.length>0){let a=i.data[0].trade_date;r=u(a,"YYYYMMDD").add(1,"days").format("YYYYMMDD");let e=u();if(e.diff(r,"days")<=0&&e.hours()<15)return void h.log("没有新的数据，不需要更新 "+t)}a="S"===e?await y.stockDaily(t,r):await y.indexDaily(t,r),a&&a.length>0?(i.updateTime=u().toISOString(),i.data.unshift(...a),h.info(`日线数据更新，代码 ${t}, 更新时间：${i.updateTime}, 更新条数：${a&&a.length}，总条数：${i.data&&i.data.length}`)):(i=null,h.info("日线数据没有更新，代码 "+t))}}catch(a){throw h.error(`${t} 日线数据更新时发生错误，${a}`),a}try{if(i){await l();let a=JSON.stringify(i),e=w.join(d(),"daily",t+".json");await g.writeFile(e,a,"utf-8")}}catch(a){throw new Error("保存日线历史数据时出现错误，请检查后重新执行："+t+","+a)}}async function $(t,e=!1){if(c.isEmpty(t))return{data:[]};let r;try{if(e)h.debug("force update "+t),r={updateTime:u().toISOString(),data:await y.adjustFactor(t)},h.info(`股票复权因子数据强制更新，代码 ${t}, 总条数：${r.data&&r.data.length}`);else{r=await async function(t){if(a.isEmpty(t))throw new Error("未设置读取股票代码");let e={updateTime:null,data:[]};try{await l();let a=i.join(d(),"daily",t+".adj.json");try{e=JSON.parse(await n.readFile(a,"utf-8"))}catch(t){o.debug(`读取股票复权因子文件${a} 错误：${t}`),e={updateTime:null,data:[]}}}catch(t){o.error("从本地读取日线复权因子数据时发生错误 "+t)}return e}(t);let e="";if(r.data&&r.data.length>0){let a=r.data[0].trade_date;e=u(a,"YYYYMMDD").add(1,"days").format("YYYYMMDD");let i=u();if(i.diff(e,"days")<=0&&i.hours()<15)return void h.debug("没有新的复权因子数据，不需要更新 "+t)}let s=await y.adjustFactor(t,e);if(h.debug(`${t} 复权因子数据返回：${s&&s.length}`),!(s&&s.length>0))return r=null,void h.info("日线复权因子数据没有更新，代码 "+t);r.updateTime=u().toISOString(),r.data.unshift(...s),h.info(`日线复权因子数据更新，代码 ${t}, 更新条数：${s&&s.length}，总条数：${r.data&&r.data.length}`)}}catch(a){throw h.error(`${t} 日线复权因子数据更新时发生错误，${a}`),a}try{if(r&&r.data&&r.data.length>0){let a=JSON.stringify(r),e=w.join(d(),"daily",t+".adj.json");await g.writeFile(e,a,"utf-8")}}catch(a){throw new Error("保存复权因子数据时出现错误，请检查后重新执行："+t+","+a)}}async function S(t,e=!1){if(c.isEmpty(t))return{data:[]};let r;try{if(e)h.debug("force update "+t),r={updateTime:u().toISOString(),data:await y.dailyBasic(t)},h.info(`股票基本面数据强制更新，代码 ${t}, 总条数：${r.data&&r.data.length}`);else{r=await async function(t){if(a.isEmpty(t))throw new Error("未设置读取股票代码");let e={updateTime:null,data:[]};try{await l();let a=i.join(d(),"info",t+".info.json");try{e=JSON.parse(await n.readFile(a,"utf-8"))}catch(t){o.debug(`读取基本面文件${a} 错误：${t}`),e={updateTime:null,data:[]}}}catch(t){o.error("从本地读取基本面数据时发生错误 "+t)}return e}(t);let e="";if(r&&r.data&&r.data.length>0){let a=r.data[0].trade_date;e=u(a,"YYYYMMDD").add(1,"days").format("YYYYMMDD");let i=u();if(i.diff(e,"days")<=0&&i.hours()<15)return void h.debug("没有新的股票基本面数据，不需要更新 "+t)}let s=await y.dailyBasic(t,e);if(h.debug(`${t} 基本面数据返回：${s&&s.length}`),!(s&&s.length>0))return r=null,void h.info("基本面数据没有更新，代码 "+t);r.updateTime=u().toISOString(),r.data.unshift(...s),h.info(`基本面数据更新，代码 ${t}, 更新条数：${s&&s.length}，总条数：${r.data&&r.data.length}`)}}catch(a){throw h.error(`${t} 基本面数据更新时发生错误，${a}`),a}try{if(r&&r.data&&r.data.length>0){let a=JSON.stringify(r),e=w.join(d(),"info",t+".basic.json");await g.writeFile(e,a,"utf-8")}}catch(a){throw new Error("保存基本面数据时出现错误，请检查后重新执行："+t+","+a)}}async function j(t,a){try{await l();let e=JSON.stringify(t),i=w.join(d(),a);await g.writeFile(i,e,{encoding:"utf-8"})}catch(t){throw new Error("保存列表数据时出现错误，请检查后重新执行："+t)}}t.clearAllData=async function(){try{h.debug("检查根目录状态："),await l(),h.info("清理股票列表数据...");let t=w.join(d(),"stock-list.json");try{await g.access(t,p.constants.F_OK);try{await g.unlink(t)}catch(t){throw t}}catch(t){}h.info("清理股票列表数据完成"),h.info("清理指数列表数据...");let a=w.join(d(),"index-list.json");try{await g.access(a,p.constants.F_OK);try{await g.unlink(a)}catch(t){throw t}}catch(t){}h.info("清理指数列表数据完成"),h.info("清理股票历史数据...");let e=w.join(d(),"daily");try{await g.access(e,p.constants.F_OK);try{let t=await g.readdir(e);h.info(`共有${t.length}个历史数据文件待删除`),t.forEach(async t=>{await g.unlink(w.join(e,t))})}catch(t){throw t}}catch(t){}h.info("清理股票历史数据完成")}catch(t){throw new Error("清除所有已经同步数据发生错误："+t)}},t.readStockDaily=s,t.readStockIndexList=async function(){let t=null;try{await l();let e=i.join(d(),"index-list.json");t=JSON.parse(await n.readFile(e,"utf-8")),a.isEmpty(t)||o.debug("指数列表更新时间 @"+t.updateTime)}catch(t){throw o.error("读取指数列表数据错误："+t),new Error("读取指数列表过程中出现错误，请检查后重新运行："+t)}return a.isEmpty(t)?{updateTime:"",data:[]}:t},t.readStockList=async function(){let t=null;try{await l();let e=i.join(d(),"stock-list.json");t=JSON.parse(await n.readFile(e,"utf-8")),a.isEmpty(t)||o.debug("股票列表更新时间 @"+t.updateTime)}catch(t){throw o.error("读取股票列表数据错误："+t),new Error("读取股票列表过程中出现错误，请检查后重新运行："+t)}return a.isEmpty(t)?{updateTime:"",data:[]}:t},t.updateAdjustFactorData=$,t.updateDailyBasicData=S,t.updateDailyData=m,t.updateData=async function(t=!1,a=!1,e=!1,i=!1,r=!1,n=!1){let o=u();h.info("获取和更新股票列表数据 ..."),h.debug(`参数：强制更新 ${t}, 全部更新 ${n}，更新股票日线 ${a}, 更新指数日线 ${r}`);let d=await y.stockBasic(),s={updateTime:o.toISOString(),data:d};await j(s,"stock-list.json"),h.info("股票列表数据更新完毕！"),h.info("获取和更新指数列表数据 ...");let l={updateTime:o.toISOString(),data:[]},w=await Promise.all(y.indexMarketList.map(async t=>y.indexBasic(t.code)));if(w&&w.length>0&&w.forEach(t=>{if(t&&t.length>0){let a=t.length,e=(t=t.filter(t=>c.isEmpty(t.exp_date))).length;h.debug(`指数过滤，总共${a}, 剩余${e}`),l.data.push(...t)}}),await j(l,"index-list.json"),h.info("更新指数列表数据完成！"),n||a){if(h.info("开始更新股票日线数据..."),c.isArray(d)&&d.length>0){let a=d.map(a=>({caller:m,args:[a.ts_code,t,"S"]})),e=f(a,20,"股票日线更新任务");try{h.debug("等待股票日线更新队列完成..."),await Promise.all(e),h.debug("股票日线更新队列全部执行完毕！")}catch(t){h.error("股票日线任务执行 错误！"+t)}}h.info(y.showInfo()),h.info("股票日线数据更新完毕!")}if(n||e){if(h.info("开始更新股票复权因子数据..."),c.isArray(d)&&d.length>0){let a=d.map(a=>({caller:$,args:[a.ts_code,t]})),e=f(a,20,"股票复权因子更新任务");try{h.debug("等待股票日线复权因子更新队列完成..."),await Promise.all(e),h.debug("股票日线复权因子更新队列全部执行完毕！")}catch(t){h.error("股票日线复权因子任务执行 错误！"+t)}}h.info(y.showInfo()),h.info("股票复权因子数据更新完毕!")}if(n||i){if(h.info("开始更新基本面数据..."),c.isArray(d)&&d.length>0){let a=d.map(a=>({caller:S,args:[a.ts_code,t]})),e=f(a,20,"基本面更新任务");try{h.debug("等待基本面数据更新队列完成..."),await Promise.all(e),h.debug("基本面数据更新队列全部执行完毕！")}catch(t){h.error("股票基本面更新任务执行 错误！"+t)}}h.info(y.showInfo()),h.info("股票基本面数据更新完毕!")}if((n||r)&&(h.info("指数日线数据更新开始 ..."),c.isArray(l.data)&&l.data.length>0)){let a=l.data.map(a=>({caller:m,args:[a.ts_code,t,"I"]})),e=f(a,20,"指数日线更新任务");try{h.debug("等待指数日线更新队列完成 ..."),await Promise.all(e),h.debug("指数日线数据更新队列全部完成！")}catch(t){h.error("指数日线任务执行 错误：%o",t)}h.info(y.showInfo()),h.info("指数日线数据更新完毕！")}},Object.defineProperty(t,"__esModule",{value:!0})}));
//# sourceMappingURL=stockdata.js.map
