# Design: 界面精度与交互一致性修复（第九批）

> 输入：用户 2026-11-09 第五次走查 7 项；仓库现状代码复核与真机取证（`StatusBar.tsx`、`PaneTreeView.tsx`、`OutlineMenu.tsx`、`FloatingPreview.tsx`、`App.tsx`、`VideoPlayer.tsx`、`fold.ts`、`block-handle.ts`、`icons.ts`）。
> 无视觉原型 baseline；本批是既有界面的精度修订，锚点来源为用户裁决 + 现行 spec + 一手代码观察。

## D-1 页面宽度三挡块 hover 虚线

**现状**：三柱用 `clip-path` 切出斜面，未选中底色 `--app-sunken` 与面板底几乎同色，实测截图上几乎不可见；`clip-path` 会裁掉 `border`/`outline`。

**决策**：每柱改为「按钮外框 + 内层斜面填充」两层——外层按钮保留命中与虚线边框，内层 `span.width-bar-fill` 承担 `clip-path` 与底色。默认 `border: 1px dashed transparent`；`button:hover` 与 `:focus-visible` 时 `border-color: var(--app-border-strong)`。选中态仍以填充色 `--app-accent` 区分。这样虚线不被裁剪，且只在指针进入单柱时出现。

## D-2 栏目右上角图标整区显隐

**现状**：mode / 更多 / 关闭常显；全屏单独用 `.pane-fullscreen-button` 做栏目 hover 显隐。

**决策**：四个按钮收进 `.pane-actions` 容器，容器默认 `opacity: 0`；`.pane-leaf:hover .pane-actions`、`.pane-leaf:focus-within .pane-actions`、`.pane-actions:hover`、`.pane-actions[data-open="true"]` 时 `opacity: 1`。容器保持 `pointer-events: auto`（否则隐身区无法被指针命中），按钮本身仍可点击。菜单打开或子菜单展开时写 `data-open="true"`，避免指针移到菜单上时整组消失。全屏按钮原有的独立 hover 规则删除，避免两套门控叠加。

## D-3 大纲按钮右缘对齐

**现状**：`.biaoyue-outline { right: 28px }`；实测大纲按钮右缘 1172，栏目右侧图标区右缘 1196（容器 `px-1` = 4px）。

**决策**：`.biaoyue-outline` 的 `right` 改为 `4px`，使大纲按钮右缘与栏目右侧图标区（含关闭按钮）右缘同线；`top: 10px` 不变。浮层仍相对按钮包裹层 `right: 0`，不受影响。

## D-4 悬浮窗钉住后多实例

**现状**：store 只有 `preview: PreviewState | null`，`openPreview` 整体替换；`App` 只渲染一个 `FloatingPreview`。

**决策**：

- `PreviewState` 增加 `id: string`；`openPreview` 在入口生成 id（同一次调用保持稳定，重试幂等）。
- 新增 `pinnedPreviews: PreviewState[]`。`togglePreviewPin` 把当前窗写入数组并保留 `preview` 引用（兼容既有单窗读法）；再次取消钉住按 id 从数组移除。
- 打开新预览时只替换 `preview`，不动 `pinnedPreviews`；因此钉住的窗口被“封存”，新窗不断累积。
- 渲染层把 `pinnedPreviews` 与 `preview` 按 id 去重后逐个渲染；移动/缩放/关闭/钉住全部按 id 定位，两个集合同步更新。
- 关闭当前窗时若同 id 在 `pinnedPreviews` 中也移除，避免「关不掉」。
- 既有 `closePreview()`（无参）仍关闭当前窗，供阅读空间悬停离窗复用。

## D-5 状态栏 peek 悬浮化

**现状**：`App` 在隐藏/沉浸态且 `statusBarPeek` 时把 `<StatusBar>` 放回根 flex 列，状态栏 23px 参与布局，正文高度变化。

**决策**：`StatusBar` 增加 `floating` 属性；为真时根节点加 `app-status-bar--floating`，CSS 置 `position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; box-shadow: 0 -8px 24px rgb(0 0 0 / .12)`。正文容器高度不再变化；热区与 500ms 计时逻辑不变。离开时移除 `floating` 并隐藏。

## D-6 视频二级菜单交互

