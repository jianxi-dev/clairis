# search-float-refine 需求四要素

- spec issue: https://github.com/jianxi-dev/clairis/issues/1004
- 输入源：用户 2026-11-17 反馈（5 项：2 缺陷 + 3 优化），围绕 ⌘F 搜索浮窗
- 一手证据：
  - 原型 `docs/design/explorations/frontmatter-search/prototype.html`（浮窗底部快捷键说明行：「↑↓ 切换 · ↵ 定位选中 · #1~9 直达（局部 · 浮窗内）· Esc 关闭」）
  - 归档 baseline `openspec/changes/archive/2026-11-16-doc-property-and-search-panel/baseline/search-default.png`、`search-replace.png`（浮窗视觉基准）
  - 既有规格 `openspec/specs/search-replace-float/spec.md`（S-1 浮窗形态 / S-3 结果列表与行尾快捷键）

## What（做什么）

### A. 缺陷修复（2 项）

- 缺陷 1 行尾快捷键：回车符仅在点击行后才显示；需求是行被选中（↑↓ 换选）即显示 ⏎。既有规格 S-3 已定义「被选中（当前命中）的行改显示 ⏎」，按回归缺陷处理，G1 真机复现定性根因（嫌疑：换选更新链路或快捷键列渲染条件）。
- 缺陷 2 点击定位：点击结果行未在编辑器/预览中定位到命中处。既有规格 S-3 已定义「点击定位（选中 + 滚动到可视区）」。嫌疑根因：`locate()` 走全局 `getActiveEditorView()`（最近聚焦编辑器）而非浮窗所属窗格视图（`getEditorView(panelId)`），分栏或焦点漂移时定位到错误窗格；G1 复现确认。

### B. 功能优化（3 项）

- 优化 1 浮窗壳样式复用：浮窗壳复用文件卡片悬浮窗（悬浮预览窗 `FloatingPreview`）的样式能力——surface 底、border 描边、圆角、投影、标题栏拖动的既有视觉范式，以及调整大小能力：四边 + 四角 8 向缩放（复用 `src/lib/previewAnchor.ts` 的 `RESIZE_EDGES`/`resizePreview`/`clampPreviewSize`，不另写一套）。观感打磨随样式复用一并收敛（用户原话「目前样式不好看」）。
- 优化 2 状态栏：浮窗底部新增状态栏，内容 = 原型里的快捷键说明（↑↓ 切换 · ↵ 定位选中 · ⌘1~9 直达（局部 · 浮窗内）· Esc 关闭）；状态栏自动显隐（打开显示 → 指针离开且失焦后延迟隐藏 → 悬停/聚焦恢复；显隐语义在 design.md 记为显式决策）。
- 优化 3 行内容预览态渲染：结果行上下文片段以预览态样式轻量渲染（加粗/斜体/行内代码/标题等不显示源码符号），命中词高亮保留。

## Why（为什么）

- 缺陷 1/2 是「该响应不响应」的交互阻断：换选无反馈、点击无定位，直接破坏 S-3 既有承诺。
- 优化 1/2 提升浮窗观感与可发现性：与悬浮预览窗同一操作语言（8 向缩放），快捷键说明降低记忆负担。
- 优化 3 消除「列表里看到源码」的阅读断裂，与预览态视觉一致。

## Scope（影响面）

- `src/components/Content/SearchReplacePanel.tsx`（壳样式、缩放、状态栏、定位、行渲染）
- `src/styles/search-float.css`（样式收敛，对齐悬浮预览窗视觉范式）
- `src/lib/previewAnchor.ts`（只复用；如需小幅导出补充由本票内聚完成）
- e2e：`e2e/` 下搜索浮窗用例扩展

## Non-goals（不做）

- 语义搜索（原型「分期 · 示意」，不属本期）
- 替换与 diff 预览行为变更（S-4 不动）
- 搜索扫描规则变更（S-2 不动）
- 悬浮预览窗（FloatingPreview）自身改动——只复用不修改
