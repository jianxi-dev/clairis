# Tasks: 第十三批真机走查（ui-polish-batch13）

> 切片原则：每条 = 一个用户可见交付物，贯穿「实现 → 样式 → e2e」。Blocked by 只记真实文件级冲突（同一文件 = 冲突，本仓 1 issue = 1 PR）。
> QG-2：每条均新增/扩展 e2e，无 `no-ui-impact` 豁免。
> QG-6：11 票 ≥ 6，集成 checkpoint 在 3.1 与 7.1 之后各一次。

## 1. 编辑态装饰重建（回归）

依赖：无

- [x] 1.1 分栏/整屏/布局恢复后，md 编辑态仍为富文本
  - 创建 EditorState 时装入 `decorCompartment.of(初始装饰)` 与 `langCompartment.of(createLanguageExtension(当前 kind))`，同步 `currentKindRef`。
  - 验收：md 编辑态 → 分栏 → 原格 `data-mode=edit`，`.cm-heading-marker` 数量 ≥1、`.cm-callout` 数量 ≥1、正文不出现 `**`/`##` 源码文本；整屏切换往返后同断言成立。
  - e2e：`e2e/editor-mode-persistence.spec.ts`（新增）。
  - 接线归属：无新增导出。

## 2. 轮盘视觉与三级联动

依赖：无

- [x] 2.1 水滴图标、25% 透明度、三层默认高亮与指针联动、提示只留圆心
  - `sectorIcon("color")` → 新 `droplet` 图标；`third-open` 时根/二层 opacity 0.25；`openGroup` 默认高亮中心项；group 打开时按指针角度就近高亮三层；移除扇区/单元/色条 `title`，仅保留 hub 提示。
  - 验收：打开「颜色」→ 扇区图标 name 为 `droplet`；打开「格式→加粗组」三层后，根扇区计算 opacity 为 0.25、三层恰有 1 个 `.hot`；指针沿二层从左向右滑动时，三层 `.hot` 的 `data-idx` 单调不减；悬停任一根扇区 600ms 不出现 `.app-tip`，悬停圆心出现含「格式刷」的提示。
  - e2e：`e2e/roulette-third-layer.spec.ts`（新增）+ `e2e/floating-toolbar.spec.ts`（改提示断言）。
  - 接线归属：无新增导出。

## 3. 格式刷与胶囊选区工具条

依赖：2.1（同触 `roulette-view.ts` / `editor.css`）

- [x] 3.1 格式刷可刷行内样式与字色/背景色；设置可切换胶囊/轮盘；胶囊两层按钮常用动作居中
  - `applyMarks` 补 color/bg，仅在选区稳定后调度；新增 `capsule-toolbar.ts` 与 `AppConfig.selectionToolbar`；设置页新增切换项。
  - 验收：选中带字色+加粗的文本点圆心进入格式刷，再选中另一段 → 该段源码同时含 `**` 与相同 `mdb-color-*`，圆心计数为 2；设置切「胶囊」后选中文字 → `.app-capsule-toolbar` 可见、`.selection-roulette` 数量 0，胶囊恰有 2 行、近指针行含加粗/斜体/字色/背景色/清除格式。
  - e2e：`e2e/roulette-painter.spec.ts`、`e2e/selection-capsule.spec.ts`（新增）。
  - 接线归属：`selectionToolbar` 由本票接入 `floating-toolbar()` 渲染选择与 `SettingsView` 单选；`capsule-toolbar` 仅由本票调用。

## 4. 高亮块图标跟随与间距

依赖：2.1（同触 `editor.css`）

- [x] 4.1 转换为其他高亮类型后图标跟随；图标与标题无空档
  - emoji 覆盖值改为 `{type, emoji}`，仅类型一致时采用；头部 `gap:0`、图标 `padding:0`、空标题槽 `min-width:0`。
  - 验收：把 NOTE 高亮块 emoji 改为 🚀，再经块菜单「类型」转为 TIP → 卡片 `data-callout-emoji` 等于 TIP 默认（不等于 🚀）；图标右边缘与标题文本左边缘间距 ≤2px。
  - e2e：`e2e/callout-columns.spec.ts`（扩展）。
  - 接线归属：无新增导出。

## 5. 撤销/重做快捷键免点击

依赖：无

- [x] 5.1 ⌘Z / ⌘⇧Z（Ctrl 同）在编辑态无需先聚焦正文
  - App 全局 keydown：焦点不在 `.cm-editor`/输入控件时，对当前聚焦格的活动 EditorView 执行 undo/redo 并 focus。
  - 验收：md 编辑态输入「abc」，点击栏目头（焦点离开编辑器），按 ⌘Z → 内容回到输入前；按 ⌘⇧Z → 恢复「abc」。
  - e2e：`e2e/editor-undo.spec.ts`（扩展）。
  - 接线归属：无新增导出。

## 6. 文案与行宽上限统一