**现状**：`openPopover` 在 `fullscreenWeb` 为真时直接返回并提示「全屏下不可用」；菜单只支持点击；锚点取按钮左缘；快捷键浮层宽 250；截图提示走 `art.notice`（顶部居中）。

**决策**：

- 删除全屏拦截：全屏态与普通态同一套 `openPopover`。
- 控件 `mouseenter` 打开、`mouseleave` 延迟 180ms 关闭；浮层自身 `mouseenter` 取消关闭、`mouseleave` 关闭。点击仍可切换，兼顾键盘/触屏。
- 锚点改为「鼠标水平中心」：控件事件记录 `clientX`，`left = cursorX - containerLeft - width/2`，再钳制到 `[8, containerWidth - width - 8]`；被边界钳制即用户所说的「受窗口界限限制」。
- 快捷键浮层宽度 `250 → 168`（缩 1/3），网格列间距同步收紧。
- 截图提示改为 React 浮层：读取截图控件矩形，渲染在控件上方 8px 居中；2 秒后自动消失。`art.notice` 不再承担截图提示。
- 给 playlist / subtitle / note / hints 控件补 `data-name`，消除不可定位的控件。

## D-7 视频右侧按钮与图标

**现状**：11 个控件盒子均为 38×38，但图标笔画外接框差异大：速度表约 11px 宽、键盘约 16×8、tune 为滑杆；原生全屏图标 19.8px，自绘 24.2px。

**决策**：

- `player.css` 统一右侧一行：`.art-controls-right` 垂直居中，`.art-control` 固定 38×38；自绘 `.art-icon` 24×24、内部 svg 22×22 且 `display: block`，原生图标同规格。
- 图标几何按 `design-system:§2.1` 24 网格统一视觉外接框：
  - `keyboardHints` 重绘为圆角键盘外框（x3–21, y6–18）+ 两排键帽 + 空格键，可一眼识别为键盘。
  - `visual`（画面）改用 `image` 图片框图标（山与太阳），不再用无法表意的滑杆。
  - `speed` 弧加宽到 16px、`loop*` 弧加宽到 15px、`rotate` 弧加宽到 16px，缩小与相机/字幕等矩形图标的视觉差。
- 视觉复核用 `cw-vision.sh describe/analyze` 与截图并排；不以「盒子相等」代替「看起来相等」。

## D-8 倍速菜单指针表盘

**现状**：六档每行都渲染同一个 `speed` 图标，档位只靠文字与勾选区分。

**决策**：新增 `RateDial`（16×16，`data-rate-dial`、`data-angle`）：圆环 + 12 点位刻度，指针角 `clamp(log2(rate / 1.0) * 60, -60, 60)` 度；1.0× 指针指 12 点，0.5× / 0.75× 偏左，1.25× / 1.5× / 2.0× 偏右。主控件仍用 `speed` 速度表，不改既有断言。

## D-9 MD 折叠三角与合行修复

**现状**：`createFoldDecorations` 用 `headingLine.to` 作为替换起点，把标题行尾换行符一起替换；四个相邻章节折叠后 `.cm-line` 变成 `# A# B# C# D`。三角 10px、`opacity: 0.55` 常显。

**决策**：

- 替换起点改为 `headingLine.to + 1`（保留换行符）；若 `from >= to` 不生成 replace。单测断言 `replace.from` 相应加 1。
- 三角 SVG 由 10×10 改为 20×20，路径按 20 网格重绘（`M6 4 L15 10 L6 16 Z` 量级）。
- `.cm-fold-toggle` 默认 `opacity: 0`；`.cm-fold-toggle-folded`、`:hover`、`:focus-visible` 时 `opacity: 1`。召唤区复用块手柄的几何：`block-handle` 在指针进入 `.cm-content` 左缘 25% 时给 contentDOM 加 `cm-summon-zone` 类，离开移除；CSS `.cm-summon-zone .cm-fold-toggle { opacity: 1 }`。键盘操作时 `:focus-visible` 保底。

## 集成 checkpoint

本 change 共 9 票。每完成 ≤4 票：合并到集成分支 → `npx tsc --noEmit` + `npm test` → Playwright 打开一次 → 记录「用户现在能看到什么」。
