# 验收锚点 — ui-command-registry

锚点来源：用户 2026-11-10 授权（先 3 票，如可行复制到工具条槽位）；design.md D1–D4；实现勘察 `roulette.ts:45,62`、`roulette-view.ts:31,96,150`、`floating-toolbar.ts:305,628`、`config.rs:14,397`。

## R-1 命令注册表

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 点击轮盘「加粗」后编辑态源码含加粗标记 | "**" | design D1 / 用户需求 9 |
| A-1.2 | exact | 内置命令 `bold` 注册命中 | "true" | design D1 |
| A-1.3 | exact | 未注册 `commandId` 且无 `run` 的项在轮盘筛选中出现次数 | "0" | design D1 |

## R-2 扇区数据面

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 配置去掉 `columns` 后轮盘根扇区数量 | "7" | design D2 |
| A-2.2 | exact | 配置去掉 `columns` 后 `.sr-sector` 的 `data-sector` 集合含 `columns` 的次数 | "0" | design D2 |
| A-2.3 | exact | 配置写入未知 id 后轮盘根扇区数量（回落默认） | "8" | design D3 |
| A-2.4 | exact | 配置写入空数组时保存结果 | "rejected" | design D3 |

## R-3 设置面与回滚

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 设置中取消勾选「分栏」后轮盘根扇区数量 | "7" | design D4 |
| A-3.2 | exact | 取消勾选并重启后轮盘根扇区数量 | "7" | design D4 |
| A-3.3 | exact | 点「恢复默认」后轮盘根扇区数量 | "8" | design D4 |
| A-3.4 | exact | 空数组被拒后 `user/settings.json` 中 `rouletteSectors` 的值 | "unchanged" | design D3 |
