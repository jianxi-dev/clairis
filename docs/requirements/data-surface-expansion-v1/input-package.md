---
title: "data-surface-expansion-v1 需求输入包（L-1 五条契约）"
type: requirements
status: active
last_updated: 2026-11-26
---

# 需求输入包（L-1 契约门自证）

> 本 change 属「对标/学习」（Omarchy 扩展点模型 / 插件机制对标）+ 新需求线，按 `docs/agents/quality-gates.md` L-1 交付五条契约证据。

## 1. 来源可追溯

| 来源 | 类型 | 支撑的决策 |
|---|---|---|
| issue #1496（spec，含 `## 输入对账` 评论） | 用户需求（已确认） | 面注册表抽象、三面范围、六处菜单、改名许可、UI 图标限定、键位后置 |
| `docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` §4 B2/B5/B6、§5.2、§6 第三批 | 已评审设计稿（探索层） | 菜单/胶囊/图标三面提取方向；map 型逐键合并 / list 型整体替换；批次归属 |
| `docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md` §5 第二批 | 已评审设计稿（探索层） | 配置型插件与数据文件化正交；本 change 承载配置值落点 |
| `openspec/changes/archive/2026-11-25-data-surface-contract-v1/design.md:99-101` | 归档 change（P0） | P1 留白：「全局 registry JSON / schema codegen / `surface:new`（P1）」 |
| `src-tauri/src/surfaces.rs:29` 注释 | 一手代码 | 「新增面时在此加变体，并在三处登记（P1 再抽象为注册表）」 |
| Codex 对抗评审（P0，2026-11-25，#17「先样板后抽象」裁定） | 独立外部评审 | 先样板后抽象的顺序；本变更是 P1 抽象的落地 |

## 2. 空白显式化（open-question）

| 开放问题 | 状态 | 阻断范围 |
|---|---|---|
| 菜单面第六处「AI 浮窗」指哪个菜单 | **已裁决**：AI 小窗（`AiBubble`）无独立 ⋯ 菜单，其菜单是 `AiConversation` 的「预设」菜单（`SPEC_PRESETS` 六项，`src/components/ai/AiConversation.tsx:134-180`）；菜单面第六处 = 该预设菜单 | 不阻断（见 §默认裁决 1） |
| 用户覆盖面文件位置 | **已裁决**：新面独立 `user/<id>.json`，不塞 `settings.json`（避免与 `htmlToolbarItems` 的 settings 字段语义混淆） | 不阻断 |
| 图标面合并语义 | **已裁决**：map 型逐键深合并（沿用 `merge_json` 对象递归语义），未覆盖概念键保留默认 | 不阻断 |
| 菜单/胶囊合并语义 | **已裁决**：list 型整体替换（沿用 `merge_json` 数组整体替换语义 + P0 html-toolbar 范式） | 不阻断 |
| 键位面基线 | **已裁决**：后置；设计稿 02 §4 B1 称 `src/lib/keybindings.ts` 不存在，实际为 `src/lib/shortcuts.ts`（573 行） | 不阻断（本批不做） |

## 3. 一手证据

- `src-tauri/src/surfaces.rs:29`：`SurfaceId` 枚举 + `surfaces()` / `default_file_name()` / `user_override()` 三处 match（P1 抽象对象）。
- `src/lib/paneHeaderMenu.ts:45/56/69`：`PANE_MENU_ITEMS`（6 项）/ `EXPORT_MENU_ITEMS`（6 项）/ `AI_PANE_MENU_ITEMS`（1 项）三张常量表（菜单面现状）。
- `src/components/TabBar.tsx:701-900`：页签右键菜单硬编码项（悬浮小窗 / 向右分栏 / 向下分栏 / 添加字段 / 导出子菜单 / 打印 / 复制路径 …）。
- `src/components/Content/PreviewView.tsx:593-743`：预览右键 `contextItems`（打开所在文件夹 / 另存为 / 复制文件路径 …）。
- `src/components/ai/AiConversation.tsx:134-180`：AI 对话「预设」菜单（`SPEC_PRESETS`）。
- `src/ui/icons.ts`：`ICONS: Record<IconName, IconDef>`，`IconDef { d?, s?, dash?, parts?, label }`（图标面现状；不含 `src/editors/icons.ts`）。
- `src/editors/orchestration/floating-toolbar.ts:825-841`：`capsuleItems()` 12 项常量（胶囊面现状）；`CapsuleItem { id, label, icon, run }`（`capsule-toolbar.ts:11-16`）。
- `src-tauri/src/ai_agent.rs:278`：`parse_surface_id` 面白名单现状仅 `html-toolbar`（AI 通路现状）。
- `src-tauri/src/config.rs:390-396`：`merge_json` 对数组整体替换（合并语义一手证据）。
- `src/lib/shortcuts.ts`（573 行，`SHORTCUTS` 常量表）：键位面真实基线（`src/lib/keybindings.ts` 不存在）。

