// 纯函数：账本按天汇总、日期序列、趋势填补、数字格式化。
// 计费口径：total = input + cacheRead + output + cacheWrite，绝不含 reasoning。

function toNum(value) {
  return Number(value) || 0
}

/**
 * 汇总单日账本记录。
 * @param {object} day - { input, output, cacheRead, cacheWrite, calls, reasoning, ... }
 * @returns {{input:number, output:number, cacheRead:number, cacheWrite:number, calls:number, total:number}}
 */
function sumDay(day) {
  const input = toNum(day?.input)
  const output = toNum(day?.output)
  const cacheRead = toNum(day?.cacheRead)
  const cacheWrite = toNum(day?.cacheWrite)
  const calls = toNum(day?.calls)
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    calls,
    total: input + cacheRead + output + cacheWrite,
  }
}

/**
 * 生成最近 dayCount 个自然日（含 today）的日期字符串，升序。
 * 用 UTC 方法按天递减，避免本地时区 DST 影响。
 * @param {string} todayDateStr - 'YYYY-MM-DD'
 * @param {number} dayCount
 * @returns {string[]}
 */
function dateKeys(todayDateStr, dayCount) {
  const [y, m, d] = todayDateStr.split('-').map(Number)
  const today = new Date(Date.UTC(y, m - 1, d))
  const keys = []
  for (let i = 0; i < dayCount; i++) {
    const date = new Date(today.getTime() - i * 86400000)
    const yy = date.getUTCFullYear()
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(date.getUTCDate()).padStart(2, '0')
    keys.push(`${yy}-${mm}-${dd}`)
  }
  return keys.reverse()
}

/**
 * 按 dateKeys 构造趋势数组；无数据的日子全 0 但带 date。
 * @param {object} days - 账本 days 对象
 * @param {string} todayDateStr
 * @param {number} dayCount
 * @returns {Array<{date:string, input:number, output:number, cacheRead:number, cacheWrite:number, calls:number, total:number}>}
 */
function buildTrend(days, todayDateStr, dayCount) {
  const keys = dateKeys(todayDateStr, dayCount)
  return keys.map((date) => {
    const day = days?.[date]
    if (day) return { date, ...sumDay(day) }
    return { date, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, total: 0 }
  })
}

/**
 * 三档格式化：>=1e8 亿（2 位小数），>=1e4 万（1 位小数），否则原样字符串。
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万'
  return String(n)
}

export { sumDay, dateKeys, buildTrend, formatNumber }
