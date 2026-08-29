---
title: "归档总索引（docs/archive）"
type: archive
status: archived
last_updated: 2026-08-01
source_of_truth: historical
---

# 归档总索引（docs/archive）

本目录存放**已被取代或停用**的历史文档。归档内容属治理规范（[GOVERNANCE.md](../GOVERNANCE.md)）权威优先级矩阵第 6 层（research / history）：**只用于"过去是什么样、为什么被取代"的历史调查，不参与实现裁定**。当前生效的真相源（产品 / spec / ADR / 已批准设计）一律不得放在此处。

归档按年份组织（`docs/archive/YYYY/<origin>/`）。被取代的文档在 frontmatter 用 `superseded_by` / `redirect` 指向替代者。归档保留 Git 历史，不删除原始提交。

## 2026 年归档分组

| 分组 | 内容 | 替代品（replacement） |
| --- | --- | --- |
| [2026/reading-completion/](2026/reading-completion/README.md) | 「无侧栏墨页第 5 轮：阅读完成时刻」设计探索命题 `PLAN.md` 与审查日志 `PLAN-REVIEW-LOG.md`。是一轮设计探索而非全局计划，文件名易误导 Agent。 | [docs/delivery/roadmap.md](../delivery/roadmap.md)（路线图）、[docs/product/vision.md](../product/vision.md)（愿景） |
| [2026/legacy-requirements/](2026/legacy-requirements/README.md) | v2.4 之前的历史需求 / 质量 / 早期设计稿共 9 份（原散落于 `docs/archive/` 根部）。 | [docs/product/README.md](../product/README.md)（产品方向）、`openspec/specs/`（功能行为真相源） |
| [2026/legacy-docs/](2026/legacy-docs/README.md) | 2026 迁移后 `docs/` 根部遗留的历史稿共 8 份（计划 / 评审 / 质量 / 来源 / 架构稿）。 | 见各文件 `superseded_by`（[分组 README](2026/legacy-docs/README.md) 表格） |

## 仍保留在活树的 superseded 入口

以下文件**未移动、未删除**，原地标记 `status: superseded`、`source_of_truth: historical`、`superseded_by: docs/product/`（并含 `redirect`），作为 superseded 入口保留，待链接改写（任务 12）与迁移核对（任务 13）后再处置：

- `docs/CORE-REQUIREMENTS-clairis.md`（v2.4 全量副本；仓库根目录同源副本已于方案 A（2026-08）删除，哈希留档见 [MIGRATION-REPORT](../MIGRATION-REPORT.md) §四）

## 相关索引

- [2026 年归档说明](2026/README.md)
- [文档治理规范](../GOVERNANCE.md)
- 当前产品方向：[docs/product/README.md](../product/README.md)
- 当前产品路线图：[docs/delivery/roadmap.md](../delivery/roadmap.md)
