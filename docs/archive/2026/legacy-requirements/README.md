---
title: "归档分组：历史需求稿（legacy-requirements）"
type: archive
status: archived
last_updated: 2026-08-01
source_of_truth: historical
---

# 归档分组：legacy-requirements（v2.4 之前历史需求 / 质量稿）

## 这个分组是什么

本分组收纳 Clairis（旧名 Folio / MDWRT / 渐明）在 v2.4 之前产生的**历史需求稿、质量管控稿与早期设计/移交文档**。这些文件此前散落在 `docs/archive/` 根部，现归入 `docs/archive/2026/legacy-requirements/`。文件用 `mv` 整体移动，正文逐字节未变（移动前后 sha256 一致）。

## 文件清单

- `CORE-REQUIREMENTS-v3-archived.md` — 核心需求文档 v3。
- `CORE-REQUIREMENTS-v4-archived.md` — 核心需求文档 v4（渐明）。
- `CORE-REQUIREMENTS-V4-2-archived.md` — 核心需求文档 v4（Folio 命名期）。
- `CORE-REQUIREMENTS-渐明-archived.md` — 完整需求整合文档（渐明期）。
- `HTML-SUPPORT-DESIGN.md` — HTML 支持设计概要（Folio）。
- `QUALITY-IMPROVEMENT.md` — 质量管控加强方案。
- `markdown阅读器.md` — 早期 markdown 阅读器调研稿。
- `no-sidebar-desk-file-list-proposal.md` — 无侧栏 Desk 与文件列表改进方案（已被收敛方案取代）。
- `渐晰Markdown 阅读编辑器 会话移交文档.md` — 会话移交文档。

## 为何归档（不再参与裁定）

- 这批是 v2.4 之前的历史需求与质量稿，版本已被取代，其中多处引用已不存在的旧 `doc/` 路径与旧执行计划，若当作现状会误导实现。
- 按治理规范，归档内容属权威优先级矩阵第 6 层（research/history），**只用于历史回溯，不参与实现裁定**。

## 替代品（replacement）

| 想了解 | 去这里 |
| --- | --- |
| 当前产品方向、愿景、范围 | [docs/product/README.md](../../../product/README.md) |
| 功能行为真相源（canonical spec） | `openspec/specs/`（仓库根 `openspec/specs/`） |
| 当前产品路线图 | [docs/delivery/roadmap.md](../../../delivery/roadmap.md) |

> 说明：v2.4 全量需求副本 `docs/CORE-REQUIREMENTS-clairis.md` 未移动，原地标记 `status: superseded`、`source_of_truth: historical`、`superseded_by: docs/product/`，作为 superseded 入口保留，待链接改写与迁移核对（任务 12/13）后再处理。仓库根目录同源副本已于方案 A（2026-08）删除，哈希留档见 [MIGRATION-REPORT](../../../MIGRATION-REPORT.md) §四。

## 上级索引

- [2026 年归档](../README.md)
- [归档总索引](../../README.md)
