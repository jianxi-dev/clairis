---
title: API key 只存 OS keyring
type: adr
status: accepted
last_updated: 2026-08-01
---

# ADR 0005 — API key 只存 OS keyring

- **Status**: accepted
- **Date**: 2026-08-01

## Context

翻译等功能需要第三方 API key。配置文件（`app_config.json`）是明文磁盘文件，可能被备份、同步或误提交，把密钥写入其中会造成泄漏风险。

## Decision

API key **只存操作系统钥匙串（OS keyring）**，经由 Rust 命令 `get_api_key` / `set_api_key` / `delete_api_key` 读写，**不写入任何配置文件**。实现见 `src-tauri/src/commands/config_cmd.rs`。

## Consequences

- 密钥不落明文配置，降低泄漏面；日志同样不记录 API key。
- 密钥可用性依赖 OS keyring 后端，跨平台需各自适配。
- 前端获取密钥必须经命令通道，不能从配置对象直接读取。

## 关联

- 现状佐证：`docs/architecture/overview.md` §六、§七。
- 摘要登记：`CONTEXT.md` §二 决策 #5。
