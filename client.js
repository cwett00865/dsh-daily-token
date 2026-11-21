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
        '.dt-h-row{display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:8px}',
        '.dt-total{font-size:28px;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums;color:var(--dsh-accent,var(--dsw-alias-state-business-primary,inherit))}',
        '.dt-detail{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px}',
        '.dt-detail-item{display:inline-flex;align-items:baseline;gap:4px}',
        '.dt-detail-k{color:var(--dsh-muted,var(--dsw-alias-label-tertiary,inherit))}',
        '.dt-detail-v{font-variant-numeric:tabular-nums}',
        '.dt-switch{display:inline-flex;flex-shrink:0;gap:6px;margin:2px 0 0}',
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
        '.dt-daterow{display:flex;align-items:center;gap:8px;padding:0 0 10px;margin-bottom:10px;border-bottom:1px solid var(--dsh-border,var(--dsw-alias-border-l2,currentColor))}',
        '.dt-date{flex:1 1 auto;min-width:0;padding:3px 6px;font:inherit;font-size:12px;line-height:16px;color:inherit;background:var(--dsh-bg,var(--dsw-alias-bg-layer-1,transparent));border:1px solid var(--dsh-border,var(--dsw-alias-border-l2,currentColor));border-radius:5px}',
        '.dt-today{flex:0 0 auto;padding:3px 10px;font:inherit;font-size:12px;line-height:16px;cursor:pointer;border-radius:5px;border:1px solid var(--dsh-accent,var(--dsw-alias-state-business-primary,currentColor));background:transparent;color:var(--dsh-accent,var(--dsw-alias-state-business-primary,inherit))}',
        '.dt-cmp{display:grid;grid-template-columns:52px 1fr 1fr;gap:4px 8px;align-items:baseline}',
        '.dt-cmp-h{font-size:11px;font-weight:600;color:var(--dsh-muted,var(--dsw-alias-label-tertiary,inherit));text-align:right}',
        '.dt-cmp-k{font-size:11px;color:var(--dsh-muted,var(--dsw-alias-label-tertiary,inherit))}',
        '.dt-cmp-k.dt-strong{font-size:12px;font-weight:700;color:var(--dsh-accent,var(--dsw-alias-state-business-primary,inherit))}',
        '.dt-cmp-v{font-size:12px;text-align:right;font-variant-numeric:tabular-nums}',
        '.dt-cmp-v.dt-strong{font-size:18px;font-weight:700;color:var(--dsh-accent,var(--dsw-alias-state-business-primary,inherit))}',
        '.dt-col.dt-pick{cursor:pointer}',
        '.dt-bars.dt-has-sel .dt-col:not(.dt-sel) .dt-bar{opacity:.4}',
        '.dt-bars.dt-has-sel .dt-col.dt-pick:hover .dt-bar{opacity:.85}',
        '.dt-col.dt-sel .dt-x-label{font-weight:700;color:var(--dsh-accent,var(--dsw-alias-state-business-primary,inherit))}',
      ].join('\n')
      document.head.appendChild(style)
    }

    function detail(label, value) {
      return h('div', { className: 'dt-detail-item', key: label },
        h('span', { className: 'dt-detail-k' }, label),
        h('span', { className: 'dt-detail-v' }, formatNumber(value)))
    }

    /** '2026-11-18' -> '11月18日' */
    function fmtDate(s) {
      const parts = String(s || '').split('-')
      if (parts.length !== 3) return String(s || '')
      return Number(parts[1]) + '月' + Number(parts[2]) + '日'
    }

    /** One comparison row: label, today's value, picked-day value. */
    function cmpRow(label, a, b, strong) {
      const v = 'dt-cmp-v' + (strong ? ' dt-strong' : '')
      const k = 'dt-cmp-k' + (strong ? ' dt-strong' : '')
      return h(React.Fragment, { key: label },
        h('div', { className: k }, label),
        h('div', { className: v }, formatNumber(a)),
        h('div', { className: v }, formatNumber(b)))
    }

    /** 7/30 day bar chart built from plain divs. Bar height = total / max total. Clicking a bar picks that day. */
    function chart(trend, pickedDate, onPick) {
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
          : h('div', { className: 'dt-bars' + (pickedDate ? ' dt-has-sel' : '') }, items.map((item, i) => {
              const total = Number(item && item.total) || 0
              const date = String((item && item.date) || '')
              const label = date.length >= 10 ? date.slice(5, 10) : date
              const title = date + ' · ' + formatNumber(total) + '（点击查看当天）'
              const pct = total > 0 ? (total / max) * 100 : 0
              const sel = !!pickedDate && date === pickedDate
              return h('div', {
                className: 'dt-col dt-pick' + (sel ? ' dt-sel' : ''),
                key: date || i,
                onClick: () => { if (date) onPick(date) },
              },
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
      const [pickedDate, setPickedDate] = useState('')
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
        fetch(API + '?days=' + days + (pickedDate ? '&date=' + encodeURIComponent(pickedDate) : ''), controller ? { signal: controller.signal } : undefined)
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
      }, [days, retry, pickedDate])

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
      const picked = hasData && pickedDate && data.selected ? data.selected : null
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
                      // 1) 日期选择 + 今日/所选日期对比
                      h('div', { className: 'dt-daterow' },
                        h('input', {
                          type: 'date',
                          className: 'dt-date',
                          value: pickedDate,
                          max: today.date,
                          title: '选择日期查看当天用量',
                          onChange: (e) => setPickedDate(e.target.value || ''),
                        }),
                        pickedDate
                          ? h('button', {
                              type: 'button',
                              className: 'dt-today',
                              onClick: () => setPickedDate(''),
                            }, '回到今天')
                          : null),
                      h('div', { className: 'dt-block' },
                        picked
                          ? h('div', { className: 'dt-cmp' },
                              h('div', { className: 'dt-cmp-k' }, ''),
                              h('div', { className: 'dt-cmp-h' }, '今日'),
                              h('div', { className: 'dt-cmp-h' }, fmtDate(picked.date)),
                              cmpRow('总计', today.total, picked.total, true),
                              cmpRow('输入', today.input, picked.input),
                              cmpRow('输出', today.output, picked.output),
                              cmpRow('缓存读', today.cacheRead, picked.cacheRead),
                              cmpRow('缓存写', today.cacheWrite, picked.cacheWrite))
                          : h('div', null,
                              h('div', { className: 'dt-h' }, '今日 Token'),
                              h('div', { className: 'dt-total' }, formatNumber(today.total)),
                              h('div', { className: 'dt-detail' },
                                detail('输入', today.input),
                                detail('输出', today.output),
                                detail('缓存读', today.cacheRead),
                                detail('缓存写', today.cacheWrite)))),
                      // 2) 7/30 切换 + 柱状图
                      h('div', { className: 'dt-block' },
                        h('div', { className: 'dt-h' }, '用量趋势'),
                        h('div', { className: 'dt-switch' },
                          h('button', {
                            type: 'button',
                            className: days === 7 ? 'dt-on' : '',
                            onClick: () => setDays(7),
                          }, '近 7 天'),
                          h('button', {
                            type: 'button',
                            className: days === 30 ? 'dt-on' : '',
                            onClick: () => setDays(30),
                          }, '近 30 天')),
                        chart(data.trend, pickedDate, (d) => setPickedDate(d))),
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
