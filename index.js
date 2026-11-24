import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { sumDay, sumByModel, buildTrend, buildRange } from './lib/summary.js'

const LEDGER = path.join(os.homedir(), '.dsh', 'storages', 'cost-meter', 'ledger.json')
// 自选区间最多 366 天，超了只取靠后的 366 天
const MAX_RANGE_DAYS = 366
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayStr() {
  // 本机时区的 YYYY-MM-DD
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`
}

async function readLedger() {
  try {
    const text = await fs.readFile(LEDGER, 'utf8')
    const obj = JSON.parse(text)
    return obj?.days && typeof obj.days === 'object' ? obj.days : null
  } catch {
    return null
  }
}

export function apply(ctx) {
  const route = {
    kind: 'prefix',
    path: '/daily-token/api',
    async handler(req, res) {
      const send = (code, body) => {
        res.statusCode = code
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(body))
      }
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        if (url.pathname !== '/daily-token/api/summary') { send(404, { error: 'not-found' }); return }
        const daysParam = Number(url.searchParams.get('days'))
        const days = [7, 30].includes(daysParam) ? daysParam : 7
        const rawDate = url.searchParams.get('date')
        const pickedDate = rawDate && DATE_RE.test(rawDate) ? rawDate : null
        // 自选区间：from/to 任一给了就按区间算；格式或日期非法时退回 days 口径
        const rawFrom = url.searchParams.get('from')
        const rawTo = url.searchParams.get('to')
        const wantRange = !!(rawFrom || rawTo)
        const ledgerDays = await readLedger()
        const ledger = ledgerDays || {}
        const today = todayStr()
        const pickedDay = pickedDate ? (ledger[pickedDate] || {}) : {}
        const selected = pickedDate
          ? { date: pickedDate, ...sumDay(pickedDay), byModel: sumByModel(pickedDay) }
          : null
        const customTrend = wantRange ? buildRange(ledger, rawFrom, rawTo, MAX_RANGE_DAYS) : null
        const trend = customTrend || buildTrend(ledger, today, days)
        const range = trend.length
          ? { from: trend[0].date, to: trend[trend.length - 1].date, days: trend.length }
          : { from: today, to: today, days: 0 }
        send(200, {
          today: { date: today, ...sumDay(ledger[today] || {}), byModel: sumByModel(ledger[today] || {}) },
          selected,
          trend,
          range,
          stale: !ledgerDays,
        })
      } catch (err) {
        ctx.logger?.warn?.('dsh-daily-token: api failed: ' + (err?.message ?? err))
        send(200, { today: { date: todayStr(), ...sumDay({}), byModel: [] }, selected: null, trend: [], range: null, stale: true })
      }
    },
  }
  if (typeof ctx.inject === 'function') {
    ctx.effect(() => {
      const fiber = ctx.inject(['webServer'], webCtx => {
        webCtx.effect(() => webCtx.webServer.register(route), 'dsh-daily-token: /daily-token/api')
      })
      return () => { try { fiber?.dispose?.() } catch {} }
    }, 'dsh-daily-token: api')
  }
  ctx.logger?.info?.('dsh-daily-token: loaded')
}
