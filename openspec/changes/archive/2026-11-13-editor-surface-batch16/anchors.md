# 验收锚点 — editor-surface-batch16

锚点来源：用户 2026-11-13 补充修复清单（spec issue #695，21 条）+ 本轮实测视频基线（`.artifacts/video-baseline-2026-11-13/`）；design.md D1–D19。

## R-1 块宽度统一

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 预览引用块与段落文字列宽度差（px） | 0 | #695 第 6 项 / design D5 |
| A-1.2 | exact | 编辑态引用块与正文行文字列宽度差（px） | 0 | #695 第 7 项 / design D5 |
| A-1.3 | exact | 编辑态代码块与正文行文字列宽度差（px） | 0 | #695 第 7 项 / design D5 |

## R-2 编辑态公式与代码高亮

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 非活跃态 `.katex` 节点数 | 2 | #695 第 8 项 / design D7 |
| A-2.2 | exact | js 围栏内 `.tok-keyword` 节点数下限 | 1 | #695 第 8 项 / design D8 |
| A-2.3 | state-machine | 光标进入公式块后显示源码 | 进入源码态 | #695 第 8 项 / design D7 |

## R-3 手柄菜单稳定与拖块

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 回移父菜单 300ms 后转换菜单节点数 | 1 | #695 第 1 项 / design D1 |
| A-3.2 | exact | 图片菜单垂直中心与手柄中心偏差上限（px） | 2 | #695 第 2 项 / design D2 |
| A-3.3 | exact | 拖拽期间插入指示线节点数 | 1 | #695 第 3 项 / design D3 |

## R-4 插入菜单表格与分栏

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 指针在第 3 行第 4 列时选中格数 | 12 | #695 第 10 项 / design D10 |
| A-4.2 | exact | 回滑到第 1 行第 1 列时选中格数 | 1 | #695 第 10 项 / design D10 |
| A-4.3 | exact | 分栏横向单元数 | 5 | #695 第 11 项 / design D11 |
| A-4.4 | exact | 单击第 4 格插入的围栏类名 | "col-4" | #695 第 11 项 / design D11 |

## R-5 图片描述

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 点描述后新增 `> 评论：` 行数 | 0 | #695 图片段第 1 项 / design D13 |
| A-5.2 | exact | 重开文档后描述行文字 | "示意图" | #695 图片段第 1 项 / design D13 |
| A-5.3 | exact | 已有描述再点后输入框回填值 | "示意图" | #695 图片段第 1 项 / design D13 |

## R-6 图片裁剪

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 编辑态可见文本含 `<!--w=` | "false" | #695 图片段第 2 项 / design D14 |
| A-6.2 | exact | 图片下方空白高度上限（px） | 8 | #695 图片段第 2 项 / design D14 |
| A-6.3 | state-machine | 拖左上角向右下时裁剪宽度 | 变为更小 | #695 图片段第 4 项 / design D14 |
| A-6.4 | exact | 显示裁剪语义的控制点数量下限 | 6 | #695 图片段第 5 项 / design D14 |
| A-6.5 | exact | 二次裁剪后 crop 宽度 | 变为新矩形宽度 | #695 图片段第 6 项 / design D14 |

## R-7 图片对齐与锚点

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 新插入图片容器 text-align | "center" | #695 图片段第 7 项 / design D15 |
| A-7.2 | exact | 居中按钮 aria-pressed | "true" | #695 图片段第 7 项 / design D15 |
| A-7.3 | exact | 已裁剪图拖锚点时裁剪浮层节点数 | 0 | #695 图片段第 11 项 / design D15 |

## R-8 图片预览浮层

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 滚轮放大后 scale 下限 | 1.1 | #695 图片段第 8 项 / design D16 |
| A-8.2 | exact | 旋转一次后的角度 | 90 | #695 图片段第 8 项 / design D16 |
| A-8.3 | exact | 恢复原始尺寸后的 scale | 1 | #695 图片段第 8 项 / design D16 |
| A-8.4 | exact | 点下载后下载调用次数 | 1 | #695 图片段第 8 项 / design D16 |

## R-9 块菜单与任务图标

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 任务复选框 border-radius | "3px" | #695 第 12 项 / design D19 |
| A-9.2 | exact | 图片块菜单文本顺序 | "对齐与缩进,剪切,复制,删除" | #695 图片段第 10 项 / design D18 |
| A-9.3 | exact | 图片手柄内 `svg[data-icon]` 数量 | 1 | #695 图片段第 10 项 / design D18 |

## R-10 预览宽度与字体

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | exact | 预览引用块与段落文字列宽度差（px） | 0 | #695 第 6 项 / design D5 |
| A-10.2 | exact | 编辑态与预览态正文 font-family 相等 | "true" | #695 第 9 项 / design D6 |

## R-11 预览图片圆角

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-11.1 | exact | 预览图片 border-radius | "12px" | #695 图片段第 9 项 / design D17 |
| A-11.2 | exact | 上下两角半径相同 | "true" | #695 图片段第 9 项 / design D17 |

## R-12 Markdown 打印

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-12.1 | exact | 点打印后 window.print 调用次数 | 1 | #695 第 13 项 / design D12 |
| A-12.2 | exact | 打印态顶栏 display | "none" | #695 第 13 项 / design D12 |
| A-12.3 | exact | 代码块 break-inside | "avoid" | #695 第 13 项 / design D12 |
| A-12.4 | exact | @page 页边距 | "10mm" | #695 第 13 项 / design D12 |

## R-13 视频测试基线

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-13.1 | exact | 首次点击旋转后的 transform 角度 | 270 | 实测 2026-11-13 / #518 AC / design Context |
| A-13.2 | exact | 连续四次点击后的 transform 角度 | 0 | #518 AC / design Context |
| A-13.3 | exact | 播放列表 spec 重复 5 次失败数 | 0 | 实测 2026-11-13（基线 1/5 失败） |
