# 验收锚点 — ui-polish-batch6

锚点来源：本 change `design.md` D-1…D-21、`specs/*/spec.md` delta（application-shell G-3/状态栏、navigation 页签条与格头/阅读空间密度与卡片规格/悬浮预览窗/图标体系、editing E-10/E-11/颜色面板二级保持/编辑态工具条归属/撤销与重做快捷键、file-management C-6）、用户 2026-11-08 第二次走查清单（23 项）、仓库现状代码实测。

> 无原型 baseline（本 change 无 `baseline/*.png`）；锚点均为 `exact` 或 `state-machine`，来源为 spec / design / 一手观察。

## R-1 顶栏移除与沉浸图标化

窗口顶部不存在只写产品名的横条；沉浸入口只剩图标。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 窗口顶部品牌横条文本节点数量 | 0 | spec G-3 |
| A-1.2 | exact | 沉浸入口按钮内的文本节点数量 | 0 | spec G-3 |
| A-1.3 | state-machine | 沉浸入口按钮可访问名包含「沉浸阅读」 | """true""" | design D-2 |

## R-2 页签选中态与底边框

选中页签无描边、以底色与主色区分；页签容器不画底边。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 选中页签计算 outline-width | 0px | spec 页签条与格头 |
| A-2.2 | exact | 页签容器计算 border-bottom-width | 0px | spec 页签条与格头 |
| A-2.3 | state-machine | 选中页签文字色与未选中页签文字色不同 | """true""" | spec 页签条与格头 |

## R-3 页签右键菜单图标

右键菜单每个可点击项都带图标。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 右键菜单中无图标的可点击项数量 | 0 | spec 页签条与格头 |

## R-4 状态栏高度与显隐

高度紧凑；双击隐藏；指针底部悬停 0.5s 显现。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 默认字号下状态栏计算高度上限（px） | 26 | spec 状态栏 |
| A-4.2 | state-machine | 双击后状态栏不再可见 | """false""" | spec 状态栏 |
| A-4.3 | state-machine | 指针进入底部热区 500ms 内状态栏重新可见 | """true""" | spec 状态栏 |

## R-5 主题弹窗

主题按钮带下拉指示，悬停弹出四项主题面板，点击即切。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 主题面板项数 | 4 | spec 状态栏 |
| A-5.2 | state-machine | 点击「暗色」后根节点含 dark class | """true""" | spec 状态栏 |

## R-6 主页入口与宽度面板

网格概览前有主页；宽度数字可点开三档+滑块面板。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | state-machine | 状态栏主页按钮存在 | """true""" | spec 状态栏 |
| A-6.2 | exact | 宽度面板预设档数 | 3 | spec 状态栏 |
| A-6.3 | exact | 宽度面板滑块数量 | 1 | spec 状态栏 |

## R-7 阅读空间卡片底部行

图标 14px、收藏爱心、路径可交互带完整路径、整行贴底、最小高度不重叠。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 底部动作图标渲染尺寸（px） | 14 | spec 阅读空间密度与卡片规格 |
| A-7.2 | state-machine | 收藏图标为爱心（path 与 heart 一致） | """true""" | spec 阅读空间密度与卡片规格 |
| A-7.3 | state-machine | 路径按钮 title 为完整路径 | """true""" | spec 阅读空间密度与卡片规格 |
| A-7.4 | exact | 最小高度下缩略图/进度/底行两两相交对数 | 0 | spec 阅读空间密度与卡片规格 |

## R-8 悬浮预览窗宽度与唤出区

宽度=基准+一个缩略图宽；唤出区与缩略图等宽。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | state-machine | 悬浮窗宽度与基准宽的差值等于缩略图宽度 | """true""" | spec 悬浮预览窗 |
| A-8.2 | state-machine | 指针停在缩略图左侧正文区时悬浮窗不出现 | """false""" | spec 悬浮预览窗 |

## R-9 悬浮窗底部动作行

悬停底部区域浮现三按钮，尺寸与卡片一致，PDF 同样适用。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 悬浮窗初始底部动作按钮可见数量 | 0 | spec 悬浮预览窗 |
| A-9.2 | exact | 悬停底部后三按钮可见数量 | 3 | spec 悬浮预览窗 |
| A-9.3 | exact | 悬浮窗内按钮与卡片内同款按钮宽度差（px） | 0 | spec 悬浮预览窗 |

## R-10 图钉与编辑器图标

