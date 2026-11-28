# 验收锚点 — ui-quality-primitives-v1

锚点来源：spec issue #1706；交付方案 §1 Q2/Q3 与 §4 第 2 行；一手实测（236 / 71 / 21 / 7 / 4 / 47 / 292 / 135 / 106 / 56）。R-1…R-5 对应 tasks.md 2.1–2.6 与 spec delta UP-1…UP-5。本 change 无 prototype PNG，故不含 `perceptual` 锚点。

## R-1 四基件单一来源与 token-only 样式（UP-1 / 任务 2.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 基件 CSS 裸色值 / 裸 px 字号命中数 | 0 | 方案 §Q2 样式只用 token |
| A-1.2 | exact | IconButton 命中区下限（px） | 24 | 方案 §Q2 |
| A-1.3 | exact | Button variant 档数 | 6 | 方案 §Q2 |
| A-1.4 | exact | primitives.css 在 main.tsx 的引入次数 | 1 | 方案 §Q2 |

## R-2 浮层定位与关闭仲裁共享（UP-2 / 任务 2.2）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | useAnchoredPosition 支持的翻转方向数 | 12 | 方案 §Q2 12 向 |
| A-2.2 | state-machine | Esc 只关栈顶层后下层浮层 | 保留（0 处关闭） | interaction.md §4 |
| A-2.3 | exact | useMenuPos 全仓残留引用数 | 0 | 实测 47 行单文件 |
| A-2.4 | exact | 容器夹取回归用例覆盖的嵌入态面板溢出 | 1 | #1017 |

## R-3 /showcase 对照场（UP-3 / 任务 2.4）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | showcase 态数（4 基件 × 6 态） | 24 | 方案 §Q2 |
| A-3.2 | exact | showcase 主题数 | 2 | 方案 §Q2 明暗双主题 |
| A-3.3 | exact | 生产构建 grep showcase 命中数 | 0 | 方案 §Q2 dev-only |

## R-4 图标纪检（UP-4 / 任务 2.5）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 两表概念键集合差集大小 | 0 | 方案 §Q3 ① |
| A-4.2 | exact | 12px 白名单外越档处数 | 0 | 实测生产 3 处 |
| A-4.3 | exact | 动作→图标映射唯一性违规数 | 0 | 方案 §Q3 ③ |
| A-4.4 | exact | 孤儿键数 | 0 | 方案 §Q3 ④ |
| A-4.5 | exact | 11 行裁决明细条数 | 11 | 方案 §Q3 |

## R-5 基件迁移与不自造 button（UP-5 / 任务 2.6）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 迁移处数（Button 3 + IconButton 3 + Menu 1） | 7 | 方案 §Q2 迁移 Top3 |
| A-5.2 | exact | 迁移后全仓裸 button 总数上限 | 229 | 实测 236 |
| A-5.3 | state-machine | 每屏 primary 按钮数上限 | 1 | 方案 §Q2 review 判据 |
