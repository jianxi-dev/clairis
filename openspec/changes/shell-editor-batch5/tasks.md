# Tasks: 桌面外壳与编辑器批量修复（第五批）

> 垂直切片：每条任务都能单独交付并在页面上看到结果。
> 依赖：见每节「依赖」行。同文件交集决定串行（不是功能依赖）。

## 1. 分栏 · 页签 · 沉浸（反馈 1 / 2 / 3 / 9 / 10）

依赖：1.1 → 1.2（同改 `TabBar.tsx`）

- [ ] 1.1 沉浸悬浮条与页签交互修复

  实现要点：
  - `ImmersivePeekBar.tsx`：热区 `pointermove` 用 `elementFromPoint` + `closest('[data-pane-id]')` 解析指针所在格，高亮/切换内容；无命中回退 `focusedPaneId`；给 `TabBar` 补 `paneId`/`onReorderTabs`/`onMoveToPane`；空格渲染兜底文案「空分栏」
  - `App.tsx` / `styles/editor.css`：热区 `.immersive-peek-trigger` 与悬浮条重叠，消除条上方 16px 透明带（保留 16px 命中高度）
  - `stores/index.ts`：新增 `tabDragActive`（或等价），`TabBar` 拖拽期间置真，抑制热区 2s 收起
  - `PaneTreeView.tsx`：`showFullscreen` 恒真（单格也显示全屏入口；`showClosePane` 保持 `!rootIsLeaf`）
  - `styles/editor.css`：页签胶囊高度下调不压上下边线
  - 测试：扩展 `e2e/immersive-peek.spec.ts`、`e2e/pane-fullscreen-icon.spec.ts`、`e2e/clairis-bug2.spec.ts`；新增悬浮条跟随格 e2e
- [ ] 1.2 页签拖拽跟手 ghost

  实现要点：
  - `TabBar.tsx`：`pointermove` 记录 `clientX/Y`；`createPortal` 到 body 渲染 `position:fixed` 克隆（`pointer-events:none`）；`finish` 清理
  - 测试：扩展 `e2e/pane-header.spec.ts` / `e2e/pane-drag.spec.ts` 断言 ghost 存在并随指针
- [ ] 1.3 页签双击改名

  实现要点：
  - `TabBar.tsx`：标题双击进入行内编辑（input 或 contentEditable）；回车提交、Esc 取消、失焦提交
  - `stores/index.ts`：新增 `renameTab(tabId, title)`（仅改 title，不改 path）
  - 测试：新增 e2e 断言双击→改名→回车生效、Esc 撤销

## 2. 图标体系（反馈 7 / 15）

依赖：2.1 → 5.3（同改 `Toolbar.tsx`）

- [ ] 2.1 图标补漏与统一

  实现要点：
  - `src/ui/icons.ts`：新增 `exportWord`/`exportZip`/`exportMdpkg` 形状；重绘 `subtitle`（对话气泡形）与 `keyboardHints`（键位格形）以区分
  - `src/lib/paneHeaderMenu.ts`：导出项 icon 改指新名
  - `VideoPlayer.tsx`：自绘控件经 `iconSvg(name, size)` 统一到与原生控件一致的视觉尺寸
  - `Toolbar.tsx`：沉浸入口由文字改 `<Icon name="immersive" />`（图标+文字）
  - pin 四处（`FloatingPreview.tsx`、`ReadingRail.tsx` ×2、`CaptureOverlay.tsx`）：`name={pinned ? "pinOff" : "pin"}`
  - 暖色图标：确认 `--app-accent` 在 `.warm` 下解析，图标 `color` prop 透传
  - 测试：扩展 `e2e/icon-system.spec.ts`、`src/__tests__/ui/icons.test.ts`

## 3. PDF 预览（反馈 5 / 6）

依赖：3.1 → 3.2（同改 `PdfViewer.tsx`）

