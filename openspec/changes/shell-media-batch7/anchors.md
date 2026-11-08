# 验收锚点 — shell-media-batch7

锚点来源：本 change `design.md` D-1…D-13、`specs/*/spec.md` delta（application-shell 状态栏/G-10、navigation 图标「关闭其他」/chrome 前景色/一键自动布局、reading A-13、file-management C-6）、用户 2026-11-08 第三次走查 8 项、仓库现状代码复核（`StatusBar.tsx` 关闭定时器与 6px 死区、`FloatingPreview.tsx` `sandbox=""`+`srcDoc`、`VideoPlayer.tsx` 仅 window resize 触发重排、`PaneTreeView.tsx` 全屏按钮 accent hover）。

> 无原型 baseline（本 change 无 `baseline/*.png`）；锚点均为 `exact` 或 `state-machine`，来源为 spec / design / 一手代码观察。

## R-1 主题弹层生命周期与主题入口

指针横越间隙时面板不消失；单击图标循环切换；关闭途径完整。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | state-machine | 指针从主题按钮缓慢移动到面板项上停留 500ms 后面板仍可见 | "true" | spec 状态栏 |
| A-1.2 | state-machine | 连续单击主题图标 4 次后的主题序列 | "light → dark → warm → system" | spec 状态栏 |
| A-1.3 | exact | 主题面板的 role 属性值 | "menu" | spec 状态栏 |
| A-1.4 | exact | 宽度调整面板按 Esc 后可见面板数量 | 0 | spec 状态栏 |
| A-1.5 | state-machine | 状态栏隐藏态经底部热区唤出后，指针移入主题面板时面板仍可见 | "true" | design D-1 |

## R-2 图片右键菜单

应用自绘、渲染不等 IPC、四项、可关闭。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 菜单可见时仍在等待的 invoke 调用数（500ms 延迟桩） | 1 | design D-3 |
| A-2.2 | exact | 图片右键菜单可点击项数量 | 4 | spec 状态栏 / design D-3 |
| A-2.3 | exact | 外部点击后菜单节点数量 | 0 | design D-1 |
| A-2.4 | exact | 图片上右键时原生菜单被阻止次数 | 1 | design D-3 |

## R-3 「关闭其他」图标

单一叉、无虚线、与「关闭」不同。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 「关闭其他」图标中带 stroke-dasharray 的路径数 | 0 | spec「关闭其他」图标可辨 |
| A-3.2 | exact | 图标中的叉形笔画组数 | 1 | spec「关闭其他」图标可辨 |
| A-3.3 | state-machine | closeOthers 的 path 与 close 的 path 不同 | "true" | spec「关闭其他」图标可辨 |

## R-4 视频播放器

容器自适应、上下集、截图、旋转/缩放/亮度、顺序与音频差异。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 容器尺寸变化后视频宽高比与容器宽高比的差值上限 | 0.02 | spec C-6 |
| A-4.2 | state-machine | 上一集按钮位于播放键之前、下一集位于之后 | "true" | spec C-6 |
| A-4.3 | state-machine | 截图按钮在 DOM 中位于网页全屏按钮之前 | "true" | spec C-6 |
| A-4.4 | exact | 画面缩放上限倍数 | 4 | spec C-6 |
| A-4.5 | exact | 画面亮度上限百分比 | 150 | spec C-6 |
| A-4.6 | exact | 切换视频文件后的旋转角度 | 0 | spec C-6 |
| A-4.7 | exact | 音频文件控制条中画面类控件（旋转/缩放/亮度/截图）数量 | 0 | spec C-6 |
| A-4.8 | state-machine | 点击截图并取消另存为后新增文件数 | "0" | design D-8 |

## R-5 沉浸模式

状态栏与未钉住阅读空间隐藏；每栏独立页签条；退出恢复。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 进入沉浸后状态栏计算高度（px） | 0 | spec G-10 |
| A-5.2 | exact | 未钉住时进入沉浸后可见的阅读空间面板数量 | 0 | spec G-10 |
| A-5.3 | exact | 钉住时进入沉浸后可见的阅读空间面板数量 | 1 | spec G-10 |
| A-5.4 | exact | 两栏沉浸态下同时可见的栏头数量上限 | 1 | spec G-10 |
| A-5.5 | exact | 展开的栏头宽度与该栏宽度差值上限（px） | 2 | spec G-10 |
| A-5.6 | state-machine | 退出沉浸后状态栏恢复可见 | "true" | design D-9 |

## R-6 chrome 前景色统一

四处同色、悬停同色且更亮、AI 例外、全屏按钮不蓝。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 四类 chrome 元素静息计算色的两两差值 | 0 | spec chrome 前景色 |
| A-6.2 | state-machine | 悬停计算色亮度高于静息计算色 | "true" | spec chrome 前景色 |
| A-6.3 | state-machine | 全屏按钮悬停色等于同栏其它按钮悬停色 | "true" | spec chrome 前景色 |
| A-6.4 | state-machine | AI 图标色与其它图标静息色不同 | "true" | spec chrome 前景色 |

## R-7 阅读空间悬浮窗

图片按宽适配可滚动；HTML 本地地址直载并允许脚本；不预读二进制。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 长图渲染宽度与内容区宽度差值（px） | 0 | spec A-13 |
| A-7.2 | state-machine | 长图预览内容区 scrollHeight 大于 clientHeight | "true" | spec A-13 |
| A-7.3 | exact | HTML 预览 iframe 的 srcdoc 属性值 | "null" | spec A-13 |
| A-7.4 | state-machine | HTML 预览 iframe 的 sandbox 含 allow-scripts | "true" | spec A-13 |
| A-7.5 | exact | 打开图片悬浮预览时 open_file_direct 调用次数 | 0 | spec A-13 |

## R-8 一键自动布局

按钮紧邻主页；2 栏媒体优先；4 栏 2×2；页签不丢。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 自动布局按钮与主页按钮之间的元素数 | 0 | spec 一键自动布局 |
| A-8.2 | exact | 2 栏 [Markdown, 视频] 布局后视频栏宽度占比下限 | 60% | spec 一键自动布局 |
| A-8.3 | exact | 4 栏布局后每栏宽高与工作区一半的差值上限（px） | 2 | spec 一键自动布局 |
| A-8.4 | exact | 布局前后页签总数差 | 0 | spec 一键自动布局 |
