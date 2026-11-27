---
title: "highlight-mark-refine-v1 需求输入包（L-1 五条契约）"
type: requirements
status: active
last_updated: 2026-11-27
---

# 需求输入包（L-1 契约门自证）

> 本 change 属「用户反馈修正 + 竞品对标（quiet-md emoji 库与取色器）」，按 `docs/agents/quality-gates.md` L-1 交付五条契约证据。
> 来源批次：用户 2026-11-27 高亮块与标注呈现反馈 6 条 + 截图 6 张。

## 1. 来源可追溯

| 来源 | 类型 | 支撑的决策 |
|---|---|---|
| `/Users/mason/Downloads/高亮调整颜色窗口截图.png`（截图#1） | 用户截图（当前态） | 高亮颜色面板现状：44px 宽色块、三行（字体/边框/填充）、选中态蓝描边 |
| `/Users/mason/Downloads/quiet高亮emoji.png`（截图#2） | 竞品截图（目标态） | 取色器布局：顶部搜索 + 随机、最近行、分类网格、底部 8 页签 |
| `/Users/mason/Downloads/目前高亮块emoji和文字位置截图.png`（截图#3） | 用户截图（当前态） | 编辑态 emoji 独占一行、正文从下一行开始 |
| `/Users/mason/Downloads/豆包高亮文字和emoji位置截图.png`（截图#4） | 竞品截图（目标态） | emoji 与首行正文同行、换行对齐正文列 |
| `/Users/mason/Downloads/高亮图标.png`（截图#5） | 竞品截图（目标态） | 纯高亮手柄图标：圆角矩形框 + 下方两行 |
| `/Users/mason/Downloads/纯高亮手柄图标及调整颜色图标.png`（截图#6） | 竞品截图（目标态） | 调色板图标（调色盘图形）+ 手柄与调色板图标簇 |
| `/Users/mason/ToHighs/AI-doc/竞品分析学习/quiet-md-main/crates/core/src/emoji.tsv` | 一手竞品数据（1578 行 TSV） | D6 emoji 库全量、7 分类（cat 0..6） |
| `/Users/mason/ToHighs/AI-doc/竞品分析学习/quiet-md-main/src/editor/emoji.rs` | 一手竞品实现 | D7 分类常量、常用表、`RANDOM_BLOCKLIST` 语义；D8 随机 |
| `/Users/mason/ToHighs/AI-doc/竞品分析学习/quiet-md-main/src/editor/emoji_picker.rs` | 一手竞品实现 | D7 8 页签布局（`NAV`）、最近段、底栏 |
| 用户 2026-11-27 反馈批次（6 条） | 用户需求 | D1–D12 全部决策 |
| 用户 2026-11-27「按默认」确认 | 用户裁决 | 对账表 12 行全按默认 |

## 2. 空白显式化（open-question）

无 open-question。所有歧义点均在对账表「歧义点/候选」列给出候选并写明默认，用户已确认「全按默认」。

未决项：无。

## 3. 一手证据

