# 验收锚点 — ui-polish-batch9

锚点来源：本 change `design.md` D-1…D-9、`specs/*/spec.md` delta、用户 2026-11-09 第五次走查 7 项、仓库现状代码复核与真机截图（`StatusBar.tsx` / `PaneTreeView.tsx` / `OutlineMenu.tsx` / `FloatingPreview.tsx` / `App.tsx` / `VideoPlayer.tsx` / `fold.ts` / `block-handle.ts` / `icons.ts`）。

> 无原型 baseline（本批为既有界面精度修订）；锚点均为 `exact` 或 `state-machine`，来源为 spec / design / 用户裁决 / 一手代码观察。

## R-1 页面宽度三挡块 hover 虚线

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 未悬停时三根刻度柱的计算 `border-style` | "dashed" | design D-1 |
| A-1.2 | exact | 未悬停时三根刻度柱的 `border-color` alpha 通道 | 0 | design D-1 |
| A-1.3 | state-machine | 悬停单柱后该柱 `border-color` alpha > 0 且另外两柱 = 0 | "true" | design D-1 |
| A-1.4 | exact | 刻度柱 hover 边框宽度（px） | 1 | design D-1 |

## R-2 栏目右上角图标整区显隐

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 指针不在操作区时 `.pane-actions` 的计算 `opacity` | 0 | design D-2 |
| A-2.2 | exact | 指针滑入操作区后 `.pane-actions` 的计算 `opacity` | 1 | design D-2 |
| A-2.3 | state-machine | 打开更多菜单后 `.pane-actions` 的计算 `opacity` 仍为 1 | "true" | design D-2 |
| A-2.4 | exact | 操作区内按钮数量（模式/全屏/更多/关闭，单栏无关闭时 3） | "≥3" | design D-2 |

## R-3 大纲按钮右缘对齐

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 大纲按钮右缘与栏目「更多操作」按钮右缘的差值（px） | "≤1" | design D-3 |
| A-3.2 | exact | `.biaoyue-outline` 的 `right` 计算值（px） | 4 | design D-3 |
| A-3.3 | exact | 未钉住时按钮计算 `border-width` | 0 | design D-3 |

## R-4 悬浮窗钉住后多实例

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 钉住 A、打开并钉住 B 后 `floating-preview` 节点数 | 2 | design D-4 |
| A-4.2 | state-machine | 两个窗口的 `data-preview-path` 互不相同且各自保留 | "true" | design D-4 |
| A-4.3 | exact | 关闭其中一个后剩余窗口数 | 1 | design D-4 |
| A-4.4 | state-machine | 取消其中一个钉住后其余窗口保持 `data-pinned="true"` | "true" | design D-4 |
| A-4.5 | exact | 未钉住时连续悬停两行后悬浮窗数量 | 1 | design D-4 |

## R-5 状态栏 peek 悬浮化

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | peek 状态栏的计算 `position` | "fixed" | design D-5 |
| A-5.2 | exact | 浮现前后 `workspace-body` 高度差（px） | 0 | design D-5 |
| A-5.3 | exact | 浮现状态栏的 `bottom`（px） | 0 | design D-5 |

## R-6 视频二级菜单交互

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | state-machine | 网页全屏态指针移入倍速控件后 `.rate-menu` 节点数 | 1 | design D-6 |
| A-6.2 | state-machine | hover 画面控件出现菜单，移出 180ms 后节点数 | 0 | design D-6 |
| A-6.3 | exact | 菜单水平中心与鼠标 x 的差值（px，未触边界） | "≤2" | design D-6 |
| A-6.4 | exact | 快捷键浮层宽度（px） | 168 | design D-6 |
| A-6.5 | exact | 截图提示底边到截图按钮顶边的距离（px） | "≥4" | design D-6 |
| A-6.6 | exact | playlist / subtitle / note / hints 控件的 `data-name` 数量 | 4 | design D-6 |

## R-7 视频右侧按钮与图标

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 右侧每个 `.art-control` 的命中盒宽高（px） | 38 | design D-7 |
| A-7.2 | exact | 右侧每个 `.art-icon` 盒子宽高（px） | 24 | design D-7 |
| A-7.3 | exact | 右侧自绘 svg 的渲染宽高（px） | 22 | design D-7 |
| A-7.4 | exact | `keyboardHints` 图标的外框矩形段数 | "≥1" | design D-7 |
| A-7.5 | exact | `visual` 图标不再包含滑杆端点圆的数量 | 0 | design D-7 |

## R-8 倍速菜单指针表盘

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 倍速菜单每行 `data-rate-dial` 数量 | 1 | design D-8 |
| A-8.2 | exact | 1.0× 档的 `data-angle`（度） | 0 | design D-8 |
| A-8.3 | state-machine | 0.5× 的 `data-angle` < 0、2.0× 的 > 0 | "true" | design D-8 |
| A-8.4 | exact | 主倍速控件仍为 `svg[data-icon='speed']` 数量 | 1 | design D-8 |

## R-9 MD 折叠三角与合行修复

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 折叠三角 svg 渲染宽高（px） | 20 | design D-9 |
| A-9.2 | exact | 指针在正文右侧 75% 区域时三角计算 `opacity` | 0 | design D-9 |
| A-9.3 | state-machine | 指针进入 `.cm-content` 左缘 25% 后三角 `opacity` | 1 | design D-9 |
| A-9.4 | exact | 四个相邻标题全部折叠后包含标题文本的 `.cm-line` 数量 | 4 | design D-9 |
| A-9.5 | exact | 折叠后单行文本出现 `# A# B` 的次数 | 0 | design D-9 |
| A-9.6 | exact | 折叠 replace 装饰起点相对标题行末的偏移（字符） | 1 | design D-9 |
