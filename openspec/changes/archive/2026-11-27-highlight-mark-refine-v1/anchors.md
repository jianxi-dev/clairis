# 验收锚点 — highlight-mark-refine-v1

锚点来源：用户 2026-11-27 反馈批次与 6 张截图（截图#1 当前色板、截图#2 quiet 取色器、截图#3 当前 emoji 位置、截图#4 豆包目标位置、截图#5 手柄图标、截图#6 调色板图标）、决策 D1–D12、一手实现观察（`src/renderers/markdown.ts:783` `titleHtml || label`、`src/styles/reader.css:1036-1059` 预览 `.callout`、`src/styles/editor.css:2957-2979` `.cm-callout-mark`、`src/styles/editor.css:3779-3799` 色块 44×40、`src/editors/orchestration/callout-color-panel.ts:216-291` `data-active` 只算一次、`src/editors/orchestration/floating-toolbar.ts:330-332` 与 `988-990`、`src/editors/orchestration/block-handle.ts:54-67`）。R-1 对应 tasks 1.1（E-52 / D1 / D2 / D11）；R-2 对应 1.2（E-53 / D3）；R-3 对应 1.3（E-48 / D4 / D5）；R-4 对应 1.4（E-54 / D6 / D7 / D8）；R-5 对应 1.5（D9 / D10 / D12）。

## R-1 预览态同形与空标题（E-52）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 预览态纯高亮边框与圆角 | `.callout-mark` 计算 `border-inline-start-width: 0px`、`border-top-width: 1px`、`border-radius: 4px` | 截图#3 / D1 |
| A-1.2 | exact | 预览态纯高亮无标题栏 | `.callout-title` 节点数 = 0，文本不含「纯高亮」 | 截图#3 / D1 |
| A-1.3 | exact | 标注空标题不印默认名 | `> [!NOTE]` 预览 HTML 不含「注释」（命中数 0），`.callout-title` 元素 textContent 为空字符串、其 emoji 伪元素可见 | D2 / 一手 `markdown.ts:783` |
| A-1.4 | state-machine | 会话内改 emoji 对预览可见 | 编辑态改 "🚀" 后预览对应块 `data-callout-emoji` = "🚀"；未改块 = 类型默认 "🖍️" | D11 / 一手 `callout-emoji.ts:30-57` |

## R-2 纯高亮 emoji 悬挂缩进（E-53）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 编辑态 emoji 与首行同行 | emoji 右缘与正文首行左缘间距 ≤ 2px；正文首行 top 与 emoji top 差 ≤ 2px | 截图#4 / D3 |
| A-2.2 | exact | 正文换行对齐正文列 | 正文第二行左缘与首行左缘 x 坐标差 ≤ 1px（编辑态与预览态同） | 截图#4 / D3 |

## R-3 高亮颜色面板（E-48）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 色块尺寸 1/4 与面板几何 | 色块计算 `width: 22px`、`height: 20px`；行 `gap: 4px`；面板 `width: 216px`；每行 8 格不换行 | 截图#1 / D4 |
| A-3.2 | state-machine | 选色与随机后选中态即时刷新 | 新值色块 `data-active="true"`、旧值 `data-active="false"`，面板仍可见；随机后 `bg` 与 `border` 色块同时刷新 | D5 / 一手 `callout-color-panel.ts:264-269` |

## R-4 emoji 取色器（E-54）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 8 页签与常用段 | 页签数 = 8，顺序 `最近 / 表情符号 / 动物 / 食物 / 活动 / 地点 / 物件 / 符号`；「常用」段 = 24 项 | 截图#2 / D7 |
| A-4.2 | state-machine | 最近段持久化与随机 | 首次打开「最近」段 = 0 项；选后 = 1 项最新在前；点「随机」后 `data-callout-emoji` 变化且取色器仍可见 | 截图#2 / D7 / D8 |
| A-4.3 | exact | 全量库 | 解析后 emoji 条数 = 1578，分类数 = 7 | D6 / quiet `emoji.tsv` |

## R-5 图标与工具条（E-48 supersede / D9 / D10 / D12）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 两条工具条居中 | 两条工具条中心与块盒中心偏差 ≤ 2px | 截图#6 / D10 / 一手 `floating-toolbar.ts:988-990` |
| A-5.2 | exact | 颜色入口统一调色板 | 两条工具条颜色入口 `svg` 的 `data-icon` = `PaletteOutlined`（各恰 1 个） | 截图#6 / D9 / 一手 `floating-toolbar.ts:330-332` |
| A-5.3 | exact | 纯高亮手柄图标 | 纯高亮手柄 `data-icon` = `HighlightBlockOutlined`（恰 1 个）；标注手柄 ≠ 该值（0 个） | 截图#5 / D10 / 一手 `block-handle.ts:54-67` |