- `src/renderers/markdown.ts:783`：`const title = titleHtml || label`——预览态强制回退默认名（D2 的缺陷根因）。
- `src/renderers/markdown.ts:785-797`：预览态统一 `el.className = "callout"` + `.callout-title`，无 mark 分支（D1 缺陷根因）。
- `src/styles/reader.css:1036-1059`：预览 `.callout` = 3px 左边框 + `.callout-title` 标题行；`[data-callout="highlight"]`（1148-1151、1207-1210）只覆盖颜色变量。
- `src/styles/editor.css:2957-2979`：编辑态 `.cm-callout-mark` = 1px 全边框 + `border-inline-start-width: 0` + 4px 圆角；`.cm-callout-header-mark` 是独立块行（D3 缺陷根因）。
- `src/styles/editor.css:3091-3101`：`.cm-callout-content` 有 `margin-top: 0.35em`，正文与 emoji 行分离。
- `src/styles/editor.css:3779-3799`：`.cm-highlight-color-panel .cm-color-row { gap: 8px }`、`.cm-color-swatch { width: 44px; height: 40px }`、`[data-active="true"]` 描边（D4 现状）。
- `src/editors/orchestration/callout-color-panel.ts:216-291`：`buildHighlightColorPanel` 的 `data-active` 在 `addRow` 内计算一次；`onPick` / `onRandom` 回调不刷新面板（D5 缺陷根因）。
- `src/editors/decorations/callout-emoji.ts:108-171`：取色器只有搜索 + 20 个 `CALLOUT_EMOJI_CHOICES`，无页签 / 最近 / 随机。
- `src/editors/callout-types.ts:146-171`：`CALLOUT_EMOJI_CHOICES` 20 项。
- `src/editors/orchestration/floating-toolbar.ts:330-332`：颜色入口图标 `mark ? HighlighterOutlined : FontcolorOutlined`（D9 缺陷根因）。
- `src/editors/orchestration/floating-toolbar.ts:988-990`：`preferredLeft` 仅 mark 居中、标注左对齐（D10 缺陷根因）。
- `src/editors/orchestration/block-handle.ts:54-67`：`BLOCK_ICON_NAME` 无 highlight 专用项，纯高亮走 `CalloutOutlined`（D10 缺陷根因）。
- `src/editors/icons.ts:500-504`：`HighlighterOutlined` 现状；`renderIcon`（812-853）支持 `stroke`。
- `src/editors/decorations/callout-emoji.ts:30-57`：`getCalloutEmojiOverrides` / `getCalloutEmojiOverride` 按 EditorView 存，仅经 `mdb:callout-emoji` 发布，无消费者（D11 缺陷根因）。

## 4. 冲突显式

| 冲突 | 裁定 |
|---|---|
| E-48（`openspec/specs/editing/spec.md:1924`）「纯高亮块的工具条 SHALL 水平居中于块盒（中心偏差 ≤ 2px）并使用荧光笔图标；标注块工具条位置与图标 SHALL 保持不变」 | 与 D9/D10 冲突。裁决：supersede 为「两条工具条均水平居中于块盒（中心偏差 ≤ 2px）+ 共用 `PaletteOutlined` 调色板图标」；块菜单「颜色」行仍为 `FormatColorTextOutlined` |
| E-48 同段「每行 SHALL 严格 8 格且 `flex-wrap: nowrap`」与 D4「色块缩到 1/4」 | 不冲突：8 格与不换行保留，仅改色块尺寸与 gap（22×20 / 4px） |
| E-48「字体色色块 SHALL 使用字母 A 字形（`FormatColorTextOutlined`）」 | 保留，不改 |
| E-48「`text` 只作用于标题与正文」 | 保留，不改 |
| quiet `emoji.rs` 的 `DEFAULT_FREQUENT` 15 项 vs 现 `CALLOUT_EMOJI_CHOICES` 20 项 | 裁决：D7「常用」段原样保留现 20 项，不换 quiet 的 15 项 |
| quiet `PER_LINE = 11` vs 现面板 8 格 | 裁决：每行格数沿用现面板（高亮 8 格），emoji 取色器格数不设死（按容器宽度自适应），不引入 11 格硬约束 |

## 5. 验收锚点

锚点在 `openspec/changes/highlight-mark-refine-v1/anchors.md` 逐条落（`cw-conformance.sh generate/lock`），来源标记为本文件 §3 一手证据行号与截图编号。关键锚点预览：

- 预览态 `[!highlight]` 计算 `border-inline-start-width: 0px`、`border-top-width: 1px`、`border-radius: 4px`（截图#3/#4 / D1）
- 预览态 `[!NOTE]` 无标题时 `.callout-title` 节点数为 0（D2 / 一手证据 `markdown.ts:783`）
- 编辑态纯高亮 emoji 与首行正文同行：emoji 右缘与正文首行左缘间距 ≤ 2px，正文第二行左缘与首行左缘对齐（截图#4 / D3）
- 高亮面板色块计算 `width: 22px`、`height: 20px`、行 `gap: 4px`、每行 8 格不换行（截图#1 / D4）
- 选色后当前值色块 `data-active="true"` 即时刷新、面板不关闭（D5）
- 取色器 8 页签 + 最近段两分段 + 随机按钮（截图#2 / D7 / D8）
- 两条工具条中心偏差 ≤ 2px、颜色入口 `data-icon="PaletteOutlined"`（截图#6 / D9 / D10）
- 纯高亮手柄 `data-icon="HighlightBlockOutlined"`（截图#5 / D10）
