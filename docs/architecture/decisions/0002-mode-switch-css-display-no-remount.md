---
title: 模式切换用 CSS display 非 remount
type: adr
status: accepted
last_updated: 2026-08-01
---

# ADR 0002 — 模式切换用 CSS display 非 remount

- **Status**: accepted
- **Date**: 2026-08-01

## Context

preview / edit / source 三种模式需要频繁切换。若在切换时按条件渲染重建编辑器组件，CodeMirror 6 的 `EditorView` 会被销毁重建，丢失 undo 历史、光标选区与编辑状态，用户体验断裂。

## Decision

模式切换使用 CSS `display` 显隐（`display:none` / `display:block`），**不 remount** 编辑器组件、不重建 `EditorView`。阅读模式显示 `PreviewView` 时，编辑器容器被隐藏而非卸载。

实现见 `src/components/Content/ContentArea.tsx`：编辑器容器在 preview 时 `display:none`，`PreviewView` 仅在 preview 时渲染；装饰的启用/禁用通过 `decorCompartment.reconfigure` 完成，而非重建视图。

## Consequences

- 切换模式后 undo 历史、选区、编辑状态完整保留。
- 编辑器实例常驻内存，需自行管理其生命周期（创建一次、卸载时销毁）。
- 禁止将模式切换改写为条件渲染重建 `EditorView`（见 `AGENTS.md` 约束）。

## 关联

- 现状佐证：`docs/architecture/overview.md` §二、§三。
- 摘要登记：`CONTEXT.md` §二 决策 #2。
