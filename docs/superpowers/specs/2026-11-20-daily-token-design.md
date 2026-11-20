# dsh-daily-token 每日 Token 用量插件设计

## 目标

在 DSH 左栏底部做一个常驻入口，点开看今天的 token 用量和最近 7/30 天的趋势。数字取自本机 cost-meter 账本，插件自己读、自己算，不依赖网络。

这是一个独立插件，装到 desktop profile 里，和已有的 cost-meter 各自独立显示，展示内容允许重叠。

## 数据源

账本文件：`~/.dsh/storages/cost-meter/ledger.json`（约 797KB，单行 JSON）。用 `os.homedir()` 拼路径，不写死盘符。

文件里 `days` 是按日期 key 的对象，形如：

```
days["2026-11-20"] = {
  input, output, cacheRead, cacheWrite, reasoning,
  calls, cost, apiCost, costCny, costEur, ...
  sessions: [ { 同上字段, id, title, at, ... }, ... ]
}
```

取数只读 `days[日期]` 的顶层字段，不解压会话日志，也不累加 sessions。

账本现有数据从 2026-09-30 起，约 50 天；配置 `historyDays=180`，30 天趋势够用。没有记录的自然日按 0 处理，不算丢数据。

## 计费口径

今日总量和趋势每天的值，统一用这个公式：

```
total = input + cacheRead + output + cacheWrite
```

不含 `reasoning`。reasoning 一直是 output 的子集，价格表里没有它的单独单价，它的钱已经算进 output，再加一遍会重复。这个口径和账本自己的 cost 计算一致，用账本里 86 条带单价的记录反推验证过（66 条误差在 ±2% 内，其余是峰值时段加价，结构相同）。

`cacheWrite` 目前恒为 0，但字段保留，将来账本开始写这个值也能正确计入。

## 架构

两层，客户端 + 宿主：

```
client.js（浏览器） --fetch--> index.js（主进程） --读文件--> ledger.json
```

- `index.js`：host 侧，注册路由 `GET /daily-token/api/summary`。读账本、算汇总、返回结果。用 `ctx.effect` 注册路由并在退出时回收；用 `ctx.logger` 打日志，不用 console.log；所有文件 IO 包 try/catch。
- `lib/summary.js`：纯函数，不碰 ctx，只做「账本对象 + 今天日期 → 汇总结果」的换算，方便单测。
- `client.js`：浏览器侧，挂 `sidebar.footer.action` 槽位，页面加载和手动重试时请求上面的路由，渲染按钮和浮层。请求走 dsh 插件的 fetch 封装（`baseUrl` + `/api` 路径），不用裸 fetch 外部地址。

接口返回结构：

```
{
  today: { date, total, input, output, cacheRead, cacheWrite, calls },
  trend: [ { date, total, input, output, cacheRead, cacheWrite, calls }, ... ],  // 最近 7 或 30 个自然日，无数据填 0
  stale: false                                                                  // 账本读不到时为 true
}
```

`trend` 的长度由客户端请求的 `days` 参数决定（7 或 30），宿主按本机时区（`Asia/Shanghai`）生成日期序列。

## 文件结构

```
D:\WORK\dsh-daily-token\
  package.json
  cordis.patch.yml
  index.js
  lib\summary.js
  client.js
  test\summary.test.js
  docs\superpowers\specs\2026-11-20-daily-token-design.md
```

`package.json` 的 dsh 段：

```
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web" },
  "compatibility": { "dsh": ">=0.2.0-rc.1 <0.3.0-0" }
}
```

## UI

左栏底部一个入口按钮，平时显示简写，如「今日 Token 167万」。点击弹出浮层，点浮层外面或再点按钮关闭。

浮层从上到下三块：

1. **今日总量**：计费口径 total，大字。下面一行小字拆四项明细：输入 input、输出 output、缓存读 cacheRead、缓存写 cacheWrite，每项带数字。
2. **趋势区**：7/30 天切换，默认 7 天。柱状图，横轴日期、纵轴当天 total；没用的日子是 0、柱子为空；鼠标悬浮显示当天具体数字。
3. **数据来源**：底部一行小字「数据来自 cost-meter 账本」。

数字格式化：超过 1 亿显示「x.xx亿」，超过 1 万显示「x.x万」，否则原样显示。

样式用 dsh 现有主题变量（`var(--dsh-*)`、`data-theme`），不写死颜色。

## 容错

- 账本文件读不到、或 JSON 解析失败：宿主返回 `stale: true` 加空数据；客户端浮层显示「暂无数据」和一个重试按钮，不弹错误窗。点重试重新请求接口。
- 字段缺失（某天没 sessions、没 cacheWrite 等）：一律按 0 处理，不中断。
- 日期用本机时区（Asia/Shanghai），"今日"按本机当天算。
- 宿主所有文件 IO 都包 try/catch，失败退化成空数据，不让插件拖垮会话。

## 测试

零依赖，`node test/summary.test.js` 直接跑，不 spawn 子进程（避开沙箱 EPERM）。对 `lib/summary.js` 的纯函数造假数据验证：

1. total 算法正确（input + cacheRead + output + cacheWrite，不含 reasoning）。
2. 7/30 天日期序列填补正确，没数据的日子填 0。
3. 字段缺失时不崩，按 0 处理。
4. 数字格式化（万、亿、原样三档）。

## 安装与验证

1. 装之前备份 profile 的三个配置文件。
2. `dsh plugin --profile desktop add link:D:\WORK\dsh-daily-token`
3. 重启 dsh（host 改动必须重启）。
4. 验证：左栏底部出现入口 → 点开能看到今日数字和四项明细 → 趋势区 7/30 切换正常 → 底部有数据来源标注。
5. 容错验证：临时把账本改名，重开浮层应显示「暂无数据」+ 重试按钮；改名回来点重试应恢复数字。

client 部分的 HMR 只有在 `pnpm run dev:web` 同时跑着时才自动更新，否则改 UI 也要重启 dsh 才能看到。
