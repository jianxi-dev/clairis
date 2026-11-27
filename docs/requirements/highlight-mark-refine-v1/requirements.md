---
title: "highlight-mark-refine-v1 需求四要素"
type: requirements
status: active
last_updated: 2026-11-27
spec_issue: https://github.com/jianxi-dev/clairis/issues/1651
---

# highlight-mark-refine-v1 需求四要素

> 来源：用户 2026-11-27 高亮块与标注呈现反馈批次（6 条 + 6 张截图）+ quiet-md 逆向着色器参照。
> 输入对账：待 spec issue 建立后回填其 `## 输入对账` 评论链接（G0 阶段先落 `.artifacts/highlight-mark-refine-v1/reconciliation-table.md`）。
> 决策：D1–D12 见 `openspec/changes/highlight-mark-refine-v1/design.md`。

## What（做什么）

修正纯高亮块与标注在**预览态与编辑态**的呈现落差，并重构 emoji 取色器与工具条入口，归为五个可独立验收的切片：

1. **预览态高亮块与标注空标题**：预览态 `[!highlight]` 与编辑态同形（无左边框、无标题栏、1px 全边框、4px 圆角、强叠底）；标注（13 类）标题未填写时只渲染 emoji、不渲染默认名称；纯高亮完全不渲染标题行。emoji 与正文同行、悬挂缩进（编辑态与预览态一致）。
2. **编辑态纯高亮 emoji 悬挂对齐**：emoji 在首行行首，正文首行紧接其后，正文换行后左缘与正文列对齐（emoji 下方不出现空行）。
3. **高亮颜色面板**：色块面积缩到 1/4（`44×40` → `22×20`，行内 gap `8px` → `4px`），面板宽度保持 216px 且每行 8 格不换行；选色与「随机」后当前值色块 `data-active` 立即刷新（原地更新，不重建面板、不关闭）。
4. **emoji 库与取色器重构**：换用 quiet 的 `emoji.tsv` 全量（1578 条、7 分类）；取色器改为 8 页签（最近 / 表情符号 / 动物 / 食物 / 活动 / 地点 / 物件 / 符号）；「最近」页签分两段（上「常用」= 现 20 个精选，下「最近」= 最近使用，localStorage 持久化、去重、最新在前、上限 20）；顶部搜索框右侧新增「随机」按钮。
5. **图标与工具条居中**：新增 `PaletteOutlined`（调色板图形）作为标注与纯高亮两条工具条的颜色入口图标；两条工具条都水平居中于块盒（中心偏差 ≤ 2px）；纯高亮手柄图标改为新增 `HighlightBlockOutlined`（圆角矩形框 + 下方两行）。

## Why（为什么）

- 预览态 `[!highlight]` 仍走通用 `.callout` 的 3px 左边框 + 标题栏，与编辑态的「无左边框、无标题栏、1px 全边框」不同形——同一份 markdown 在编辑态与预览态看起来是两个块。
- 预览态 `convertCallouts` 的 `const title = titleHtml || label` 强制回退默认名，标注未填标题时预览会印出「注释 / 信息 / …」字样，纯高亮也会印出「纯高亮」——用户要的是「未填写就不显示」。
- 编辑态纯高亮的 emoji 独占一行（`.cm-callout-header-mark` 是独立块行），正文从下一行开始，emoji 下方出现空行，与豆包式「emoji 与首行正文同行、换行对齐正文列」的观感不符。
- 高亮颜色面板色块 44×40 过大，一屏只能放 4 行；选中态 `data-active` 在构建时算一次，选色或随机后不刷新，用户看不到当前值落在哪一格。
- emoji 取色器只有 20 个硬编码选项、只能搜索，没有分类、没有最近、没有随机；用户要的是 quiet 式全量库 + 8 页签 + 最近 + 随机。
- 两条工具条颜色入口图标不一致（标注用 `FontcolorOutlined`、纯高亮用 `HighlighterOutlined`），且标注工具条左对齐、纯高亮居中——用户要两条都居中且共用调色板图标。
- 纯高亮块手柄仍是荧光笔图标，用户要「圆角矩形框 + 下方两行」的块形图标。

## Scope（范围）

- 渲染：`src/renderers/markdown.ts`（`convertCallouts`）、`src/styles/reader.css`（预览 `.callout` / `[data-callout="highlight"]`）。
- 编辑态装饰：`src/editors/decorations/callout.ts`（`toDOM` 的 mark 分支与 emoji 结构）、`src/styles/editor.css`（`.cm-callout-mark` / `.cm-callout-content` / `.cm-highlight-color-panel`）。
- 面板与工具条：`src/editors/orchestration/callout-color-panel.ts`、`src/editors/orchestration/floating-toolbar.ts`、`src/editors/orchestration/block-handle.ts`。
- emoji：`src/editors/decorations/callout-emoji.ts`、`src/editors/callout-types.ts`、新增 `src/editors/emoji-data/`（`emoji.tsv` + 运行时解析）。
- 图标：`src/editors/icons.ts`（新增 `PaletteOutlined` / `HighlightBlockOutlined`）。
- 规格：`openspec/specs/editing/spec.md` E-48 两处冲突条款 supersede + 3 条 ADDED 需求。
- 测试：`src/__tests__/`（渲染、面板、取色器、图标）、`e2e/`（高亮面板、工具条、预览排版）。

## Non-goals（范围外）

- 不改 `[!highlight]` 的 markdown 序列化格式（仍写 `> [!highlight]` + 既有属性块）。
- 不改 24 格色值表（`HIGHLIGHT_*` 四组色值逐字保留）。
- 不为 callout emoji 增加 markdown 持久化位（#361 限制维持）：会话内覆盖只存 localStorage / store 附属，预览读取。
- 不改块菜单「颜色」行的 `FormatColorTextOutlined`（A 字形）与 `text` 作用域（只作用于标题与正文）。
- 不改标注（13 类）的 3px 左边框与标题栏形态。
- 不改字符级 `==text==` 高亮渲染。
- 不新增 npm 依赖（emoji 库以 Vite `?raw` 随仓库引入）。
- 不改 `readingMode` 优先级、`Cmd+Shift+U` 语义、瞬态浮层排除。

## 输入对账

见 `.artifacts/highlight-mark-refine-v1/reconciliation-table.md`（12 行，含 `确认：` 行）。spec issue 建立后在此回填 issue 号与 `## 输入对账` 评论链接。

## 验收锚点

见 `openspec/changes/highlight-mark-refine-v1/anchors.md`：R-1…R-5（对应 tasks 1.1–1.5），共 13 个锚点（A-1.1…A-5.3）。