## 4. 冲突显式

| 冲突 | 裁定 |
|---|---|
| 设计稿 02 §4 B1 称 `src/lib/keybindings.ts`（86 行） | **事实更正**：该文件不存在；实际键位表为 `src/lib/shortcuts.ts`（573 行，`SHORTCUTS` + `ShortcutDef` 带 `scope`）。键位面后置时以 `shortcuts.ts` 为基线（issue #1496 Further Notes 已留痕） |
| issue #1496 列「AI 浮窗」为菜单面第六处，但代码中 AI 小窗无独立 ⋯ 菜单 | 裁决：第六处 = `AiConversation` 的「预设」菜单（`SPEC_PRESETS`）；AI 小窗本身无菜单可迁移（见 §默认裁决 1） |
| 设计稿 02 §4 B8「导出配置」与菜单面 `EXPORT_MENU_ITEMS` 重叠 | 裁决：`EXPORT_MENU_ITEMS` 是菜单项（不是导出设置），归并菜单面；`exportFormat` 零命中，无导出设置可文件化 |
| 设计稿 02 §4 B6 称图标注册表含 `src/editors/icons.ts` | 裁决：本批只做 `src/ui/icons.ts`（用户指令「先只做本批UI图标」）；`src/editors/icons.ts` 后置 |
| 胶囊（B5）与 HTML 工具条（B4）易混 | 裁决：胶囊面 ≠ html-toolbar；`selectionToolbar: "roulette"|"capsule"` 切换已存在，胶囊面只覆盖 capsule 分支 |

## 5. 验收锚点

锚点在 change 的 `anchors.md` / `conformance.json` 逐条落（M0 机检），来源标记为本文件 §3 一手证据行号与 §1 设计稿条款。关键锚点预览：

- 面登记表追加新面后 `load_all` 返回 4 面，无需改枚举或三处 match（来源：`surfaces.rs:29` 一手证据）
- 菜单改名生效：格头菜单显示「查看源码」，不含「源码模式」（来源：`paneHeaderMenu.ts:45` 现值）
- 六处消费端同源：改 `menus.json` 后 1 秒内六处呈现新集合（来源：DS-5/DS-8）
- 图标改名/换路径/新增概念键生效（来源：`Icon.tsx` 消费 + `icons.ts` 的 `IconDef`）
- 胶囊按钮集可配置：改 `capsules.json` 后选区工具条按钮变化（来源：`floating-toolbar.ts:825-841` 现 12 项）
- AI 面白名单 1→4；未登记 id 拒绝（来源：`ai_agent.rs:278` 现一面）

## 默认裁决

| # | 裁决 | 理由 |
|---|---|---|
| 1 | 菜单面第六处「AI 浮窗」= `AiConversation` 的「预设」菜单（`SPEC_PRESETS` 六项） | issue #1496 把它列为六处之一；代码中 AI 小窗（`AiBubble`）无独立 ⋯ 菜单，唯一可迁移的 AI 浮窗菜单是预设菜单。若用户本意是别的菜单，属范围变更，需回 issue 确认 |
| 2 | 新面用户覆盖面独立 `user/<id>.json` | 避免与 `htmlToolbarItems` 的 settings 字段语义混淆；新面项形状各异，塞 settings 会让 `patch_config` 的 allowlist 与面校验器双头维护 |
| 3 | 菜单/胶囊 list 型整体替换；图标 map 型逐键合并 | 沿用 `merge_json` 既有语义（数组整体替换 / 对象递归）与 P0 html-toolbar 范式；顺序即语义，逐键合并无法定义顺序 |
| 4 | 面注册表用 Rust 常量表 + TS 常量表，对账测试锁定 | P0 裁定不引入 JSON Schema 运行时；手写类型 + 对账测试是本仓既有范式 |
| 5 | `surface:new` 落点 `scripts/surface-new.sh` | 与既有 `scripts/cw-*.sh` 同目录；不引入新运行时依赖 |
