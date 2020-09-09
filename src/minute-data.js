/**
 * 分钟数据的转换和保存
 * 转换来源：wind导出的分钟数据，支持多个不同类别，1m, 5m, 30m, 60m
 * 保存：存入到Sqlite文件中
 *
 * Sqlite 数据表定义
 * Minutes
 * symbol,STRING,
 * type,INTEGER
 * date,STRING
 * time,STRING
 * open,DECIMAL(10,3)
 * high,DECIMAL(10,3)
 * low,DECIMAL(10,3)
 * close,DECIMAL(10,3)
 * vol,BIGINT
 * capital,BIGINT
 * count,INTEGER
 * updatedAt,DATE
 */
