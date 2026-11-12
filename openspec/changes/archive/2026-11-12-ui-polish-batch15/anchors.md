# 验收锚点 — ui-polish-batch15

锚点来源：用户 2026-11-11 第二批口述 10 项（#660）；design.md D1–D13。

## R-1 视频连播与旋转

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | state-machine | 第一个视频播完后当前播放项索引 | 2 | #660 第 1 项 / design D1 |
| A-1.2 | exact | 竖拍视频容器计算 transform 含 rotate | "true" | #660 第 1 项 / design D1 |
| A-1.3 | exact | 视频可见宽度不超过容器宽度 | "true" | #660 第 1 项 / design D1 |

## R-2 轮盘召唤与形态

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 选中文字后轮盘节点数 | 0 | #660 第 2 项 / design D2 |
| A-2.2 | exact | 按开关快捷键后轮盘节点数 | 1 | #660 第 2 项 / design D2 |
| A-2.3 | exact | 默认形态为圆心时可见扇区数 | 0 | #660 第 2 项 / design D3 |
| A-2.4 | state-machine | 双击圆心后形态切换为整盘 | "true" | #660 第 2 项 / design D3 |
| A-2.5 | exact | 中键拖动后轮盘中心坐标变化 | "true" | #660 第 2 项 / design D4 |

## R-3 轮盘搜索

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 搜索结果行数上限 | 9 | #660 第 2 项 / design D5 |
| A-3.2 | exact | 搜索结果首行默认选中 | "true" | #660 第 2 项 / design D5 |
| A-3.3 | exact | 搜索结果不含层级名称行 | "true" | #660 第 2 项 / design D5 |
| A-3.4 | exact | 滚动后快捷键列横向坐标不变 | "true" | #660 第 2 项 / design D5 |
| A-3.5 | exact | 第二行显示的快捷键序号 | 2 | #660 第 2 项 / design D5 |

## R-4 提示时长

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 设置 1.5 秒后配置持久值 | 1.5 | #660 第 3 项 / design D6 |
| A-4.2 | exact | 提示消失耗时下限（ms） | 1400 | #660 第 3 项 / design D6 |

## R-5 块对齐标记隐藏

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 编辑态可见文本包含 `:::` | "false" | #660 第 4 项 / design D7 |
| A-5.2 | exact | 源码态可见文本包含 `:::` | "true" | #660 第 4 项 / design D7 |

## R-6 独立静音

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 静音第一个媒体后第二个媒体 muted | "false" | #660 第 5 项 / design D8 |

## R-7 音频淡出与同目录列表

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 静音后 100ms 仍处于播放态 | "false" | #660 第 6 项（用户 2026-11-11 更正：立即停止）/ design D9 |
| A-7.2 | exact | 同目录 3 个音频时列表项数 | 3 | #660 第 6 项 / design D9 |

## R-8 PDF 按钮栏

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 固定隐藏后按钮栏计算 display | "none" | #660 第 7 项 / design D10 |
| A-8.2 | exact | 快捷键切换后按钮栏可见 | "true" | #660 第 7 项 / design D10 |

## R-9 顶栏

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 顶栏产品名文本长度 | 0 | #660 第 8 项 / design D11 |
| A-9.2 | exact | 未钉住时窗口按钮落在栏目页签栏区域 | "true" | #660 第 8 项 / design D11 |
| A-9.3 | exact | 钉住时窗口按钮落在左栏区域 | "true" | #660 第 8 项 / design D11 |
| A-9.4 | exact | 第一个页签左缘与目标位置偏差（px） | 2 | #660 第 8 项 / design D11 |
| A-9.5 | exact | 左栏「阅读空间」文本长度 | 0 | #660 第 8 项 / design D11 |

## R-10 轮盘历史与颜色二级

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | exact | 历史分组剪切按钮的索引 | 2 | #660 第 9 项 / design D12 |
| A-10.2 | exact | 颜色二级透明项有棋盘格或描边 | "true" | #660 第 9 项 / design D12 |

## R-11 栏目更多操作菜单

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-11.1 | exact | 菜单右缘越出视口像素 | 0 | #660 第 10 项 / design D13 |
