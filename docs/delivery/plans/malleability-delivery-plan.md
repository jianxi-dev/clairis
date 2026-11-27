---
title: "数据文件化 / 插件化 / 品质线：交付实施与对账方案"
type: delivery
status: draft
last_updated: 2026-11-27
source_of_truth: supporting
---

# 数据文件化 / 插件化 / 品质线：交付实施与对账方案

> 本文把 `docs/design/explorations/malleability-plan-v2.md`（2026-11-25，经 Codex 20 项对抗评审）落成可执行、可对账的实施版。v2 保留为评审记录；本文是**实施与验收的当前依据**。
> 状态图例：✅ 已完成 / 🚧 部分完成 / ⬜ 未开始。每项固定四段：**目标效果 → 具体做法 → 完成判据（机检 + 人工）→ 现状与成本**。

## 0. 总览与顺序

品质线放第一（用户 2026-11-27 裁定：交付品质是当前首要问题），其余按依赖排。

| 批次 | 项 | 状态 | 成本 | 依赖 |
|---|---|---|---|---|
| **B1 品质地基** | Q0 token 门禁 · Q1 四条交互条款 · Q4 交付验收模板 | ⬜ | 3 天 | 无（可与任何功能并行） |
| **B2 基件** | Q2 四基件 + `/showcase` · Q3 图标纪检 | ⬜ | 5 天 | Q0/Q1 |
| **B3 可发现可调用** | M1 命令目录 · M2 AI 发现与地图注入 | ⬜ | 4–7 天 | B1（Q0 的 token 约束） |
| **B4 迁移补口** | M3 反向棘轮 · M4 键位面 · M5 导出/新建默认 | ⬜ | 7–10 天 | M1 |
| **B5 插件** | M6 manifest v2 + 贡献注册 + 权限 | ⬜ | 6–9 天 | M1、M3 |
| **B6 管线补全** | M7 loader 元数据 + dir/package 形态 | ⬜ | 4–6 天 | 可并行 |
| **B7 治理示范** | Q5 专项治理闭环（px 字面量专项） | ⬜ | 2–3 天 | Q0（基线） |

---

## 1. 品质线（Q0–Q5）

### Q0 token 门禁 ⬜（1.5 天）

**目标效果**：新写的 UI 代码不允许出现裸色值；改主题只改 token；语义色对比度可机检。

**具体做法**
1. `src/styles/tokens.ts`：与 `tokens.css` 一一对应的类型化常量表（当前 99 个变量）。首版由脚本生成，此后手改需同步。
2. `scripts/check-tokens.mjs` 三项检查：
   - **A 裸色值**：扫 `src/components/**`、`src/editors/**` 的 `tsx/ts/css`，命中 `#rgb/#rrggbb/#rrggbbaa`、`rgb()/rgba()` 即失败（`tokens.css`/`tokens.ts` 豁免）。存量 452 处逐条进 `scripts/token-baseline.json`（file:line + 值 + 原因），**基线只减不增**。
   - **B token 对账**：`tokens.ts` 键集 == `tokens.css` 变量集；`src` 内每个 `var(--x)` 必须已定义。
   - **C 对比度**：解析语义对（ink-1/bg、ink-2/bg、accent/on-accent、status 四组），算 WCAG 比值；正文级 ≥4.5、大字/次要 ≥3、ink-1 ≥7。阈值写入 `docs/design/system/spec.md` 新增 §7.8。
3. 接线：`verify.sh` 新增「3c. Token Gate」；pre-commit 只跑 A（<1 秒）；CI `verify` job 跑全量。

**完成判据**
- 机检：`node scripts/check-tokens.mjs` 绿；故意在组件写 `#ff0000` → 退 1；删一个 token 定义 → 退 1；调低对比度 → 退 1 并列出对与数值。
- 人工：`spec.md` §7.8 条款存在；`verify.sh` 输出含 3c。

**现状**：⬜ 无 `tokens.ts`、无 `check-tokens.mjs`；`verify.sh` 现有 8 个检查段（tsc / eslint / vitest / css-manifest / docs-gate / cargo check / 两套 e2e），无色值门禁。

