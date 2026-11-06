# 验收锚点 — reading-surface-refine

来源：维护者 2026-11-06 的 15 项阅读/编辑界面反馈（原文见 spec issue）、layout-portal 归档规格（`openspec/specs/application-shell|navigation|reading|editing|configuration`）、当前桌面端实现观察。

## R-1 外壳与主题

顶栏职责、页签名称、胶囊活跃态、class 驱动主题、图标与全屏。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 顶栏文件名字符串数量 | 0 | 维护者反馈 #2 |
| A-1.2 | exact | 页签标题可见数量 | 每个页签 1 个 | 维护者反馈 #2 |
| A-1.3 | state-machine | 主题切换覆盖 | 1 个根 dark class + 4 类 surface token 同步 | 维护者反馈 #1 |
| A-1.4 | state-machine | 单格全屏按钮 | 单格 0 个；多格 1 个且点击后全屏 | 维护者反馈 #11 |

## R-2 阅读空间

缩略图居中、动作不重叠、HTML 占位与摘要、本机最近文件、父文件夹。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 缩略图与动作按钮重叠像素 | 0 | 维护者反馈 #3 |
| A-2.2 | exact | HTML 摘要中的 `<tag>` 数量 | 0 | 维护者反馈 #3 |
| A-2.3 | state-machine | 最近文件来源 | 启动加载 20 条，mtime 倒序 | 维护者反馈 #5 |
| A-2.4 | state-machine | 父文件夹点击 | 1 次系统文件管理器调用 | 维护者反馈 #5 |

## R-3 悬浮预览

右半区触发、离窗关闭、真实媒体。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | state-machine | 左半区触发 | 0 个预览打开 | 维护者反馈 #6 |
| A-3.2 | state-machine | 右半区触发 | 250ms 后打开并锚定该行 | 维护者反馈 #6 |
| A-3.3 | exact | 离窗关闭延时 | 180ms | 维护者反馈 #4 |
| A-3.4 | exact | 媒体元素 | 3 类 img/video/audio | 维护者反馈 #4 |

## R-4 编辑与选区

块手柄左四分之一、滑入菜单、选区胶囊。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 块手柄召唤区 | 正文左侧 25% | 维护者反馈 #8 |
| A-4.2 | exact | 滑入手柄开菜单延时 | 60ms | 维护者反馈 #15 |
| A-4.3 | state-machine | 阅读态选区 | 3 个动作胶囊 | 维护者反馈 #9 |

## R-5 设置与检索

正文无设置浮层、设置可滚动、Ctrl+P 快速打开、本机正文检索。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 正文右上角设置浮层数量 | 0 | 维护者反馈 #11 |
| A-5.2 | state-machine | 设置窗窄窗 | 0 越界，滚动可达底部 | 维护者反馈 #14 |
| A-5.3 | state-machine | Ctrl/Cmd+P | 1 个快速打开，0 原生打印 | 维护者反馈 #12 |
| A-5.4 | state-machine | 本机检索 | 1 个正文命中，2 类筛选 | 维护者反馈 #16 |
