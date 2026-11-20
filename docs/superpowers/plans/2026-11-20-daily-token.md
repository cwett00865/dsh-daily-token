# dsh-daily-token 实施计划

> 给实现者：用 superpowers:subagent-driven-development 或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 勾选跟踪。

**Goal:** 做一个独立 DSH 插件，读本机 cost-meter 账本，在左栏底部显示今日 token 用量和 7/30 天趋势。

**Architecture:** host 侧（index.js）注册一条 HTTP 路由读 ledger.json，用纯函数（lib/summary.js）算汇总；client 侧（client.js）挂 `sidebar.footer.action` 槽位，加载时请求路由，渲染按钮 + 浮层。两层通过 JSON 接口通信。

**Tech Stack:** Node ESM（`type: module`），零外部依赖，host 用 ctx.inject + webServer.register，client 用 window.__ModuleLoader__ + React.createElement，测试用 node 原生断言。

**Spec:** `D:\WORK\dsh-daily-token\docs\superpowers\specs\2026-11-20-daily-token-design.md`

## Global Constraints

- 计费口径：`total = input + cacheRead + output + cacheWrite`，**不含 reasoning**。
- 账本路径：`os.homedir() + '/.dsh/storages/cost-meter/ledger.json'`，不写死盘符。
- 接口：`GET /daily-token/api/summary?days=7|30`，返回 `{ today, trend, stale }`。
- 今日/趋势日期用本机时区（Asia/Shanghai），"今日"取本机当天。
- client 请求走 dsh 封装，不裸 fetch 外部地址；样式用 `var(--dsh-*)` / `data-theme`，不写死颜色。
- host 所有文件 IO 包 try/catch，失败返回 `stale:true` + 空数据，不拖垮会话。
- 兼容性声明：dsh `>=0.2.0-rc.1 <0.3.0-0`；client `platform: web`。
- `D:\WORK` 非 git 仓库：本计划所有"提交"步骤改为"保存文件"，不做 git commit。
- 测试用 `node test/summary.test.js` 直接跑，**不 spawn 子进程**（沙箱 EPERM）。

## Review Focus

以下几类输入最容易坑人但单测不一定覆盖，实现时按这里的期望行为处理，并把对应验证加到任务步骤里：

1. 账本某天 `days[key]` 存在但缺字段（如无 `cacheWrite`）→ 缺失字段按 0，不崩；total 仍算得出。→ Task 2 测试断言。
2. 请求 days=30 但账本只有约 22 天数据 → trend 长度必须正好 30，缺的日期填 0 且 date 字段填对应日期。→ Task 2 测试断言。
3. 账本文件不存在 / JSON 解析失败 → host 返回 `stale:true` + 空 today + 空 trend；client 显示「暂无数据」+ 重试按钮，不弹窗。→ Task 3 手动验证 + Task 4。
4. `reasoning` 字段有值但绝不能被算进 total（重复计费）。→ Task 2 测试断言。
5. 数字格式化边界：9999→"9999"，10000→"1.0万"，100000000→"1.00亿"。→ Task 2 测试断言。
6. client 请求失败（网络/路由 404）也要显示「暂无数据」+ 重试，不能白屏或报错。→ Task 4 实现 + 手动验证。

---

## 文件结构

```
D:\WORK\dsh-daily-token\
  package.json                          # ESM 声明 + dsh bundle/client 配置
  cordis.patch.yml                      # 插件注入条目
  index.js                              # host：路由接线 + 读账本 + 兜底
  lib\summary.js                        # 纯函数：汇总/日期/格式化
  client.js                             # client：槽位注册 + 渲染 + 请求
  test\summary.test.js                  # 纯函数单测
  docs\superpowers\specs\...design.md   # 已写
  docs\superpowers\plans\...daily-token.md  # 本文件
```

## 参考范本（照抄结构，别重新发明）

- host 路由注册 + 路由对象：`C:\Users\G7\.dsh\profiles\desktop\node_modules\dsh-memory-layered\index.js`（搜 `apiRoute` / `webServer`）和 `src\api.js`（`createApiRoute`）。要点：
  - `ctx.inject(['webServer'], webCtx => webCtx.effect(() => webCtx.webServer.register(route), label))`
  - route 形如 `{ kind: 'prefix', path: '/daily-token/api', handler(req,res){...} }`
- client 骨架 + 槽位注册：`C:\Users\G7\.dsh\profiles\desktop\node_modules\dsh-memory-layered\client.js`（末尾 `return { inject, apply }`）。要点：
  - `window.__ModuleLoader__.load({ id, factory(require){ const React=require('react'); ... return { inject:['slots'], apply(ctx){...} } } })`
  - `ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name:'sidebar.footer.action', id:'daily-token', order:0, label:()=>'Token 用量' }, Component))`
