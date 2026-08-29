---
title: "历史遗留根级文档（legacy-docs）"
type: archive
status: archived
last_updated: 2026-08-01
source_of_truth: historical
---

# 历史遗留根级文档（legacy-docs）

本分组收纳 2026 年迁移后 `docs/` 根部遗留的历史稿共 **8 份**（计划稿 / 评审稿 / 质量稿 / 来源稿 / 架构稿）。这些文档在迁移前散落在 `docs/` 根部，非需求历史（见 [legacy-requirements/](../legacy-requirements/README.md)）、非设计探索命题（见 [reading-completion/](../reading-completion/README.md)），故单建本分组归档。

## 分组文件与 superseded_by

| 文件 | 类型 | 替代品（superseded_by） |
| --- | --- | --- |
| [DESIGN-REVIEW.md](./DESIGN-REVIEW.md) | design | [docs/design/approved/](../../../design/approved/README.md)（已批准设计）、[docs/design/explorations/](../../../design/explorations/README.md)（探索稿） |
| [DEVEX-REVIEW.md](./DEVEX-REVIEW.md) | delivery | [docs/delivery/roadmap.md](../../../delivery/roadmap.md) |
| [EXECUTION-PLAN.md](./EXECUTION-PLAN.md) | delivery | [docs/delivery/roadmap.md](../../../delivery/roadmap.md) |
| [MVP-渐明-v1.md](./MVP-渐明-v1.md) | delivery | [docs/delivery/roadmap.md](../../../delivery/roadmap.md)、[docs/product/](../../../product/README.md)（vision/principles/scope 已提炼） |
| [QUALITY-STANDARDS.md](./QUALITY-STANDARDS.md) | delivery | [docs/GOVERNANCE.md](../../../GOVERNANCE.md) |
| [SOURCE-MANAGEMENT.md](./SOURCE-MANAGEMENT.md) | delivery | [docs/GOVERNANCE.md](../../../GOVERNANCE.md)、[AGENTS.md](../../../../AGENTS.md) |
| [09-html-exploration.md](./09-html-exploration.md) | research | [docs/design/explorations/](../../../design/explorations/README.md)（设计探索） |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | architecture | [docs/architecture/overview.md](../../../architecture/overview.md)、[docs/architecture/decisions/](../../../architecture/decisions/README.md) |

## 权威级别（重要）

本分组全部文件为 `archived` / `historical`，**默认不参与实现裁定**。在权威优先级矩阵中属于第 6 层（research / history）：仅用于"过去是什么样、为什么被取代"的历史调查，实现冲突时不得引用本分组内容覆盖任何高层真相源。
