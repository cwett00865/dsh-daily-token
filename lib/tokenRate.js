// 纯函数：把流式文字增量估成 token，并用滑动窗口算 tok/s。
// 不碰 ctx、不读文件，方便单测。
//
// 估算口径（用户已确认接受近似）：
//   - 中日韩文字/假名/全角标点：1 字 ≈ 1 token
//   - 其余字符（英文、数字、符号、空白）：约 4 字符 ≈ 1 token（每段向上取整）
// 说明：流式过程中宿主只给文字增量，精确 output token 数要等流结束的 usage 块，
// 所以这里只能是估算值；界面会标注「估算」。

/** 单字符是否按 CJK/全角计 1 token。 */
function isWideTokenChar(code) {
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK 统一表意文字
    (code >= 0x3400 && code <= 0x4dbf) || // CJK 扩展 A
    (code >= 0x20000 && code <= 0x2fa1f) || // CJK 扩展 B~F
    (code >= 0x3040 && code <= 0x30ff) || // 日文平假名/片假名
    (code >= 0x31f0 && code <= 0x31ff) || // 片假名语音扩展
    (code >= 0xac00 && code <= 0xd7af) || // 韩文音节
    (code >= 0x1100 && code <= 0x11ff) || // 韩文字母
    (code >= 0xff01 && code <= 0xff60) || // 全角字符/标点
    (code >= 0x3000 && code <= 0x303f) // CJK 符号与标点
  )
}

/**
 * 估一段文字大约等于多少 token。
 * @param {string} text
 * @returns {number} 非负整数
 */
function estimateTokens(text) {
  if (typeof text !== 'string' || text.length === 0) return 0
  let tokens = 0
  let latin = 0
  const flush = () => {
    if (latin > 0) {
      tokens += Math.ceil(latin / 4)
      latin = 0
    }
  }
  for (const ch of text) {
    if (isWideTokenChar(ch.codePointAt(0))) {
      flush()
      tokens += 1
    } else {
      latin += 1
    }
  }
  flush()
  return tokens
}

/**
 * 滑动窗口速率表：记录每个时间点的 token 数，算最近 windowMs 内的 tok/s。
 * 分母取 min(windowMs, max(1000ms, 实际经过时间))，避免流刚开始时虚高、
 * 又避免短流被固定窗口低估。
 */
class RateMeter {
  constructor(windowMs = 3000) {
    this.windowMs = windowMs > 0 ? windowMs : 3000
    /** @type {{t:number, n:number}[]} 按时间单调递增 */
    this.samples = []
  }

  /** 记一笔 token；ts 可注入便于测试。 */
  add(tokens, ts = Date.now()) {
    const n = Number(tokens) || 0
    if (n <= 0) return
    const last = this.samples.length ? this.samples[this.samples.length - 1].t : -Infinity
    const t = Number.isFinite(ts) ? Math.max(ts, last) : Date.now()
    this.samples.push({ t, n })
    this.trim(t)
  }

  trim(now) {
    const cutoff = now - this.windowMs
    let i = 0
    while (i < this.samples.length && this.samples[i].t < cutoff) i++
    if (i > 0) this.samples.splice(0, i)
  }

  /** 当前速率（tok/s，保留 1 位小数）；无样本返回 0。 */
  rate(now = Date.now()) {
    this.trim(now)
    if (this.samples.length === 0) return 0
    let sum = 0
    for (const s of this.samples) sum += s.n
    const oldest = this.samples[0].t
    const span = Math.min(this.windowMs, Math.max(1000, now - oldest))
    return Math.round((sum / (span / 1000)) * 10) / 10
  }

  clear() {
    this.samples.length = 0
  }
}

export { estimateTokens, RateMeter }
