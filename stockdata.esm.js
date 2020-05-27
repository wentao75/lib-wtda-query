const t=require("lodash"),a=require("os"),e=require("path"),i=require("fs"),n=i.promises,r=require("pino")({level:process.env.LOGGER||"info",prettyPrint:{levelFirst:!0,translateTime:"SYS:yyyy-mm-dd HH:MM:ss.l",crlf:!0},prettifier:require("pino-pretty")}),l={daily:"daily",info:"info",financial:"fin"};function o(){return e.join(a.homedir(),".wtda")}async function c(){let a=null;try{await g();let i=e.join(o(),"stock-list.json");a=JSON.parse(await n.readFile(i,"utf-8")),t.isEmpty(a)||r.debug("股票列表更新时间 @"+a.updateTime)}catch(t){throw r.error("读取股票列表数据错误："+t),new Error("读取股票列表过程中出现错误，请检查后重新运行："+t)}return t.isEmpty(a)?{updateTime:"",data:[]}:a}async function d(){let a=null;try{await g();let i=e.join(o(),"index-list.json");a=JSON.parse(await n.readFile(i,"utf-8")),t.isEmpty(a)||r.debug("指数列表更新时间 @"+a.updateTime)}catch(t){throw r.error("读取指数列表数据错误："+t),new Error("读取指数列表过程中出现错误，请检查后重新运行："+t)}return t.isEmpty(a)?{updateTime:"",data:[]}:a}const s={daily:"daily",adjustFactor:"adjustFactor",suspendInfo:"suspendInfo",dailyBasic:"dailyBasic",moneyFlow:"moneyFlow",indexDaily:"indexDaily",income:"income",balanceSheet:"balanceSheet",cashFlow:"cashFlow",forecast:"forecast",express:"express",dividend:"dividend",financialIndicator:"financialIndicator",financialMainbiz:"financialMainbiz",disclosureDate:"disclosureDate",pledgeStat:"pledgeStat",pledgeDetail:"pledgeDetail"},f={daily:{name:"daily",path:l.daily,ext:""},adjustFactor:{name:"adjustFactor",path:l.daily,ext:".adj"},suspendInfo:{name:"suspendInfo",path:l.info,ext:".sus"},dailyBasic:{name:"dailyBasic",path:l.info,ext:".bsc"},moneyFlow:{name:"moneyFlow",path:l.info,ext:".mf"},indexDaily:{name:"indexDaily",path:l.daily,ext:""},income:{name:"income",path:l.financial,ext:".ic"},balanceSheet:{name:"balanceSheet",path:l.financial,ext:".bs"},cashFlow:{name:"cashFlow",path:l.financial,ext:".cf"},forecast:{name:"forecast",path:l.financial,ext:".fc"},express:{name:"express",path:l.financial,ext:".ep"},dividend:{name:"dividend",path:l.financial,ext:".dd"},financialIndicator:{name:"financialIndicator",path:l.financial,ext:".id"},financialMainbiz:{name:"financialMainbiz",path:l.financial,ext:".mb"},disclosureDate:{name:"disclosureDate",path:l.financial,ext:".dt"},pledgeStat:{name:"pledgeStat",path:l.financial,ext:".ps"},pledgeDetail:{name:"pledgeDetail",path:l.financial,ext:".pd"},trend:{name:"trend",path:l.daily,ext:".tr"}};async function h(a,e){if(!s[a])throw new Error("不支持的数据类型："+a);if(t.isEmpty(e))throw new Error("未设置读取股票代码");let i={updateTime:null,data:[]},l=f[a];try{await g();let t=u(a,e);r.debug(`读取本地数据 ${e}.${a}，参数配置 %o，文件 ${t}`,l);try{i=JSON.parse(await n.readFile(t,"utf-8"))}catch(t){r.debug("读取文件时发生错误："+t),i={data:[]}}}catch(t){r.error(`从本地读取个股数据${a}时发生错误 ${t}`)}return i}function u(a,i){let n=f[a];if(!n)throw new Error("不支持的数据类型"+a);if(t.isEmpty(i))throw new Error("未设置读取股票代码");return e.join(o(),n.path,i+n.ext+".json")}async function g(){let t=o();try{await n.access(t,i.constants.F_OK|i.constants.R_OK|i.constants.W_OK)}catch(a){r.debug("检查数据根目录错误 "+a),await n.mkdir(t,{recursive:!0})}for(let a of Object.keys(l)){let o=e.join(t,l[a]);try{await n.access(o,i.constants.F_OK|i.constants.R_OK|i.constants.W_OK)}catch(t){r.debug(`检查目录${l[a]}错误 ${t}`),await n.mkdir(o,{recursive:!0})}}}g();const y=require("lodash"),w=require("moment"),p=require("@wt/lib-taskqueue"),m=require("@wt/lib-tushare"),$=require("pino")({level:process.env.LOGGER||"info",prettyPrint:{levelFirst:!0,translateTime:"SYS:yyyy-mm-dd HH:MM:ss.l",crlf:!0},prettifier:require("pino-pretty")}),b=require("path"),S=require("fs"),x=S.promises,j={[s.dividend]:s.dividend,[s.pledgeStat]:s.pledgeStat,[s.pledgeDetail]:s.pledgeDetail};async function E(t,a,e=!1){if(j[t])return I(a);if(y.isEmpty(t)||!s[t])throw Error("请填写正确的个股数据名称！"+t);if(y.isEmpty(a))throw Error("请填写正确的股票代码！"+a);let i;try{if(e){$.debug("需要强制更新数据："+a);try{let[e,n,r]=await m.queryStockInfo(t,a);i={updateTime:w().toISOString(),startDate:r,endDate:n,data:e},$.info(`个股数据${t}强制更新，代码 ${a}, 更新时间：${i.updateTime}, 更新时间范围: ${r} - ${n}, 总条数：${i.data&&i.data.length}`)}catch(e){throw $.error(`强制更新个股${a}数据${t}时出现错误：${e}`),e}}else{i=await h(t,a),$.debug(`读取本地数据${a}.${t}：${i.updateTime}, ${i.startDate}, ${i.endDate}, ${i.data&&i.data.length}`);let e="";if(i.data&&i.data.length>0){let t=i.endDate;e=w(t,"YYYYMMDD").add(1,"days").format("YYYYMMDD");let n=w();if(n.diff(e,"days")<=0&&n.hours()<15)return void $.log("没有新的数据，不需要更新 "+a)}let[n,r,l]=await m.queryStockInfo(t,a,e);i&&!i.startDate&&(i.startDate=l),n&&n.length>0?(i.updateTime=w().toISOString(),i.endDate=r,i.data.unshift(...n),$.info(`个股数据${t}更新，代码 ${a}, 更新时间：${i.updateTime}, 更新时间范围: ${l} - ${r}, 更新条数：${n&&n.length}，总条数：${i.data&&i.data.length}`)):(i=null,$.info(`个股数据${t}没有更新，代码 ${a}`))}}catch(e){throw $.error(`${a} 个股数据${t}更新时发生错误，${e}`),e}await F(i,t,a)}async function F(t,a,e){try{if(t&&t.data&&t.data.length>0){let i=JSON.stringify(t),n=u(a,e);$.debug(`保存个股${e}数据${a}到：${n}`),await x.writeFile(n,i,"utf-8")}}catch(t){throw new Error(`保存个股${e}数据${a}时出现错误，请检查后重新执行：${t}`)}}async function _(t=!1,a=!1,e=!1,i=!1,n=!1,r=!1,l=!1){$.debug(`参数：强制更新 ${t}, 更新股票信息数据 ${a}, 更新股票财务数据 ${e}, 更新主营业务构成 ${i}, 更新分红送股 ${n}, 更新股权质押数据 ${r}，更新指数数据 ${l}`);let[o,c]=await async function(t){let a=w();$.info("获取和更新股票列表数据 ...");let e=await m.stockBasic(),i={updateTime:a.toISOString(),data:e};await v(i,"stock-list.json"),$.info("股票列表数据更新完毕！"),$.info("获取和更新指数列表数据 ...");let n={updateTime:a.toISOString(),data:[]},r=await Promise.all(m.indexMarketList.map(async t=>m.indexBasic(t.code)));r&&r.length>0&&r.forEach(t=>{if(t&&t.length>0){let a=t.length,e=(t=t.filter(t=>y.isEmpty(t.exp_date))).length;$.debug(`指数过滤，总共${a}, 剩余${e}`),n.data.push(...t)}});return await v(n,"index-list.json"),$.info("更新指数列表数据完成！"),[i,n]}();a&&await async function(t,a){let e=t&&t.data;if(e&&e.length>0){let t=[];$.info("个股信息数据更新准备...");for(let i=0;i<e.length;i++)for(let n=0;n<D.length;n++)t.push({caller:E,args:[D[n],e[i].ts_code,a]});if($.info("个股信息数据更新准备完毕！"),t&&t.length>0){let a=p(t,30,"个股数据更新任务");try{$.debug("等待个股数据更新队列完成..."),await Promise.all(a),$.info(m.showInfo()),$.debug("个股数据更新队列全部执行完毕！")}catch(t){$.error("个股数据更新任务执行 错误！"+t)}}}}(o,t),e&&await async function(t,a){let e=t&&t.data;if(e&&e.length>0){let t=[];$.info("个股财务数据更新准备...");for(let i=0;i<e.length;i++)for(let n=0;n<O.length;n++)t.push({caller:E,args:[O[n],e[i].ts_code,a]});if($.info("个股财务数据更新准备完毕！"),t&&t.length>0){let a=p(t,30,"个股财务数据任务");try{$.debug("等待个股财务数据更新队列完成..."),await Promise.all(a),$.info(m.showInfo()),$.debug("个股财务数据更新队列全部执行完毕！")}catch(t){$.error("个股财务数据更新任务执行 错误！"+t)}}}}(o,t),i&&await async function(t,a){let e=t&&t.data;if(e&&e.length>0){let t=[];$.info("个股主营业务数据更新准备...");for(let i=0;i<e.length;i++)t.push({caller:E,args:[s.financialMainbiz,e[i].ts_code,a]});if($.info("个股主营业务数据更新准备完毕！"),t&&t.length>0){let a=p(t,30,"个股主营业务数据任务");try{$.debug("等待个股主营业务数据更新队列完成..."),await Promise.all(a),$.info(m.showInfo()),$.debug("个股主营业务数据更新队列全部执行完毕！")}catch(t){$.error("个股主营业务数据更新任务执行 错误！"+t)}}}}(o,t),n&&await async function(t){let a=t&&t.data;if(a&&a.length>0){let t=[];$.info("个股分红送股数据更新准备...");for(let e=0;e<a.length;e++)t.push({caller:I,args:[s.dividend,a[e].ts_code]});if($.info("个股分红送股数据更新准备完毕！"),t&&t.length>0){let a=p(t,20,"个股分红送股数据任务");try{$.debug("等待个股分红送股数据更新队列完成..."),await Promise.all(a),$.info(m.showInfo()),$.debug("个股分红送股数据更新队列全部执行完毕！")}catch(t){$.error("个股分红送股数据更新任务执行 错误！"+t)}}}}(o),r&&await async function(t){let a=t&&t.data;if(a&&a.length>0){let t=[];$.info("个股股权质押数据更新准备...");for(let e=0;e<a.length;e++)t.push({caller:I,args:[s.pledgeStat,a[e].ts_code]}),t.push({caller:I,args:[s.pledgeDetail,a[e].ts_code]});if($.info("个股股权质押数据更新准备完毕！"),t&&t.length>0){let a=p(t,20,"个股股权质押数据任务");try{$.debug("等待个股股权质押数据更新队列完成..."),await Promise.all(a),$.info(m.showInfo()),$.debug("个股股权质押数据更新队列全部执行完毕！")}catch(t){$.error("个股股权质押数据更新任务执行 错误！"+t)}}}}(o),l&&await async function(t,a){if(t&&t.data&&t.data.length>0){$.info("指数日线数据更新开始 ...");let e=t.data.map(t=>({caller:E,args:[s.indexDaily,t.ts_code,a]})),i=p(e,20,"指数日线更新任务");try{$.debug("等待指数日线更新队列完成 ..."),await Promise.all(i),$.debug("指数日线数据更新队列全部完成！")}catch(t){$.error("指数日线任务执行 错误：%o",t)}$.info(m.showInfo()),$.info("指数日线数据更新完毕！")}}(c,t)}const D=[s.daily,s.adjustFactor,s.suspendInfo,s.dailyBasic,s.moneyFlow],O=[s.income,s.balanceSheet,s.cashFlow,s.forecast,s.express,s.financialIndicator,s.disclosureDate];async function I(t,a){let e=w();if(y.isEmpty(a))throw new Error(`没有设置查询${t}的个股代码`);$.info(`个股${a}获取和更新${t}数据 ...`);let i=await m.queryStockInfo(t,a),n={updateTime:e.toISOString(),data:i};$.info(`个股${a} 数据${t}更新，更新时间：${n.updateTime}, 总条数：${n.data&&n.data.length}`);try{if(n&&n.data&&n.data.length>0){let e=JSON.stringify(n),i=u(t,a);$.debug(`保存个股${a}数据${t}到：${i}`),await x.writeFile(i,e,"utf-8")}}catch(e){throw $.error(`保存个股${a}数据${t}错误：${e}`),new Error(`保存个股${a}数据${t}时出现错误，请检查后重新执行：${e}`)}}async function v(t,a){try{let e=JSON.stringify(t),i=b.join(o(),a);await x.writeFile(i,e,{encoding:"utf-8"})}catch(t){throw new Error("保存列表数据时出现错误，请检查后重新执行："+t)}}async function q(){try{$.debug("检查根目录状态："),$.info("清理股票列表数据...");let t=b.join(o(),"stock-list.json");try{await x.access(t,S.constants.F_OK);try{await x.unlink(t)}catch(t){throw t}}catch(t){}$.info("清理股票列表数据完成"),$.info("清理指数列表数据...");let a=b.join(o(),"index-list.json");try{await x.access(a,S.constants.F_OK);try{await x.unlink(a)}catch(t){throw t}}catch(t){}$.info("清理指数列表数据完成"),$.info("清理股票历史数据...");let e=b.join(o(),l.daily);try{await x.access(e,S.constants.F_OK);try{let t=await x.readdir(e);$.info(`共有${t.length}个历史数据文件待删除`),t.forEach(async t=>{await x.unlink(b.join(e,t))})}catch(t){throw t}}catch(t){}$.info("清理股票历史数据完成"),$.info("清理股票信息数据...");let i=b.join(o(),l.info);try{await x.access(i,S.constants.F_OK);try{let t=await x.readdir(i);$.info(`共有${t.length}个历史数据文件待删除`),t.forEach(async t=>{await x.unlink(b.join(i,t))})}catch(t){throw t}}catch(t){}$.info("清理股票信息数据完成"),$.info("清理股票财务数据...");let n=b.join(o(),l.financial);try{await x.access(n,S.constants.F_OK);try{let t=await x.readdir(n);$.info(`共有${t.length}个历史数据文件待删除`),t.forEach(async t=>{await x.unlink(b.join(n,t))})}catch(t){throw t}}catch(t){}$.info("清理股票财务数据完成")}catch(t){throw new Error("清除所有已经同步数据发生错误："+t)}}async function k(){let t=await c();if(!t||!t.data)return void $.error("没有读取到股票列表，无法处理日线数据");let a=t.data.map(t=>({caller:T,args:[t.ts_code]}));if(a&&a.length>0){let t=p(a,30,"日线数据合并");try{await Promise.all(t)}catch(t){$.error("日线数据合并任务执行发生未知异常："+t)}}}async function T(t){if(y.isEmpty(t))return;let a=await h(s.daily,t);$.debug(`日线${t}读取到${a.data.length}条数据`);let e=await h(s.adjustFactor,t);$.debug(`复权因子${t}读取到${e.data.length}条数据`);let i=e&&e.data&&e.data.length>0?e.data[0].adj_factor:1;$.debug(`${t}最新复权因子: ${i}`),a&&a.data&&a.data.length>0&&(a.data=a.data.map(t=>{let a=e.data.filter(a=>a.trade_date===t.trade_date);return $.debug(t.trade_date+", 寻找到adj：%o",a),a&&a.length>0&&(t.adj_factor=a[0].adj_factor,t.prevadj_factor=a[0].adj_factor/i),t})),await F(a,s.daily,t),$.info(t+"日线数据合并完成！")}function M(t){let a=[];for(let e=2;e<t.length-2;e++){let i=t[e],n=null,r=a.length>0?a[a.length-1]:null,l=null!==r?r[2]:0;(0===i[2]&&i[3].high>=t[e-1][3].high&&i[3].high>=t[e+1][3].high||1===i[2]&&i[1]>=t[e-2][1]&&i[1]>=t[e+2][1])&&(n=[i[0],i[3].high,1,i[3]],$.debug(`找到高点，序号${e}, %o`,i),1===l&&($.debug(`前一个点也是高点：, 当前序号${e}, 当前点：%o, 上一个点：%o`,n,r),r[1]<n[1]?($.debug("当前点价格更高，替换前一个点！"),a[a.length-1]=n):$.debug("之前的高点比当前点高，忽略这次发现的高点"),n=null)),(0===i[2]&&i[3].low<=t[e-1][3].low&&i[3].low<=t[e+1][3].low||-1===i[2]&&i[1]<=t[e-2][1]&&i[1]<=t[e+2][1])&&(n=[i[0],i[3].low,-1,i[3]],$.debug(`发现低点，序号${e}, %o`,i),-1===l&&($.debug(`前一个点也是低点，当前序号${e}, 当前点：%o, 上一个点：%o`,n,r),r[1]>n[1]?($.debug("当前点比上一个点价格更低，替换上一个点！"),a[a.length-1]=n):$.debug("当前点比上一个点价格高，忽略这次发现的低点！"),n=null)),null!==n&&a.push(n)}return a}async function K(t){if(y.isEmpty(t))return;let a=await h(s.daily,t);$.debug("去除内移交易日..., "+(a&&a.data&&a.data.length));let e=function(t){let a=[];if(!t||!Array.isArray(t))return a;if(t.length<=0)return a;let e=t.length-1,i=t[e],n=e-1;for(;n>=0;){let r=t[n];if(r){if(r.high<=i.high&&r.low>=i.low);else{let t=[r.trade_date,null,0,r];a.push(t),e=n,i=r}n-=1}}return a}(a.data);a.data=null,a=null;let i=[];for(let t=0;t<3;t++)e=M(e),i[t]=e,$.debug(`趋势等级: ${t}, 趋势点数量 ${i[t].length}`);$.info(t+"趋势数据计算完毕！");try{let a={updateTime:w().toISOString(),ts_code:t,data:i},e="trend",n=JSON.stringify(a),r=u(e,t);await x.writeFile(r,n,"utf-8"),$.info(`个股${t}趋势数据保存：${r}, 短期：${i&&i[0].length}，中期：${i&&i[1].length}，长期：${i&&i[2].length}`)}catch(a){throw new Error(`保存个股${t}数据${dataName}时出现错误，请检查后重新执行：${a}`)}e=null}async function P(){$.info("内存使用：%o",process.memoryUsage());let t=await c();if(!t||!t.data)return void $.error("没有读取到股票列表，无法处理日线数据");$.info("内存使用：%o",process.memoryUsage());let a=t.data.map(t=>({caller:K,args:[t.ts_code]}));if($.info("内存使用：%o",process.memoryUsage()),a&&a.length>0){let t=p(a,20,"趋势数据计算");try{await Promise.all(t)}catch(t){$.error("趋势数据合并任务执行发生未知异常："+t)}t=null}$.info("趋势数据全部计算完毕！"),$.info("内存使用：%o",process.memoryUsage())}export{k as calculateAllDailyData,P as calculateAllTrendPoints,T as calculateDailyData,K as calculateTrendPoints,q as clearAllData,h as readStockData,d as readStockIndexList,c as readStockList,s as stockDataNames,_ as updateData,E as updateStockInfoData};