### Q1 四条交互条款 ⬜（1 天）

**目标效果**：把「零横线 / 反馈三档 / 禁用而非隐藏 / Esc 只退场」从口号变成可判定条款，并各有守护。

**具体做法**：新建 `docs/design/system/interaction.md`，每条含定义、正反例、守护指针；`spec.md` §8 的「不做交互规范」supersede 为「交互条款见 interaction.md」。
1. **零横线**：UI 分隔用间距/背景，不画 1px 横线；例外仅菜单分组线、表格边框（用 `--app-border`）。守护：新增 `border-top/bottom: 1px` 进基线，只减不增 + review 判据。
2. **反馈三档**：静默（状态自明）/ 轻提示（toast）/ 需确认（dialog）；禁止 `window.alert/confirm`。守护：grep 零命中 + toast 组件唯一入口。
3. **禁用而非隐藏**：条件不满足时控件保留且 `disabled` + 原因提示。守护：e2e 三条（无选区导出、AI 未配置、只读文档）。
4. **Esc 只退场**：Esc 只关闭最上层，不触发保存/删除。守护：e2e 逐层关闭断言。

**完成判据**：`interaction.md` 四条各带守护指针；`window.alert`/`confirm` 零命中；e2e 新增 ≥4 条且绿；§8 已 supersede。
**现状**：⬜ 无 `interaction.md`；`spec.md` §7.3 只有人工「审美七问」，§8 明确「不做交互规范」。

### Q2 四基件 + 样板间 ⬜（4 天）

**目标效果**：按钮、图标按钮、菜单、提示四类不再各域自造；浮层定位与关闭仲裁共享一套；规范有可点的对照场。

**具体做法**
1. `src/ui/primitives/`：
   - `Button.tsx`：`{variant: primary|secondary|soft|ghost|danger|danger-soft, size: sm|md, icon?, loading?, disabled?}`；样式在 `src/styles/primitives.css`，只用 token。**音量纪律：每屏 primary ≤1**（review 判据）。
   - `IconButton.tsx`：`{icon, label, size: 14|18}`，命中区 ≥24×24，`label` 必填（供 tooltip 与 aria）。
   - `Menu.tsx`：`items: {id,label,icon?,shortcut?,disabled?,run}[]`；定位抽 `useAnchoredPosition`（12 向 flip/shift，来自现有 `useMenuPos`）；关闭仲裁 `useLayerDismiss`；`PortalScope` 统一 portal。
   - `Tooltip.tsx`：收敛 `TooltipLayer` 的 DOM 探针测量为测量 hook；支持 above/below 自动翻转。
2. **迁移 Top3**（每类先替换重复最多的 3 处，不追求全量）：设置页按钮（现约 12 处散装）、页签右键菜单、编辑器工具条按钮、AI 面板按钮；逐域列清单勾销。
3. `/showcase` 路由（仅 dev）：4 基件 × 6 态（default/hover/active/disabled/loading/focus）× 明暗双主题；每态挂 `data-showcase` 锚点供 e2e 截图。

**完成判据**：`/showcase` 可打开；e2e 截 4 基件 × 6 态；迁移清单逐项勾；新代码 review 禁止自造 button 类字符串（列入 PR 模板）。
**现状**：⬜ `src/ui` 只有 `icons.ts`；全仓 236 个裸 `<button>`，无 `.btn*` 统一类；`useMenuPos` 只有视口/面板夹紧，无 12 向与嵌套仲裁。

### Q3 图标纪检 ⬜（1 天）

**目标效果**：尺寸只有 14/18/24 三档（12 仅角标）；同一动作永远同一图标；面/线不混用；两套图标表同源。

**具体做法**
- 现状盘点（实测）：`size={18}` 71 处、`14` 21 处、`24` 6 处、`12` 3 处。
- `scripts/check-icons.mjs`：① `src/ui/icons.ts` 与 `src/editors/icons.ts` 概念键集合相等；② 尺寸白名单（12 仅 3 处豁免清单）；③ 菜单/胶囊/块菜单的「动作 → 图标」映射唯一且都存在于两表；④ 无孤儿键。
- 11 个高频 18px 图标人工裁决一轮（面/线、笔画粗细），结论追加 `docs/design/system/decisions.md`。

