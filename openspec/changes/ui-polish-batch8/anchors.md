# 验收锚点 — ui-polish-batch8

锚点来源：本 change `design.md` D-1…D-12、`specs/*/spec.md` delta、用户 2026-11-09 第四次走查 17 项、仓库现状代码复核（`TabBar.tsx` / `PaneTreeView.tsx` / `OutlineMenu.tsx` / `PdfViewer.tsx` / `HtmlVisualEditor.tsx` / `stores/index.ts` / `VideoPlayer.tsx`）。

> 无原型 baseline（本批为既有界面精度修订）；锚点均为 `exact` 或 `state-machine`，来源为 spec / design / 用户裁决 / 一手代码观察。

## R-1 页签拖拽禁选与选中态分级

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 拖拽页签经过正文后 `window.getSelection().toString()` 的长度 | 0 | design D-1 |
| A-1.2 | exact | 聚焦栏活动页签标题颜色与未选中页签标题颜色的关系 | "不同（选中为 --app-text-strong）" | spec navigation 页签条 |
| A-1.3 | exact | 非聚焦栏活动页签图标的计算颜色 | "等于 --app-chrome-rest" | design D-2 |
| A-1.4 | exact | 聚焦栏活动页签图标计算颜色的类型色通道 | "#6366f1" | spec navigation 图标体系 |
| A-1.5 | exact | 聚焦栏目 `box-shadow` 中 accent 内描边的宽度 | 0 | design D-2 |

## R-2 PDF 顶栏与外围底色

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 页码区容器的计算 `border-width` | 0 | design D-4 |
| A-2.2 | state-machine | 切换 light 与 dark 主题后 PDF 外围背景的计算值与 `--app-bg` 相等 | "true" | design D-4 |
| A-2.3 | exact | PDF 页码 / 翻页控件数量 | 1 | spec reading PDF 页码工具条位置 |

## R-3 主题图标 / 自动布局图标 / 去三角

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | `sunBright` 图标中从圆心向外的光线段数 | 6 | design D-5 |
| A-3.2 | exact | `sunBright` 相邻光线的夹角（度） | 60 | design D-5 |
| A-3.3 | exact | 主题入口按钮内的 svg 节点数 | 1 | decisions 状态栏主题按钮 |
| A-3.4 | exact | `layoutAuto` 图标 path 中四宫格矩形段数 | 0 | design D-5 |
| A-3.5 | exact | `layoutAuto` 图标中星芒段数 | 3 | design D-5 |

## R-4 栏目全屏按钮与尺寸下限

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 栏目未悬停时全屏按钮的计算 `opacity` | 0 | design D-6 |
| A-4.2 | exact | 指针滑入栏目头后全屏按钮的计算 `opacity` | 1 | design D-6 |
| A-4.3 | exact | 全屏态全屏按钮的计算 `opacity` | 1 | design D-6 |
| A-4.4 | exact | 栏目最小宽度常量（px） | 0 | design D-6 |

## R-5 悬浮预览动作行与阅读空间路径

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 指针移出动作行 150ms 后动作行节点数 | 0 | design D-7 |
| A-5.2 | exact | 动作行按钮悬停时计算 `background-color` 的 alpha 通道 | 0 | design D-7 |
| A-5.3 | exact | 动作行中路径按钮数量 | 1 | design D-7 |
| A-5.4 | exact | 动作行左内距（px） | 24 | design D-7 |
| A-5.5 | exact | 阅读空间路径按钮悬停时计算 `background-color` 的 alpha 通道 | 0 | design D-7 |

## R-6 页签右键菜单「悬浮小窗」

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 页签右键菜单项数量 | 5 | design D-3 |
| A-6.2 | exact | 菜单首项文案 | "悬浮小窗" | design D-3 |
| A-6.3 | state-machine | 点击悬浮小窗后 `floating-preview` 的 `data-preview-path` 等于页签路径 | "true" | design D-3 |

## R-7 AI 停靠态打开文件

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | state-machine | AI 停靠且 AI 栏聚焦时，卡片双击打开后工作区新增页签内容可见 | "true" | design D-8 |
| A-7.2 | state-machine | AI 停靠且 AI 栏聚焦时，Ctrl+O 打开文件后页签落在非 AI 栏 | "true" | design D-8 |
| A-7.3 | exact | 停靠 AI 栏在打开文件前后的页签数变化 | 0 | design D-8 |

## R-8 HTML 工具条归属、双击定位与块缩放

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | HTML 编辑态 `cm-floating-toolbar` 节点数 | 0 | design D-9 |
| A-8.2 | exact | md 编辑态 `html-edit-toolbar` 节点数 | 0 | design D-9 |
| A-8.3 | exact | HTML 可视化编辑双击后 `selection.toString()` 的长度 | 0 | design D-9 |
| A-8.4 | state-machine | 拖动右下缩放手柄后 content 含 `width:` 与 `height:` | "true" | design D-9 |

## R-9 大纲按钮几何

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 大纲按钮右缘到内容区右缘距离（px） | 28 | design D-10 |
| A-9.2 | exact | 未钉住时按钮计算 `border-width` | 0 | design D-10 |
| A-9.3 | exact | 钉住时按钮计算 `border-width` | 1 | design D-10 |

## R-10 页面宽度面板

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | exact | 宽度滑块 `max` 属性 | 1400 | design D-11 |
| A-10.2 | exact | 点击宽松档后 `--type-measure` 的值 | "1200px" | design D-11 |
| A-10.3 | exact | 三根刻度柱之间的 `gap`（px） | 0 | design D-11 |
| A-10.4 | exact | 滑块宽度与三柱总宽的差（px）大于 | 0 | design D-11 |

## R-11 视频播放器控制条与截图

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-11.1 | exact | 控制条高度（px） | 38 | design D-12 |
| A-11.2 | exact | 自绘控件图标渲染尺寸（px） | 22 | spec navigation 图标体系 |
| A-11.3 | exact | 进度条悬停后缩略图节点数 | 1 | design D-12 |
| A-11.4 | exact | 截图后剪贴板写入次数 | 1 | design D-12 |
| A-11.5 | exact | 截图后调用系统另存为的次数 | 0 | design D-12 |
| A-11.6 | exact | 全屏态点击倍速后展开的二级菜单数 | 0 | design D-12 |
| A-11.7 | exact | 快捷键总览中视频家族条目数下限 | 10 | design D-12 |
| A-11.8 | exact | 快捷键说明图标的外框矩形段数 | 0 | design D-12 |
