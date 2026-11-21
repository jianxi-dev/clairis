# 验收锚点 — doc-property-refine-1121b

锚点来源：spec issue #1311（用户 2026-11-21 反馈 11 项优化 + 截图证据）+ design.md D1–D10；R-1…R-8 与 tasks.md 1.1–8.1 一一对应。

## R-1 密度（tasks 1.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | A 胶囊计算高度 | "var(--dpb-chip-height)" | #1311 / design D1 |
| A-1.2 | exact | 布尔开关计算高度 | "var(--dpb-bool-height)" | #1311 / design D1 |
| A-1.3 | state-machine | 指针进入 `[data-testid="dpb-count"]` 自身区域前后计数 opacity | 进入前 0 → 进入后 1 | #1311 / design D2 |

## R-2 B 列对齐 + A 空值宽度（tasks 2.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | B 名称列计算宽度 | "var(--dpb-label-width)" | #1311 / design D3 |
| A-2.2 | exact | 名称超 8 汉字字段的省略号截断出现次数 | 0 | #1311 / design D3 |
| A-2.3 | exact | A 模式空值输入区计算宽度 | ≥ 200px | #1311 / design D4 |

## R-3 隐藏语义 + 页签信息窗入口（tasks 3.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | state-machine | 按 ⌘⇧Y 隐藏后源码 `---` 节点可见性 | 隐藏→不可见 | #1311 / design D5 |
| A-3.2 | exact | 隐藏态下 `.dpb-hidden-note` 节点数 | 0 | #1311 / design D5 |
| A-3.3 | state-machine | 信息窗点击「显示字段」后属性面板渲染 | 点击→面板出现 | #1311 / design D6 |

## R-4 chip 输入统一（tasks 4.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 非编辑态 chip 输入框节点数 | 0 | #1311 / design D7 |
| A-4.2 | state-machine | 点击值区进入编辑态后输入框节点数 | 点击→1 | #1311 / design D7 |
| A-4.3 | state-machine | 连续两次 Enter 提交后的 chip 数与输入框焦点 | 2 个 chip 且输入框仍聚焦 | #1311 / design D7 |

## R-5 下拉选项（tasks 5.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | state-machine | 打开 select 值区后选项菜单与当前值高亮 | 打开→菜单出现且当前行高亮 | #1311 / design D9 |
| A-5.2 | state-machine | 选择已有值后 YAML 该键写回值 | 选择→写回所选值 | #1311 / design D9 |
| A-5.3 | state-machine | 新增值行提交后 YAML 出现新值 | 提交→新值写回 | #1311 / design D9 |

## R-6 折叠三角（tasks 6.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 折叠三角相对标题文本的水平位置 | "三角 x < 标题 x" | #1311 / design D10 |
| A-6.2 | exact | 折叠态下字段行节点数 | 0 | #1311 / design D10 |
| A-6.3 | state-machine | 标题行 hover 前后折叠三角 opacity | 0 → 1 | #1311 / design D10 |

## R-7 日期 / 日期时间（tasks 7.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 日期 / 日期时间值区 placeholder | "YYYY-MM-DD" / "YYYY-MM-DD HH:mm" | #1311 / design D10 |
| A-7.2 | state-machine | 空字段打开面板后时 / 分预置值 | = 当前时刻（非 00:00） | #1311 / design D10 |
| A-7.3 | state-machine | 滚轮列滚动 / 点击「清除」后 YAML 值 | 滚动→值变化；清除→空值 | #1311 / design D10 |

## R-8 手柄与工具条（tasks 8.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | state-machine | 拖动手柄完成排序后 `.dpb-ops` 节点数 | 拖动→0 | #1311 / design D10 |
| A-8.2 | state-machine | 单击手柄后 `.dpb-ops` 节点数 | 单击→1 | #1311 / design D10 |
| A-8.3 | exact | 工具条中心与标题行中心水平偏差 | ≤ 2px | #1311 / design D10 |