**完成判据**：脚本绿；12px 仅豁免清单内；裁决表 11 行。
**现状**：⬜ 无脚本；两表有对账测试雏形但未覆盖尺寸与动作映射。

### Q4 交付验收模板 ⬜（0.5 天，随 Q0 一起）

**目标效果**：每次 UI 交付都有可核对的视觉与可靠性证据，而不是「编译通过」。

**具体做法**：`docs/delivery/ui-verification-template.md` 要求三件证据——① 截图对（明/暗 × 1280/400 窄窗，标出关键态）；② 关键路径 e2e 或手工步骤清单（逐步可复现）；③ 计算样式断言（字号/色值/尺寸来自 token，非肉眼）。接入 PR 模板与 G3「交付对账」：缺证据即退。

**完成判据**：模板存在；至少 2 个新 PR 按模板提交；PR 模板含三件证据勾选。
**现状**：⬜ 无模板；G3 交付对账只要求功能点清单。

### Q5 专项治理闭环（示范一次）⬜（2–3 天）

**目标效果**：证明「扫描 → 量化 → 分批修 → 规则沉淀 → 栅栏」闭环能跑通，可复制到其他专项。

**具体做法**：首个专项选**样式层 px 字面量**（实测 1247 处 / 80 种取值）。`scripts/check-px.mjs` 先 report-only 量化 → 按域分批替换为 token（先 4/8px 两个高频值）→ 数字进基线 → Q0 的 A 检查加「px 基线只减不增」。

**完成判据**：首期高频值替换完成；基线数字下降并锁死；一份 2 页专项复盘。
**现状**：⬜ 无脚本、无基线。

---

## 2. 已完成项（具体化，供对账）

### D1 补丁写边界与 state 保护 ✅（`data-surface-contract-v1`）

- **交付内容**：`apply_patch_at` 重写（删 state 写入、只写合并后的 user diff、返回真实有效配置）+ 写边界 allowlist（从 `AppConfig::default()` 序列化派生、嵌套递归、state 专属键拒绝、读取端保持宽松）。
- **关键文件**：`src-tauri/src/config.rs`（`apply_patch_at`、`validate_patch_keys`、`state_value`）。
- **可观察行为**：AI 补丁后「最近文件/阅读位置」不再丢；写错键名得到明确报错；user 层不出现未修改的默认键。
- **对账**：`cargo test --manifest-path src-tauri/Cargo.toml`（283 项）；测试名含 `patch` 与 `state` 字样的六条；CI `rust-tests`。
- **遗留**：无。

### D2 html-toolbar 单面样板 ✅（同 change）

- **交付内容**：默认按钮集合唯一来源迁 `src-tauri/src/resources/html-toolbar.default.json`（物化 defaults 层）；`surfaces.rs` 注册/合并/过滤/聚合告警；`load_surfaces` 命令 + `surfaces-changed(id)` 事件（500ms 指纹去抖）；前端 `src/lib/dataSurfaces/{loader,store}.ts` 按面缓存；删除 `slots.ts` 常量；`horizontal-toolbar.ts` 改读面。
- **可观察行为**：改面文件 1 秒内工具条变化；AI 说「工具条只留粗体和斜体」生效且可回滚；代码里无第二份默认数组。
- **对账**：`grep -r "HTML_TOOLBAR_ITEMS" src` 零命中；e2e `e2e/tauri/surfaces-events.spec.ts`；`load_surfaces` 返回项含 `html-toolbar`。
- **遗留**：无。

### D3 面注册表与 7 个面 ✅（`data-surface-expansion-v1` + 后续）

| 面 | 形状 | 合并语义 | 默认源 |
|---|---|---|---|
| `html-toolbar` | id 字符串数组 | 整体替换 | `resources/html-toolbar.default.json` |
| `menus` | 对象项（group/id/label/icon/action） | **按组替换** | `resources/menus.default.json` |
| `icons` | 概念键 → 定义 | 逐键深合并，接受新键 | `resources/icons.default.json` |
| `capsules` | 对象项 | 整体替换 | `resources/capsules.default.json` |
| `reader-presets` | 对象项（fontSize/width/skin） | **按 id 并入** | `resources/reader-presets.default.json` |
| `care-scale` | 对象项（scale） | 按 id 并入 + 步长归整 | `resources/care-scale.default.json` |
| `pane-modes` | 对象项（hotzone/reveal/hint） | 按 id 并入 | `resources/pane-modes.default.json` |

