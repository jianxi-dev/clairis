# 验收锚点 — editor-block-parity

锚点来源：《md-bundle/docs/doubao-editor-study/ui-gap-and-target.md》§2.2/2.3/2.4、本 change design.md D1–D6、用户 2026-11-03 走查反馈。

## R-1 块菜单结构 E-11

「转为」为 5×2 图标网格；动作组含复制/剪切/删除/缩进对齐/颜色；表格块含标题行/列/均分列宽/删除表格；每行都有图标。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 转为单元格数量 | 10 | design.md D2 |
| A-1.2 | exact | 菜单宽 | 236px | ui-gap-and-target.md §2.3 |
| A-1.3 | exact | 菜单行高 | 32px | ui-gap-and-target.md §2.3 |
| A-1.4 | exact | 菜单图标渲染尺寸 | 18px | ui-gap-and-target.md §2.2 |
| A-1.5 | exact | 表格块结构开关数量 | 3 | design.md D3 |
| A-1.6 | exact | 「在下方添加」行 svg 数量 | 1 | E-7 每一行带图标 |

## R-2 单元格富文本 E-12

单元格编辑态支持斜杠插入与行内格式，提交保持单行。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 单元格内 `/` 后出现的菜单数 | 1 | design.md D4 |
| A-2.2 | exact | 提交后单元格文本换行数 | 0 | GFM 单元格单行约束 |
| A-2.3 | state-machine | 编辑态提交语义 | Enter=提交, Tab=右移, Esc=还原 | design.md D4 |

## R-3 工具条 E-9 修订

单格不出现工具条；多行才出现合并；无背景色入口。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 单格点击后工具条数量 | 0 | 用户反馈 2026-11-03 |
| A-3.2 | exact | 工具条背景色入口数量 | 0 | design.md D5 |
| A-3.3 | state-machine | 合并可见条件 | 选区行数 ≥ 2 | E-9 修订 |

## R-4 全角标点 E-13

`，`→`,`、`／`→`/`；代码内不替换；可 undo。

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 输入「你好，世界」后的源码 | 你好,世界 | 用户反馈 2026-11-03 |
| A-4.2 | exact | 围栏代码块内全角逗号保留数 | 1 | design.md D6 |
| A-4.3 | state-machine | undo 步数 | 1（回到键入前） | design.md D6 |
