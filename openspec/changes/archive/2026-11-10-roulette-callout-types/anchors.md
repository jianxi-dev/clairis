# 验收锚点 — roulette-callout-types

锚点来源：用户 2026-11-10「标注类型不全，补全」、`CALLOUT_EDIT_TYPES`、PR #531。

## R-1 类型集

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 高亮三层类型数 | 13 | CALLOUT_EDIT_TYPES |
| A-1.2 | exact | 第一类 | "注释" | CALLOUT_EDIT_TYPES |
| A-1.3 | exact | 最后一类 | "引用" | CALLOUT_EDIT_TYPES |
| A-1.4 | state-machine | 选择「成功」写入源码 | "> [!success]" | 用户反馈 |

## R-2 悬停观感

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 悬停扇区填充不再是带 alpha 的 accent-soft | "true" | 用户反馈 |
