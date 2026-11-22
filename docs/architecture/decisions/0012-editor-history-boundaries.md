---
title: 编辑器撤销历史边界三原则
type: adr
status: accepted
last_updated: 2026-11-22
---

# ADR 0012 — 编辑器撤销历史边界三原则

- **Status**: accepted
- **Date**: 2026-11-22
- **Implemented by**: change `editor-foundation-batch1`（#1335 回灌收口 / #1336 输入节流 / #1338 历史边界）

## Context

编辑器（CM6）与 store 双向同步，撤销历史是 `EditorState` 的一部分。落地本批前存在三个边界缺口：

1. `smart-input.ts` 的标题升降、列表缩进、智能回车、智能退格等结构 dispatch 不带 `userEvent`，一次结构意图会被 CM6 的默认分组（相邻且 500ms 内的 `input.type` / `delete`）拆散或并入相邻输入，撤销步数与用户心智不符。
2. 程序回灌（store → 编辑器）用 `addToHistory.of(false)` 不进历史，但没有 `isolateHistory`，会与相邻用户编辑并成一组，一次 ⌘Z 可能连带回退用户编辑。
3. `block-convert.ts` 的块转换事务同样无注解，转换与相邻输入共享分组。

ADR 0003 已裁定 store→CM6 内容同步采用 300ms 防抖，且 300ms 为固化值。

## Decision

### 三原则

1. **用户可感知变更必带 `userEvent`**：键入、删除、结构命令、撤销/重做各自带可读的 `userEvent`，历史分组只由显式注解决定。
2. **程序回灌不进历史，但必须切断相邻分组**：回灌事务 `addToHistory.of(false)` + `isolateHistory.of("before")`，既不入历史，也不与上一用户分组相连。
3. **结构命令每意图一个独立 undo 步**：标题升降、列表缩进、智能回车、智能退格、块转换各自成组。

### 结构事务助手

新增 `src/editors/structure-history.ts`：`structureTransaction(spec)` 给事务附加 `userEvent: "app.structure"` 与 `isolateHistory.of("full")`（`isolateHistory` 取值仅 `before` / `after` / `full`），并保留调用方已有 annotations。**绝不设 `addToHistory: false`**——结构命令必须留在历史里。

接入面：`smart-input.ts` 的 `demoteHeading` / `promoteHeadingOnLine` / `indentList` / `outdentList` / `smartEnter` / `smartBackspace`，以及 `block-convert.ts` 的 `dispatchBlockConvert`（块菜单与选区轮盘的转换）。拖拽重排 `moveBlock` 属批次 2，本批不接入。

### 内容快照节奏

300ms 防抖沿用 ADR 0003，不调整。新增 **2000ms 硬截止**（`CONTENT_SYNC_MAX_DELAY_MS`）：自首个待写变更起算，不随后续键入顺延，避免长会话中快照无限滞后。

### 键位

撤销/重做主键位 `Mod-Z` / `Ctrl-Z` 由 `historyKeymap` 与 `ctrlHistoryBindings` 承载；`Mod-[` / `Mod-]` 交回 `defaultKeymap` 的缩进语义。

## Consequences

- 结构命令「一个意图、一次撤销」；两次连续结构命令后一次 ⌘Z 只回退最后一次。
- 程序回灌不再与相邻用户编辑并组，回灌后一次 ⌘Z 只回退用户编辑。
- `isolateHistory` 成为历史边界的统一原语：结构命令用 `full`，程序回灌用 `before`。
- 300ms 仍是 ADR 0003 的固化值；2000ms 为本批新增截止，调整需经新 ADR。
- 助手只覆盖本批四类结构命令；未接入的结构类 dispatch（如拖拽重排）仍走普通历史分组。
- 回归网：`src/__tests__/editor/undoInvariants.test.ts`（确定性 50 步不变量）与 `e2e/structure-history.spec.ts`（真实键盘）。

## 关联

- 前置 ADR：[0003](./0003-store-debounce-300ms.md)（300ms 防抖）、[0004](./0004-store-plain-text-not-editor-objects.md)（store 存纯文本）。
- 变更设计：`openspec/changes/editor-foundation-batch1/design.md` D2 / D3 / D5。
- 规格：`openspec/changes/editor-foundation-batch1/specs/editing/spec.md` E-41。
