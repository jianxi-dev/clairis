---
title: 门户与布局构建验收（layout-portal）
type: delivery
status: accepted
last_updated: 2026-11-06
source_of_truth: supporting
---

# 门户与布局构建验收（layout-portal）

> 对应 change `layout-portal`（spec issue #170 / 收尾票 #186）。逐条核查批准设计 [spec.md](../design/approved/layout-portal/spec.md) §14 的 12 条构建验收与设计哲学 §四的 12 条红线（下表已展开；设计哲学为本地工作文档，不在此重复外链）。
> 实现经 layout-portal 16/16 票合并（含收尾阶段的 #204–#209）；本文件是交付验收记录（supporting），功能行为真相源仍以 `openspec/specs/` 为准。

## 一、构建验收 12 条（批准设计 §14）

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 门户四块齐全，无「来源」 | 通过 | [e2e/portal.spec.ts](../../e2e/portal.spec.ts)「门户齐备…无「来源」」；`src/components/PortalView.tsx` |
| 2 | 工作区：N 栏递归分裂、每格多页签、全屏、拖拽换位/移动、四向落区、最小 240px、布局持久化 | 通过 | [e2e/pane-tree.spec.ts](../../e2e/pane-tree.spec.ts)（分裂/240px/全屏/持久化）、[e2e/pane-drag.spec.ts](../../e2e/pane-drag.spec.ts)（换位/移动/四向落区） |
| 3 | 阅读空间：三态、双布局、三密度（默认卡片+堆叠）、卡片规格、滑杆下拉含「设为默认」 | 通过 | [e2e/reading-rail.spec.ts](../../e2e/reading-rail.spec.ts)（三态/双布局/搜索）、[e2e/rail-cards.spec.ts](../../e2e/rail-cards.spec.ts)（三密度/卡片规格/设为默认） |
| 4 | 网格：下拉控件、bento 三型、缩略图优先、自适应文字、默认选中首卡、`j/k` 整行、`h/l` 行内、`Page` 整页、动态编号重算 | 通过 | [e2e/grid-overview.spec.ts](../../e2e/grid-overview.spec.ts)（下拉/bento/缩略图/首卡）、[e2e/grid-keyboard.spec.ts](../../e2e/grid-keyboard.spec.ts)（`j/k`/`h/l`/`Page`/编号重算） |
| 5 | 悬浮窗：真内容、四边四角缩放、贴栏右缘 x 恒定/y 跟行、拖动保持到关闭、hover 动作区、双开关独立 | 通过 | [e2e/floating-preview.spec.ts](../../e2e/floating-preview.spec.ts)（锚定/缩放/翻转/双开关/hover 动作区） |
| 6 | AI：唯一入口、小窗 285×260 右下、四边四角缩放、停靠/脱离、确认卡人话、撤销+快照、视图改写 | 通过 | [e2e/ai-forms.spec.ts](../../e2e/ai-forms.spec.ts)（唯一入口/小窗尺寸/停靠脱离/确认卡/撤销快照/预设） |
| 7 | 设置：左导航 10 区、跟随系统外观 | 通过 | [e2e/settings-scene.spec.ts](../../e2e/settings-scene.spec.ts)（10 区/跟随系统）、[e2e/settings-content.spec.ts](../../e2e/settings-content.spec.ts)（各区内容） |
| 8 | 扩展：拖入即用、导出、AI 生成 | 通过 | [e2e/extensions-manage.spec.ts](../../e2e/extensions-manage.spec.ts)（导入/开关/卸载/导出/AI 生成/取消） |
| 9 | 图标：universe-icon、标签三级、类型色、无 emoji | 通过 | [e2e/icon-system.spec.ts](../../e2e/icon-system.spec.ts)（类型色/无 emoji/图标抽屉/标签三级） |
| 10 | 快捷键：完整表可执行、tooltip 显示、`?` 总览 | 通过 | [e2e/shortcuts.spec.ts](../../e2e/shortcuts.spec.ts)（`?` 总览/全局 9 条/tooltip/注册表规则） |
| 11 | 哲学 12 红线全过 | 通过 | 本文件 §二（逐条证据） |
| 12 | 生成物离线单文件（contentweave 部分） | Out of Scope | 批准设计 §14 第 12 条 + §15「未定/延后」；contentweave 单文件生成不属于本 change，显式记录不阻塞 |

