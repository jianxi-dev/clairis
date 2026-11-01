---
title: 配置三层与快照回滚
type: adr
status: accepted
last_updated: 2026-11-01
---

# ADR 0006 — 配置三层与快照回滚

- **Status**: accepted
- **Date**: 2026-11-01

## Context

现状是单个平铺的 `app_config.json`：所有设置项与派生状态（最近文件、滚动位置）混在一个文件，整文件覆盖写，没有默认层/用户层之分，没有快照，没有校验。这挡着产品铁律 D6（一切可变状态皆文本）与 D7（AI 可塑但必须可撤销）：AI 直接改文件没有回滚点，应用写入没有原子性，改坏只能手工翻找。

## Decision

采用**配置三层 + 原子写 + 快照 + 校验回滚 + 热应用**：

- **配置分层**：`defaults/settings.json`（随包只读）、`user/settings.json`（用户与 AI 可写）、`state/state.json`（派生状态）。有效配置 = defaults ⊕ user（user 覆盖同名键）。
- **原子写**：写临时文件再 rename；任一步失败保留原文件，不产生半截 JSON。
- **快照**：每次成功写 user 配置前，先把当前 user 文件复制进 `snapshots/`，保留最近 10 份。
- **校验**：非法值（字号 8–96、阅读宽度 480–2400、比例 0–1、主题/皮肤枚举）拒绝写入并返回错误，磁盘不变。
- **回滚命令**：`list_config_snapshots` / `restore_config_snapshot`（恢复前先给当前状态拍一份快照）。
- **热应用**：`user/settings.json` 被外部改动后 1 秒内向前端发 `config-changed` 事件。
- **迁移**：首次启动把旧 `app_config.json` 拆成 user + state，旧文件保留。

## Consequences

- AI 改配置有回滚点，应用写入有原子性，满足 D6/D7/D8。
- 配置是全局状态，迁移与并发写都必须可回滚；监听用父目录轮询 + 文件名过滤，规避 rename 丢 watch。
- 旧 `app_config.json` 只读迁移，`load_config` / `save_config` 命令名与 `AppConfig` 结构保持不变，前端既有调用不动。

## 关联

- 产品铁律：`docs/product/principles.md` D6/D7/D8。
- 进行中变更：`openspec/changes/text-config-layer/`。
- 摘要登记：`CONTEXT.md` §二 决策 #6。
