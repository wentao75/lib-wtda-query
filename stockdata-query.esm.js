const a=require("lodash"),e=require("os"),t=require("path"),i=require("fs"),n=i.promises,r=require("pino")({level:process.env.LOGGER||"info",prettyPrint:{levelFirst:!0,translateTime:"SYS:yyyy-mm-dd HH:MM:ss.l",crlf:!0},prettifier:require("pino-pretty")}),s={daily:"daily",info:"info",financial:"fin"},c="stock-list.json",o="index-list.json";function l(){return t.join(e.homedir(),".wtda")}async function d(){let e=null;try{await h();let i=t.join(l(),"stock-list.json");e=JSON.parse(await n.readFile(i,"utf-8")),a.isEmpty(e)||r.debug("股票列表更新时间 @"+e.updateTime)}catch(a){throw r.error("读取股票列表数据错误："+a),new Error("读取股票列表过程中出现错误，请检查后重新运行："+a)}return a.isEmpty(e)?{updateTime:"",data:[]}:e}async function p(){let e=null;try{await h();let i=t.join(l(),"index-list.json");e=JSON.parse(await n.readFile(i,"utf-8")),a.isEmpty(e)||r.debug("指数列表更新时间 @"+e.updateTime)}catch(a){throw r.error("读取指数列表数据错误："+a),new Error("读取指数列表过程中出现错误，请检查后重新运行："+a)}return a.isEmpty(e)?{updateTime:"",data:[]}:e}const f={daily:"daily",adjustFactor:"adjustFactor",suspendInfo:"suspendInfo",dailyBasic:"dailyBasic",moneyFlow:"moneyFlow",indexDaily:"indexDaily",income:"income",balanceSheet:"balanceSheet",cashFlow:"cashFlow",forecast:"forecast",express:"express",dividend:"dividend",financialIndicator:"financialIndicator",financialMainbiz:"financialMainbiz",disclosureDate:"disclosureDate",pledgeStat:"pledgeStat",pledgeDetail:"pledgeDetail",trend:"trend"},u={daily:{name:"daily",path:s.daily,ext:""},adjustFactor:{name:"adjustFactor",path:s.daily,ext:".adj"},suspendInfo:{name:"suspendInfo",path:s.info,ext:".sus"},dailyBasic:{name:"dailyBasic",path:s.info,ext:".bsc"},moneyFlow:{name:"moneyFlow",path:s.info,ext:".mf"},indexDaily:{name:"indexDaily",path:s.daily,ext:""},income:{name:"income",path:s.financial,ext:".ic"},balanceSheet:{name:"balanceSheet",path:s.financial,ext:".bs"},cashFlow:{name:"cashFlow",path:s.financial,ext:".cf"},forecast:{name:"forecast",path:s.financial,ext:".fc"},express:{name:"express",path:s.financial,ext:".ep"},dividend:{name:"dividend",path:s.financial,ext:".dd"},financialIndicator:{name:"financialIndicator",path:s.financial,ext:".id"},financialMainbiz:{name:"financialMainbiz",path:s.financial,ext:".mb"},disclosureDate:{name:"disclosureDate",path:s.financial,ext:".dt"},pledgeStat:{name:"pledgeStat",path:s.financial,ext:".ps"},pledgeDetail:{name:"pledgeDetail",path:s.financial,ext:".pd"},trend:{name:"trend",path:s.daily,ext:".tr"}};async function m(e,t){if(!f[e])throw new Error("不支持的数据类型："+e);if(a.isEmpty(t))throw new Error("未设置读取股票代码");let i={updateTime:null,data:[]},s=u[e];try{await h();let a=y(e,t);r.debug(`读取本地数据 ${t}.${e}，参数配置 %o，文件 ${a}`,s);try{i=JSON.parse(await n.readFile(a,"utf-8"))}catch(n){n&&"ENOENT"===n.code?r.debug(`读取${t}的${e}文件${a}不存在，%o`,n):r.error(`读取${t}的${e}文件${a}时发生错误：${n}, %o`,n),i={data:[]}}}catch(a){r.error(`从本地读取个股数据${e}时发生错误 ${a}`)}return i}function y(e,i){let n=u[e];if(!n)throw new Error("不支持的数据类型"+e);if(a.isEmpty(i))throw new Error("未设置读取股票代码");return t.join(l(),n.path,i+n.ext+".json")}async function h(){let a=l();try{await n.access(a,i.constants.F_OK|i.constants.R_OK|i.constants.W_OK)}catch(e){r.debug("检查数据根目录错误 "+e),await n.mkdir(a,{recursive:!0})}for(let e of Object.keys(s)){let c=t.join(a,s[e]);try{await n.access(c,i.constants.F_OK|i.constants.R_OK|i.constants.W_OK)}catch(a){r.debug(`检查目录${s[e]}错误 ${a}`),await n.mkdir(c,{recursive:!0})}}}h();export{s as DATA_PATH,o as INDEXLIST_FILE,c as STOCKLIST_FILE,l as getDataRoot,y as getStockDataFile,m as readStockData,p as readStockIndexList,d as readStockList,f as stockDataNames};