# lib-wtda-query

用于处理量化计算数据的基础模块，处理本地数据的读取。

## 数据表定义

这里主要对日线数据相关的表做基础定义

### 历史数据

基础日线，包括分钟，日，周，月等不同周期

**表名 QUOTES**

| 字段名     | 类型           | 主键 | 可空 | 备注                                                                                       |
| ---------- | -------------- | ---- | ---- | ------------------------------------------------------------------------------------------ |
| TS_CODE    | VARCHAR(10)    | Y    | F    | 代码，带有市场                                                                             |
| TYPE       | VARCHAR(1)     |      | F    | 数据类型，取值如下 D 日线；W 周线；M 月线；1 1分钟；2 5分钟； 3 15分钟；4 30分钟；5 60分钟 |
| TRADE_DATE | VARCHAR(8)     |      | F    | 交易日期， YYYYMMDD                                                                        |
| TIME       | VARCHAR(12)    | Y    | F    | 数据的最后时间，YYYYMMDDHHmm                                                               |
| OPEN       | DECIMAL(12, 3) |      |      | 开盘价                                                                                     |
| HIGH       | DECIMAL(12, 3) |      |      | 最高价                                                                                     |
| LOW        | DECIMAL(12, 3) |      |      | 最低价                                                                                     |
| CLOSE      | DECIMAL(12, 3) |      |      | 收盘价                                                                                     |
| VOL        | INTEGER        |      |      | 成交量                                                                                     |
| AMOUNT     | INTEGER        |      |      | 成交额                                                                                     |
| COUNT      | INTEGER        |      |      | 成交笔数                                                                                   |
| UPDATEDAT  | TIMESTAMP      |      |      | 更新时间                                                                                   |