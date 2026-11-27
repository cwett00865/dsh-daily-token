import assert from 'node:assert/strict'
import { estimateTokens, RateMeter } from '../lib/tokenRate.js'

let pass = 0
function t(name, fn) {
  try { fn(); pass++; console.log('  PASS ' + name) }
  catch (e) { console.error('  FAIL ' + name + ': ' + e.message); process.exitCode = 1 }
}

console.log('tokenRate:')
t('空字符串 = 0', () => assert.equal(estimateTokens(''), 0))
t('非字符串 = 0', () => assert.equal(estimateTokens(null), 0))
t('纯英文 4 字符 = 1 token', () => assert.equal(estimateTokens('abcd'), 1))
t('英文 5 字符 = 2 token（向上取整）', () => assert.equal(estimateTokens('abcde'), 2))
t('一个中文 = 1 token', () => assert.equal(estimateTokens('中'), 1))
t('四字中文 = 4 token', () => assert.equal(estimateTokens('中文测试'), 4))
t('中英混排分别计', () => assert.equal(estimateTokens('你好abcd'), 3))
t('日文假名/韩文按宽字符', () => assert.equal(estimateTokens('こんにちは'), 5))
t('全角标点按宽字符', () => assert.equal(estimateTokens('你好，世界'), 5))

t('RateMeter 无样本 = 0', () => {
  const m = new RateMeter(3000)
  assert.equal(m.rate(10000), 0)
})
t('单笔 100 token 在 t=0，t=1000 时 = 100 tok/s', () => {
  const m = new RateMeter(3000)
  m.add(100, 0)
  assert.equal(m.rate(1000), 100)
})
t('单笔 100 token 在 t=0，t=500 时按最小 1000ms 分母 = 100', () => {
  const m = new RateMeter(3000)
  m.add(100, 0)
  assert.equal(m.rate(500), 100)
})
t('两笔共 300 token 跨度 2 秒 = 150 tok/s', () => {
  const m = new RateMeter(3000)
  m.add(100, 1000)
  m.add(200, 2000)
  assert.equal(m.rate(3000), 150) // 分母取数据跨度 2000ms，不是完整窗口
})
t('窗口外的样本被丢弃', () => {
  const m = new RateMeter(3000)
  m.add(100, 0)
  m.add(120, 2000)
  assert.equal(m.rate(4000), 60) // t=0 的样本已过期，剩 120/2s = 60
})
t('0 token 不计入', () => {
  const m = new RateMeter(3000)
  m.add(0, 0)
  m.add(undefined, 0)
  assert.equal(m.rate(1000), 0)
})
t('clear 后归零', () => {
  const m = new RateMeter(3000)
  m.add(100, 0)
  m.clear()
  assert.equal(m.rate(1000), 0)
})

console.log(`tokenRate: ${pass} passed`)
