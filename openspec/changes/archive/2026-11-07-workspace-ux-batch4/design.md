# Design: 工作区交互第四批修正

本文只记录需要裁定的实现选择。

## D1 id 必须跨重启唯一，而不是「恢复后重排」

根因：`paneTree.ts` 的 `nextBranchId` 与 `stores/index.ts` 的 `nextPaneId` 都是模块级 `let 1`，重启从 1 开始；`restoreLayout` 原样保留持久化 id（常见 `branch-1`、`pane-1`）。新建分栏立刻生成同 id。`setBranchRatio` 的 walk 对**每个** `node.id === branchId` 都写入，于是拖一个分隔线改到所有同 id 分支；重复 leaf id 还会让 `findLeaf` / `data-pane-id` / React key 命中错误对象。

裁定：
- 新 id 统一为 `branch-<uuid>` / `pane-<uuid>`（`crypto.randomUUID()`，不可用时退回 `Date.now().toString(36)+随机`）。持久化旧 id 保持可读，且永不与新生 id 相等。
- `setBranchRatio` 只更新第一个匹配节点（防御性，即使外部写坏 id 也不扩散）。
- 不重排恢复后的 id：重排需要重映射 `focusedId` 与 AI 格引用，收益不如「生成器不再撞车」直接。

## D2 分隔线拖拽只改自己的分支

分隔线的容器是它所在 branch 的 div，`raw` 由该容器矩形算出，写入也只针对 `branch.id`。改到别的分支只可能来自 D1 的 id 撞车。另外两处一起收：
- `.pane-divider` 加 `shrink-0`：flex 收缩时不会退化成 0 宽，避免「拖不动」。
- `useDragResize` 的 RAF 从「每个 pointermove 排一帧」改为「一帧只排一次、只取最新事件」，避免高频移动堆积写 store。
- `clampRatio` 在容器 ≤480px 时回退 0.5 保持不变：两格各 240px 是硬下限，无解时居中是可解释的。

## D3 页签拖拽必须 pointer capture

TabBar 与 usePaneDragController/useDragResize 都把监听挂在 `window`。指针进入正文 iframe 后，pointermove/pointerup 进入 iframe 的文档，父窗口收不到。页签拖拽在 pointerdown 时对页签元素 `setPointerCapture(pointerId)`，事件仍冒泡到 window，拖拽跨 iframe 连续。悬浮窗标题栏、缩放手柄、分隔线同理。

## D4 分栏语义按「谁发起」区分

- 页签右键「向右/向下分栏」：用户意图是「把这个文件分到那边」→ 新格 + 搬入页签 + 聚焦新格（`splitPaneWithTab`）。
- 栏目「更多」里的分栏：意图是「再开一格」→ 保持 `splitPane` 建空栏。
- 网格/阅读空间卡片的「分屏」：意图是「把这个文件放到旁边」→ 保留现有打开到新格语义。
- `dropFileOnPane` 去重要彻底：文件已在目标格 → 只聚焦 + 切到该页签；在其他格 → 搬页签进新格，源格变空且非根时塌缩；未打开 → 新建格。
- `moveTabToPane` 保留「空源格」：那是用户显式分出来的格，不应被自动吞掉；空格的关闭按钮始终可用。

## D5 页签视觉：默认透明，交互态才出胶囊

未选中页签 `bg-transparent`、无圆角胶囊、文字 `--app-text-2`；`:hover` 才 `rounded-full` + `--app-sunken`。选中保持 `--app-accent-soft` 胶囊。页签条容器背景改透明，去掉页签之间的 1px 竖线——竖线在透明底上会变成悬浮碎片。栏目头不设背景，顶栏 Toolbar 的 `--app-surface` 也改为透明，整行同色（`--app-bg`）。

## D6 沉浸：高度收纳 + 独立悬浮条

- 流内 `.app-chrome` 在 `.immersive` 下 `max-height: 0`、`opacity: 0`、`overflow: hidden`、`border-bottom-width: 0`，transition 300ms；不再用 `visibility: hidden` 占位。
- 顶部热区从 2px 提到 16px。
- 回显不再复用流内 chrome（会推挤正文），改为独立的 `ImmersivePeekBar`：fixed 顶部、z-index 60、背景 `--app-surface`、阴影，包含当前聚焦格的 TabBar 与「退出沉浸」按钮。指针进入热区 400ms 出现，离开热区与悬浮条 2s 后收起。

## D7 阅读空间：两态都可调

拖拽手柄在 `pinned` 与 `hover` 两态都渲染（悬浮态覆盖在浮层右缘），共用 `railPinnedWidth` 与 200–360 钳制；`collapsed` 只保留 12px 边缘触发条，不渲染手柄（没有可调的可见栏）。

## D8 行宽：滑块与预设并存

`config.readerWidth` 已是数值（480–2400 校验），只是 UI 缺连续控件。新增 `<input type="range" min=480 max=2400 step=20>` 与数值展示；三档预设保留为快捷按钮，点击后滑块同步。写入仍走 `setConfig + saveAppConfig`。

## D9 卡片工具条：按文件类型收敛，不按容器

PDF 卡片的缩略图在网格里是占位图形、在阅读空间里是真 iframe；两者都被工具条遮住。裁定：`kind === "pdf"` 时不渲染工具条（不是 CSS 隐藏），其他类型不变。悬浮预览窗没有卡片工具条，无需改动。

## D10 HTML 预览：预览态不预热编辑器

`ContentArea` 的 EditorView 仍按 panel 常驻以保留 undo/选区，但**内容同步与语言解析推迟到编辑器首次可见**（`cmVisible` 为真）。预览态下空 doc 的 EditorView 创建成本可忽略。切到源码/编辑时在同一 effect 里 dispatch 全文，用户可感知的是「切换瞬间完成解析」，而不是「打开即卡」。`HtmlPreview` 增加骨架层，iframe `onLoad` 后移除。

## D11 验证方式

- 单测锁 `paneTree` 的 id 唯一性与 `setBranchRatio` 单点更新、`dropFileOnPane` 语义。
- e2e 用真实 Chromium：两栏拖分隔线断言另一分支比例不变；拖页签跨格断言 leaf 数不变；右键分栏断言文件路径出现在新格；PDF 卡片 hover 断言工具条不存在；悬浮窗拖过 iframe 断言位置持续变化；50KB HTML 记录 `performance.now()` 首屏。
