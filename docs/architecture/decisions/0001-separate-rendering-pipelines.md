---
title: 阅读/编辑分离（双渲染管线）
type: adr
status: accepted
last_updated: 2026-08-01
---

# ADR 0001 — 阅读/编辑分离（双渲染管线）

- **Status**: accepted
- **Date**: 2026-08-01

## Context

Biaoyue 同时要满足两种体验：阅读时追求极致排版（富文本式呈现），编辑时保留纯文本 Markdown 的轻量与可移植。若用单一组件兼顾二者，编辑器要么牺牲排版表现力，要么把复杂的富文本状态引入存储与序列化。

## Decision

采用两条相互独立的渲染管线：

- **阅读管线**：`src/renderers/`，Markdown 经 `marked` 解析、`DOMPurify` 白名单清洗后由 `PreviewView` 渲染（见 `src/renderers/markdown.ts`）。
- **编辑管线**：CodeMirror 6（`src/editors/`），直接编辑 Markdown 源文本并叠加装饰。

阅读管线只读、无编辑交互状态；编辑管线不承担最终排版。

## Consequences

- 阅读排版不受编辑器能力限制，可独立优化呈现质量。
- 两条管线代码各自演进，复杂度被隔离；代价是同一份内容有两套渲染逻辑需要分别维护。
- 安全边界集中在阅读管线的 `DOMPurify` 白名单。

## 关联

- 现状佐证：`docs/architecture/overview.md` §二。
- 摘要登记：`CONTEXT.md` §二 决策 #1。
