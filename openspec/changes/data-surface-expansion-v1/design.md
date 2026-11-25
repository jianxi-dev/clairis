# Design: 数据面扩展 v1（面注册表 + 菜单/图标/胶囊三面）

## Context

P0（`data-surface-contract-v1`）落地了 html-toolbar 单面：`SurfaceId` 枚举 + `surfaces()` / `default_file_name()` / `user_override()` 三处 match + 前端 loader 面清单。再加一个面要改四处代码（`src-tauri/src/surfaces.rs:29` 注释自述「P1 再抽象」；归档 change `design.md:99-101` 留白）。

本变更把「面」抽象为登记数据，并用它迁移三类界面结构：

| 面 | 现状一手证据 | 项形状 |
|---|---|---|
| 菜单 | `src/lib/paneHeaderMenu.ts:45/56/69` 三张常量表（PANE 6 项 / EXPORT 6 项 / AI_PANE 1 项）；页签右键 `src/components/TabBar.tsx:701-900`；预览右键 `src/components/Content/PreviewView.tsx:593-743`；AI 浮窗 `src/components/ai/AiConversation.tsx:134-180`（预设菜单） | `menu-item`（id/label/icon/action/enabled/order） |
| 图标 | `src/ui/icons.ts` 的 `ICONS: Record<IconName, IconDef>`，`IconDef { d?, s?, dash?, parts?, label }`（`src/ui/icons.ts` IconDef 定义） | `icon`（概念键/label/path 组） |
| 胶囊 | `src/editors/orchestration/floating-toolbar.ts:825-841` 的 `capsuleItems()` 12 项常量；`CapsuleItem { id, label, icon, run }`（`capsule-toolbar.ts:11-16`） | `capsule`（id/label/icon/order） |

设计依据：`docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` §4 B2/B5/B6、§5.2（map 型逐键合并 / list 型整体替换）、§6 第三批；`01-plugin-capability-extraction.md` §5 第二批。设计稿属探索层，本文件承载裁决。

## Goals / Non-Goals

**Goals:**

- 新增面 = 登记数据（面 = `{id, 默认文件名, 项形状, 校验器}`），不改 Rust 枚举与三处 match、不改前端 loader 面清单。
- 三个面各自走完整闭环：默认文件 → 用户覆盖 → 面级热应用 → AI 读写 → 回滚。
- 菜单项与图标的显示名称（label）由面数据提供，UI 不再硬编码文案。
- `surface:new` 脚手架让 AI 新增面不再手抄样板。

**Non-Goals:**

- 轮盘面（用户指令：暂停）、`readingMode` 文件化（单点后置）。
- 键位面 `keybindings.json`（依赖 `App.tsx` 按键分发重接线；且设计稿 02 §4 B1 称 `src/lib/keybindings.ts` 86 行——**该文件不存在**，实际键位表为 `src/lib/shortcuts.ts` 573 行，以其为基线）。
- 编辑器图标 `src/editors/icons.ts`（与 UI 图标两套 ICONS 职责不同，本批只做 `src/ui/icons.ts`）。
- 块菜单 `block-menu`（CM6 内嵌 flyout，非声明式菜单表）。
- 插件贡献 / 权限 / manifest v2（P2）、schema codegen / JSON Schema 运行时（沿用 P0 裁定：手写类型 + 对账测试）。

## Decisions

### D1 面注册表最小单元

- 面 = `{id, 默认文件名, 项形状(shape), 校验器}`。Rust 端 `surfaces.rs` 用一张 `SURFACES: &[SurfaceSpec]` 表驱动：`load_all` 遍历该表，`default_file_name` / `user_override` / `embedded_defaults` 由 spec 分派，删除 `SurfaceId` 枚举 + 三处 match。
- 前端 `src/lib/dataSurfaces/loader.ts` 的已知面清单同样由该数据派生（`SUPPORTED_SURFACES` 常量，与 Rust 表对账测试锁定）。
- **替代方案**：每面复制 html-toolbar 样板（被否：与 issue #1496「新增面 = 登记数据不改样板」冲突）；全局 registry JSON + schema codegen（被否：P0 裁定不引入 JSON Schema 运行时，手写类型 + 对账测试）。

### D2 项形状（shape）异形共存

