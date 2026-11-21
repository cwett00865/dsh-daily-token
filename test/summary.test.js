import assert from 'node:assert/strict'
import { sumDay, sumByModel, dateKeys, buildTrend, formatNumber } from '../lib/summary.js'

// 计费口径：不含 reasoning
assert.deepEqual(
  sumDay({ input: 10, output: 20, cacheRead: 30, cacheWrite: 5, reasoning: 999, calls: 2 }),
  { input: 10, output: 20, cacheRead: 30, cacheWrite: 5, calls: 2, total: 65 },
)
// 字段缺失按 0
assert.deepEqual(sumDay({ input: 7 }), { input: 7, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, total: 7 })
// 全空对象不崩
assert.equal(sumDay({}).total, 0)

// 日期序列：含今天、长度对、升序
const keys = dateKeys('2026-11-20', 7)
assert.equal(keys.length, 7)
assert.equal(keys[6], '2026-11-20')
assert.equal(keys[0], '2026-11-14')

// 趋势填补：30 天里只有 2 天有数据，长度仍 30，其余填 0
const days = { '2026-11-19': { input: 100, output: 50 }, '2026-11-20': { input: 200, cacheRead: 800 } }
const trend = buildTrend(days, '2026-11-20', 30)
assert.equal(trend.length, 30)
assert.equal(trend[29].total, 1000)
assert.equal(trend[28].total, 150)
assert.equal(trend[0].total, 0)
assert.equal(trend[0].date, '2026-10-22')

// 按模型汇总：跨 session 合并同一模型，按 total 降序，reasoning 不进 total
const byModel = sumByModel({
  sessions: [
    { byProviderModel: { 'a:m1': { input: 10, output: 5, cacheRead: 100, calls: 2 }, 'a:m2': { input: 1, output: 1, calls: 1 } } },
    { byProviderModel: { 'a:m1': { input: 20, output: 15, cacheRead: 0, reasoning: 999, calls: 3 } } },
  ],
})
assert.deepEqual(byModel.map((r) => r.model), ['a:m1', 'a:m2'])
assert.deepEqual(byModel[0], { model: 'a:m1', input: 30, output: 20, cacheRead: 100, cacheWrite: 0, calls: 5, total: 150 })
assert.equal(byModel[1].total, 2)
// 没有 sessions / 没有 byProviderModel 时返回空数组，不崩
assert.deepEqual(sumByModel({}), [])
assert.deepEqual(sumByModel({ sessions: [{}, null] }), [])

// 格式化三档
assert.equal(formatNumber(9999), '9999')
assert.equal(formatNumber(10000), '1.0万')
assert.equal(formatNumber(100000000), '1.00亿')

console.log('summary.test: all passed')