- client 请求 host：参照同文件里 `rpc.call('/api', 'method', payload, signal)` 的模式；路由路径与 host 的 `path` 对齐。实现时若 rpc 映射对不上，退化为 `fetch('/daily-token/api/summary?days='+days)`（同源相对路径），以实际能取到数据为准。

---

### Task 1: 项目骨架

**Files:**
- Create: `D:\WORK\dsh-daily-token\package.json`
- Create: `D:\WORK\dsh-daily-token\cordis.patch.yml`
- Create: `D:\WORK\dsh-daily-token\index.js`（最小 apply）
- Create: `D:\WORK\dsh-daily-token\client.js`（最小 load + apply）

**Interfaces:**
- Produces: 一个 dsh 能识别、能加载、不报错的空插件骨架。

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "dsh-daily-token",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "exports": { ".": "./index.js", "./package.json": "./package.json" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web" },
    "compatibility": { "dsh": ">=0.2.0-rc.1 <0.3.0-0" }
  }
}
```

- [ ] **Step 2: 写 cordis.patch.yml**

```yaml
- insert:
    - id: dsh-daily-token
      name: 'dsh-daily-token'
```

- [ ] **Step 3: 写 index.js 最小骨架**

```js
export function apply(ctx) {
  ctx.logger?.info?.('dsh-daily-token: loaded')
}
```

- [ ] **Step 4: 写 client.js 最小骨架**

```js
window.__ModuleLoader__.load({
  id: 'dsh-daily-token',
  factory(require) {
    const React = require('react')
    return {
      inject: ['slots'],
      apply(ctx) {
        // 槽位注册在 Task 4 填充
      },
    }
  },
})
```

- [ ] **Step 5: 保存文件**

确认四个文件都在 `D:\WORK\dsh-daily-token\` 下。此阶段不安装（安装见 Task 5）。

---

### Task 2: lib/summary.js 纯函数 + 单测

**Files:**
- Create: `D:\WORK\dsh-daily-token\lib\summary.js`
- Test: `D:\WORK\dsh-daily-token\test\summary.test.js`

**Interfaces:**
- Consumes: 账本 `days` 对象（`{ 'YYYY-MM-DD': {input,output,cacheRead,cacheWrite,calls,reasoning,...}, ... }`）。
- Produces:
  - `sumDay(day)` → `{ input, output, cacheRead, cacheWrite, calls, total }`，total 按计费口径，字段缺失按 0。
  - `dateKeys(todayDateStr, dayCount)` → `string[]`，最近 dayCount 个自然日（含 today）的 `YYYY-MM-DD`，按时间升序。
  - `buildTrend(days, todayDateStr, dayCount)` → `Array<{date,input,output,cacheRead,cacheWrite,calls,total}>`，长度正好 dayCount，无数据的日子全 0 但 date 填对应日期。
  - `formatNumber(n)` → `string`，三档格式化。

- [ ] **Step 1: 写失败测试 test/summary.test.js**

```js
import assert from 'node:assert/strict'
import { sumDay, dateKeys, buildTrend, formatNumber } from '../lib/summary.js'

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

// 格式化三档
assert.equal(formatNumber(9999), '9999')
assert.equal(formatNumber(10000), '1.0万')
assert.equal(formatNumber(100000000), '1.00亿')

console.log('summary.test: all passed')
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /d/WORK/dsh-daily-token && node test/summary.test.js`
Expected: 失败（模块不存在 / 函数未定义）。

- [ ] **Step 3: 实现 lib/summary.js**

按 Interfaces 里的签名实现四个纯函数。要点：
- `sumDay`：用 `Number(day?.x) || 0` 取值；`total = input + cacheRead + output + cacheWrite`；`reasoning` 完全不参与。
- `dateKeys`：从 today 字符串解析出 Date，用 UTC 方法按天递减生成字符串（避免本地时区 DST 影响），再 reverse 成升序。
- `buildTrend`：对 dateKeys 每个日期，`days[date]` 存在则 sumDay，否则全 0 对象但带 date。
- `formatNumber`：`>=1e8` → `(n/1e8).toFixed(2)+'亿'`；`>=1e4` → `(n/1e4).toFixed(1)+'万'`；否则 `String(n)`。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /d/WORK/dsh-daily-token && node test/summary.test.js`
Expected: 输出 `summary.test: all passed`，退出码 0。

- [ ] **Step 5: 保存文件**

---

### Task 3: host 路由（index.js 接线）

**Files:**
- Modify: `D:\WORK\dsh-daily-token\index.js`

**Interfaces:**
- Consumes: `lib/summary.js` 的 `sumDay`, `buildTrend`；账本文件路径规则。
- Produces: `GET /daily-token/api/summary?days=7|30` → JSON `{ today, trend, stale }`。

- [ ] **Step 1: 实现 index.js 路由**

骨架：

```js
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
```

- [ ] **Step 2: 保存文件**

- [ ] **Step 3: 手动验证（需先安装 + 重启，见 Task 5）**

