# Tasks: 界面精度与交互一致性修复（第八批）

> 垂直切片：每条任务都能单独交付并在页面上看到结果。
> 依赖：见每节「依赖」行。同文件交集决定串行（不是功能依赖）。
> 反馈编号对应用户 2026-11-09 第四次走查清单。
> 集成 checkpoint 计划：本 change 共 11 票，每完成 ≤4 票执行一次 QG-6 集成 checkpoint（合并到集成分支 → `npx tsc --noEmit` + `npm test` → Playwright 打开一次 → 记录「用户现在能看到什么」）。

## 1. 页签拖拽禁选与选中态分级（反馈 1 / 5）

依赖：无

- [ ] 1.1 拖拽页签不再选中正文文字；页签选中态与图标分级生效

  实现要点：
  - `components/TabBar.tsx`：拖拽激活时 `document.documentElement.dataset.tabDrag = "true"`，`finish` 时删除；`stores/index.ts` 的 `tabDragActive` 保留供现有热区逻辑使用
  - `styles/editor.css`：`html[data-tab-drag="true"] body * { user-select: none; -webkit-user-select: none; }`
  - `TabBar.tsx`：选中页签标题色 `--app-text-strong`；未选中页签图标 `--app-chrome-rest`；传入 `paneFocused` 与 `isActive` 判定，只有「聚焦栏目的活动页签」图标用类型色；其他栏目的活动页签标题仍用选中色
  - `styles/editor.css`：删除 `.pane-leaf[data-focused="true"]` 的 accent 内描边；`data-tab-drop` 落区环保留
  - 测试：新增 `e2e/tab-drag-select.spec.ts` 断言拖拽经过正文后 `window.getSelection().toString() === ""`；扩展 `e2e/pane-header.spec.ts` 断言聚焦栏活动页签图标色 ≠ 灰、非聚焦栏活动页签图标为灰、`pane-leaf` 的 `box-shadow` 不含 accent

## 2. PDF 顶栏边框与外围底色（反馈 2）

依赖：无

- [ ] 2.1 页码区去外框、PDF 外围底色跟随主题

  实现要点：
  - `components/Content/PdfViewer.tsx` `injectPdfUiCss`：追加 `[data-epdf-i="pdf-page-nav"] *` 相关容器 `border: 0`，只去框不隐藏控件
  - 同一注入：`:host { background: var(--app-bg) }` 与外层容器 `background: var(--app-bg)`；页面纸面不改色
  - 测试：`e2e/pdf-chrome.spec.ts`（Tauri mock）断言页码区计算 `border-width == 0px`，容器背景随 `document.documentElement.className` 切换后等于 `--app-bg` 计算值

## 3. 主题图标等距、去三角、自动布局魔法棒（反馈 3 / 7 / 14）

依赖：无（图标表与状态栏，与 1 不同文件）

- [ ] 3.1 三个图标与主题入口视觉修正

  实现要点：
  - `ui/icons.ts`：`sunBright` 重绘为 6 条 60° 等角光线（半径 6.5→9.5）+ 中心圆 r3.5；`layoutAuto` 改为魔法棒（斜棒 + 3 星芒）
  - `components/StatusBar.tsx`：清除任何 chevron/三角渲染；点击循环与悬停面板行为不变
  - `docs/design/system/decisions.md`：追加「亮色图标光线数=6 等距」「自动布局=魔法棒」两行（append-only）
  - 测试：`e2e/icon-system.spec.ts` 扩展——解析 `sunBright` 6 条线段、相邻夹角 60°±2°；`theme-entry` 内 `svg` 数量为 1 且无三角路径（路径点数 ≤ 24 的填充三角）；`auto-layout-entry` 的 path 不含四宫格矩形

## 4. 栏目全屏按钮悬停显示与尺寸下限取消（反馈 4 / 17）

依赖：无

