## Context

E-48 与 editor-refine-batch2 把编辑态纯高亮落成了「无左边框、无标题栏、1px 全边框、4px 圆角、强叠底」，但预览态仍走通用 `.callout`（3px 左边框 + 标题栏），且 `convertCallouts` 的 `titleHtml || label` 让空标题也印出默认名。编辑态纯高亮的 emoji 独占一行（`.cm-callout-header-mark` 是独立块行），正文从下一行开始。高亮颜色面板色块 44×40、`data-active` 只在构建时算一次。emoji 取色器只有 24 个硬编码选项 + 搜索。两条工具条颜色入口图标不一致、标注条左对齐。纯高亮手柄是荧光笔图标。

用户 2026-11-27 给出 6 条反馈 + 6 张截图（截图#1 当前色板、截图#2 quiet 取色器、截图#3 当前 emoji 位置、截图#4 豆包目标位置、截图#5 手柄图标、截图#6 调色板图标），并确认「全按默认」。

## Goals / Non-Goals

- Goals：预览态与编辑态同形；空标题不印默认名；emoji 与正文同行悬挂缩进；色块缩到 1/4 + 选中态即时刷新；emoji 库换 quiet 全量 + 8 页签 + 最近 + 随机；两条工具条居中 + 共用调色板图标；纯高亮手柄换块形图标。
- Non-Goals：不改 `[!highlight]` 序列化格式；不改 24 格色值；不为 callout emoji 增加 markdown 持久化位（#361 维持）；不改块菜单「颜色」行 A 字形与 `text` 作用域；不改标注 13 类形态；不改字符级 `==text==`；不新增 npm 依赖。

## Decisions

### D1 预览态 `[!highlight]` 与编辑态同形

**决定**：`convertCallouts` 为 `type === "highlight"` 走 mark 分支——`el.className = "callout callout-mark"`，不建 `.callout-title`，CSS 给 `border-inline-start-width: 0`、`border: 1px solid`、`border-radius: 4px`、背景走 `--callout-bg`（复用 `highlightCssVars` 三色属性，缺省回落荧光笔黄）。预览输出 emoji（类型默认 `🖍️`；会话内改过则显示改后的）。
**理由**：编辑态已是此形态，预览态复用同一套视觉变量即同形；截图#3/#4 显示两态观感分裂。
**落点**：`src/renderers/markdown.ts`（`convertCallouts`）、`src/styles/reader.css`（`.callout-mark`）、`src/editors/callout-attrs.ts`（`highlightCssVars` 复用）。

### D2 预览态空标题不渲染默认名

**决定**：删除 `const title = titleHtml || label` 的 label 回退。标注（13 类）标题未填写时只渲染 emoji、不渲染默认名称；纯高亮完全不渲染标题行。
**理由**：用户反馈「未填写就不显示」；现实现强制印出「注释 / 信息 / 纯高亮」。
**落点**：`src/renderers/markdown.ts:783`、`src/styles/reader.css`（`.callout-title` 空态）。

### D3 emoji 与正文同行、悬挂缩进

**决定**：emoji 在首行行首，正文首行紧接其后，正文换行后左缘与正文列对齐（emoji 下方不出现空行）。编辑态把 mark 的 emoji 从独立 `.cm-callout-header-mark` 块行改为与正文同列的悬挂结构（emoji 占位 + 正文 `padding-inline-start` 对齐）；预览态同构。
**理由**：截图#4（豆包）为目标；截图#3 显示当前 emoji 独占一行、下方空行。
**落点**：`src/editors/decorations/callout.ts`（mark 分支结构）、`src/styles/editor.css`（`.cm-callout-mark` / `.cm-callout-content`）、`src/styles/reader.css`（预览悬挂）。

### D4 色块缩到 1/4

**决定**：`.cm-highlight-color-panel .cm-color-swatch` 从 `44×40` 改为 `22×20`，`.cm-color-row` gap 从 `8px` 改为 `4px`；面板宽 216px 不变，每行 8 格 `flex-wrap: nowrap` 不换行。
**理由**：截图#1 显示 44px 色块过大；缩小后面板信息密度与 quiet 观感一致。
**落点**：`src/styles/editor.css:3779-3799`。

### D5 选中态即时刷新