- **共享能力**：面级快照 `snapshots/surfaces/<id>/`（10 份）+ `restore_surface_snapshot`；面级热应用；`SUPPORTED_SURFACES` 与 Rust 表对账测试。
- **对账**：`grep -c "SurfaceSpec {" src-tauri/src/surfaces.rs` = 7；e2e 各面 spec（html-toolbar/menus/icons/capsules/reader-presets/pane-presets/pane-scale/pane-mode-surface）。
- **偏差（非遗漏）**：未建 `src/shared/data-surfaces.json` 全局 JSON 注册表，改用 Rust 静态表 + 前端对账（延续 Codex #17「先样板后抽象」）。

### D4 脚手架 ✅（`surface:new`）

- **交付内容**：`scripts/surface-new.sh`（形状闭集 menu-item/icon/capsule/toolbar/reader-preset；默认文件、登记行、六栏模板；幂等；dry-run）+ 自检 `surface-new.test.sh` 13 项。
- **对账**：`bash scripts/surface-new.test.sh` → 13 项全通过。
- **遗留**：不生成校验器/消费端（设计如此）。

### D5 已迁移的 UI 面与预设组 ✅

- `menus`：六处消费端（格头/ AI 窗格 / 导出子菜单 / 页签右键 / 预览右键 / AI 浮窗预设），按组替换 + action 白名单。
- `icons`：两套表同源 + 新增概念键（有效集合 135→136）。
- `capsules`：12 项对象项，`run` 按 id 分派。
- `reader-presets`：三套默认（紧凑/标准/宽屏），宽度步长归整，AI 可改。
- `care-scale` / `pane-modes`：档内参数可调（乘数 [0.8,1.5] 步长 0.05；热区 [12,24]、时长 [1000,10000]、提示线 [0,2]）。
- **对账**：各 change 已归档（`openspec/changes/archive/`）；`docs/delivery/requirements-status.md` 有逐条记录。

### D6 AI 数据面工具 ✅（6 个）

`read_config`、`patch_config`、`list_snapshots`、`restore_surface_snapshot`、`read_data_surface`、`patch_data_surface`。
- 行为：面白名单校验；`items:null` 恢复默认；按 id 并入；写前快照；越界拒绝且零写盘。
- **对账**：`grep -c '"name": "' src-tauri/src/ai_agent.rs`（tool_schemas 内 6）；Rust AI 用例（reader/care-scale/pane-modes 面各 2–3 条）。

---

## 3. 待完成项（具体化）

### M1 命令目录 ⬜（3–5 天）

- **目标效果**：全站动作有唯一 id 目录；菜单/工具条/轮盘/键位/插件都只引用命令 id；新增「插片段」这类动作不再改消费端代码。
- **做法**：`src/lib/commands/registry.ts` 定义 `CommandDef { id, label, icon, scope: global|editor|pane, when?, run, args? }`；`run` 按类型分派（`insertSnippet` / `applyTemplate` / `setConfig` / `runExport` / `openPath` / `aiPrompt`）。现 `editors/orchestration/commands.ts`（32 行，仅格式命令）并入；`menu_action_allowed` 从「默认菜单 action 集合」改为「命令目录白名单」。
- **判据**：新增一个声明式命令（插片段）只需加一条目录项 + 一个数据引用，菜单/工具条即可用；未登记 action 被拒；e2e 菜单项执行一次。
- **依赖**：无（B3 先做）。

### M2 AI 发现与地图注入 ⬜（1–2 天）

