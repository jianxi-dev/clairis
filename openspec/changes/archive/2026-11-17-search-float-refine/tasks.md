# 任务清单：搜索浮窗打磨（search-float-refine）

> 规格：`specs/search-replace-float/spec.md`（MODIFIED S-1、MODIFIED S-3、ADDED S-6）。设计：`design.md`（决策 D1～D4、数据面六栏表）。需求四要素：`docs/requirements/search-float-refine/requirements.md`，spec issue #1004。
>
> **切片说明（QG-7）**：按垂直切片拆票，每票贯穿样式/逻辑/e2e 全层，做完用户能在页面上直接看到东西。1.1 壳样式与缩放、1.2 行尾快捷键与定位、1.3 状态栏与行渲染，各票独立交付验证。
>
> **测试归属（QG-2/QG-4）**：vitest 与 Playwright e2e 随各票交付（票面 AC 列明），本清单不再单列汇总条目。
>
> **数据面**：本 change 无可配置面变更（信号命中「快捷键」关键词，六栏表已在 design.md「## 数据面」逐栏填明真实落点与「不改」判据，`cw-data-surface.sh new` 已通过）；各票「数据面」字段填「无（见 change 六栏表）」。
>
> **归档**：G4 收口后按 change-workflow 归档本 change；锚点 / baseline / conformance 由编排侧另行生成，不在票面。

## 1. 浮窗壳线

- [x] 1.1 浮窗壳样式与 8 向缩放复用
  - **What to build**：重构 `src/components/Content/SearchReplacePanel.tsx` 浮窗壳：复用悬浮预览窗视觉范式（surface 底、border 描边、圆角、投影，落 `src/styles/search-float.css` 对齐 `FloatingPreview` 的样式语言）；8 向缩放接线——`onPointerDown` 判定缩放方向复用 `src/lib/previewAnchor.ts` 的 `RESIZE_EDGES`，指针移动走 `resizePreview()`、尺寸钳制走 `clampPreviewSize()`，壳层封装统一包装（D1，固定传入搜索浮窗最小尺寸宽 320、高 240，默认 600×460 不被误钳）；移除右下角单一缩放手柄，标题栏拖动保持。新建/调整 `search-float-*` class 全部落 `src/styles/`（CSS manifest 通过）。**接线归属**：previewAnchor 复用为既有 API（`RESIZE_EDGES`/`resizePreview`/`clampPreviewSize`），本票仅接线调用、不导出新 API；壳样式与缩放状态归 `SearchReplacePanel` 组件。**数据面**：无。**标签建议**：ui-surface
  - **Acceptance criteria**：
    - 打开页面按 ⌘F，搜索浮窗观感与文件卡片悬浮窗一致（surface 底、border、圆角、投影，浏览器计算样式可见）。
    - 用鼠标分别拖动浮窗上、下、左、右四边与四个角，8 个方向均可缩放，尺寸随拖拽实时变化，拖到最小尺寸后不再缩小（钳制生效）。
    - 标题栏拖动可移动浮窗，拖后位置会话内优先；既有位置三档（左/中/右）与改设置回默认行为不变。
    - 右下角旧单一缩放手柄不再单独存在（8 向缩放覆盖其能力）。
    - vitest 覆盖包装函数：默认尺寸不被默认钳制误钳、各方向缩放边界正确。
    - e2e：指针拖拽四边与四角后断言浮窗尺寸变化（浏览器可观测）。
