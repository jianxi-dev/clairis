---
title: 场景化外壳与 Pane 递归树取代旧扁平分屏
type: adr
status: accepted
last_updated: 2026-11-06
---

# ADR 0011 — 场景化外壳与 Pane 递归树取代旧扁平分屏

- **Status**: accepted
- **Date**: 2026-11-06
- **Implemented by**: change `layout-portal`（PR #204–#209）

## Context

旧外壳是扁平的两栏/三栏布局：没有 `scene` 概念，门户/网格/设置与工作区并列而非覆盖；分屏只有单一 `splitDirection` + `splitTabIds`（`src/stores/index.ts` 的旧字段），每格一个页签、无递归、无全屏、无拖拽换位；左侧导航是旧「无侧栏」方向的遗留。布局规格 v1.0 定稿（`docs/design/approved/layout-portal/spec.md`）后，旧扁平分屏无法表达 N 栏递归、每格多页签、全屏与拖拽换位，也未定义场景切换时工作区的保留语义。

## Decision

1. **场景化外壳**：顶层 `scene`（`portal` / `workspace` / `grid` / `settings`）。workspace 是常显底座，portal/grid/settings 以 `fixed inset-0` 覆盖层挂载，切换场景**不卸载工作区**（保留 EditorView、选区、undo 历史与滚动位置）。`?` 总览是独立浮层；设置用 `settingsReturnRef` 记录并返回上一场景。
2. **Pane 递归树**：`PaneLayout`（node/leaf）取代扁平分屏字段。每 leaf 多页签、可递归分裂（⌘⌥→ / ⌘⌥↓）、⌘⇧↵ 全屏、拖拽换位（中心互换 / 四边移动 / 移到根层）、最小 240px。旧 `splitDirection` / `splitTabIds` / `splitActiveTabId` 等字段并存（expand，待收编后 contract）。
3. **视图规格持久化集中化**：rail / preview / grid / icon / AI 视图规格合并进 Rust 应用配置字段 `railViewSpec` / `previewSettings` / `aiViewSpec`（及 `paneLayout`），而非设计稿 §13 的独立 `rail.json` / `grid.json` / `preview.json` 文件。
4. **移除旧三栏外壳**：旧扁平分屏外壳移除（PR #204）；阅读空间由 [ADR 0009](./0009-collapsible-reading-rail-supersedes-no-sidebar.md) 的可折叠阅读空间承担。

## Consequences

- 好：场景切换零成本（不重建 EditorView）；pane 树支持任意递归分栏；视图规格集中在一份配置里，AI 改写与撤销/快照只需处理一个对象。
- 代价/偏离：视图规格**未**落为设计稿 §13 的独立文件，而是配置字段（见 `docs/architecture/overview.md` §七）。当前实现即真相，设计稿的文件形态为后续可选项。
- 代价：旧 `split*` 字段仍存于 store（历史兼容），待收编。
- 周边：扩展包（`extensions/<id>/{manifest.json, SKILL.md}`，`.disabled` 停用标记，AI 系统提示消费）与快捷键注册表（`src/lib/shortcuts.ts` 单一真相源）构成外壳的其余部分。

## 关联

- 批准设计：[layout-portal/spec.md](../../design/approved/layout-portal/spec.md)（§1 场景图 / §3 pane 树 / §13 持久化）。
- 前置 ADR：[ADR 0009](./0009-collapsible-reading-rail-supersedes-no-sidebar.md)（可折叠阅读空间）、[ADR 0002](./0002-mode-switch-css-display-no-remount.md)（模式切换不 remount）。
- 验收记录：[layout-portal-acceptance.md](../../delivery/layout-portal-acceptance.md)。
