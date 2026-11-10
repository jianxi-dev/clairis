# 验收锚点 — ui-polish-batch14

锚点来源：用户 2026-11-10 第十四批口述（#597）；design.md §1 勘察表与 D1–D7。

## R-1 轮盘回归

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 三层展开后根扇区计算 opacity | "0.9" | #597 第 7 项 / design D1 |
| A-1.2 | exact | NOTE 改图标后转 TIP 的卡片图标 | "tip-default" | #597 第 7 项 / design D1 |
| A-1.3 | exact | 关闭轮盘后 `.selection-roulette` 数量 | "0" | design D1 |

## R-2 音频分流

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 打开 mp3 后 `.pdf-*` 节点数量 | "0" | #597 第 2 项 / design D2 |
| A-2.2 | exact | 打开 mp3 后音频控件可见 | "true" | #597 第 2 项 / design D2 |

## R-3 视频播放核心

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 全屏后时间戳节点可见 | "true" | #597 第 1 项 / design D3 |
| A-3.2 | exact | 播放到第 2 项后重载的当前项索引 | "2" | #597 第 1 项 / design D3 |
| A-3.3 | exact | 播放列表顶部循环按钮数量 | "0" | #597 第 5 项 / design D3 |
| A-3.4 | exact | 页签喇叭点击后 audio.muted | "true" | #597 第 14 项 / design D3 |

## R-4 视频布局与手势

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 收窄到阈值后按钮溢出数量 | "0" | #597 第 1 项 / design D3 |
| A-4.2 | exact | 二级降级后图标尺寸小于初始值 | "true" | #597 第 1 项 / design D3 |
| A-4.3 | exact | 两个视频同时画中画时容器数量 | "2" | #597 第 1 项 / design D3 |

## R-5 编辑导航

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 编辑后 `cmd+[` 内容回退 | "true" | #597 第 3 项 / design D4 |
| A-5.2 | exact | 再按 `cmd+]` 内容前进 | "true" | #597 第 3 项 / design D4 |

## R-6 悬浮小窗编辑态

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 小窗编辑态源码标记片段数 | "0" | #597 第 8 项 / design D4 |

## R-7 胶囊

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 胶囊容器计算 border-radius 上限 | "<=12" | #597 第 9 项 / design D4 |
| A-7.2 | exact | 胶囊动作项数等于轮盘可执行项数 | "true" | #597 第 9 项 / design D4 |

## R-8 转换菜单与列表

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 插入 CSS 与缩进/对齐子项图标数等于项数 | "true" | #597 第 10 项 / design D4 |
| A-8.2 | exact | 滑出 400ms 后二级菜单节点数量 | "0" | #597 第 10 项 / design D4 |
| A-8.3 | exact | 点任务项后块源码前缀 | "- [ ]" | #597 第 11 项 / design D4 |
| A-8.4 | exact | 三块同级转有序后的编号序列 | "1,2,3" | #597 第 12 项 / design D4 |

## R-9 弹窗对齐

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 弹窗中心与图标中心水平偏差上限（px） | "<=2" | #597 第 4 项 / design D5 |
| A-9.2 | exact | 贴边时弹窗完整可见 | "true" | #597 第 4 项 / design D5 |

## R-10 导出

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | exact | 导出菜单文本序列 | "Word / .mdpkg / 图片 / PDF / HTML / ZIP" | #597 第 13 项 / design D6 |
| A-10.2 | exact | 点 PDF 后生成文件 | "exists" | #597 第 13 项 / design D6 |