**决定**：`buildHighlightColorPanel` 暴露 `refresh(active: CalloutAttrs)`（或等价原地更新），在 `onPick` / `onRandom` 回调后重算 `data-active` 并重挂到对应色块；不重建面板、不关闭。面板仍只由点击外部 / Esc 关闭。
**理由**：现 `data-active` 在 `addRow` 内算一次，选色后不刷新，用户看不到当前值。
**落点**：`src/editors/orchestration/callout-color-panel.ts`、`src/editors/orchestration/floating-toolbar.ts`（`onPick` / `onRandom` 后调用 refresh）。

### D6 emoji 库换 quiet 全量

**决定**：以 Vite `?raw` 引入 `emoji.tsv`（1578 条、7 分类），运行时解析为 `{cat, id, char, name, keywords}`；不新增 npm 依赖。
**理由**：现 24 项硬编码无法覆盖中文搜索与分类；quiet 库已含 zh 名 / 关键词。
**落点**：新增 `src/editors/emoji-data/emoji.tsv` + `src/editors/emoji-data/parse.ts`。

### D7 取色器 8 页签 + 最近两段

**决定**：页签顺序 `最近 / 表情符号 / 动物 / 食物 / 活动 / 地点 / 物件 / 符号`（对应 quiet `CATEGORIES` 7 类 + 最近）。`最近` 页签分两段：上「常用」= 现 `CALLOUT_EMOJI_CHOICES` 24 个（原样保留）；下「最近」= 最近使用（localStorage 持久化，去重、最新在前、上限 20）；未使用时最近段为空（不占位）。
**理由**：截图#2 为目标布局；现取色器无分类 / 最近。
**落点**：`src/editors/decorations/callout-emoji.ts`、`src/editors/callout-types.ts`（保留 24 项）、新增 `src/editors/emoji-data/`。

### D8 随机按钮

**决定**：顶部搜索框右侧新增「随机」按钮（Dice / Shuffle 图标），点击直接应用一个随机 emoji（沿用 quiet `RANDOM_BLOCKLIST` 排除项语义），窗口保持打开。
**理由**：截图#2 右上随机按钮；现取色器无随机。
**落点**：`src/editors/decorations/callout-emoji.ts`、`src/styles/editor.css`（按钮样式）。

### D9 颜色入口图标统一为 PaletteOutlined

**决定**：新增 `PaletteOutlined`（Material palette 图形，与截图#6 同观感）；标注与纯高亮两条工具条的色板入口都用它。块菜单「颜色」行保持 `FormatColorTextOutlined`（A 字形，不改）。
**理由**：现标注用 `FontcolorOutlined`、纯高亮用 `HighlighterOutlined`，两入口不一致。
**落点**：`src/editors/icons.ts`（新增 `PaletteOutlined`）、`src/editors/orchestration/floating-toolbar.ts:330-332`。

### D10 两条工具条居中 + 纯高亮手柄图标

**决定**：两条工具条都水平居中于块盒（中心偏差 ≤ 2px）；纯高亮手柄图标改为新增 `HighlightBlockOutlined`（圆角矩形框 + 下方两行，见截图#5），标注手柄不变。
**理由**：现仅 mark 居中、标注左对齐；截图#5 给出手柄目标形。
**落点**：`src/editors/orchestration/floating-toolbar.ts:988-990`、`src/editors/orchestration/block-handle.ts`（`BLOCK_ICON_NAME` / `blockHandleIcon`）、`src/editors/icons.ts`（新增 `HighlightBlockOutlined`）。

### D11 会话内 emoji 覆盖对预览可见

**决定**：以文档内容签名（长度 + FNV-1a 前 4000 字）为键，把会话内 callout emoji 覆盖存进轻量模块 Map（`callout-emoji-overrides.ts`，上限 8 条）；预览渲染时用同一份内容取快照。不为 callout emoji 增加 markdown 持久化位（#361 限制维持）。
**理由**：现覆盖按 EditorView 存、仅经 `mdb:callout-emoji` 发布且无消费者，预览读不到。
**落点**：`src/editors/callout-emoji-overrides.ts`、`src/editors/decorations/callout-emoji.ts`、`src/renderers/markdown.ts`。

### D12 规格冲突 supersede

