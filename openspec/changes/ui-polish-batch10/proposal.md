# Proposal: 界面与交互走查修复（第十批）

## Why

用户 2026-11-09 第六次真机走查报了 12 项问题，集中在四类真实损失：

- **工具条归属错误**：MD 编辑态点一下正文就冒出「AI / 背景色 / 边框色 / 删除」——这是 HTML 非文字区块的工具条；而 HTML 文字区块该有的横向文字工具条（AI / 字号 / B / I / U / S / 链接 / 对齐 / 字色 / 删除）反而没接上。
- **多栏互相打断**：一个栏目在播视频，另一个栏目打开别的视频或文件时，先前的视频被换源、黑屏。
- **入口缺失/不可见**：⌘O 选不到音频、HEIF、`.sh`；栏目更多菜单没有刷新；视频打开后左侧栏展开按钮被盖住；预览态没有折叠三角。
- **菜单几何与图标失真**：新建/转换菜单过宽、插入 CSS 与对齐仍带图标、方框类图标不可辨、二级菜单移出即消失、剪切仍是文档图标。

## What Changes

1. **工具条归属**：MD 编辑态移除块工具条（AI / 背景 / 边框 / 删除），只保留选区轮盘；HTML 文字节点/文字选区改用横向文字工具条（AI / 字号 / 加粗 / 斜体 / 下划线 / 删除线 / 链接 / 对齐 / 字色 / 删除）；HTML 非文字区块使用 AI / 背景色 / 边框色 / 删除。
2. **#105 / #318**：空行「+」悬停不得弹转换菜单；全角 `／` 与 `、` 归一为半角后不得触发斜杠命令（仅 `，` 继续归一）。
3. **视频多栏**：播放器按格独立持有源与可见性；任一格打开新媒体不替换其他格的播放器，正在显示的视频不变黑。
4. **视频按钮**：倍速二级表盘与主控件同形；全屏按钮重绘为与画中画同线宽同尺寸；时间戳笔记与截图图标等高；播放列表图标底部与画面对齐；补齐视频按钮快捷键并在总览中列出。
5. **打开文件**：⌘O 过滤增加音频、HEIF/HEIC 图片与 `.sh` 等脚本。
6. **栏目与页签**：更多菜单增加「刷新」；页签改名输入框长度增加 1/2；左侧栏展开按钮层级高于媒体宿主，视频打开后仍可展开。
7. **手柄菜单**：新建/转换菜单宽度由 264px 收窄到 176px；顶部两行间距收紧；插入 CSS、对齐去图标；视频/文件、表格、内嵌网页、分栏图标重绘并与轮盘统一；颜色/对齐/缩放二级改为下方展开且指针移出不消失；剪切块换剪刀图标。
8. **折叠**：MD 编辑态只显示指针所在行的折叠三角；MD 预览态为标题增加同规则折叠三角。
9. **表格**：MD 编辑态与预览态表格增加比外框更浅的竖向分割线。

## Capabilities

### Modified Capabilities

- `editing`：E-13 全角标点（不再触发命令）、E-17 空行手柄、E-19/E-22 工具条归属与控件集、标题折叠（当前行显隐、预览态）
- `file-management`：C-1 打开文件过滤、C-6 视频多栏与按钮/快捷键
- `application-shell`：G-6 页签改名输入框、栏目更多菜单刷新、左侧栏层级

## Impact

- 代码：`editors/setup.ts`、`orchestration/block-toolbar.ts`、`components/Content/HtmlEditToolbar.tsx`、`HtmlVisualEditor.tsx`、`VideoPlayer.tsx`、`mediaPlayerState.ts`、`MediaPlayerHost.tsx`、`PreviewView.tsx`、`TabBar.tsx`、`PaneTreeView.tsx`、`ReadingRail.tsx`、`editors/orchestration/{block-menu,block-handle,menu-metrics,slash}.ts`、`editors/smart-input.ts`、`editors/icons.ts`、`src-tauri/src/commands/file.rs`、`styles/{editor,reader,player}.css`
- 测试：新增/扩展 `e2e/{html-edit-toolbar-kinds,block-toolbar,video-multi-pane,video-controls,pane-header,heading-fold,table-grid,slash-menu}.spec.ts` 与对应单测
- 风险：播放器状态形状变化影响所有媒体页签；工具条归属变更影响 MD/HTML 两套编辑态；菜单宽度影响定位与二级面板；回滚为 revert，无数据迁移
