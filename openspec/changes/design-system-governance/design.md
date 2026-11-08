# Design: 设计系统治理

## Context

设计决策此前分散在三处且互不引用：`docs/design/explorations/`（历史数值，已 superseded）、`docs/product/principles.md`（Doctrine，管取舍）、`src/styles/tokens.css`（实现，只有颜色）。缺的是中间层：**跨界面复用的数值规范**。

`docs/README.md` §二 已有 6 级权威矩阵，`GOVERNANCE.md` §1 已登记 `design/system` 子域与其职责（「色板、字体、组件规范、设计令牌」，不得承载单 feature 方案），但该目录只有一个 224 字节的空壳稿。

## Goals

1. 视觉数值只定义一次，可被 feature 设计、票面、e2e 引用。
2. 单点裁决有账可查，同一争论不重开。
3. 把关点前移，但**不新增人工停点**。

## Non-Goals

- 不做组件模式库、动效规范、品牌指南、像素级审计。
- 不重画已定案图标，不把历史数值层整体复活。
- 不引入新依赖（stylelint），不改运行时。

## Decisions

| 决策点 | 选择 | 理由（含被否方案） |
|---|---|---|
| 落点路径 | `docs/design/system/spec.md` | 该子域已被 `docs/README.md` §三与 `GOVERNANCE.md` §1 登记。**否**：新建 `approved/design-system/`（同主题两个 canonical 路径，违反 §5） |
| 层级模型 | 沿用现有 6 级矩阵，设计系统驻第 4 层 | 矩阵是唯一冲突裁定。**否**：另立「五层裁决链」（第二套层级，且把 Doctrine 排在设计系统之上，与矩阵顺序相反） |
| 数值来源 | 实测频次（`src/styles/*.css`）+ 既有裁决 | 「誊写不是发明」。**否**：按惯例发明 4/8/16 刻度（无证据链） |
| 规则与裁决的分工 | spec 管跨界面规则；decisions.md 管单部件裁决 | 避免同一事实两处写、改一处忘另一处 |
| 台账可变性 | append-only + 稳定表头 | `accepted` 不可原地改写。**否**：每次小裁决走 supersede（维护成本会杀死规范） |
| 视觉把关 | 票面视觉锚点 + code-review，C9 后续机检 | 维护者裁定：跨 change 零询问自动接力，不新增人工确认 |
| 图标收敛 | 吸收 v2 规则 + v3 七轮定案，双降 superseded | v3 是 QA 日志非规范文；v2 的形状裁决已被 v3 覆盖 |
| token 化节奏 | 首个 change 只写规范，tokens.css 扩容另开 change | 2609 行 CSS / 355 处 px，一次性迁移不可评审 |

## Risks / Trade-offs

| 风险 | 现状 | 缓解 |
|---|---|---|
| 规范腐烂（写了没人引用） | 无强制 | 先行指标：票面视觉锚点引用率；C9 机检在后续 change 落地 |
| spec 与 tokens.css 漂移 | 无 CI 同步 | spec 头部声明「快照 + 复现命令」；漂移检查留后续 |
| 只追加靠自律 | 无机检 | GOVERNANCE 写入纯追加约束；pre-commit 检查留后续 |
| 台账与实现脱钩 | 已实证一次（pinOff 原型值未落地） | 台账规则：已落地行必须带 PR 号，以实现值为准 |
| 审美方向性反悔 | 不可防 | 四要素模板 + 「先给 2–3 个候选终态」，不假装能机检 |

## Migration

1. `docs/design/system/spec.md`、`decisions.md` 新建（accepted / canonical）。
2. icon v2、v3 QA、颜色空壳稿标 `superseded` + `superseded_by` + `redirect`。
3. `GOVERNANCE.md` 增补条款；`AGENTS.md`、`docs/README.md`、`docs/agents/*` 接线。
4. 存量硬编码不追溯：规则只约束新增与本次触及的代码。