- `menu-item`：`{id, label, icon, action, enabled, order}`。`action` 是代码侧动作 id（D3 混合面：数据声明顺序/可见性/文案，代码声明动作）。
- `icon`：`{key, label, d?, s?, dash?, parts?}`。`key` 是概念键（对应 `IconName`）；`label` 是显示名称。
- `capsule`：`{id, label, icon, order}`。`id` 对应代码侧动作（`capsule-font` / `capsule-bg` / 格式动作 id）。
- 形状随面登记，由面自己的校验器拒绝非法项（缺字段 / 类型错 / 未知 action → 过滤 + 聚合告警）。
- **替代方案**：统一用 `SurfaceItem { id, label, icon, group }`（被否：只适用工具条，表达不了 action/enabled/order 与图标 path 组）。

### D3 默认源唯一

- 仓库内 `resources/<id>.default.json`（构建内嵌 `include_str!`），物化到 `defaults/surfaces/<id>.json`；前端不留第二份默认常量。
- 菜单默认文件内容 = 现有三张表 + 页签右键 + 预览右键 + AI 浮窗预设菜单的并集（按消费端分组）。
- 图标默认文件内容 = `src/ui/icons.ts` 的 `ICONS` 全量（概念键 + label + path 组）。
- 胶囊默认文件内容 = `capsuleItems()` 现有 12 项。
- 删除 `paneHeaderMenu.ts` 的三张常量表与 `floating-toolbar.ts` 的 `capsuleItems()` 常量；消费端改读面。

### D4 用户覆盖与合并语义

- 用户覆盖：`user/<id>.json`（新面独立文件，不再塞 `settings.json`——避免与 `htmlToolbarItems` 的 settings 字段语义混淆）。
- 合并语义沿用面契约：按 id 合并、未知 id 过滤并聚合告警、空覆盖回落默认、坏文件回落内嵌。
- **数组整体替换**（沿用既有 `merge_json` 对数组整体替换语义，`config.rs:390-396`）——菜单/胶囊是 list 型，顺序即语义。
- 图标面是 map 型（概念键 → 定义），逐键深合并（沿用 `merge_json` 对象递归语义）：用户只覆盖某几个概念键的 label/path，未覆盖的概念键保留默认。
- **替代方案**：菜单/胶囊用逐键合并（被否：顺序即语义，逐键合并无法定义顺序；且 P0 html-toolbar 已是整体替换 + 未知 id 过滤，沿用同范式）。

### D5 面级热应用

- 复用 P0 的 `surfaces-changed(id)` 与 500ms `(mtime, len)` 指纹去抖，只重载对应面，不触发全量配置重放。
- watcher 扩展：监听全部已登记面的 defaults 物化文件与 `user/<id>.json` 覆盖文件。
- 前端 `store.ts` 按面缓存，事件到达只 `reloadSurface(id)`。

### D6 AI 工具白名单扩展

- `read_data_surface` / `patch_data_surface` 的面白名单从 `html-toolbar` 扩到四面。
- `patch_data_surface` 的补丁形状按面 shape 分派：html-toolbar 仍为 `{"items":[...]}`；menus/icons/capsules 为 `{"items":[...]}`（完整项对象数组，整体替换）。
- 写入仍走「校验 → 快照 → 原子写」，只写 user 覆盖，不改 defaults 物化文件。
- **替代方案**：新面各加工具（被否：AI 工具爆炸，且 issue 明确「统一工具读写三个面」）。

### D7 消费端接线

- 菜单消费端（格头/AI 窗格/导出子菜单/页签右键/预览右键/AI 浮窗）统一读菜单面，按 `group` 字段过滤出各消费端的项。
- `Icon` 组件按概念键查图标面：`label` 来自面数据（缺失回落 `ICONS` 默认 label）；path 组来自面数据（缺失回落 `ICONS` 默认 path）。
- `createCapsuleToolbar` 读胶囊面（`capsuleItems()` 改从面取，`run` 由代码侧按 id 分派）。
- 名称修改：菜单项与图标的 label 均由面数据提供；UI 不再硬编码文案。

### D8 `surface:new` 脚手架