- [ ] 3.1 PDF 缩放与页码条位置

  实现要点：
  - `PdfViewer.tsx`：`DISABLED_CATEGORIES` 追加 `zoom-in`/`zoom-out`；`onReady(registry)` 桥接 WebKit `gesturestart/gesturechange` 到 zoom 插件（复用 `PreviewView` 的 `usePreviewZoom` 模式）
  - `PdfViewer.tsx`：`onReady` 后 `ui.disableOverlay("page-controls")`；用 `ui.mergeSchema` 把 `scroll:previous-page`/`scroll:next-page` + 页码并入 `main-toolbar`
  - 测试：扩展 `e2e/tauri/file-kinds.spec.ts`（缩放/翻页选择器同步）
- [ ] 3.2 PDF 卡片真缩略图

  实现要点：
  - 先定方案（OQ-1）：EmbedPDF render 插件运行时渲首页到 canvas 生成 dataURL；或 Rust 侧渲染落盘
  - `ReadingRail.tsx` 的 `pdf-page` 缩略图分支替换为真位图；`lib/railCards.ts` 的 `thumbDescriptorOf` 产出真图 src
  - 测试：扩展 `e2e/rail-cards.spec.ts`、`src/__tests__/railCards.test.ts`

## 4. Markdown 编辑（反馈 18 / 19 / 20 / 21 / 23 / 24 / 25 / 26）

依赖：4.1 → 4.2 → 4.3 → 4.4（`editor.css` / `decorations/` 相交，串行）

- [ ] 4.1 全角斜杠/顿号触发命令 + 手柄滑入显菜单

  实现要点：
  - `slash.ts`：顿号 `、` 触发器改为转 ASCII `/` 后开菜单；`smart-input.ts`：全角 `／` 转换后触发菜单
  - `orchestration/block-handle.ts`：移除菜单计时的 `entry.gate.isOpen()` 前置，手柄 hover 即开菜单
  - 测试：改 `e2e/smart-input.spec.ts`、`src/__tests__/editor/slash.test.ts`；扩展 `e2e/block-menu.spec.ts`
- [ ] 4.2 大纲按钮形态 + 标题折叠

  实现要点：
  - `OutlineMenu.tsx` + `styles/editor.css`：大纲按钮改方形圆角、默认透明、钉住 `data-pinned` 显底色
  - `decorations/`：移植 md-bundle `chapter-tree.ts` 章节区间数学，新增折叠 widget（三角）+ `StateField`/`StateEffect`；新增 `cm-*` 类名同步 CSS
  - 测试：扩展 `e2e/outline-menu.spec.ts`；新增折叠 e2e / 单测
- [ ] 4.3 编辑器工具条收敛与选区能力

  实现要点：
  - 迁移 md-bundle `floating-toolbar.ts` 能力；图标复用 `src/editors/icons.ts` 的 `COMMAND_ICON_NAME`
  - 按 workbuddy 收敛集合：块=AI 编辑/背景色/边框色/删除；文字=AI 编辑/字号(当前值)/加粗/斜体/下划线/删除线/链接/对齐/文字颜色/删除
  - 对齐：补 `toggleBlockAlignment`（Pandoc fenced div 语义）；颜色改共享调色板实色观感；缩进图标修正
  - 内联格式作用选区；对齐/删除/颜色未选区时作用整块
  - 测试：新增选区工具条 e2e；扩展 `e2e/block-menu.spec.ts`、`src/__tests__/editor/colorPalette.test.ts`
- [ ] 4.4 文档前进后退恢复

  实现要点：
  - `ContentArea.tsx`：内容同步 dispatch 标 `Transaction.addToHistory.of(false)`（或最小 diff），避免整篇替换进历史、避免跨页签
  - `HtmlVisualEditor.tsx`：补文档级撤销栈
  - 测试：`src/__tests__` 断言同步不进历史；e2e 断言 Ctrl+Z 不清空、可多步

## 5. 阅读空间卡片 · 状态栏 · 新建（反馈 11 / 13 / 14 / 16 / 22）