依赖：3.1（同触 `SettingsView.tsx`）

- [x] 6.1 打开文件位置文案；宽度提示去掉「（点击调整）」；设置与状态栏行宽上限同为 1400
  - 新增 `src/lib/readerWidth.ts`（MIN 480 / MAX 1400 / STEP 20 / 预设）；两处共用；`aiErrors` 文案同步。
  - 验收：栏目「更多」第四项文本为「打开文件位置」；状态栏宽度按钮 title 等于 `页面宽度 1080px`（无括号）；设置行宽滑块 `max=1400` 与状态栏宽度滑块 `max=1400` 相等。
  - e2e：`e2e/pane-header.spec.ts`、`e2e/status-width.spec.ts`（改断言）。
  - 接线归属：`readerWidth` 常量由本票接入两组件。

## 7. 页签栏双击新建与弹窗期间抑制提示

依赖：无

- [x] 7.1 双击页签条空白处新建 MD；任一弹窗打开时不出现悬停胶囊
  - `TabBar` 根节点 dblclick（排除页签/按钮/输入）；新增 `overlayGate` 并在 `ContextMenu`、栏目 ⋯ 菜单登记；`TooltipLayer` 检查 gate。
  - 验收：双击页签条右侧空白 → 页签数 +1、新页签标题「未命名」且 `data-mode=edit`；右键页签打开菜单后把指针移到栏目头按钮并停 600ms → `.app-tip` 数量 0；关闭菜单后再悬停 → `.app-tip` 出现。
  - e2e：`e2e/tab-strip-dblclick.spec.ts`、`e2e/tooltip-pill.spec.ts`（新增/扩展）。
  - 接线归属：`overlayGate` 由本票接入 `ContextMenu` / `PaneTreeView` / `TooltipLayer`。

## 8. 视频自动播放与时间戳图标

依赖：2.1（同触 `icons.ts`）

- [x] 8.1 打开视频自动播放；去掉「加载中→点击」；多路互不影响；时间戳笔记笔写图标
  - `autoplay:true`、`autoPlayback:true`；ready 后 seek 并 `play()`；失败不清空画面；`timestampNote` 换笔写字形。
  - 验收：打开视频 800ms 内 `video.paused === false`；两格各开一个视频，两 `<video>` 均 `paused === false` 且 `muted === false`；时间戳按钮图标 path 含笔尖（data-icon=timestampNote 的 path 与旧值不同）。
  - e2e：`e2e/video-multi-pane.spec.ts`、`e2e/media-render.spec.ts`（扩展）。
  - 接线归属：无新增导出。

## 9. HTML 卡片缩略图恢复

依赖：无

- [x] 9.1 阅读空间 HTML 卡片显示真实首屏缩略图
  - 恢复 iframe（10% 缩放、pointer-events none、`sandbox="allow-scripts"`），类型色占位在底层，`onLoad` 淡入；去掉并发配额。
  - 验收：最近列表含 ≥3 个 HTML 文件时，每个卡片 `.rail-thumb iframe` 存在且 `opacity` 收敛为 1；无 iframe 的卡片仍显示类型色占位（不白块）。
  - e2e：`e2e/rail-cards.spec.ts`（改断言）。
  - 接线归属：无新增导出。

## 10. PDF 工具栏双击收起/固定与顶部悬浮

依赖：无

- [x] 10.1 默认显示；双击收起/固定；收起后仅顶部热区悬浮显示；取消沉浸自动收起
  - 删除 readingMode 1.2s 自动收起；新增 `chromeHidden`/`chromePeek` 与双击监听；shadow CSS 增加 hidden/peek 规则。
  - 验收：打开 PDF 顶栏 opacity 1 且占位（正文高度较小）；双击顶栏后 opacity 0、正文高度增加 ≥24px；指针从顶部 16px 滑入 → opacity 1 且 `position` 为 `absolute`（悬浮，正文高度不变）；指针从正文中部滑入 → opacity 仍 0；再双击 → opacity 1 且回到占位。
  - e2e：`e2e/pdf-chrome.spec.ts`（扩展；无 Tauri 时用 mock shadow 探针）。
  - 接线归属：无新增导出。

## 11. 悬浮小窗预览/编辑切换

依赖：无

- [x] 11.1 md/html/文本悬浮小窗支持编辑并保存
  - 标题栏钉住右侧新增切换按钮；编辑态 md/text/html 用 textarea；保存走既有 Tauri 写文件命令并回写内容。
  - 验收：悬浮预览 md 文件 → 钉住右侧出现切换按钮；点击进入编辑态出现 textarea；修改后 ⌘S → `write_text_file` 被调用且再次预览显示新内容；html/text 同样出现按钮。
  - e2e：`e2e/floating-preview-edit.spec.ts`（新增）。
  - 接线归属：本票在 `FloatingPreview.tsx` 内接线保存命令。
