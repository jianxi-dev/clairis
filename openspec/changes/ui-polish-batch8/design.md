# Design: 界面精度与交互一致性修复（第八批）

> 输入：用户 2026-11-09 第四次走查 17 项；仓库现状代码复核（`TabBar.tsx` 指针捕获但未禁选、`PaneTreeView.tsx` 聚焦内描边、`OutlineMenu.tsx` `right: calc(100% / 3)`、`tokens.css` 主题变量、`PdfViewer.tsx` shadow DOM 注入、`HtmlVisualEditor.tsx` 双击链路、`stores/index.ts` `openFile` 宿主栏选择、`VideoPlayer.tsx` 控制条与截图）。
> 无视觉原型 baseline；本批是既有界面的精度修订，锚点来源为用户裁决 + 现行 spec + 一手代码观察。

## D-1 页签拖拽期间的全局禁选

**现状**：拖动页签跨栏时，指针扫过的正文文字被浏览器选中。页签条自身 `select-none` 不够——拖拽命中区会经过其它栏的正文。

**决策**：拖拽激活（超过 4px 阈值）时给 `document.documentElement` 写 `data-tab-drag="true"`，结束/取消时移除；CSS 在 `html[data-tab-drag]` 下对 `body *` 应用 `user-select: none`（含 `-webkit-user-select`）。不改正文的既有选择能力，也不清空用户已有的选区——只在拖拽会话内禁止新的选择。

**为什么不 `preventDefault` mousedown**：页签已经用指针捕获驱动拖拽；`preventDefault` 会连点击切签与双击重命名一起破坏。

## D-2 页签选中态与图标分级

**现状**：选中页签用 accent 前景 + accent-soft 底；所有页签图标都带类型色；栏目聚焦用 `inset 0 0 0 1.5px var(--app-accent)` 蓝框。

**决策**：

- 选中页签标题色用 `--app-text-strong`（亮色近黑、暗色近白），不再用 accent —— 用户要求「白色或黑色」。
- 未选中页签图标：`--app-chrome-rest`（灰），不带类型色。
- 仅「聚焦栏目的活动页签」图标保留类型色；其他栏目的活动页签标题用选中色、图标保持灰。
- 删除 `.pane-leaf[data-focused="true"]` 的 accent 内描边；聚焦语义改由页签/内容本身表达（拖拽落区环 `data-tab-drop` 保留）。

**取舍**：类型色仍是文件身份的一部分，但降级为「当前正在看的文件」的奖励色；这比处处彩色更能一眼指出焦点。

## D-3 页签右键菜单「悬浮小窗」

**决策**：菜单增一项「悬浮小窗」（图标 `pip`），点击以被右击页签的矩形为锚调用 `openPreview`，行为与文件卡片一致（同一 `FloatingPreview`、同一打开/分栏动作）。菜单项顺序：悬浮小窗 / 向右分栏 / 向下分栏 / 关闭 / 关闭其他；分隔线保留。

## D-4 PDF 顶栏与外围底色

**现状**：`pdf-page-nav` 组件自带边框，是全站唯一带外框的顶栏控件；PDF 外围由组件默认白/灰填充，不跟主题。

**决策**：

- 向 PDF shadow root 追加一条 CSS，命中 `[data-epdf-i="pdf-page-nav"]` 内部容器，`border: 0`（不隐藏组件本身）。
- shadow root 注入 `:host { background: var(--app-bg) }`，并给外层容器显式 `background: var(--app-bg)`；PDF 页面纸面保持白/纸色（文档本体不该被主题染色），只染外围。
- 变量走 `var(--app-bg)`，随 light/dark/warm 切换自动生效，不新增主题分支。

## D-5 主题图标等距与去三角

- `sunBright` 重绘为**6 条等角光线（60° 间隔）+ 中心圆**：光线起止半径 6.5→9.5（24 网格），圆心 (12,12)。暖色 `sunWarm` 仍用 4 条，保持「亮色比暖色多光线」的可辨差异。
- 主题入口仍是单个图标按钮（点击循环 + 悬停弹面板），**不渲染任何 chevron/三角**。这是已裁决条款（decisions「状态栏主题按钮」），本次按实现回归处理。
- 自动布局图标 `layoutAuto` 改为**魔法棒**：斜向棒身 + 3 个星芒，去掉四宫格路径；`aria-label`/`title` 仍为「自动布局」。

## D-6 栏目全屏按钮与尺寸下限

- 全屏按钮加 `pane-fullscreen-button` 类：默认 `opacity: 0; pointer-events: none`；`.pane-leaf:hover` 或 `:focus-within` 时 `opacity: 1; pointer-events: auto`；`data-fullscreen="true"` 的栏目恒显示（退出入口不能藏）。
- 取消 `MIN_PANE_PX = 240` 的双重兜底：`clampRatio` 下限改 0（只保留 [0,1] 数值钳制与 `containerPx<=0` 兜底），`PaneNode` 内联与 CSS 的 `min-width/min-height` 改 0。允许拖到 0 后，现有空栏回收（`pruneEmpty`）在比例归零时由分隔条双击复位兜底，不新增自动删除逻辑。

## D-7 悬浮预览动作行

