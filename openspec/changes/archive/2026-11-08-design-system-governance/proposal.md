# Proposal: 设计系统治理（视觉数值唯一来源 + 决案台账 + 视觉锚点）

## Why

2026-11-06 ~ 11-08 的 UI 打磨批次反复返工：主题按钮下拉三角先加（#360/PR #381）后删（#389/PR #397），图钉三轮（#352 → #366/PR #387 → #368/PR #388），缩略图尺寸（#392/PR #396）。根因不是态度，是**视觉数值没有 canonical 来源**：

- 唯一的完整设计手册 `ui-design-philosophy.md` 已标 superseded / historical，不参与实现裁定；
- 取代它的 Doctrine D1–D10 裁决「该不该有」，裁决不了「三角多大算合适」；
- `src/styles/tokens.css` 168 行只有语义色 + 1 个圆角，间距/字号/图标线长全缺；`editor.css` 2609 行含 355 处 px；
- `AGENTS.md` 没有「实现 UI 前读设计规范」的路由，规范不在上下文里等于不存在；
- `defect-workflow.md` 全文 0 处「视觉」，视觉偏差无票可提、无度量语言。

结果：每轮返工都是「用户当人肉像素比较器，执行者猜一个数值去改」。

## What Changes

- **设计系统落点**：`docs/design/system/spec.md`（accepted · canonical）——图标网格/笔画/尺寸、间距刻度、字号阶梯、圆角阴影、三主题语义色、L3 审美判据。数值来自实测频次与既有裁决，不发明新档。
- **决案台账**：`docs/design/system/decisions.md`（accepted · canonical · `ledger: append-only`）——15 行具体部件裁决，只追加不改写。
- **旧稿收编**：icon-system-v2（draft）、icon-system-v3 的 QA 记录（in-review）、颜色空壳稿 → 全部 superseded + redirect 到 spec，内容被吸收。
- **治理条款**（`docs/GOVERNANCE.md`）：append-only 台账例外、`ledger` / `redirect` 字段、§5.1 具体性优先与矛盾即缺陷、收敛 §2.3 与 §6.1 的既有矛盾、§6.3 补 superseded 归档要求。
- **接线**（`AGENTS.md`）：设计系统路由；数值只定义一次；ui-surface 票面第七字段「视觉锚点」。
- **缺陷与反馈**：`docs/agents/defect-workflow.md` 增「非功能视觉缺陷」；新增 `docs/agents/ui-feedback.md` 四要素模板。

## Capabilities

### New Capabilities

<!-- 无新能力：纯文档/流程变更，不改变运行时行为 -->

### Modified Capabilities

- `docs-governance`：新增 DG-2 设计系统唯一数值来源、DG-3 append-only 决案台账、DG-4 票面视觉锚点、DG-5 视觉偏差缺陷承接。

## Impact

- 影响 `docs/design/system/`、`docs/GOVERNANCE.md`、`docs/README.md`、`AGENTS.md`、`docs/agents/`；不改任何运行时行为与产品功能。
- **明确不在本 change**：C9 机检（`cw-tickets-check.sh`）、`tokens.css` 扩容与存量迁移、e2e 断言锚定 token、CI 接入 spec↔tokens 漂移检查。全部留给后续 change。
- 已知弱点：C9 落地前视觉锚点由 code-review 人工执行；spec 是 `tokens.css` 的快照，颜色变更不会自动同步。
- 权威：设计系统驻现有 6 级权威矩阵第 4 层（`docs/README.md` §二），低于 canonical spec 与 ADR；不新建层级。
