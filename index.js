import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { sumDay, buildTrend } from './lib/summary.js'

const LEDGER = path.join(os.homedir(), '.dsh', 'storages', 'cost-meter', 'ledger.json')

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
        const days = [7, 30].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 7
        const ledgerDays = await readLedger()
        const today = todayStr()
        if (!ledgerDays) { send(200, { today: { date: today, ...sumDay({}) }, trend: buildTrend({}, today, days), stale: true }); return }
        send(200, {
          today: { date: today, ...sumDay(ledgerDays[today] || {}) },
          trend: buildTrend(ledgerDays, today, days),
          stale: false,
        })
      } catch (err) {
        ctx.logger?.warn?.('dsh-daily-token: api failed: ' + (err?.message ?? err))
        send(200, { today: { date: todayStr(), ...sumDay({}) }, trend: [], stale: true })
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
