# 验收锚点 — editor-refine-batch2

锚点来源：spec issue #1406（4 全组 / 6a / 6d）+ 一手证据截图 `豆包的高亮效果.png` / `纯高亮的颜色图标及效果.png` / `嵌入文件的三种方式工具条.png`；design.md D1–D4 与「数据面」。R-1…R-4 对应 tasks.md 1.1–2.2。

## R-1 纯高亮块：新类型 + 无边框渲染分支 + 六色色板 + 四入口 + 菜单收敛

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 纯高亮块计算 `border-inline-start-width`（px） | 0 | #1406 反馈4a / 豆包的高亮效果.png |
| A-1.2 | exact | 纯高亮块内 `.cm-callout-header` 节点数 | 0 | #1406 反馈4a / design D1 |
| A-1.3 | exact | 纯高亮块计算 `border-radius`（px） | 8 | design D1 / 设计系统 §5 |
| A-1.4 | exact | 斜杠菜单「常用」段「高亮」+「标注」项数 | 2 | #1406 反馈4b |
| A-1.5 | exact | 「标注」子菜单展开的语义类型数 | 13 | #1406 反馈4b / callout-types.ts:38-54 |
| A-1.6 | state-machine | 四入口（斜杠 / 块菜单转为 / 转换手柄 / 选区轮盘）点「高亮」→ 文档出现 `> [!highlight]` | 点击→写入 | #1406 反馈4c |
| A-1.7 | exact | 纯高亮块可用的六色板色相数 | 6 | 纯高亮的颜色图标及效果.png / design D1 |

## R-2 颜色面板图标形象化

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 颜色面板色块内含文本 `A` 的节点数 | 0 | #1406 反馈4d / 纯高亮的颜色图标及效果.png |
| A-2.2 | exact | 色块容器计算 `justify-content` | 严格等于 "center" | #1406 反馈4d |
| A-2.3 | exact | 高亮块工具条 `data-testid="callout-type-entry"` 节点数 | 0 | #1406 反馈4d / design D2 |
| A-2.4 | state-machine | NOTE 块填充改红后切换 TIP → 填充色相仍为红 | 切换→色相延续 | #1406 反馈4e |
| A-2.5 | exact | 六色板色相与豆包截图一致的色数 | 6 | 纯高亮的颜色图标及效果.png |

## R-3 嵌入文件卡 quiet 化

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 嵌入工具条按钮数（展开全屏 + 对齐3 + 三态3） | 7 | 嵌入文件的三种方式工具条.png |
| A-3.2 | exact | 嵌入工具条内含「下载」字样的按钮数 | 0 | #1406 反馈6a |
| A-3.3 | state-machine | 点「卡片」→ `.cm-embed-body` 计算 `display` | 点击→none | #1406 反馈6d / design D3 |
| A-3.4 | state-machine | 点「预览」→ body 可见且高度 ≤ 上限 | 点击→受限 | 嵌入文件的三种方式工具条.png |
| A-3.5 | state-machine | 点「嵌入」→ body 全尺寸显示 | 点击→全尺寸 | design D3 |
| A-3.6 | exact | 头部主标题文本严格等于文件名（节点数） | 1 | #1406 反馈6d |
| A-3.7 | exact | 头部描述副标题节点数（有描述时） | 1 | #1406 反馈6d |
| A-3.8 | state-machine | 拖边框后文档属性 `{width=…}` 变化 | 拖动→写回 | design D3 |

## R-4 嵌入 md 保真与预览可渲染

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 嵌入 md 与独立预览同段落计算 `font-size` 相等 | 1 | #1406 反馈6b |
| A-4.2 | exact | 嵌入 md 与独立预览同段落计算 `line-height` 相等 | 1 | #1406 反馈6b |
| A-4.3 | exact | 嵌入 md 与独立预览同段落计算 `margin-block-end` 相等 | 1 | #1406 反馈6b |
| A-4.4 | exact | 预览态嵌入区 `naturalWidth === 0` 的 `<img>` 裂图节点数 | 0 | #1406 反馈6c |
| A-4.5 | exact | 预览态嵌入 md 内容可见节点数下限 | 1 | #1406 反馈6c / design D4 |
| A-4.6 | exact | 预览态 pdf / html / 附件引用渲染为 iframe 或附件卡的节点数下限 | 1 | #1406 反馈6c |