依赖：5.1 → 5.2（同改 `ReadingRail.tsx`/`previewAnchor.ts`）；5.3 依赖 2.1；5.4 独立

- [ ] 5.1 阅读空间卡片布局与更名收藏

  实现要点：
  - `ReadingRail.tsx`：card 档动作移左下角，顺序 打开/右分栏/下分栏/收藏/路径；右上角显示进度（仅百分比，悬停「已读」）与时间
  - `railView.ts` + 11 处「置顶」文案 → 「收藏」（`ReadingRail.tsx`、`GridToolbar.tsx`、`shortcuts.ts`、`aiViewSpec.ts`、`App.tsx`）
  - `ReadingRail.tsx` / `styles/editor.css`：折叠态边缘条改无色
  - 测试：扩展 `e2e/rail-cards.spec.ts`、`src/__tests__/components/Rail/ReadingRail.test.tsx`
- [ ] 5.2 悬浮预览窗宽度与底部按钮

  实现要点：
  - `previewAnchor.ts`：阅读空间右侧 1/2 触发的预览窗宽度收窄到卡片缩略图宽度对应窄宽
  - `FloatingPreview.tsx`：底部动作区（打开/分栏→/分栏↓）在指针进入底部按钮高度区时重显
  - 测试：扩展 `e2e/floating-preview.spec.ts`
- [ ] 5.3 状态栏与顶栏图标迁移

  实现要点：
  - 新增 `StatusBar` 组件（规格参考 `docs/design/approved/shell-ui/spec.md`）
  - `Toolbar.tsx`：移除主题区；grid/AI/theme/immersive 4 图标按序移入状态栏右侧
  - 测试：扩展 `e2e/app.spec.ts` / 新增状态栏 e2e
- [ ] 5.4 新建默认 .md + 首页跳转

  实现要点：
  - `stores/index.ts`：`newTabWith` 让 `fileTypeOf(path)` 返回 markdown（补 `.md` 路径或 TabBar 用 `tab.fileKind`）；设 `scene: "workspace"`
  - 测试：改 `e2e/extensions-template.spec.ts`、扩展 `e2e/portal.spec.ts`

## 6. 视频（反馈 8）

- [ ] 6.1 视频切换后页签名同步

  实现要点：
  - 切视频文件时同步页签 `title` 为文件基名（`stores/index.ts` / `VideoPlayer.tsx` 附近）
  - 测试：扩展 `e2e/tauri/media-player.spec.ts`

## 7. HTML 编辑态（反馈 4）

- [ ] 7.1 HTML 编辑态显示修复

  实现要点：
  - 先独立复现定位根因（DQ-2）：用 `readme-contract-consult.html` 走编辑态，排查 `buildEditableDoc`、sandbox `allow-scripts`、外链 CDN 脚本、异常首字符
  - 按根因最小修复；附「红」证据（复现）与「绿」证据（修复后）
  - 测试：新增 e2e（用 mock 桥打开该结构文档切编辑态断言可见）；扩展 `e2e/html-visual-*.spec.ts`

## 8. 既有测试失败（反馈 12）

- [ ] 8.1 导出二级菜单重渲染修复

  实现要点：
  - 定位导出二级菜单在 mock 下被重渲染导致 element detached 的根因（`PaneTreeView.tsx` 导出子菜单渲染）
  - 最小修复（稳定 key / 避免父级重渲染导致重挂载）
  - 测试：重跑并附通过证据 —— `e2e/ai-forms.spec.ts`、`e2e/clairis-bug2.spec.ts`、`e2e/tauri/{ai-entry,export-docx,export-html,export-mdpkg,export-png}.spec.ts`

## 9. 收尾

- [ ] 9.1 归档与台账

  全部子票合并后：`/opsx-sync` → `validate --strict` → `archive` → 看板 Done → 关 spec issue #311 → `docs/delivery/requirements-status.md` 登记 G-3/G-7/G-8/G-10、状态栏、图标体系、E-10…E-17、C-4/C-6、PDF 预览。
