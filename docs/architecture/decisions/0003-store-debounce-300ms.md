---
title: store→CM6 同步 debounce 300ms
type: adr
status: accepted
last_updated: 2026-08-01
---

# ADR 0003 — store→CM6 同步 debounce 300ms

- **Status**: accepted
- **Date**: 2026-08-01

## Context

编辑器（CM6）与状态层（Zustand store）之间需要双向同步内容。若在每次按键（keystroke）都把内容同步到 store，会触发高频的状态更新与重渲染，带来明显的性能开销。

## Decision

编辑器内容回写 store 采用 **debounce 300ms** 的节奏，避免每个 keystroke 都触发同步。编辑侧的变更监听仍即时生效，但向 store 落内容以 300ms 防抖收敛。

## Consequences

- 打字时的重渲染与序列化压力显著降低。
- store 中的内容相对编辑器存在最多 ~300ms 的滞后；依赖 store 内容即时一致的逻辑（如保存）需感知该延迟。
- 300ms 为固化决策值，调整需经新 ADR。

## 关联

- 现状佐证：`docs/architecture/overview.md` §四。
- 摘要登记：`CONTEXT.md` §二 决策 #3。