重启 dsh 后用浏览器或 curl 访问 `http://127.0.0.1:9733/daily-token/api/summary?days=7`：
Expected: 200 + JSON，含 `today`（有 date/total/四项/calls）、`trend`（长度 7）、`stale:false`。
把账本临时改名再请求：Expected `stale:true`，today 全 0。改回。

---

### Task 4: client UI

**Files:**
- Modify: `D:\WORK\dsh-daily-token\client.js`

**Interfaces:**
- Consumes: `GET /daily-token/api/summary?days=N` 返回的 `{today,trend,stale}`；`lib/summary.js` 的 `formatNumber`（client 侧复制一份极简版，或内联同样逻辑——client 不能直接 import host 模块）。
- Produces: 左栏底部按钮 + 点击浮层。

- [ ] **Step 1: 实现 client.js**

要求（React.createElement，无 JSX、无构建）：
- `window.__ModuleLoader__.load({ id:'dsh-daily-token', factory(require){...} })`，`require('react')`。
- `return { inject:['slots'], apply(ctx){ ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name:'sidebar.footer.action', id:'daily-token', order:0, label:()=>'Token 用量' }, DailyTokenWidget)) } }`。
- `DailyTokenWidget` 用 hooks（useState/useEffect）：组件挂载时请求 `?days=7`，存 `{data, loading, error}`。
- 请求方式：先试 `window.__DSH_RPC__?.call?.('/api', 'daily-token/summary', {days}, signal)` 之类封装；若取不到，退回 `fetch('/daily-token/api/summary?days='+days)`（同源）。以实际取到数据为准，二选一即可，不要两条都留。
- 渲染：
  - 按钮文字：有数据→`今日 Token {formatNumber(today.total)}`；stale/错误→`Token 用量`。
  - 浮层：点按钮切换显示；点浮层外关闭（document click 监听，判断 target 不在组件容器内）。
  - 浮层内容三块：
    1. 今日总量大字 `formatNumber(today.total)` + 四项小字（输入 input / 输出 output / 缓存读 cacheRead / 缓存写 cacheWrite，各带 formatNumber）。
    2. 7/30 切换（`type` 切换 state，默认 7，切换时重新请求对应 days），柱状图：用普通 div/canvas 画，横轴 trend 的 date（显示 MM-DD），柱高按 total 相对最大值比例，空日子（total=0）不画柱；每柱 `title` 属性显示日期+formatNumber(total) 作悬浮提示。
    3. 底部小字「数据来自 cost-meter 账本」。
  - `stale===true` 或请求失败：浮层显示「暂无数据」+ 一个「重试」按钮（点它重新请求），不弹窗、不白屏。
- 样式用 `var(--dsh-*)` 主题变量，`data-theme` 适配；不写死颜色。
- formatNumber client 版：`>=1e8`→`x.xx亿`，`>=1e4`→`x.x万`，否则原样。

- [ ] **Step 2: 保存文件**

- [ ] **Step 3: 手动验证（需重启或 HMR，见 Task 5）**

打开 GUI：Expected 左栏底部出现「今日 Token xxx」按钮 → 点开见三块内容 → 7/30 切换数字变化 → 底部有来源标注 → 临时改坏账本再开，见「暂无数据」+ 重试。

---

### Task 5: 安装、备份、重启、全量验证

**Files:** profile 配置三个文件（备份，不改源码）

**Interfaces:**
- Consumes: Task 1–4 完成的插件目录。

- [ ] **Step 1: 备份 profile 配置**

备份 `C:\Users\G7\.dsh\profiles\desktop\` 下的三个配置文件（`package.json`、`cordis.patch.yml`、配置文件）到带时间戳的副本。

- [ ] **Step 2: 安装插件**

Run: `dsh plugin --profile desktop add link:D:\WORK\dsh-daily-token`
Expected: 命令成功，profile 里出现该插件条目。

- [ ] **Step 3: 重启 dsh**

host 改动必须重启才生效。重启后看启动日志无 `entry not found` / `dsh-daily-token` 加载报错。

- [ ] **Step 4: 全量验证**

依次确认：
1. 接口 `GET /daily-token/api/summary?days=7` 返回正确结构（Task 3 Step 3）。
2. 左栏底部入口出现且数字合理（对照账本今日 total）。
3. 浮层三块齐全，7/30 切换正常，柱状图显示。
4. 账本改名 → 「暂无数据」+ 重试；改回 → 点重试恢复。
5. 过程中 dsh 会话不正常/不卡死。

- [ ] **Step 5: 记录回滚方式**

记下：删 cordis.patch.yml 条目 → `dsh plugin remove dsh-daily-token` → 重启。备份文件保留位置。

---

## 完成后

全量验证通过后，按 finishing-a-development-branch 的思路收尾（本环境非 git 仓库，跳过 merge/PR，直接交付文件 + 验证结论）。
