## Why

E-48（高亮块三色）与 editor-refine-batch2（高亮/标注分家）落地后，编辑态的纯高亮块已经是「无左边框、无标题栏、1px 全边框、4px 圆角、强叠底」的形态，但**预览态**仍走通用 `.callout` 的 3px 左边框 + 标题栏，同一份 markdown 在两个态里看起来是两个块。标注在预览态还会因 `titleHtml || label` 回退印出默认名，纯高亮也印出「纯高亮」。编辑态纯高亮的 emoji 独占一行，正文从下一行开始，emoji 下方留空行。高亮颜色面板色块 44×40 过大、选中态不随选色刷新。emoji 取色器只有 20 个硬编码选项、只能搜索，没有分类 / 最近 / 随机。两条工具条颜色入口图标不一致、标注条左对齐。纯高亮手柄仍是荧光笔图标。

用户 2026-11-27 给出 6 条反馈 + 6 张截图（含 quiet 与豆包目标态），确认按默认执行。

## What Changes

- **预览态与编辑态同形**：`convertCallouts` 为 `[!highlight]` 走 mark 分支——无左边框、无标题栏、1px 全边框、4px 圆角、强叠底（复用 `--callout-bg` 三色属性，缺省荧光笔黄）；输出 emoji（类型默认 `🖍️`，会话内改过则显示改后的）。
- **预览态空标题**：标注（13 类）标题未填写时只渲染 emoji、不渲染默认名称（删除 `titleHtml || label` 的 label 回退）；纯高亮完全不渲染标题行。
- **emoji 悬挂缩进**：emoji 在首行行首，正文首行紧接其后，正文换行后左缘与正文列对齐；编辑态与预览态一致。
- **高亮颜色面板**：色块 `44×40` → `22×20`，行内 gap `8px` → `4px`，面板宽 216px 不变、每行 8 格不换行；选色与「随机」后 `data-active` 原地刷新（不重建、不关闭）。
- **emoji 库与取色器**：换用 quiet `emoji.tsv` 全量（1578 条、7 分类，Vite `?raw` 引入，运行时解析，不新增依赖）；取色器 8 页签（最近 / 表情符号 / 动物 / 食物 / 活动 / 地点 / 物件 / 符号）；「最近」分两段（上「常用」= 现 24 个精选，下「最近」= localStorage 持久化、去重、最新在前、上限 20，未使用为空）；顶部搜索右侧「随机」按钮（沿用 quiet `RANDOM_BLOCKLIST` 排除语义），窗口保持打开。
- **会话内 emoji 覆盖对预览可见**：以当前文档标识为键存进轻量状态，预览渲染时读取；不为 callout emoji 增加 markdown 持久化位。
- **图标与工具条**：新增 `PaletteOutlined`（调色板图形），两条工具条颜色入口统一用它；两条工具条都水平居中于块盒（中心偏差 ≤ 2px）；纯高亮手柄改为新增 `HighlightBlockOutlined`（圆角矩形框 + 下方两行）。
- **规格 supersede**：E-48 中「纯高亮工具条使用荧光笔图标」「标注块工具条位置与图标保持不变」两条改为「两条工具条均居中 + 共用调色板图标」；其余（24 格色值、8 格不换行、A 字形、text 作用域）保留。

## Capabilities

### Modified Capabilities

- `editing`：修改 E-48 高亮块三色——两条工具条居中 + 共用 `PaletteOutlined`；色块尺寸 22×20 / gap 4px；`data-active` 即时刷新。新增 E-52（纯高亮预览与编辑同形）、E-53（纯高亮 emoji 悬挂缩进）、E-54（emoji 取色器）。

### New Capabilities

- 无（本 change 只在 `editing` 域内修改与新增需求，不新建能力域）。

## Impact

- **代码面**：`src/renderers/markdown.ts`（`convertCallouts` mark 分支 + 空标题 + emoji 输出）、`src/styles/reader.css`（预览 `.callout` mark 分支 + 悬挂缩进）、`src/editors/decorations/callout.ts`（mark 的 emoji 与正文结构）、`src/styles/editor.css`（`.cm-callout-mark` / `.cm-callout-content` / `.cm-highlight-color-panel`）、`src/editors/orchestration/callout-color-panel.ts`（`data-active` 刷新）、`src/editors/decorations/callout-emoji.ts`（8 页签 + 最近 + 随机）、`src/editors/callout-types.ts`（保留 24 项常用 + 新增库解析）、新增 `src/editors/emoji-data/`（`emoji.tsv` + 解析）、`src/editors/orchestration/floating-toolbar.ts`（图标 + 居中）、`src/editors/orchestration/block-handle.ts`（手柄图标）、`src/editors/icons.ts`（`PaletteOutlined` / `HighlightBlockOutlined`）、会话内 emoji 覆盖的轻量状态与预览读取。
- **规格面**：`openspec/specs/editing/spec.md` E-48 两处 supersede + ADDED E-52 / E-53 / E-54。
- **测试面**：`src/__tests__/renderers.markdown.test.ts`（预览 mark / 空标题）、`src/__tests__/editor/calloutColorPanel.test.ts`（`data-active` 刷新）、`src/__tests__/editor/callout-emoji-picker.test.ts`（8 页签 / 最近 / 随机）、`src/__tests__/editor/icons.test.ts`（两新图标）、`e2e/highlight-panel.spec.ts` 与 `e2e/editors/highlight-panel.spec.ts`（色块尺寸 / 居中 / 图标）、`e2e/editors/callout-mark-split.spec.ts`（悬挂缩进）、`e2e/tauri/reader-typography.spec.ts`（预览态 mark 与空标题）。
- **兼容性**：`[!highlight]` 序列化格式不变；24 格色值不变；`text` 作用域不变；#361 限制维持（emoji 覆盖仍不持久化到 markdown）；既有标注（13 类）形态不变。
