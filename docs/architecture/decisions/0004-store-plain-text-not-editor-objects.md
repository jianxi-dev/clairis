---
title: store 存纯文本，不存编辑器对象
type: adr
status: accepted
last_updated: 2026-08-01
---

# ADR 0004 — store 存纯文本，不存编辑器对象

- **Status**: accepted
- **Date**: 2026-08-01

## Context

标签内容需要在 Zustand store 中保存。CodeMirror 6 的 `EditorView` 是带 DOM 绑定与内部可变状态的对象，若直接放入 store，会让序列化、跨页签切换、会话恢复都依赖具体编辑器实例，难以持久化且容易泄漏。

## Decision

- **store 只存纯文本** `content`（字符串），不存 `EditorView` 等编辑器对象。分屏/多面板时按 tab 存各自的文本。
- `EditorView` 实例保存在模块级 `Map<panelId, EditorView>`（`src/editors/editorRef.ts`），通过 `panelId` 存取，与 store 解耦。

## Consequences

- store 是纯数据，序列化、跨页签、恢复都简单且可预测。
- 编辑器实例与文本状态分离：文本变更经 `updateListener` 回写 store（见 `ContentArea`），切换页签/文件时再把 store 文本灌回编辑器。
- 模块级 Map 需要显式管理实例注销，避免悬挂引用。

## 关联

- 现状佐证：`docs/architecture/overview.md` §三、§四。
- 摘要登记：`CONTEXT.md` §二 决策 #4。
