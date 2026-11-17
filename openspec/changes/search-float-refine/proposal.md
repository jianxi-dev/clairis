# 变更提案：搜索浮窗打磨（search-float-refine）

## Why

用户 2026-11-17 反馈 ⌘F 搜索浮窗 5 项（2 缺陷 + 3 优化，spec issue #1004），集中在浮窗壳样式与结果行行为，直接破坏既有规格承诺：

- **缺陷**：行被选中（↑↓ 换选）后行尾不显示 ⏎，需点击行才出现，与 S-3「被选中（当前命中）的行改显示 ⏎」相悖；点击结果行不能在编辑器/预览中定位到命中处，与 S-3「点击定位（选中 + 滚动到可视区）」相悖（嫌疑根因：`locate()` 走全局最近聚焦编辑器视图而非浮窗所属窗格视图，待 G1 真机复现确认）。
- **优化**：浮窗壳未复用文件卡片悬浮窗（`FloatingPreview`）的样式与操作能力（用户原话「目前样式不好看」），只有右下角单一缩放手柄；浮窗缺状态栏快捷键说明；结果行上下文片段按原始 Markdown 源码直显（`**`、`#` 等符号可见），与预览态视觉断裂。

需求四要素见 `docs/requirements/search-float-refine/requirements.md`。本期不引入新配置字段，仅对既有 `search-replace-float` 能力做形态、交互与缺陷修复的收敛。

## What Changes

- **浮窗壳样式与缩放对齐悬浮预览窗**：搜索浮窗壳复用文件卡片悬浮窗的视觉范式（surface 底、border 描边、圆角、投影）与操作语言——四边 + 四角 8 向缩放，复用 `src/lib/previewAnchor.ts` 的 `RESIZE_EDGES`/`resizePreview`/`clampPreviewSize`，不另写一套缩放实现；标题栏拖动保持。既有位置三档（左/中/右）与尺寸/位置会话内优先语义不变。
- **缺陷修复**：选中行即显示 ⏎（↑↓ 换选与 ⌘N 直达均满足，不要求点击）；点击定位修复为在浮窗所属窗格内定位（定位目标 = `getEditorView(panelId)` 所属窗格，预览态在所属窗格预览容器内滚动定位），修复分栏/焦点漂移下的错格定位。
- **行内容预览态渲染**：结果行上下文片段以预览态样式轻量渲染（加粗/斜体/行内代码可见，标题不显示源码符号），命中词高亮保留。
- **状态栏（新）**：浮窗底部新增状态栏，显示快捷键说明「↑↓ 切换 · ↵ 定位选中 · ⌘1~9 直达（局部 · 浮窗内）· Esc 关闭」；自动显隐——浮窗打开时显示，指针离开浮窗且浮窗失焦约 2 秒后自动隐藏，悬停/聚焦恢复；替换态下可选追加替换操作提示。内容来源为原型 `docs/design/explorations/frontmatter-search/prototype.html` 底部提示行，显隐语义为显式设计决策（原型为常显），记录于 design.md。

## Capabilities

### Modified Capabilities

- `search-replace-float`：
  - **S-1 浮窗形态与默认位置**（修改）：浮窗壳复用悬浮预览窗的样式能力与操作语言（8 向缩放），保留既有位置三档与尺寸/位置会话内优先语义。
  - **S-3 结果列表与行尾快捷键**（修改）：明确「⏎ 随选中行显示」的触发条件；点击定位明确为在浮窗所属窗格内定位；行内容上下文片段以预览态样式轻量渲染。

### New Requirements

- `search-replace-float` 新增 **S-6 浮窗状态栏**：浮窗底部状态栏显示快捷键说明与自动显隐语义。

### Not Modified

- `search-replace-float` 的 S-2 扫描规则、S-4 替换与 diff 预览、S-5 局部快捷键优先级内容不变（仅随缺陷复现顺手核对，不改变规格陈述）。

## Impact

- **修改**：`src/components/Content/SearchReplacePanel.tsx`（壳样式、缩放、状态栏、定位、行渲染）、`src/styles/search-float.css`（样式收敛，对齐悬浮预览窗视觉范式）。
- **复用（不改）**：`src/components/Preview/FloatingPreview.tsx`、`src/lib/previewAnchor.ts`（只复用，如需小幅导出补充由票内聚完成）；`src/lib/shortcuts.ts` 局部 scope 接线已存在，本 change 不新增键段。
- **新增（如无现成能力）**：`src/renderers` 目前无行内轻量渲染能力，按 design.md D4 新建轻量行内 renderer（接口与边界在 design.md 约定）。
- **配置面（数据面）**：无可配置面变更——本 change 不新增配置字段、不触及主题/图标/菜单/轮盘/开关，状态栏为纯展示组件。信号命中「快捷键」关键词，design.md「## 数据面」已按契约填六栏（真实落点 + 「不改」判据），`cw-data-surface.sh new` 通过。
- **测试**：vitest（行内渲染断言：源码符号不出现、加粗语义标签出现）+ Playwright e2e（缩放、选中行 ⏎、点击定位、状态栏显隐断言）；既有 search-float 相关 vitest 与 e2e 保持通过；`bash scripts/verify.sh` 全绿交付。
- **风险**：8 向缩放复用 previewAnchor 的最小尺寸钳制（260×200）与搜索浮窗默认尺寸（600×460）的兼容性，见 design.md Risks；点击定位窗格归属修复需 G1 真机复现先定性，再按 D3 落地。
