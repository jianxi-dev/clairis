# Proposal: 界面精度与交互一致性修复（第九批）

## Why

用户 2026-11-09 第五次真机走查报了 7 项问题。这一批没有崩溃或数据损坏，但有三类真实损失：

- **可发现性**：页面宽度三挡块未选中时几乎看不见；栏目右上角图标常驻却与正文争视觉；折叠三角一直亮着。
- **行为阻塞**：视频全屏后所有二级菜单被上一批显式禁用；进度条缩略图始终是首次打开的那一帧；钉住一个悬浮窗后无法再开第二个。
- **布局抖动**：底部状态栏滑入时进入 flex 流，正文被顶起 23px，滑出又落下。

第七项是真实布局缺陷：相邻标题全部折叠后，标题被拼成一行（已复现 `.cm-line` 文本为 `# A# B# C# D`）。

## What Changes

1. **状态栏 / 页面宽度**：三挡块每块在 hover 时显示 1px 虚线边框，移出隐藏；未选中块仍以底色区分。
2. **栏目头**：mode / 全屏 / 更多 / 关闭整组收入 `.pane-actions`，默认隐藏、指针滑入该区域显示、滑出隐藏；菜单打开或键盘聚焦时保持可见。
3. **大纲**：按钮右缘与栏目右侧图标区右缘对齐（`right: 4px`），不再悬空 24px。
4. **悬浮窗**：钉住后支持多个实例；新增实例不替换已钉住的窗口。
5. **底部状态栏**：隐藏/沉浸态下 peek 出的状态栏改为 fixed 悬浮层，不参与流式布局，正文高度不变。
6. **视频二级菜单**：全屏可用；全部改为 hover 显示 / 滑出隐藏；水平中心默认对齐鼠标并受容器边界约束；快捷键浮层宽度缩 1/3；截图提示固定在截图按钮上方。
7. **视频右侧按钮**：统一视觉尺寸与对齐；快捷键图标重绘为可辨认键盘；「画面」图标改为图片框。
8. **倍速菜单**：每档改为指针表盘——1.0× 指针 12 点，低速偏左、高速偏右。
9. **MD 折叠**：三角放大一倍（20px），默认透明，仅在 `.cm-content` 左缘 25% 召唤区或已折叠时显示；折叠替换保留标题行尾换行符，相邻折叠不再合并成一行。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `application-shell`：状态栏宽度面板（hover 虚线刻度）、栏目头图标组（整区 hover 显隐）、状态栏 peek（悬浮层不占布局）
- `navigation`：悬浮预览窗（钉住后多实例）
- `editing`：大纲按钮几何（与栏目按钮右缘对齐）、标题折叠（三角尺寸/召唤区/换行保留）
- `file-management`：C-6 视频预览播放器（全屏二级菜单、hover 显隐、鼠标锚定、缩略图随集刷新、截图提示、右侧按钮与图标、倍速表盘）

## Impact

- 代码：`components/StatusBar.tsx`、`components/Content/PaneTreeView.tsx`、`components/Content/OutlineMenu.tsx`、`components/Preview/FloatingPreview.tsx`、`components/Content/VideoPlayer.tsx`、`App.tsx`、`stores/index.ts`、`lib/previewAnchor.ts`、`editors/decorations/fold.ts`、`editors/orchestration/block-handle.ts`、`ui/icons.ts`、`styles/{editor,player}.css`
- 测试：扩展 `e2e/status-width.spec.ts`、`e2e/pane-header.spec.ts`、`e2e/outline-border.spec.ts`、`e2e/floating-preview.spec.ts`、`e2e/video-controls.spec.ts`、`e2e/video-rate.spec.ts`、`e2e/heading-fold.spec.ts`；单测同步 `fold.test.ts` 与 preview store 断言
- 风险：状态栏、悬浮窗、视频控制条均为多路共用组件；悬浮窗状态形状变化需逐项回归；不涉及数据迁移，回滚为 revert