- **目标效果**：AI 自己知道「有哪些面、怎么改、示例是什么」，不再靠人告诉。
- **做法**：① 新增工具 `list_data_surfaces`，返回 `{id, path, shape, merge, writable, schemaVersion, example}`；② `run_agent_turn` 组装 system prompt 时注入：`SKILL_MAP` 生成物 + 面清单 + 用户备注（`SKILL.local.md`，不覆盖系统指令）；③ `SKILL_MAP` 从「只写」改为「生成 + 注入」，内容由 registry 驱动。
- **判据**：AI 在无提示下能答出「有哪些面、改菜单怎么写」；Rust 用例断言注入内容包含 7 个面 id；工具返回结构固定。
- **依赖**：无（与 M1 并行）。

### M3 反向棘轮门禁 ⬜（1–2 天）

- **目标效果**：不允许「数据面旁边又长出一份代码常量」。
- **做法**：`scripts/check-surface-constants.mjs` 只扫 3–5 个注册文件（`slots.ts`、`paneHeaderMenu.ts`、`shortcuts.ts`、`floating-toolbar.ts`、`exportActions.ts`），命中「数组/对象字面量含 id+label/icon」即失败；存量进 baseline；接 `verify.sh`。
- **判据**：新增一段硬编码菜单数组 → 退 1；基线只减不增。
- **依赖**：M1（命令目录稳定后基线才好定）。

### M4 键位面 ⬜（3–5 天）

- **目标效果**：键位可文件化，AI 可重映射；改错不半生效。
- **做法**：`resources/keybindings.default.json`（`{id, keys:{global?,local?}, command, when?}`）；校验：id 必须存在于命令目录、键冲突检测、作用域；应用时**重注册**并做半生效检测（注册后回读比对，失败整体回滚）。`shortcuts.ts` 常量迁面。
- **判据**：改文件重映射一个快捷键且重启保持；冲突键被拒并提示；半生效（部分注册失败）整体回滚。
- **依赖**：M1。

### M5 导出菜单 / 新建默认 ⬜（2–3 天）

- **做法**：`resources/export-menu.default.json`（`{id,label,icon,command,order}`）+ 消费端改读；新建默认迁 `resources/new-doc.default.json`（模板/文件名模式/初始内容），替代 `newDocVisible` 布尔。
- **判据**：改文件后导出菜单顺序/文案立即变化；新建文档套模板生效。
- **依赖**：M1。

### M6 插件 manifest v2 ⬜（6–9 天）

- **做法**：`ExtensionManifest` 增 `schemaVersion/kind/contributes/permissions/minAppVersion`；`contributes` 仅允许 D2 声明（菜单项/工具条项/主题 token/片段，全部引用命令 id 或数据面）；权限 scope 按面定义（`menus:add`、`theme:write`、`snippets:add`）；启用态迁 `settings.extensions.<id>.enabled`；旧包（5 字段）兼容读取；**零代码执行**。
- **判据**：一个包同时贡献菜单项 + 主题 token + 片段；停用即移除；权限不足被拒；旧包仍可用。
- **依赖**：M1、M3。

### M7 loader 元数据与 dir/package 形态 🚧（4–6 天）

- **做法**：`SurfaceSpec` 增 `merge/unknownPolicy/reload/defaultSource/snapshot`；加载器支持 `dir`（snippets/templates 逐项、单文件失败跳过）与 `package`（extensions）；`schemaVersion` 迁移失败回最后快照。
- **判据**：一个 dir 型面接入只写 validator + 消费者；坏文件跳过并聚合告警；迁移失败可回滚。
- **依赖**：可并行。

---

## 4. 重排后的实施顺序

| 序 | change 建议 | 票 | 验收门 | 预计 |
|---|---|---|---|---|
| 1 | `ui-quality-gate-v1` | Q0 token 门禁 / Q1 交互条款 / Q4 验收模板 | `check-tokens` 绿 + 注入违规必红；`interaction.md` 四条带守护；PR 模板三件证据 | 3 天 |
| 2 | `ui-quality-primitives-v1` | Q2 四基件 + showcase / Q3 图标纪检 | showcase 6 态截图；迁移清单勾；`check-icons` 绿 | 5 天 |
| 3 | `command-catalog-v1` | M1 命令目录 / M2 AI 发现与注入 | 声明式命令不改消费端可用；AI 无提示答出面清单 | 4–7 天 |
| 4 | `surface-migration-batch2-v1` | M3 反棘轮 / M4 键位面 / M5 导出与新建默认 | 硬编码常量必红；键位重映射不半生效；导出改文件即变 | 7–10 天 |
| 5 | `extension-package-v2` | M6 manifest v2 | 一个包三贡献可用、停用即移除、零代码执行 | 6–9 天 |
| 6 | `surface-loader-complete-v1` | M7 元数据 + dir/package | dir 面只写校验器+消费者 | 4–6 天 |
| 7 | 专项治理（可穿插） | Q5 px 专项 | 基线下降并锁死 + 复盘 | 2–3 天 |

