# 验收锚点 — workspace-ux-batch4

锚点来源：本 change `design.md` D1–D11、`specs/application-shell/spec.md` G-8–G-12、`specs/reading/spec.md` A-15–A-17、用户反馈文字与 `~/Desktop/截图1/2/3.png`、仓库现状代码实测。

## R-1 分栏布局与页签拖拽正确性

分隔线独立、右键分栏搬文件、跨格拖拽不复制、关闭后仍可操作。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 拖动一条分隔线后，未被拖动分支的 ratio 变化 | 0 | design D1/D2 |
| A-1.2 | exact | 跨格拖拽一个页签后 leaf 数量变化 | 0 | spec G-12 |
| A-1.3 | exact | 右键「向右分栏」后原格中该文件页签数 | 0 | spec G-12 |
| A-1.4 | exact | 右键「向右分栏」后新格中该文件页签数 | 1 | spec G-12 |
| A-1.5 | state-machine | 拖拽中按 Escape 后页签顺序 | """unchanged""" | spec G-8 |
| A-1.6 | exact | 关闭一个页签后剩余分隔线可拖拽判定 | 1 | spec G-12 |

## R-2 页签视觉与沉浸收纳

未选中透明无胶囊、悬停出胶囊、页签条透明、沉浸高度 0、悬浮条回显。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 未选中且未悬停页签的胶囊圆角类数量 | 0 | spec G-9 |
| A-2.2 | exact | 悬停后未选中页签的背景色 | """var(--app-sunken)""" | spec G-9 |
| A-2.3 | exact | 沉浸态顶栏计算高度 | """0px""" | spec G-10 |
| A-2.4 | state-machine | 顶部热区停留 400ms 后悬浮页签条可见 | """true""" | spec G-10 |
| A-2.5 | exact | 页签条容器背景 alpha 通道 | 0 | spec G-9 |

## R-3 阅读表面宽度

悬浮态可拖宽、宽度持久化、行宽滑块 480–2400、正文变量同步。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 阅读空间悬浮态拖拽手柄数量 | 1 | spec A-15 |
| A-3.2 | exact | 行宽滑块 min 属性 | 480 | spec A-16 |
| A-3.3 | exact | 行宽滑块 max 属性 | 2400 | spec A-16 |
| A-3.4 | exact | 滑块设 1400 后正文 `--type-measure` | """1400px""" | spec A-16 |

## R-4 卡片与悬浮窗

PDF 卡片无工具条、非 PDF 三个动作、悬浮窗拖动跨 iframe 跟手。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | PDF 网格卡片 hover 后工具条按钮数 | 0 | spec G-11 |
| A-4.2 | exact | Markdown 网格卡片 hover 后工具条按钮数 | 3 | spec G-11 |
| A-4.3 | state-machine | 拖动悬浮窗标题栏经过 iframe 后窗口位置 | """changed""" | design D3 |
| A-4.4 | exact | 悬浮窗拖动期间预览坐标更新次数下限 | 1 | design D3 |

## R-5 HTML 打开性能

预览态编辑器不解析、切源码再同步、加载骨架、首屏时间上限。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 预览态隐藏编辑器 doc 长度 | 0 | spec A-17 |
| A-5.2 | state-machine | 切到源码后编辑器内容与读盘内容比对 | """equal""" | spec A-17 |
| A-5.3 | exact | iframe 加载中骨架节点数 | 1 | spec A-17 |
| A-5.4 | exact | 50KB HTML 打开到正文可见耗时上限（毫秒） | 1500 | spec A-17 |