- 动作行显示条件从「指针位于底部 ACTION_BAND_H」改为「指针位于动作行自身」：进入显示，离开立即隐藏（钉住态仍显示）。
- 按钮样式对齐阅读空间卡片：`text-[var(--app-chrome-rest)] hover:text-[var(--app-chrome-hover)]`，无悬停底色，14px 图标。
- 新增路径按钮（`folder` 图标 + 父目录名，`title` 为完整路径，点击 reveal），与卡片同款。
- 动作行 `padding-left` 增加一个按钮位（24px），使第一个按钮起点后移。

## D-8 AI 停靠态打开文件

**根因（代码复核）**：`openFile` 把新页签塞进 `findLeaf(paneRoot, focusedPaneId)`。AI 停靠后聚焦栏是 `kind: "ai"` 的 leaf，它不渲染页签内容 → 文件「打开了但看不见」。AI 小窗形态没有 AI leaf，所以正常；`Ctrl+O` 与卡片打开同走 `openFile`，因此一起失效。

**决策**：新增宿主栏选择规则——优先「聚焦且 `kind !== 'ai'`」的 leaf；否则取最近聚焦过的普通 leaf（`lastTabsPaneId`，随 `focusPane` 更新且跳过 AI 栏）；否则列表首个普通 leaf。AI 栏永不接收文件页签。`dropFileOnPane` 若目标是 AI 栏则同样改投普通栏。

## D-9 HTML 工具条归属与双击/缩放

- 归属：`html-edit-toolbar` 只允许由 `HtmlVisualEditor` 渲染（HTML 编辑态）。md 编辑态只允许 `cm-floating-toolbar` / `cm-block-toolbar`。新增 e2e 双断言（两种编辑态各查另一族选择器数量为 0）。
- 双击：`runtime.ts` 的 dblclick 进入文本编辑后，用 `document.caretRangeFromPoint(x,y)` 把选区折叠到点击点，并 `selection.removeAllRanges()` 清掉浏览器默认的「选词」。双击的语义 = 定位光标 + 进入该块编辑，不再选中 2 个字。
- 缩放：选中块后 `HtmlVisualEditor` 叠加 4 个手柄（右/下/右下/左）；拖动写 `style.width` / `style.height`（字母为 px，最小 24px），经 `applyStylePatch` 回写 content。手柄只在 `selected` 且非文本编辑态出现，避免与双击定位冲突。

## D-10 大纲按钮几何

- `right`：`calc(100% - <一个按钮宽>)` 的等价表达——从内容区右缘向左偏移一个按钮宽（含按钮 28px，不含外边框），即 `right: 28px`；浮层仍 `right: 0` 相对按钮包裹层对齐。
- 未钉住：按钮 `border-color: transparent`（无边框）；钉住：1px 细边框（`--app-border`），继续用 accent-soft 底 + accent 前景。当前按钮默认有 1px border，属实现回归。
- 浮层未钉住无边框、钉住 1px 的既有条款保持不变。

## D-11 页面宽度面板

- 档位：紧凑 720 / 标准 960 / 宽松 1200；滑块 `max=1400`（用户可拖到 1400）。
- 三柱：居中、`gap: 0`、并排相接（各自保留 1px 分隔），单柱宽 22px（原 flex 铺满 62%），高度 14 / 18 / 22（原 16/24/32）。
- 滑块宽度：面板内边距后的 78%（原 100%），感官上长于三柱总宽（3×22=66px）。
- 面板宽度收到 200px（原 236）。

## D-12 视频播放器

- 控制条尺寸：恢复上一版 `--art-control-height: 38px`、`--art-control-icon-size: 24px`、`--art-padding: 12px`；进度条高度不单独调。
- 进度条缩略图：`art.on("mousemove")` 取归一化 x → `video.duration * x`，用一个隐藏 `<video>` + canvas 抽帧（节流 120ms，缓存最近 20 个时间点）；失败时只显示时间，不阻塞。
- 图标：倍速用 `speed`（240° 速度表），画面用 `tune`，二级菜单每项前置图标（`rotate` / `zoomIn` / `zoomOut` / `eye` / `subtitle` / `playlist` / `loop*` / `keyboardHints`）。放大/缩小为独立按钮；旋转按钮移到「字幕」按钮之前的控制条位置。
- 截图：不再 `save_binary_as_file`；`canvas.toBlob` → `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])` → `art.notice.show = "截图已复制到剪贴板"`（胶囊提示）。失败回退为下载 dataURL，并提示失败原因。
- 全屏：`fullscreenWeb` 为真时，点击任何带二级菜单的控件不展开（直接 `return`），并提示「全屏下不可用」。
- 快捷键：视频快捷键行并入 `lib/shortcuts.ts` 的「媒体」家族；快捷键总览显示它们，不再只藏在视频提示浮层。
- 图标尺寸：所有自绘控件统一 `PLAYER_ICON_SIZE = 22`；快捷键图标改为无外框键位形（去掉外框矩形，保留键帽点阵）。

## 集成 checkpoint

本 change 共 11 票。每完成 ≤4 票：合并到集成分支 → `npx tsc --noEmit` + `npm test` → Playwright 打开一次 → 记录「用户现在能看到什么」。