**决定**：E-48 中「纯高亮块的工具条 SHALL 水平居中于块盒（中心偏差 ≤ 2px）并使用荧光笔图标；标注块工具条位置与图标 SHALL 保持不变」改为「两条工具条均水平居中于块盒（中心偏差 ≤ 2px）+ 共用 `PaletteOutlined` 调色板图标」。其余（24 格色值、8 格不换行、A 字形、`text` 作用域）全部保留。
**理由**：用户指令明确 supersede；块菜单「颜色」行 A 字形与 `text` 作用域不动。
**落点**：`openspec/changes/highlight-mark-refine-v1/specs/editing/spec.md`（MODIFIED E-48）。

## 数据面

本 change 命中 `src/editors/icons.ts`（`DATA_SURFACE_PATHS` 信号），新增两个图标 token；无新增可配置字段、无新增持久化键。

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2 | — | 判据 = 本变更 anchors R-1…R-5 逐条断言 |
| 存储 | src/editors/icons.ts | ICON_REGISTRY | `PaletteOutlined` 与 `HighlightBlockOutlined` 各一条，`renderIcon` 可渲染 |
| 校验 | src/editors/icons.ts | renderIcon | 未知名回落 `DragHandleOutlined`；新名必在注册表内 |
| 桥接 | src/editors/orchestration/floating-toolbar.ts | createCalloutBar | 两条工具条颜色入口 `data-icon` 均为 `PaletteOutlined` |
| 消费 | src/editors/orchestration/block-handle.ts | blockHandleIcon | 纯高亮手柄 `data-icon` 为 `HighlightBlockOutlined`，标注手柄不变 |
| 回滚 | src/editors/icons.ts | ICON_REGISTRY | 图标为代码常量，无 AI 写路径；回滚 = revert 本 change 的图标条目，无数据迁移，缺省回落 `DragHandleOutlined` |

票面第 8 字段（数据面）：T1=`规格`；T2=`规格`；T3=`规格`；T4=`规格`；T5=`存储,校验,桥接,消费`。

## 风险与回归面

- **既有 e2e 受影响**：
  - `e2e/editors/highlight-panel.spec.ts:77`「工具条居中且图标为荧光笔」——断言 `svg[data-icon="HighlighterOutlined"]`，需改为 `PaletteOutlined`。
  - `e2e/editors/highlight-panel.spec.ts:45`「纯高亮与标注计算样式分家」——编辑态断言不变（仍 1px / 4px / 0px），但需补预览态同形断言。
  - `e2e/highlight-panel.spec.ts:29`「四行各 8 格且不换行」——格数与不换行不变，需补色块尺寸 22×20 / gap 4px 断言。
  - `e2e/highlight-palette.spec.ts`「旧属性文档打开面板至少一格选中」——需补选色后 `data-active` 迁移断言。
  - `e2e/editors/callout-mark-split.spec.ts:92`「高亮插入后无左边框、无标题栏、圆角 4px」——编辑态不变；需补预览态同形。
  - `e2e/callout-columns.spec.ts:135`「相邻同类型改图标互不影响」——取色器选项从 24 项变为全量库，测试按 `data-emoji` 过滤而非索引，预期仍成立；需确认选择器不依赖 24 项计数。
  - `e2e/block-menu.spec.ts:845`「改过的 emoji 不跟随错误类型」——取色器重构后 `[data-emoji="🚀"]` 仍可选（🚀 在 quiet 库内），预期成立。
  - `e2e/tauri/reader-typography.spec.ts:154`——NOTE 预览断言不变（标题已填）；需补空标题不印默认名用例。
- **既有单测受影响**：`src/__tests__/renderers/markdown.test.ts:51`「纯高亮类型带标签」断言预览含「纯高亮」——D2 后纯高亮不再印标签，需改断言；`src/__tests__/editor/calloutColorPanel.test.ts` 需补 refresh 用例；`src/__tests__/editor/callout-emoji-picker.test.ts` 需补页签 / 最近 / 随机用例。
- **兼容性**：`[!highlight]` 序列化不变；24 格色值不变；#361 维持（emoji 覆盖不写 markdown，改写 localStorage，重开文档回落默认 emoji 的行为不变——localStorage 是会话内 + 跨会话最近列表，不替代 markdown 持久化）。
- **性能**：emoji.tsv 1578 行以 `?raw` 引入，运行时解析一次并缓存；取色器按需渲染可见行（沿用 quiet 的按需构建思路），避免一次性渲染 1578 个按钮。

## Open Questions

无。范围以用户 2026-11-27 确认的 D1–D12 与上述 Non-Goals 为准。