- [ ] 4.1 全屏按钮默认隐藏、悬停显示；栏目可拖到 0

  实现要点：
  - `PaneTreeView.tsx`：全屏按钮加 `pane-fullscreen-button`，全屏态带 `data-fullscreen`
  - `styles/editor.css`：默认 `opacity: 0; pointer-events: none`；`.pane-leaf:hover .pane-fullscreen-button`、`:focus-within`、`[data-fullscreen="true"]` 时可见
  - `lib/paneTree.ts`：`clampRatio` 下限 0（保留 [0,1] 与 containerPx 兜底）；`PaneTreeView` 内联与 `.pane-leaf` CSS 的 240px 最小宽高改 0
  - 测试：`e2e/pane-header.spec.ts` 断言按钮默认 `opacity == 0`、hover 后 `opacity == 1`、全屏态仍可见；`e2e/pane-resize.spec.ts` 断言分隔条拖到极端后某栏计算宽/高可为 0 且无异常

## 5. 悬浮预览动作行与阅读空间路径（反馈 6 / 8）

依赖：无

- [ ] 5.1 悬浮窗动作行自动隐藏、同卡片交互、显示路径、整体右移一个按钮位；阅读空间路径悬停去底色

  实现要点：
  - `components/Preview/FloatingPreview.tsx`：动作行显隐改为指针在动作行自身；离开即隐藏（钉住除外）；按钮类名改 `text-[var(--app-chrome-rest)] hover:text-[var(--app-chrome-hover)]` 无底色；新增路径按钮（`folder` + 父目录名 + 完整路径 title + reveal）；动作行 `padding-left: 24px`
  - `components/Rail/ReadingRail.tsx`：路径按钮移除 `hover:bg-[var(--app-sunken)]`，保留文字色变化
  - 测试：扩展 `e2e/floating-preview.spec.ts`——进入底部出现动作行与路径按钮，指针移出后 150ms 内消失；路径按钮 hover 背景透明；动作行左内距 ≥ 20px

## 6. 页签右键菜单「悬浮小窗」（反馈 9）

依赖：5.1（复用悬浮预览动作与定义，同组件但不同文件；按依赖序开工）

- [ ] 6.1 右键菜单新增悬浮小窗并唤出悬浮预览

  实现要点：
  - `TabBar.tsx` 右键菜单第一项「悬浮小窗」（图标 `pip`），点击读取页签元素矩形并 `openPreview`（`source: "tab"`），同时 `closeMenu`
  - `PreviewState` / `openPreview` 保持单一入口；不新建第二套悬浮窗
  - 测试：扩展 `e2e/tab-context-menu.spec.ts`——菜单 5 项且首项为悬浮小窗；点击后 `[data-testid="floating-preview"]` 出现且标题等于页签标题

## 7. AI 停靠态打开文件（反馈 10）

依赖：无

- [ ] 7.1 停靠 AI 时卡片打开与 Ctrl+O 落到普通内容栏

  实现要点：
  - `stores/index.ts`：新增 `lastTabsPaneId`（`focusPane` 更新、跳过 `kind === "ai"`）；`openFile` 与 `dropFileOnPane` 用「聚焦非 AI 栏 → 最近非 AI 栏 → 首个非 AI 栏」选宿主
  - 不改变 AI 栏自身的渲染与关闭逻辑
  - 测试：新增 `e2e/ai-docked-open.spec.ts`——停靠 AI 后双击卡片文件与 `Ctrl+O`（mock 对话框）均在工作区出现该文件页签且内容可见，AI 栏页签数与状态不变

## 8. HTML 工具条归属、双击定位与块缩放（反馈 11 / 12）

依赖：无

