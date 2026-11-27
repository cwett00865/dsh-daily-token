# dsh-daily-token

在 DeepSeek Harness（DSH）侧边栏显示每日 Token 用量，以及一行实时生成速度。

## 功能

- 侧边栏底部有个「今日 Token」按钮，点击展开浮层：今日用量合计，以及输入 / 输出 / 缓存读取 / 缓存写入四项明细；下面近 7 天 / 30 天用量趋势柱状图，点某一天的柱子可以和今天并排对比。
- 设置页里的「Token 用量」整页：日期对比、趋势（近 7 天 / 近 30 天 / 自选区间）、按模型拆分当天用量、逐日明细表、区间合计与日均。
- 按钮里常驻一行 `xx.x tok/s · 估算`，显示全局实时生成速度，每秒刷新。

## 安装

先克隆或下载到固定目录，再用 dsh 命令装：

```bash
dsh plugin --profile desktop add link:<插件目录>
```

装完重启 DSH。左栏底部出现「今日 Token」按钮即装好。

需要 DSH 版本 `>=0.2.0-rc.1 <0.3.0-0`。

## 数据来源

用量数据读自本机 cost-meter 插件的账本 `~/.dsh/storages/cost-meter/ledger.json`，用 `os.homedir()` 拼路径。所以要先让 cost-meter 正常记录一段时间，这里才有数。浏览器不能直接读本机文件，插件通过 host 侧接口 `GET /daily-token/api/summary` 中转返回。

计费口径：合计 = 输入 + 缓存读取 + 输出 + 缓存写入。推理 token 已算在输出里，不重复计。

## 关于实时速度

`tok/s` 是按文字增量估算的：中文等宽字符按 1 字 ≈ 1 token，英文约 4 字符 ≈ 1 token，用 3 秒滑动窗口算速率。它不是模型的精确 token 计数，所以界面上标了「估算」。全局统计，包含所有会话。

host 侧挂 DSH 的 `agent/assistant-stream` 事件做只读观察，不改模型流、不写账本。

## 开发

零依赖，纯 Node.js。

```bash
node test/summary.test.js
node test/tokenRate.test.js
```
