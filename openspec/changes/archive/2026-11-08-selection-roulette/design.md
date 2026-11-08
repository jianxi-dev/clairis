# Design: 选区轮盘工具条

> 批准设计：`docs/design/approved/selection-roulette/README.md`（canonical，2026-11-08 五轮评审）。本文件只登记**实现决策**，不复制批准稿的数值；数值以批准稿为准。
> 原型：`.lavish/selection-roulette.html`（可交互，已 headless 验证）。
> 视觉锚点：`design-system:§2.1;§4;§5;§6` + `ledger:选区轮盘`。

## R-D1 模块划分

- `editors/orchestration/roulette.ts`：纯几何与状态机（扇区角度 → 命中项、层级栈、驻留计时、包围盒夹取），不碰 DOM。
- `editors/orchestration/roulette-view.ts`：渲染与事件（portal 到 body，绝对定位），复用 `menu-stack` 的层级与外部点击关闭。
- `floating-toolbar.ts` 保留为**入口适配器**：选区稳定后调用 roulette-view；旧横向 DOM 分支删除。
- HTML 侧复用同一 `roulette-view`，由 `HtmlVisualEditor` 提供动作集（动作函数签名统一为 `(payload) => void`）。

## R-D2 出现时机与死区

- 选区稳定 90ms 后出现（80ms 淡入 + 60ms 缩放）；禁止在 `mouseup` 当场出现（批准稿 §5.1-1）。
- 圆心 = `coordsAtPos(selection.main.head)`；键盘选择用选区末端 client rect。
- 圆心 24px 死区：指针离开锚点 24px 前，圆心不响应 hover/click（§5.1-2）。
- 离开整轮 240ms 收回扇形；已有展开层时换根扇区驻留 300ms，无展开层 90ms。

## R-D3 层级与「转换」动态表

- 根环固定 8 扇区，顺序与方位按批准稿 §4.2。
- 二级/三级每格 15°、环带 92–122px、纯图标 + `title`；三级原位替换第二层，圆心变 `‹` 返回。
- 「转换」第二层由光标所在块类型生成（参数表 `convertOptionsFor(blockType)`）；标题/列表/高亮可下钻第三层；高亮落 `> [!kind]`。
- 已在标题内时第二层多出「正文」。

## R-D4 颜色双圈

- 内圈文字色 9 格（默认 + 8），每格着色字母 A，默认项加斜杠；半径 90–112。
- 外圈背景色 16 格（无 + 15），色块 16px；半径 118–140。
- 扇面按颜色 16% 淡染、悬停 34%；点击即时套用且轮盘保持展开。
- 取消独立色板浮层——颜色只经双圈设置（消除「弹出不统一」）。

## R-D5 命令映射

- 行内格式：复用 `toolbar-shared` 的 `toggleWrap` 与既有 mark/strong/em 逻辑。
- 分栏：`::: {.col-N}`；缩进：`::: {.indent-N}`（0–4，24px 一档）。
- 转换：复用 `block-convert.ts` 的块类型映射；新增「正文」「分割线」「表格」入口。
- 复制：`navigator.clipboard.writeText`，失败回退 `document.execCommand("copy")`。
- 清除格式：解包与选区相交的 `**` `*` `~~` `<u>` `` ` `` `mdb-color-*` `mdb-bg-*`，保留链接；一次 `dispatch` 单步可撤销。**只处理与选区相交的节点**，不 `parent.normalize()`（批准稿 §10 的第三个 bug）。
- 后退/前进：直接调用 CM `undo` / `redo` 命令，与快捷键共用同一历史；快照在变更**之后**提交。

## R-D6 格式刷

- 圆心点击：选区存在 → 读取行内包装存为 `{bold,italic,underline,strike,code,color,bg}`。
- 之后每次新选区自动套用（幂等），计数角标；刷完仍展开轮盘（§5.1-3）。
- `Esc` / 再点圆心退出；段落级格式不进格式刷。

## R-D7 HTML 编辑态适配

- HTML 可视化编辑态：选中元素后以**元素矩形中心**为圆心打开轮盘（无鼠标落点语义时用中心）。
- 扇区动作：转换（替换标签）/ 样式（字号/颜色/对齐/背景/边框）/ 属性（class/id）/ 删除 / 截图 / 关闭。
- 动作仍经 `applyTagReplace` / `applyStylePatch` / `applyAttrPatch` / `applyNodeRemove` 折算回 `content`，保持 E-16/E-19 的清洗链路。
- 原 `.html-edit-toolbar` 横向条删除；`e2e/html-edit-toolbar*.spec.ts` 改为断言轮盘。

## R-D8 可访问性与键位

- 数字键 1–8 按 12:00 起顺时针直接进扇区；方向键/滚轮在当前层移高亮，`Enter` 执行；`Esc` 逐层后退（筛选 → 收回扇形 → 关闭）。
- `Ctrl+F` / `⌘F`：圆心长出输入框，按关键词跨层平铺过滤，回车执行首个匹配。
- 轮盘为 `role="menu"`；扇区 `role="menuitem"`，`aria-label` 为中文名；焦点不进入轮盘（保持编辑器选区）。

## R-D9 三主题与视觉锚点

- 颜色只用 `--app-*` / `--type-*` token；扇面/描边/文字色随 light/dark/warm 变化。
- 数值（半径、角度、格宽、字号）以批准稿 §4 与 `decisions.md` 的「选区轮盘」行为准；新增单点裁决追加台账一行。