## 二、设计哲学 12 红线（设计哲学 §四）

| # | 红线 | 结果 | 证据 |
|---|---|---|---|
| 1 | 不交互时会显示多余的元素/文字/图标？→ 删或藏（P1） | 通过 | [e2e/rail-cards.spec.ts](../../e2e/rail-cards.spec.ts)「hover 只出右上角三钮」；[e2e/floating-preview.spec.ts](../../e2e/floating-preview.spec.ts)「底部动作区仅 hover 显示」 |
| 2 | 可见卡片能否数字直开 / 快捷键操作？→ 补（P2） | 通过 | [e2e/grid-keyboard.spec.ts](../../e2e/grid-keyboard.spec.ts)「⌘3 在当前格打开第 3 张编号卡」 |
| 3 | 路径能否点击穿透打开文件夹？→ 是（P2） | 通过 | [e2e/rail-cards.spec.ts](../../e2e/rail-cards.spec.ts)「路径点击调用 reveal_in_finder」 |
| 4 | 同概念是否复用唯一图标/颜色/键位？→ 是（P3） | 通过 | [e2e/icon-system.spec.ts](../../e2e/icon-system.spec.ts)「同一类型同形状、颜色严格等于类型色」；`src/lib/shortcuts.ts` 单一注册表 |
| 5 | 常用外露、不常用进「更多」？→ 是（P1/P3） | 通过 | [e2e/pane-header.spec.ts](../../e2e/pane-header.spec.ts)（⋯ 菜单恰 7 项）；[e2e/reading-rail.spec.ts](../../e2e/reading-rail.spec.ts)（滑杆下拉） |
| 6 | 默认位置/默认值可预测？→ 是（P3） | 通过 | [e2e/floating-preview.spec.ts](../../e2e/floating-preview.spec.ts)「拖动后关闭再触发：回默认锚定」；[e2e/rail-cards.spec.ts](../../e2e/rail-cards.spec.ts)（默认卡片 112px + 堆叠） |
| 7 | 该项调整无需改源码？→ 是（P4） | 通过 | 视图规格持久化于 Rust 配置字段（`railViewSpec` / `previewSettings` / `aiViewSpec`）；扩展包 `extensions/<id>/` |
| 8 | 误操作一步可逆？→ 是（P5） | 通过 | [e2e/ai-forms.spec.ts](../../e2e/ai-forms.spec.ts)「撤销条…撤销后规格相等」；[e2e/settings-content.spec.ts](../../e2e/settings-content.spec.ts)「快照…确认恢复」 |
| 9 | 文案是人话（无技术术语/字段名）？→ 是（P5） | 通过 | [e2e/ai-forms.spec.ts](../../e2e/ai-forms.spec.ts)「首弹人话确认卡」（文案「网格视图改为列表」） |
| 10 | AI 入口只有一个（顶栏）？→ 是（P1/P3） | 通过 | [e2e/ai-forms.spec.ts](../../e2e/ai-forms.spec.ts)「顶栏星芒是全站唯一 AI 入口」 |
| 11 | 新用户不看说明书能用？→ 是（默认即成品） | 通过 | [e2e/portal.spec.ts](../../e2e/portal.spec.ts)「空态：三动作」；默认值（卡片密度 / 堆叠 / 点击预览） |
| 12 | 生成物断网可看？→ 是（单文件零外部资源） | 不适用 | contentweave 单文件生成不属于本 change（批准设计 §14 第 12 条 Out of Scope、§15 延后） |

## 三、验证命令原始输出

### `npx openspec validate layout-portal --strict`

```
Change 'layout-portal' is valid
```

退出码 0。

### `npm run docs:check`

```
文档治理门禁 [gate] 根: /Users/mason/ToHighs/clairis
结果: 通过 ✓（退出码 0）
  (c) allowlist 完整性: OK（13 条）
  (a) 夹具套件: OK（14/14 通过）
  (b) 已治理域: OK（扫描 135，内容文档 78，豁免 57，违例 0，登记表降级 legacy 0）
  (d) openspec validate --all: OK（退出 0）
```

退出码 0。
