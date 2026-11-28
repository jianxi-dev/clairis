# 验收锚点 — callout-round4

锚点来源：用户桌面文档与四条反馈（#1738），PR #1739 修复。

## R-1 E-48/E-56 随机默认与深档

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | state-machine | 随机可回默认文字、高亮可出深档填充 | rand=0 时标注随机删除 text 属性、高亮随机写 dark* 填充；rand=0.9 时高亮写非 dark* 填充 | 单测 / PR #1739 |

## R-2 E-59 相邻预览拆分

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 相邻 callout 预览逐块渲染 | 三个相邻头渲染三张卡片，标记文本不进入正文 | e2e H / 截图 |

## R-3 E-60 emoji 持久化

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | state-machine | emoji 写首行属性并重开生效 | 选择后源码含 emoji=；重开与预览显示所选 emoji；改色保留 emoji | e2e I / 截图 |
