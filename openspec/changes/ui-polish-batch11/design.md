# Design: 界面与交互走查修复（第十一批）

> 本文件登记实现决策；视觉数值以 `docs/design/system/spec.md` 与台账为准。

## R-D1 视频菜单（`VideoPlayer.tsx` / `player.css`）

- 删除快捷键、播放列表、字幕三个面板右上角的关闭按钮节点。
- 倍速菜单宽度 132 → 88。
- 倍速图标显式继承按钮 `color`，hover 不改变图标颜色（与弧同色）。

## R-D2 页面宽度控件（`StatusBar.tsx` / `editor.css`）

- 整组控件默认可视度 0，指针进入状态栏宽度区域 150ms 内淡入，离开 200ms 淡出。
- 删除 `.width-bar` 的 `border: 1px dashed transparent`。
- 三挡柱体用 `--app-accent` 与 70% 透明度分级，未选中态也保持可辨识。

## R-D3 PDF 主题（`PdfViewer.tsx`）

- 在 `injectPdfUiCss` 中追加覆盖：工具条、文件菜单、大纲/书签面板、页数、缩放菜单、按钮栏底边线全部使用 `var(--app-surface)` / `var(--app-border)` / `var(--app-text-*)` / `--app-sunken`。
- 覆盖限定在 EmbedPDF 根容器内，避免影响应用其它区域。

## R-D4 刷新与更多菜单（`PaneTreeView.tsx` / `paneHeaderMenu.ts`）

- 刷新：读取磁盘后同时更新 store 内容与该页签的 EditorView 文档（最小 diff，不写历史）。
- 更多菜单新增「打开所在文件夹」，调用 `reveal_in_finder`。
- 导出子菜单：父项 `onPointerLeave` 延迟 150ms 关闭，子菜单 `onPointerEnter` 取消；两者之间加不可见桥接区。

## R-D5 编辑器细节（`block-menu.ts` / `slash.ts` / `decorations/fold.ts` / `editing.css`）

- 颜色/缩进二级面板 `left = rowRect.right - own.left + 4`，越界时翻转。
- 「对齐与缩进」入口加 `AlignLeftOutlined` 合并图标；子项图标保留。
- 斜杠菜单「插入 CSS」补 `CssOutlined`。
- 折叠三角 `margin-right` 收窄到 2px，并去掉标题 marker 在三角存在时的额外外边距。

## R-D6 视频旋转（`VideoPlayer.tsx`）

- 每次点击 `rotation - 90`（归一 0–359），与按钮图标方向一致。
