# 验收锚点 — ui-polish-batch13

锚点来源：用户 2026-11-10 第十三次口述 14 条需求（`docs/requirements/ui-polish-batch13/input-package.md`）；现有实现勘察（design.md §1 表）；设计决案 `docs/design/system/decisions.md`。

## R-1 编辑态装饰重建

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 分栏后原格 `data-mode` | "edit" | 用户需求 2 / design R-2 |
| A-1.2 | exact | 分栏后原格 `.cm-heading-marker` 数量下限 | ">=1" | 用户需求 2 / 探针复现 |
| A-1.3 | exact | 分栏后原格 `.cm-callout` 数量下限 | ">=1" | 用户需求 2 / 探针复现 |
| A-1.4 | exact | 编辑态正文字面出现的 `**` 源码片段数 | "0" | 用户需求 2 |

## R-2 轮盘视觉与三级联动

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 颜色扇区图标名 | "droplet" | 用户需求 1 |
| A-2.2 | exact | 三层展开后根扇区计算 opacity | "0.25" | 用户需求 1 |
| A-2.3 | exact | 三层展开瞬间 `.hot` 的层内数量 | "1" | 用户需求 1 |
| A-2.4 | state-machine | 指针沿二层自左向右滑动时三层 hot 索引 | "单调不减" | 用户需求 1 |
| A-2.5 | exact | 悬停根扇区 600ms 后 `.app-tip` 数量 | "0" | 用户需求 1 |
| A-2.6 | exact | 悬停圆心出现的提示文案片段 | "格式刷" | 用户需求 1 |

## R-3 格式刷与胶囊工具条

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 格式刷后目标段源码含加粗标记 | "**" | 用户需求 1 |
| A-3.2 | exact | 格式刷后目标段源码含字色类 | "mdb-color-" | 用户需求 1 |
| A-3.3 | exact | 格式刷圆心计数 | "2" | 用户需求 1 |
| A-3.4 | exact | 胶囊模式下 `.selection-roulette` 数量 | "0" | 用户需求 7 |
| A-3.5 | exact | 胶囊可见行数 | "2" | 用户需求 7 |
| A-3.6 | exact | 设置项 `selectionToolbar` 可选值数量 | "2" | 用户需求 7 |

## R-4 高亮块图标与间距

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 转换为 TIP 后卡片 emoji 等于 TIP 默认 | "💡" | 用户需求 3 / callout-types |
| A-4.2 | exact | 图标右缘与标题左缘间距上限 px | "<=2" | 用户需求 3 |

## R-5 撤销/重做快捷键

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | state-machine | 点击栏目头后按 ⌘Z 的内容变化 | "abc → 空" | 用户需求 4 |
| A-5.2 | state-machine | 再按 ⌘⇧Z 的内容变化 | "空 → abc" | 用户需求 4 |

## R-6 文案与行宽上限

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 栏目菜单项文本 | "打开文件位置" | 用户需求 5 |
| A-6.2 | exact | 状态栏宽度按钮 title 全文 | "页面宽度 1080px" | 用户需求 9 |
| A-6.3 | exact | 设置行宽滑块与状态栏滑块 max | "1400, 1400" | 用户需求 6 |

## R-7 页签栏双击与弹窗提示抑制

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 双击空白后的页签数增量 | "1" | 用户需求 8 |
| A-7.2 | exact | 新页签默认模式 | "edit" | 用户需求 8 / newTabWith |
| A-7.3 | exact | 菜单打开期间悬停 600ms 后 `.app-tip` 数量 | "0" | 用户需求 11 |

## R-8 视频自动播放与图标

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 打开视频 800ms 后 `video.paused` | "false" | 用户需求 10 |
| A-8.2 | exact | 两格视频的 muted 值 | "false, false" | 用户需求 10 |
| A-8.3 | exact | 时间戳按钮图标 path 与旧值不同 | "changed" | 用户需求 10 |

## R-9 HTML 卡片缩略图

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | HTML 卡片内 iframe 数量 | ">=1" | 用户需求 12 |
| A-9.2 | exact | 加载完成 iframe 计算 opacity | "1" | 用户需求 12 |

## R-10 PDF 工具栏

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | exact | 打开 PDF 时顶栏 opacity | "1" | 用户需求 13 |
| A-10.2 | exact | 双击收起后顶栏 opacity | "0" | 用户需求 13 |
| A-10.3 | exact | 收起后正文高度增量下限 px | ">=24" | 用户需求 13 |
| A-10.4 | state-machine | 顶部 16px 滑入后顶栏 position | "absolute" | 用户需求 13 |
| A-10.5 | exact | 正文中部滑入后顶栏 opacity | "0" | 用户需求 13 |

## R-11 悬浮小窗编辑

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-11.1 | exact | 钉住按钮右侧切换按钮存在 | ">=1" | 用户需求 14 |
| A-11.2 | exact | 编辑态 textarea 数量 | "1" | 用户需求 14 |
| A-11.3 | exact | 保存调用写文件命令次数 | ">=1" | 用户需求 14 |