- [ ] 8.1 HTML 工具条只属于 HTML 编辑；双击只定位；选中块可拖拽改宽高

  实现要点：
  - 归属：先真机复现两种编辑态实际渲染的选择器；确保 `html-edit-toolbar` 仅在 `HtmlVisualEditor` 内、`cm-floating-toolbar`/`cm-block-toolbar` 仅在 md 编辑态；必要时在 `ContentArea` 初始化扩展处按 `fileKind` 分流
  - `editors/html/runtime.ts`：双击进入编辑后 `caretRangeFromPoint` 折叠选区 + `removeAllRanges()`，仅定位光标
  - `components/Content/HtmlVisualEditor.tsx` + `editors/html/edit.ts`：选中块叠加 4 个缩放手柄（右/下/右下/左），拖动写 `width`/`height` 内联样式（px，≥24），走 `applyStylePatch`
  - 测试：`e2e/html-edit-toolbar.spec.ts` 断言 html 编辑态 `.html-edit-toolbar` 存在、`cm-floating-toolbar` 为 0；md 编辑态反之；`e2e/html-visual-text.spec.ts` 断言双击后 `selection.toString() === ""` 且 caret 存在；`e2e/html-visual-resize.spec.ts` 断言拖动右下柄后 content 出现 `width:`/`height:`

## 9. 大纲按钮几何（反馈 13）

依赖：无

- [ ] 9.1 按钮距右缘一个按钮宽、未钉住无边框、钉住细边框

  实现要点：
  - `styles/editor.css`：`.biaoyue-outline` 的 `right` 由 `calc(100% / 3)` 改为 `28px`（一个按钮宽）；按钮默认 `border-color: transparent`，钉住 `border: 1px solid var(--app-border)`；浮层未钉住 `border: 0`、钉住 1px 保持
  - 测试：扩展 `e2e/outline-border.spec.ts`——按钮右缘到内容区右缘距离 26–30px；未钉住计算 `border-style == none` 或 `border-width == 0px`；钉住后 `border-width == 1px`

## 10. 页面宽度面板刻度（反馈 15）

依赖：无

- [ ] 10.1 上限 1400、宽松 1200、三柱居中相接并收窄，滑块稍长于三柱

  实现要点：
  - `StatusBar.tsx`：`WIDTH_PRESETS` 改 720/960/1200，柱高 14/18/22；`WIDTH_MAX` 保持 1400；`WIDTH_PANEL_W` 改 200
  - `styles/editor.css`：`.width-bars` 居中、`gap: 0`、总宽 66px、单柱 22px 并排相接（1px 分隔）；`.width-slider` 宽 78%
  - `docs/design/system/decisions.md`：追加「宽度面板三柱尺寸与档位」一行
  - 测试：扩展 `e2e/status-width.spec.ts`——滑块 `max == 1400`；点击宽松后 `--type-measure == 1200px`；三柱中心与面板中线偏差 ≤1px，柱间 `gap == 0`；滑块宽度 > 三柱总宽

## 11. 视频播放器控制条与截图（反馈 16）

依赖：无

- [ ] 11.1 进度条缩略图、控制条尺寸还原、图标规范、截图入剪贴板、全屏禁二级菜单、快捷键并入总览

  实现要点：
  - `styles/player.css`：控制高度 38px、图标 24px、padding 12px（还原上一版）
  - `VideoPlayer.tsx`：进度条 `mousemove` 抽帧缩略图（节流 120ms、缓存 20 点、失败只显示时间）；倍速用 `speed` 图标、画面 `tune`、二级菜单每项前置图标；放大/缩小独立按钮；旋转按钮移到字幕前；自绘图标统一 22px；快捷键图标去外框
  - 截图改为 `canvas.toBlob` → `ClipboardItem` → `art.notice.show`（胶囊），失败回退下载并提示
  - 全屏态：`fullscreenWeb` 为真时二级菜单控件不展开并提示
  - `lib/shortcuts.ts` + `ShortcutOverlay`：并入视频快捷键家族
  - 测试：扩展 `e2e/media-render.spec.ts` / 新增 `e2e/video-controls.spec.ts`——控制高度 38px、图标 22px、进度条 hover 出现缩略图节点；截图后剪贴板 mock 收到 1 次写入且无另存为调用；全屏态点倍速不出现菜单；快捷键总览含视频条目
