# 验收锚点 — ui-toolbar-slots

锚点来源：用户 2026-11-10 授权（「先 3 票，如可行复制到工具条槽位」）；design.md D1–D4；实现勘察 `horizontal-toolbar.ts:139,167,208,232`、`config.rs:14,397`。

## R-1 槽位模型与配置驱动

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 默认工具条 `[data-action]` 数量（12 动作 + 清除格式） | "13" | design D1 / 现状勘察 |
| A-1.2 | exact | 配置去掉 `format-bold` 后 `[data-action]` 数量 | "12" | design D2 |
| A-1.3 | exact | 配置去掉 `format-bold` 后该动作节点数量 | "0" | design D2 |
| A-1.4 | exact | 配置把 `format-italic` 排首位后首个 `[data-action]` 值 | "format-italic" | design D1 |

## R-2 设置面与回滚

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 设置中取消勾选「粗体」后 `[data-action]` 数量 | "12" | design D4 |
| A-2.2 | exact | 点「恢复默认」后 `[data-action]` 数量 | "13" | design D4 |
| A-2.3 | exact | 取消勾选并重启后 `[data-action]` 数量 | "12" | design D4 |
| A-2.4 | exact | 空数组保存结果 | "rejected" | design D3 |
