# Proposal: 界面与交互走查修复（第十一批）

## Why

用户 2026-11-10 真机走查报了 10 项问题：

1. 视频的快捷键 / 播放列表 / 字幕菜单仍带右上角关闭按钮；倍速菜单过宽；倍速图标在悬停时被高亮。
2. 状态栏页面宽度按钮常显、带虚线边框，三挡形状颜色偏暗。
3. PDF 查看器的文件选项、大纲/书签栏、页数、缩放菜单与按钮栏下边线不跟随主题。
4. 栏目「刷新」点击后当前文档没有重新加载。
5. 「更多」菜单缺少「打开当前文件所在文件夹」。
6. 视频旋转按钮的方向与画面相反。
7. 「更多 → 导出」子菜单在指针移入前就消失。
8. MD 编辑态标题折叠三角与标题文字间距过大。
9. 转换手柄菜单里「颜色」「缩进」二级面板不是向右展开。
10. 「对齐与缩进」入口及其子项、「插入 CSS」入口没有图标。

## What Changes

1. 视频菜单：删除三个面板的关闭按钮；倍速菜单宽度收窄 1/3；倍速图标悬停不高亮、与弧同色。
2. 页面宽度按钮：整组滑入才显示；去掉虚线边框；三挡形状提亮。
3. PDF：用主题 token 覆盖 EmbedPDF 的内联/阴影 DOM 颜色，文件选项、大纲/书签、页数、缩放菜单与按钮栏下边线跟随三主题。
4. 刷新：重新读取磁盘并替换当前页签内容，编辑器与预览立即更新。
5. 更多菜单新增「打开所在文件夹」，调用既有 `reveal_in_finder`。
6. 视频旋转：点击后画面按逆时针 90° 旋转（与按钮图标一致）。
7. 导出子菜单：父项与子菜单之间加入指针桥与延迟关闭，移入子菜单不消失。
8. 标题折叠三角：与标题文字的间距收窄到 2px 以内。
9. 块菜单颜色/缩进二级面板改为在触发行右侧展开，越界时翻转。
10. 「对齐与缩进」入口加合并图标，子项图标确认渲染；斜杠菜单「插入 CSS」补图标。

## Capabilities

### Modified Capabilities

- `editing`：E-7 / E-11 菜单图标与二级方向、标题折叠间距
- `application-shell`：栏目更多菜单（刷新、打开文件夹、导出子菜单保持）
- `reading`：页面宽度控件显隐与形态、PDF 主题跟随
- `file-management`：视频菜单与旋转方向

## Impact

- 代码：`VideoPlayer.tsx`、`player.css`、`StatusBar.tsx`、`editor.css`、`PdfViewer.tsx`、`PaneTreeView.tsx`、`paneHeaderMenu.ts`、`block-menu.ts`、`slash.ts`、`decorations/fold.ts` / `heading.ts`、`editors/icons.ts`
- 测试：扩展 `video-controls`、`status-width`、`pane-header`、`pdf-viewer`、`block-menu`、`slash-menu`、`heading-fold` e2e
- 风险：PDF 为外部包，覆盖样式需限定作用域；回滚为 revert
