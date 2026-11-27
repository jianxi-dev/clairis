# 验收锚点 — ui-quality-gate-v1

锚点来源：spec issue #1646；交付方案 §1 Q0/Q1/Q4；一手实测（426 / 99 / 55 / 3 / 18 / 2.98）。R-1…R-4 对应 tasks.md 1.1–1.3 与 spec delta UQ-1…UQ-4。

## R-1 token 门禁（UQ-1 / 任务 1.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 组件/编辑器层新增裸色值时 check-tokens 退出码 | 1 | 方案 §Q0 A |
| A-1.2 | exact | tokens.ts 键集与 tokens.css 唯一变量名集合的差集大小 | 0 | 实测 55 唯一名 |
| A-1.3 | exact | ink-1（--app-text-strong）对 --app-bg 对比度下限 | 7 | spec §7.8 |
| A-1.4 | exact | 正文级（--app-text-2）对比度下限 | 4.5 | spec §7.8 |
| A-1.5 | exact | 次要/大字（--app-text-3）对比度下限 | 3 | spec §7.8 |
| A-1.6 | exact | 暗色主题 --app-on-accent 对 --app-accent 对比度下限 | 4.5 | 实测白字 2.98 不合格 |

## R-2 四条交互条款（UQ-2 / 任务 1.2）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | interaction.md 条款条数 | 4 | 方案 §Q1 |
| A-2.2 | exact | window.alert/confirm/prompt 新增命中数 | 0 | 方案 §Q1 守护 |
| A-2.3 | exact | 存量 window.prompt 进基线处数 | 3 | 实测 slash.ts 等 3 处 |
| A-2.4 | exact | 存量 border-top/bottom 1px 进基线处数 | 18 | 实测 src/**/*.css |
| A-2.5 | exact | 「禁用而非隐藏」e2e 守护用例数下限 | 3 | 方案 §Q1 |
| A-2.6 | state-machine | Esc 逐层关闭后文档未保存内容 | 保留（0 处变更） | 方案 §Q1 |

## R-3 交付三件证据（UQ-3 / 任务 1.3）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | UI 交付证据件数 | 3 | 方案 §Q4 |
| A-3.2 | exact | 截图窗宽档位（宽/窄，px） | 1280 与 400 | 方案 §Q4 |
| A-3.3 | state-machine | PR 缺三件证据 | 退回（0 件通过） | 方案 §Q4 |

## R-4 门禁接线（UQ-4 / 任务 1.1+1.2）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | verify.sh Token Gate 段编号 | 3c | 方案 §Q0 |
| A-4.2 | exact | pre-commit 色值检查耗时上限（毫秒） | 1000 | 方案 §Q0 |
| A-4.3 | exact | spec.md §8 supersede 后交互条款指向 | "interaction.md" | 方案 §Q1 |
