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
 * 解析 'YYYY-MM-DD' 成 UTC 毫秒；格式或日期非法返回 null（2026-02-31 这种也判非法）。
 * @param {string} dateStr
 * @returns {number|null}
 */
function parseDay(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const ms = Date.UTC(y, m - 1, d)
  const back = new Date(ms)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null
  return ms
}

/**
 * 生成 [from, to] 闭区间的日期序列，升序。起止写反了自动对调；跨度超过 maxDays 时保留靠后的 maxDays 天。
 * @param {string} fromStr - 'YYYY-MM-DD'
 * @param {string} toStr - 'YYYY-MM-DD'
 * @param {number} [maxDays=366]
 * @returns {string[]|null} 非法输入返回 null
 */
function rangeKeys(fromStr, toStr, maxDays = 366) {
  let from = parseDay(fromStr)
  let to = parseDay(toStr)
  if (from === null || to === null) return null
  if (from > to) { const t = from; from = to; to = t }
  const limit = Math.max(1, Math.floor(maxDays))
  const start = Math.max(from, to - (limit - 1) * 86400000)
  const keys = []
  for (let ms = start; ms <= to; ms += 86400000) {
    const date = new Date(ms)
    const yy = date.getUTCFullYear()
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(date.getUTCDate()).padStart(2, '0')
    keys.push(`${yy}-${mm}-${dd}`)
  }
  return keys
}

/**
 * 按 [from, to] 区间构造趋势数组；无数据的日子全 0 但带 date。
 * @param {object} days - 账本 days 对象
 * @param {string} fromStr
 * @param {string} toStr
 * @param {number} [maxDays=366]
 * @returns {Array<{date:string, input:number, output:number, cacheRead:number, cacheWrite:number, calls:number, total:number}>|null}
 */
function buildRange(days, fromStr, toStr, maxDays = 366) {
  const keys = rangeKeys(fromStr, toStr, maxDays)
  if (!keys) return null
  return keys.map((date) => {
    const day = days?.[date]
    if (day) return { date, ...sumDay(day) }
    return { date, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, total: 0 }
  })
}

/**
 * 按模型汇总一天的用量。账本里只有每条 session 带 byProviderModel，所以要逐条累加。
 * @param {object} day - 账本里某一天的记录，含 sessions[]
 * @returns {Array<{model:string, input:number, output:number, cacheRead:number, cacheWrite:number, calls:number, total:number}>} 按 total 降序
 */
function sumByModel(day) {
  const map = new Map()
  const sessions = Array.isArray(day?.sessions) ? day.sessions : []
  for (const session of sessions) {
    const models = session?.byProviderModel
    if (!models || typeof models !== 'object') continue
    for (const model of Object.keys(models)) {
      const one = models[model] || {}
      const agg = map.get(model) || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 }
      agg.input += toNum(one.input)
      agg.output += toNum(one.output)
      agg.cacheRead += toNum(one.cacheRead)
      agg.cacheWrite += toNum(one.cacheWrite)
      agg.calls += toNum(one.calls)
      map.set(model, agg)
    }
  }
  return Array.from(map.entries())
    .map(([model, agg]) => ({
      model,
      input: agg.input,
      output: agg.output,
      cacheRead: agg.cacheRead,
      cacheWrite: agg.cacheWrite,
      calls: agg.calls,
      total: agg.input + agg.cacheRead + agg.output + agg.cacheWrite,
    }))
    .sort((a, b) => b.total - a.total)
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

export { sumDay, sumByModel, dateKeys, buildTrend, rangeKeys, buildRange, parseDay, formatNumber }
