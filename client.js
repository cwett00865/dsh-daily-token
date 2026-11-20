/**
 * dsh-daily-token — client half.
 *
 * Registers one occupant on the `sidebar.footer.action` slot. The button shows
 * today's billed token total (from the host route `GET /daily-token/api/summary`);
 * clicking it opens a popover with today's breakdown, a 7/30 day bar chart and a
 * source note. No JSX, no build step, no external dependency: only `react` is
 * required from `window.__ModuleLoader__`.
 *
 * All colors come from theme variables via `var(--dsh-…, var(--dsw-…))` chains,
 * so `data-theme` switches (light/dark) are followed automatically. No color is
 * hardcoded, no dialog is used, and a stale/failed request degrades to an
 * inline "暂无数据 + 重试" state.
 */
window.__ModuleLoader__.load({
  id: 'dsh-daily-token',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef } = React

    const STYLE_ID = 'dsh-daily-token/widget'
    const API = '/daily-token/api/summary'

    /** Client-side copy of lib/summary.js formatNumber (client cannot import host modules). */
    function formatNumber(n) {
      const v = Number(n) || 0
      if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'
      if (v >= 1e4) return (v / 1e4).toFixed(1) + '万'
      return String(v)
    }

    /** Inject the widget stylesheet once. Every color resolves through theme variables. */
    function ensureStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById(STYLE_ID)) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = [
        '.dt-wrap{position:relative;display:inline-block;margin:12px 0 10px;font-family:inherit;font-size:12px;line-height:16px}',
        '.dt-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;font:inherit;font-size:12px;line-height:16px;cursor:pointer;border-radius:6px;border:1px solid var(--dsh-border,var(--dsw-alias-border-l2,currentColor));background:var(--dsh-bg,var(--dsw-alias-bg-layer-1,transparent));color:var(--dsh-text,var(--dsw-alias-label-primary,inherit))}',
        '.dt-btn:hover{border-color:var(--dsh-accent,var(--dsw-alias-state-business-primary,currentColor))}',
        '.dt-pop{position:absolute;left:0;bottom:calc(100% + 8px);width:320px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:14px;z-index:1000;border-radius:10px;border:1px solid var(--dsh-border,var(--dsw-alias-border-l2,currentColor));background:var(--dsh-bg-elevated,var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-1,transparent)));color:var(--dsh-text,var(--dsw-alias-label-primary,inherit))}',
        '.dt-block{padding:10px 0;border-bottom:1px solid var(--dsh-border,var(--dsw-alias-border-l2,currentColor))}',
        '.dt-block:last-child{border-bottom:0}',
        '.dt-h{margin-bottom:6px;font-weight:600;color:var(--dsh-text,var(--dsw-alias-label-primary,inherit))}',
        '.dt-h-row{display:flex;align-items:center;justify-content:space-between;gap:8px}',
        '.dt-total{font-size:28px;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums;color:var(--dsh-accent,var(--dsw-alias-state-business-primary,inherit))}',
        '.dt-detail{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px}',
        '.dt-detail-item{display:inline-flex;align-items:baseline;gap:4px}',
        '.dt-detail-k{color:var(--dsh-muted,var(--dsw-alias-label-tertiary,inherit))}',
        '.dt-detail-v{font-variant-numeric:tabular-nums}',
        '.dt-switch{display:inline-flex;gap:4px}',
        '.dt-switch button{padding:2px 8px;font:inherit;font-size:11px;line-height:16px;cursor:pointer;border-radius:4px;border:1px solid var(--dsh-border,var(--dsw-alias-border-l2,currentColor));background:var(--dsh-bg,var(--dsw-alias-bg-layer-1,transparent));color:var(--dsh-muted,var(--dsw-alias-label-tertiary,inherit))}',
        '.dt-switch button.dt-on{border-color:var(--dsh-accent,var(--dsw-alias-state-business-primary,currentColor));color:var(--dsh-accent,var(--dsw-alias-state-business-primary,inherit))}',
        '.dt-chart{margin-top:8px}',
        '.dt-bars{display:flex;align-items:flex-end;gap:2px;height:130px}',
        '.dt-col{flex:1 1 0;min-width:0;height:100%;display:flex;flex-direction:column;align-items:center}',
        '.dt-bar-slot{width:100%;height:92px;display:flex;align-items:flex-end;justify-content:center}',
        '.dt-bar{width:70%;max-width:16px;min-height:1px;border-radius:3px 3px 0 0;background:var(--dsh-accent,var(--dsw-alias-state-business-primary,currentColor))}',
        '.dt-x{position:relative;width:100%;height:34px;overflow:visible}',
        '.dt-x-label{position:absolute;top:0;left:50%;transform:translateX(-50%) rotate(-55deg);transform-origin:top center;font-size:9px;white-space:nowrap;color:var(--dsh-muted,var(--dsw-alias-label-tertiary,inherit))}',
        '.dt-src{padding-top:10px;font-size:11px;color:var(--dsh-muted,var(--dsw-alias-label-tertiary,inherit))}',
        '.dt-state{padding:8px 0;text-align:center;color:var(--dsh-muted,var(--dsw-alias-label-tertiary,inherit))}',
        '.dt-retry{display:block;margin:8px auto 0;padding:4px 14px;font:inherit;font-size:12px;line-height:16px;cursor:pointer;border-radius:5px;border:1px solid var(--dsh-accent,var(--dsw-alias-state-business-primary,currentColor));background:var(--dsh-bg,var(--dsw-alias-bg-layer-1,transparent));color:var(--dsh-accent,var(--dsw-alias-state-business-primary,inherit))}',
        '.dt-empty{padding:24px 0;text-align:center;font-size:11px;color:var(--dsh-muted,var(--dsw-alias-label-tertiary,inherit))}',
      ].join('\n')
      document.head.appendChild(style)
    }

    function detail(label, value) {
      return h('div', { className: 'dt-detail-item', key: label },
        h('span', { className: 'dt-detail-k' }, label),
        h('span', { className: 'dt-detail-v' }, formatNumber(value)))
    }

    /** 7/30 day bar chart built from plain divs. Bar height = total / max total. */
    function chart(trend) {
      const items = Array.isArray(trend) ? trend : []
      let max = 0
      for (let i = 0; i < items.length; i++) {
        const v = Number(items[i] && items[i].total) || 0
        if (v > max) max = v
      }
      if (max <= 0) max = 1
      return h('div', { className: 'dt-chart' },
        items.length === 0
          ? h('div', { className: 'dt-empty' }, '暂无趋势数据')
          : h('div', { className: 'dt-bars' }, items.map((item, i) => {
              const total = Number(item && item.total) || 0
              const date = String((item && item.date) || '')
              const label = date.length >= 10 ? date.slice(5, 10) : date
              const title = date + ' · ' + formatNumber(total)
              const pct = total > 0 ? (total / max) * 100 : 0
              return h('div', { className: 'dt-col', key: date || i },
                h('div', { className: 'dt-bar-slot' },
                  total > 0
                    ? h('div', { className: 'dt-bar', title: title, style: { height: pct + '%' } })
                    : null),
                h('div', { className: 'dt-x' },
                  h('span', { className: 'dt-x-label', title: title }, label)))
            })))
    }

    ensureStyle()

    function DailyTokenWidget() {
      const [days, setDays] = useState(7)
      const [result, setResult] = useState({ data: null, loading: true, error: null })
      const [open, setOpen] = useState(false)
      const [retry, setRetry] = useState(0)
      const rootRef = useRef(null)

      // Pure same-origin fetch, as ruled by the controller (no RPC branch).
      useEffect(() => {
        let cancelled = false
        let controller = null
        try { controller = typeof AbortController === 'function' ? new AbortController() : null } catch { controller = null }
        setResult({ data: null, loading: true, error: null })
        fetch(API + '?days=' + days, controller ? { signal: controller.signal } : undefined)
          .then((res) => {
            if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status))
            return res.json()
          })
          .then((json) => {
            if (!cancelled) setResult({ data: json && typeof json === 'object' ? json : null, loading: false, error: null })
          })
          .catch((err) => {
            if (!cancelled && !(err && err.name === 'AbortError')) setResult({ data: null, loading: false, error: err })
          })
        return () => {
          cancelled = true
          try { if (controller) controller.abort() } catch { /* ignore */ }
        }
      }, [days, retry])

      // Close on outside click; listener is removed on cleanup.
      useEffect(() => {
        if (!open || typeof document === 'undefined') return undefined
        function onDocClick(e) {
          const el = rootRef.current
          if (el && e.target && !el.contains(e.target)) setOpen(false)
        }
        document.addEventListener('click', onDocClick)
        return () => document.removeEventListener('click', onDocClick)
      }, [open])

      const data = result.data
      const hasData = !!(data && !data.stale && data.today && typeof data.today === 'object')
      const today = hasData ? data.today : null
      const noData = !result.loading && (!hasData || !!result.error)
      const buttonLabel = hasData ? '今日 Token ' + formatNumber(today.total) : 'Token 用量'

      return h('div', { className: 'dt-wrap', ref: rootRef },
        h('button', {
          type: 'button',
          className: 'dt-btn',
          title: '查看每日 Token 用量',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => setOpen((v) => !v),
        }, buttonLabel),
        open
          ? h('div', { className: 'dt-pop' },
              result.loading
                ? h('div', { className: 'dt-state' }, '加载中…')
                : noData
                  ? h('div', { className: 'dt-state' },
                      h('div', null, '暂无数据'),
                      h('button', {
                        type: 'button',
                        className: 'dt-retry',
                        onClick: () => setRetry((n) => n + 1),
                      }, '重试'))
                  : h('div', null,
                      // 1) 今日总量 + 四项明细
                      h('div', { className: 'dt-block' },
                        h('div', { className: 'dt-h' }, '今日 Token'),
                        h('div', { className: 'dt-total' }, formatNumber(today.total)),
                        h('div', { className: 'dt-detail' },
                          detail('输入', today.input),
                          detail('输出', today.output),
                          detail('缓存读', today.cacheRead),
                          detail('缓存写', today.cacheWrite))),
                      // 2) 7/30 切换 + 柱状图
                      h('div', { className: 'dt-block' },
                        h('div', { className: 'dt-h dt-h-row' },
                          h('span', null, '用量趋势'),
                          h('span', { className: 'dt-switch' },
                            h('button', {
                              type: 'button',
                              className: days === 7 ? 'dt-on' : '',
                              onClick: () => setDays(7),
                            }, '近 7 天'),
                            h('button', {
                              type: 'button',
                              className: days === 30 ? 'dt-on' : '',
                              onClick: () => setDays(30),
                            }, '近 30 天'))),
                        chart(data.trend)),
                      // 3) 数据来源
                      h('div', { className: 'dt-src' }, '数据来自 cost-meter 账本')))
          : null)
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register(
            {
              name: 'sidebar.footer.action',
              id: 'daily-token',
              order: 0,
              label: () => 'Token 用量',
            },
            DailyTokenWidget,
          ))
      },
    }
  },
})