pin/pinOff 收细；编辑器同族图标两两不同。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | state-machine | pin 与 pinOff 的 path 互不相同 | """true""" | spec 图标体系 |
| A-10.2 | exact | 编辑器 10 个同族图标中重复 path 组数 | 0 | spec 图标体系 |
| A-10.3 | state-machine | pinOff 斜杠起止点不跨越整个 viewBox | """true""" | spec 图标体系 |

## R-11 大纲边框

未钉住无边框；钉住 1px。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-11.1 | exact | 未钉住时浮层 border-width | 0px | spec E-10 |
| A-11.2 | exact | 钉住时浮层 border-width | 1px | spec E-10 |

## R-12 视频倍速

六档倍速，保音调。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-12.1 | exact | 倍速菜单项数 | 6 | spec C-6 |
| A-12.2 | exact | 选择 1.5× 后 video.playbackRate | 1.5 | spec C-6 |
| A-12.3 | state-machine | 倍速切换后 preservesPitch 为真 | """true""" | spec C-6 |

## R-13 编辑态工具条归属

md 用 md-bundle 集合；html 工具条不进 md。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-13.1 | exact | md 编辑态工具条内 HTML 专属按钮数量 | 0 | spec 编辑态工具条归属 |
| A-13.2 | state-machine | md 工具条含 改写/翻译/润色 三项 | """true""" | spec 编辑态工具条归属 |

## R-14 菜单落位最短路径

浮层与触发元素最近距离 ≤8px 且不越界。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-14.1 | exact | 菜单与手柄矩形最近距离上限（px） | 8 | spec E-14 |
| A-14.2 | state-machine | 触发元素贴底时菜单完整落在视口内 | """true""" | spec E-14 |

## R-15 新增手柄滑入菜单

滑入即显示，位置跟随指针。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-15.1 | state-machine | 指针滑入新增手柄后菜单出现 | """true""" | spec E-17 |
| A-15.2 | state-machine | 两次不同指针位置下菜单左上角坐标不同 | """true""" | design D-17 |

## R-16 块菜单结构

对齐与缩进合并二级；两级菜单同宽；前两行间距收紧。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-16.1 | exact | 二级菜单项数（3 对齐 + 2 缩进） | 5 | spec E-11 |
| A-16.2 | exact | 新增手柄菜单与转换手柄菜单 offsetWidth 差（px） | 0 | spec E-11 |
| A-16.3 | state-machine | 标题行与无序列表行间距小于其它相邻行间距 | """true""" | spec E-11 |

## R-17 颜色面板二级保持

父项失焦后色板仍可见。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-17.1 | state-machine | 指针移出父项后色板仍可见 | """true""" | spec 颜色面板二级保持 |

## R-18 撤销重做双快捷键

Ctrl 与 Cmd 等价。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-18.1 | state-machine | Control+z 后内容相对前态发生变化 | """true""" | spec 撤销与重做快捷键 |
| A-18.2 | state-machine | Meta+z 后内容变化与 Control+z 相同 | """true""" | spec 撤销与重做快捷键 |

## R-19 主题按钮去三角与图标区分

主题按钮只留一个图标；亮色与暖色用线条数区分。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-19.1 | exact | 主题按钮内 svg 数量 | 1 | spec 状态栏 |
| A-19.2 | state-machine | 亮色与暖色图标 path 不同且亮色光线更多 | """true""" | spec 图标体系 |

## R-20 宽度面板改版

三斜面柱 + 下行长滑块，上限 1400，面板跟随指针。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-20.1 | exact | 宽度滑块 max | 1400 | spec 状态栏 |
| A-20.2 | state-machine | 滑块宽度大于三按钮组总宽 | """true""" | spec 状态栏 |
| A-20.3 | state-machine | 面板水平中位跟随指针且在视口内 | """true""" | spec 状态栏 |

## R-21 PDF 悬浮预览无缩放条

PDF 悬浮预览不显示 embedpdf 缩放按钮。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-21.1 | exact | PDF 悬浮预览中 zoom-toolbar 按钮数量 | 0 | spec PDF 悬浮预览隐藏缩放条 |

## R-22 卡片缩略图高度

缩略图 64×48 且不与文字重叠。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-22.1 | exact | 卡片缩略图高度（px） | 48 | spec 卡片缩略图高度 |
| A-22.2 | exact | 缩略图与标题/摘要/动作行相交对数 | 0 | spec 卡片缩略图高度 |

## R-23 大纲按钮距右缘三分之二

按钮右侧留白 ≈ 容器宽度的 2/3。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-23.1 | exact | 按钮右侧留白与容器宽度 2/3 的差值上限（px） | 4 | spec E-10 |
