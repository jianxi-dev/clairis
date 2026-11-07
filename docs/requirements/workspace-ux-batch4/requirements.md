# 需求四要素 — workspace-ux-batch4

> spec issue：https://github.com/jianxi-dev/clairis/issues/271
> 来源：用户 2026-11-07 工作区交互反馈 12 项 + 截图 3 张；本会话逐条代码复现。
> 一手证据：`~/Desktop/截图1.png`、`截图2.png`、`截图3.png`（当前模型无视觉输入，内容以用户文字描述为准）。

## What

修正工作区交互的 12 项问题，归为五个可独立验收的切片：

1. **分栏布局与页签拖拽**（反馈 4、5、7、10）：分隔线独立调整、页签拖拽可见轨迹、右键分栏搬运文件、关闭页签可靠、不再复制栏目。
2. **页签视觉与沉浸收纳**（反馈 8、9、11）：未选中页签透明无胶囊、页签条透明、栏目头与顶栏同色、沉浸模式顶栏向上收纳并以悬浮条回显。
3. **阅读表面宽度**（反馈 3、6）：左侧栏任意停靠态可调宽；设置提供 480–2400px 连续行宽滑块。
4. **卡片与悬浮窗**（反馈 1、12）：PDF 卡片不显示悬停工具条；悬浮窗拖动不再被 iframe 吞事件。
5. **HTML 打开性能**（反馈 2）：预览态不同步整篇 HTML 进隐藏 CodeMirror；加载期显示骨架；以 50KB 真实文件测量。

## Why

- 分栏互牵与栏目复制不是手感问题：`pane`/`branch` id 计数器重启后从 1 开始，与持久化布局里的旧 id 撞车；`setBranchRatio` 一次性更新所有同 id 节点。用户在多栏布局里每次重开应用都会遇到。
- 页签与格拖拽、悬浮窗拖拽都没有 pointer capture；指针进入正文 iframe 后父窗口收不到 pointermove/pointerup，直接表现为「拖不动 / 指示不显示 / 松手不生效」。
- 右键分栏只切页签再建空格，与用户对「把当前文件分到右边」的直觉相反。
- 沉浸模式只改透明度不改高度，视觉上仍有两条空带；顶部热区 2px，几乎无法触发。
- 50KB HTML 在预览态仍被 CodeMirror 全文解析，且没有加载反馈。

## Scope

- 前端：`TabBar`、`PaneTreeView`、`PaneDivider`、`ContentArea`、`HtmlPreview`、`FloatingPreview`、`GridTile`、`ReadingRail`、`SettingsView`、`App`、`useDragResize`、`usePaneDragController`、`paneTree`、`stores/index.ts`、`styles/editor.css`。
- 规格：`application-shell` 新增 G-8…G-11；`reading` 新增 A-15…A-17。
- 测试：`src/__tests__` 单元/组件，`e2e/` 真实 Chromium。

## Non-goals

- 不重写递归 pane 树模型，不引入第三方拖拽库。
- 不改 Rust 命令与文件读写。
- 不做字符级富文本选区、不做 PDF 内嵌工具栏定制。
- 不改文档自身的 CDN 依赖（Tailwind Play CDN / Google Fonts）。
- 不改变「每格独立页签条」的信息架构。