- 一条命令生成：面的默认 JSON（`resources/<id>.default.json` 模板）、登记项（`SURFACES` 表一行）、数据面六栏表模板（写进 design.md 的 `## 数据面`）。
- 面作者只填形状与校验。
- 落点：`scripts/surface-new.sh`（与 `scripts/` 既有 cw-* 脚本同目录）。

### D9 兼容与迁移

- `htmlToolbarItems` 既有字段与设置页行为不变；html-toolbar 面语义不变（默认集合内容与顺序不变）。
- 菜单/图标/胶囊的默认值来源变化对用户不可见（顺序与文案不变）。
- 无 schemaVersion（本变更无迁移需求）。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | D1/D2/D3/D4/D5/D6/D7 | — | 本变更 anchors 逐条断言 |
| 存储 | src-tauri/src/resources/menus.default.json | SURFACE_DEFAULTS | 菜单默认集合唯一来源（include_str 内嵌 + 物化 defaults 层） |
| 存储 | src-tauri/src/resources/icons.default.json | SURFACE_DEFAULTS | 图标默认集合唯一来源 |
| 存储 | src-tauri/src/resources/capsules.default.json | SURFACE_DEFAULTS | 胶囊默认集合唯一来源 |
| 校验 | src-tauri/src/surfaces.rs | validate_surface | 形状校验：缺字段/类型错/未知 action 过滤并聚合告警 |
| 桥接 | src/lib/dataSurfaces/loader.ts | normalizeSurface | 默认←覆盖合并，未知 id 过滤+聚合告警，空回落默认 |
| 消费 | src/lib/paneHeaderMenu.ts | PANE_MENU_ITEMS | 消费面加载器输出，无常量兜底 |
| 消费 | src/components/Icon.tsx | Icon | 按概念键查图标面，label/path 缺失回落默认 |
| 消费 | src/editors/orchestration/capsule-toolbar.ts | createCapsuleToolbar | 读胶囊面，数组顺序即渲染顺序 |
| 回滚 | snapshots/ | restore_config_snapshot | 写前快照（沿用 10 份），一步恢复 |

票面第 8 字段（数据面）：T1=`存储,校验`；T2=`存储,桥接,消费`；T3=`消费`；T4=`消费`；T5=`规格`；T6=`校验`。

## Risks / Trade-offs

- **默认文件与常量双轨期**：`paneHeaderMenu.ts` 常量删除与消费端切换必须同一票完成，不留过渡态。→ 缓解：T2 单票完成「删常量 + 接面 + 测试」。
- **图标面 path 组校验**：`IconDef` 的 `d`/`s`/`parts` 是结构化字段，校验器需拒绝缺 `d`/`s`/`parts` 的项。→ 缓解：形状校验器 + 对账测试（默认文件 ↔ TS `IconDef`）。
- **AI 浮窗菜单位置**：issue #1496 列「AI 浮窗」为菜单面第六处，但代码中 AI 小窗（`AiBubble`）无独立 ⋯ 菜单，其菜单是 `AiConversation` 的「预设」菜单（`SPEC_PRESETS`）。→ 裁决：菜单面第六处 = AI 对话预设菜单（`src/components/ai/AiConversation.tsx:134-180`），默认项 = `SPEC_PRESETS` 六项。已在 input-package 记录。
- **事件与既有 config-changed 竞态**：`surfaces-changed` 只由面文件 watcher 触发；`config-changed` 仍只管 `user/settings.json` 全量重放，两事件消费端不同。→ 缓解：沿用 P0 裁定，不复用 `applyRustConfig`。
- **AI 写坏默认文件**：AI 工具只写 user 覆盖，不写 defaults 物化文件；defaults 文件损坏时回落内嵌。→ 缓解：沿用 P0 容错。
- **`surface:new` 生成物与手写漂移**：脚手架只生成模板，登记项与校验仍需手写。→ 缓解：模板含六栏表与登记项骨架，减少手抄。

## Migration Plan

- 无数据迁移：新面默认值来源变化对用户不可见（顺序与文案不变）。
- 回滚：面文件损坏回落内嵌默认；AI 写入走快照，可 `restore_config_snapshot` 一步恢复。

## Open Questions

- 无（本变更范围已在 issue #1496 输入对账确认；裁决见 `docs/requirements/data-surface-expansion-v1/input-package.md` §默认裁决）。