**顺序理由**：品质线是后续所有 UI 改动的闸门（先立规再动工，避免边做边返工）；命令目录是导出/键位/插件贡献的共同前置；插件必须等命令目录与反棘轮就位，否则贡献无法安全落地。

---

## 5. 交付质量指标（季度目标，可对账）

| 指标 | 当前 | 目标 |
|---|---|---|
| 每 PR 新增裸色值（组件层） | 无门禁，452 处存量 | 新增 0；存量季度下降 ≥50% |
| token 对账 / 对比度 | 无检查 | 100% 通过，违规必红 |
| 新 UI 组件使用基件 | 无基件，236 个裸 button | 新代码 100% 走基件（review 判据） |
| 图标尺寸档 | 12/14/18/24 四档 | 14/18/24（12 仅 3 处角标豁免→0） |
| UI PR 三件证据 | 无要求 | 100% 齐全（截图对 + 步骤 + 计算样式） |
| 样式层 px 字面量 | 1247 处 / 80 种 | 高频值 token 化，季度下降 ≥30% |
| 未登记代码常量 | 无门禁 | 新增 0（反棘轮） |

## 6. 每项对账速查

| ID | 状态 | 机检命令 / 人工判据 |
|---|---|---|
| D1 | ✅ | `cargo test`（283）+ state 字节不变用例 |
| D2 | ✅ | `grep HTML_TOOLBAR_ITEMS` 零命中 + `surfaces-events.spec.ts` |
| D3 | ✅ | `grep -c "SurfaceSpec {"` = 7 + 各面 e2e |
| D4 | ✅ | `bash scripts/surface-new.test.sh` 13 项 |
| D5 | ✅ | 归档 change + 各面 e2e + requirements-status |
| D6 | ✅ | tool_schemas 6 项 + 面级 AI 用例 |
| Q0 | ⬜ | `node scripts/check-tokens.mjs`（A/B/C 三项） |
| Q1 | ⬜ | `interaction.md` 四条守护 + e2e ≥4 + alert 零命中 |
| Q2 | ⬜ | `/showcase` 截图 + 迁移清单 + review 判据 |
| Q3 | ⬜ | `node scripts/check-icons.mjs` + 11 行裁决 |
| Q4 | ⬜ | 模板存在 + ≥2 PR 使用 |
| Q5 | ⬜ | 基线下降数字 + 复盘 |
| M1 | ⬜ | 声明式命令 e2e + 未登记 action 拒绝用例 |
| M2 | ⬜ | `list_data_surfaces` 返回 7 面 + 注入断言 |
| M3 | ⬜ | `check-surface-constants` 注入违规必红 |
| M4 | ⬜ | 重映射 e2e + 冲突拒绝 + 半生效回滚用例 |
| M5 | ⬜ | 改文件导出菜单变化 e2e |
| M6 | ⬜ | 一个包三贡献 e2e + 停用移除 + 旧包兼容 |
| M7 | ⬜ | dir 面接入用例 + 坏文件跳过告警 |

## 7. 风险与明确不做

- **风险**：基线一次性录入量大（452 色值 / 1247 px）→ 用脚本生成，不手抄；对比度阈值过严导致存量全红 → 只对语义对断言，存量色值不进对比度检查；基件迁移引发视觉回归 → 逐处截图对 + review。
- **不做**：插件市场/沙箱/代码级插件；全局 `deny_unknown_fields`；把 `settings.json` 全拆成几十个文件；无消费者的数据面。
