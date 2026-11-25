# 验收锚点 — data-surface-contract-v1

锚点来源：`docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` §5.8（根因修复既定方案）、一手实现观察（`config.rs:993-1018` 补丁写全量与 state 清空、`slots.ts:10-31` 前端默认常量、`ai_agent.rs:187-226` 三工具现状、`config.rs:1020-1100` SKILL_MAP 只写不读）、`docs/requirements/data-surface-contract-v1/input-package.md` §3/§5、design.md D1–D8。R-1…R-6 对应 spec delta 的 CF-7 / DS-1 / DS-2 / AI-1 / AI-2 / AI-5 与 tasks.md 1.1–3.1；AI-1 既有循环/轮次行为不变，由 A-4.1 覆盖工具集合增量。

断言值取自既有实现基准（工具数 3→5、快照 10 份、去抖 500ms、生效时限 1s）与设计稿明示形态（state 字节不变、只写 diff、未知 id 过滤 + 聚合告警）；不引入未定义数值。

## R-1 补丁写边界校验（CF-7）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | state-machine | 合法补丁执行后 `state/state.json` 与执行前 | 逐字节一致（差 0） | 设计稿 §5.8（删 state 写入 + 字节不变测试）/ config.rs:993-1018 一手证据 / D2 |
| A-1.2 | exact | 未知顶层键补丁的返回 | 校验错误含 `"fontSizeX"` 键路径；user/settings.json 差 0 字节 | D1（写边界 allowlist）/ config.rs 无 deny_unknown_fields 一手证据 |
| A-1.3 | exact | 嵌套未知键（propertyBar.unknownField）补丁的返回 | 校验错误含 `"propertyBar.unknownField"`；磁盘差 0 字节 | D1（嵌套递归校验） |
| A-1.4 | exact | state 专属键（recentFiles）补丁的返回 | 校验错误含 `"recentFiles"`；state.json 差 0 字节 | D1（state 键一律拒绝）/ 设计稿 §5.8 |
| A-1.5 | exact | user 层仅含 theme 时打 fontSize 补丁，写后 user 层键集 | 键集 → 原键集 ∪ {"fontSize"}，多出键数 0 | D2（只写合并后 user diff）/ config.rs:1002-1014 全量写一手证据 |
| A-1.6 | state-machine | user 层含历史未知键时 load_config | 正常加载（错误数 0） | D1（读取宽松，Codex #2 裁定） |
| A-1.7 | exact | 补丁返回值与 load_config_at 结果 | 逐值一致（差 0 处，含 state 层读取结果） | D2（返回真实有效配置）/ 设计稿 §5.8 返回值修正 |

## R-2 数据面默认源与有效集合（DS-1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 首次启动（defaults 层无面文件）→ 物化 | 文件出现且与内嵌默认 diff 0 处（12 项一致） | D3（物化语义同 ensure_defaults）/ slots.ts:10-31 双真相一手证据 |
| A-2.2 | exact | 覆盖 `["format-bold","nope","format-italic"]` 的有效集合 | `["format-bold","format-italic"]`，默认剩余项不补回，告警含 `nope` 恰 1 条 | D3（未知 id 过滤 + 聚合告警）/ horizontal-toolbar.ts:209-213 现行为基准 |
| A-2.3 | state-machine | 覆盖为空或全非法 → 有效集合 | 回到默认集合（12 项，非空） | D3（空回落默认） |
| A-2.4 | state-machine | 物化默认文件损坏（非法 JSON）→ 有效集合 | 恢复内嵌默认 12 项；物化文件可重建 | D3（内嵌 SURFACE_DEFAULTS 兜底） |
| A-2.5 | exact | 默认集合内容与既有内置顺序 | 逐项一致（12 项 id 与顺序不变） | D8（回归保障）/ slots.ts:10-28 现值 |

## R-3 面级加载与变更事件（DS-2）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | `load_surfaces` 返回结构 | 含全部已登记面（本变更 1 个：html-toolbar）的有效集合与告警 | D4 / design.md 数据面六栏 |
| A-3.2 | state-machine | 外部修改面文件 → 事件 | 1 秒内发出 surfaces-changed(id) | D4（500ms 指纹去抖）/ CF-5 既有 1s 语义 |
| A-3.3 | state-machine | surfaces-changed 到达后 pane 布局与编辑器状态 | 保持原值（重置 0 次，只重载对应面） | D4（不复用 applyRustConfig，Codex #10）/ useConfig.ts:135 SAVE_ECHO_WINDOW 一手证据 |

## R-4 agent 工具集合（AI-1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | tool_schemas 工具名集合 | 恰为 read_config / patch_config / list_snapshots / read_data_surface / patch_data_surface（3→5） | D5 / ai_agent.rs:187-226 现三工具一手证据 |

## R-5 patch_config 行为收紧（AI-2）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | state-machine | state.json 含 recentFiles 后打 theme 补丁 | state.json 差 0 字节 | 同 A-1.1（D2） |
| A-5.2 | state-machine | 合法补丁写入前 | 快照数 +1（list_snapshots 可见） | 既有 CF-3 语义保持 / D2 |

## R-6 数据面读写工具（AI-5）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | read_data_surface("html-toolbar") 返回结构 | 恰含 3 键："effective" / "defaults" / "warnings" | D5 |
| A-6.2 | state-machine | patch_data_surface 改覆盖集合 → 有效集合变化 | 快照数 +1；有效集合 → 新值 | D5 + D2（复用校验快照链路） |
| A-6.3 | exact | read_data_surface("menus")（未登记 id）返回 | 结构化错误（面未登记）；写入数 0 | D5（面白名单） |
| A-6.4 | state-machine | patch_data_surface 执行后 defaults 物化文件 | 差 0 字节（AI 只写用户覆盖） | D5 / D3 |