- [x] 1.2 行尾快捷键与点击定位缺陷修复
  - **What to build**：修复 S-3 两项缺陷（DQ-2：G1 真机复现先定性根因，票面假设不是结论）。**⏎ 随选中行显示**：规格目标是「行被选中（↑↓ 换选或 ⌘N 直达）即显示 ⏎，不要求点击」（S-3 delta）。静态读码显示行尾渲染条件（L682-684）已按 `safeSelected` 切换、↑↓ 也更新 `selected`——但用户实测「点击行才显示回车」，根因待定性：候选①换选更新链路在真机未生效（焦点/事件被截），候选②用户实测版本滞后，候选③渲染条件在特定命中数/滚动态下不随行。复现确认后按实际根因修复。**点击定位窗格归属修复**：`locate()` 编辑态改用 `getEditorView(panelId)` 取浮窗所属窗格的编辑器视图做选区与滚动；预览态在所属窗格的 `.preview-content` 容器内做文本树滚动定位，限定所属窗格（D3）；真机复现确认「分栏/焦点漂移定位错格」成立后落地，另发现根因则 D3 修订后再落。**接线归属**：`getEditorView(panelId)` 为既有模块级 Map API（`src/editors/editorRef.ts`），本票改调用目标；快捷键局部 scope 复用 `src/lib/shortcuts.ts` 既有 `activateLocalContext` 接线，不新增键段。**数据面**：无（见 change 六栏表）。**标签建议**：ui-surface
  - **Acceptance criteria**：
    - 打开页面按 ⌘F，按 ↓ 或 ↑ 换选结果行时，当前选中行行尾立即显示 ⏎（无需点击即出现）；其余行 1~9 显示 ⌘1~⌘9。
    - 按 ⌘N 直达某结果行时，该行行尾同样显示 ⏎。
    - 点击任一结果行，编辑器（编辑态）或预览（预览态）在**所属窗格**内滚动到命中处并选中，分栏场景下定位不落到错误窗格（浏览器可观测：选区/滚动位置在对应窗格内变化）。
    - Enter 定位选中行、⌘1~9 直达行为不回归（S-5 局部优先级不变）。
    - vitest 覆盖渲染条件：选中行 ⏎ 跟随、未选中行 ⌘N 显示。
    - e2e：↓ 换选后断言选中行行尾文本为 ⏎；点击行后断言所属窗格选区/滚动位置变化。
- [x] 1.3 状态栏自动显隐 + 行内容预览态渲染
  - **What to build**：**状态栏（S-6）**：浮窗底部新增状态栏，内容「↑↓ 切换 · ↵ 定位选中 · ⌘1~9 直达（局部 · 浮窗内）· Esc 关闭」；自动显隐——打开显示，指针离开且失焦约 2 秒后隐藏，悬停/聚焦恢复（D2）；替换态下可选追加替换操作提示。**行内容预览态渲染**：新建轻量行内 renderer（D4，落 `src/renderers/inline.ts`，导出 `renderInlineWithHit(text, hit?)`：行内语法 `**加粗**`/`*斜体*`/`` `行内代码` `` 轻量渲染，标题等块级符号不显示源码符号，命中区间包裹 `<mark>`，先转义再渲染避免命中错位）；结果行上下文片段接入该渲染，命中高亮保留。**接线归属**：`renderInlineWithHit` 为本 change 新建 API，由 `SearchReplacePanel` 结果行渲染消费（导出方 `src/renderers/inline.ts`，接线方 `SearchReplacePanel`）；状态栏组件归 `SearchReplacePanel`，显隐定时器随组件生命周期清理。**数据面**：无。**标签建议**：ui-surface
  - **Acceptance criteria**：
    - 打开页面按 ⌘F，浮窗底部显示状态栏快捷键说明「↑↓ 切换 · ↵ 定位选中 · ⌘1~9 直达（局部 · 浮窗内）· Esc 关闭」（浏览器可见）。
    - 指针离开浮窗且浮窗失焦约 2 秒后，状态栏自动隐藏；指针重新悬停或浮窗重新聚焦时恢复显示（浏览器可观测显隐切换）。
    - 结果行上下文片段按预览态样式渲染：加粗文本呈加粗、行内代码呈代码样式，行内不出现 `**`、`#` 等源码符号；命中词高亮（`<mark>`）保留。
    - 命中词处于加粗/行内代码内部时，`<mark>` 正确包裹命中子串，不错位。
    - vitest 覆盖行内渲染：源码符号不出现、加粗/斜体/代码语义标签出现、命中区间正确、转义安全。
    - e2e：状态栏显隐切换断言（计算样式可见性）；结果行无源码符号、含加粗语义标签断言。

## 2. 验收与交付

- [x] 2.1 集成验收与交付
  - **What to build**：`npm run tauri dev` 手动走查 1.1～1.3 全量关键路径（8 向缩放、拖动、选中行 ⏎、点击定位、状态栏显隐、行渲染观感，按仓库 UI 测试约定用功能说明性语言记录）；`bash scripts/verify.sh` 全绿（tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright）；更新 `docs/delivery/requirements-status.md`。**接线归属**：验收与交付，不新增代码接线。**数据面**：无。**标签建议**：integration
  - **Acceptance criteria**：
    - 真实桌面应用内手动点一遍关键路径，1.1～1.3 各优化点与缺陷修复在 UI 上可观测成立。
    - `bash scripts/verify.sh` 全绿，既有 search-float 相关 vitest 与 e2e 保持通过。
    - `docs/delivery/requirements-status.md` 更新，search-float-refine 需求状态与实现一致。
