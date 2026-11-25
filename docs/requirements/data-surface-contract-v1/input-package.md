---
title: "data-surface-contract-v1 需求输入包（L-1 五条契约）"
type: requirements
status: active
last_updated: 2026-11-25
---

# 需求输入包（L-1 契约门自证）

> 本 change 属「对标/学习」（Omarchy 扩展点模型 / Tau 界面生产线 / 插件机制对标），按 `docs/agents/quality-gates.md` L-1 交付五条契约证据。

## 1. 来源可追溯

| 来源 | 类型 | 支撑的决策 |
|---|---|---|
| `docs/research/technical/data-fileization-omarchy-inventory.md`（2026-11-10 勘误版） | 一手盘点（带文件:行号） | 三层底座现状；「缺口在 UI 结构没数据化」结论 |
| `docs/research/technical/plugin-management-benchmark.md` | 竞品对标 | 「扩展点=数据文件，先约定后 API」原则（建议 2/4） |
| `docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` §5.8 | 已评审设计稿 | `apply_patch_at` 根因与修复方案（删 state 写入 + 返回值修正 + 字节不变测试）——本变更 P0-0 直接采纳 |
| `docs/design/pluginization-datafile-settings-rail/01-plugin-capability-extraction.md` | 已评审设计稿 | 插件形态三分类与「数据文件管配置值、插件管打包」正交裁定 |
| Codex 对抗评审（2026-11-25，本会话，1,430,339 tokens） | 独立外部评审 | 20 项发现：采纳 17（含顺序裁定 #17「先样板后抽象」、未知键写边界 #2、schema 依赖取舍 #3、反向棘轮降级 #11）；澄清 2；反驳 1（CI 已含 cargo test，经 `.github/workflows/ci.yml` 核实） |
| 用户确认 | 用户裁决 | 2026-11-25「执行吧」= v2 方案全按默认（spec issue #1458 对账表） |

## 2. 空白显式化（open-question）

| 开放问题 | 状态 | 阻断范围 |
|---|---|---|
| 面级快照是否独立目录（`snapshots/surfaces/<id>/`）还是沿用 settings 快照 | **已裁决**：本变更沿用 settings 快照（补丁走既有 snapshot_user），面级独立快照留 P1 | 不阻断 |
| 面级事件与既有 `config-changed` 的关系 | **已裁决**：新增 `surfaces-changed(id)`，不复用全量重放 | 不阻断 |
| allowlist 的维护方式（手写常量 vs serde 派生） | **已裁决**：从 `AppConfig::default()` 序列化键集派生 + 嵌套递归，减少手维护 | 不阻断 |

## 3. 一手证据

- `src-tauri/src/config.rs:993-1018`：`apply_patch_at` 只读 user、写空 state（缺陷一手证据）。
- `src-tauri/src/config.rs:441-465`：`settings_value`/`state_value` 实现（补丁写全量的机制证据）。
- `src/editors/orchestration/slots.ts:10-31`：`HTML_TOOLBAR_ITEMS` 常量（双真相一手证据）。
- `src/editors/orchestration/horizontal-toolbar.ts:209-213`：消费点回落常量路径。
- `src-tauri/src/ai_agent.rs:187-226`：现有三工具 schema（AI 通路现状）。
- `src-tauri/src/config.rs:1020-1032`：`seed_skill_map` 只写不读（AI 地图现状）。

## 4. 冲突显式

| 冲突 | 裁定 |
|---|---|
| Codex #2：「未知键拒绝」与「旧配置可加载」矛盾 | 写边界拒绝 + 读取宽松分离（写入时校验，加载不校验未知键） |
| Codex #3：「只写 schema+消费者」不成立（无 JSON Schema 运行时依赖） | 不引入依赖；校验仍手写，schema 仅作文档/夹具/AI 契约 |
| Codex #17：先造生成器 vs 先样板 | 先样板（`html-toolbar` 单面），生成器留 P1 |
| Codex #18（CI 无 Rust 测试） vs 本仓 `.github/workflows/ci.yml`（有 `rust-tests` job） | 反驳：CI 已含 `cargo test`；新面 Rust 测试进既有 job 即可 |
| 设计稿 §5.6/§5.7（view-specs 独立文件 / 捕获配置归一） | 沿用既有裁定保持现状，本变更不重开 |

## 5. 验收锚点

锚点在 change 的 `anchors.md`/`conformance.json` 逐条落（M0 机检），来源标记为本文件 §3 一手证据行号与 §1 设计稿 §5.8。关键锚点预览：

- patch 后 `state/state.json` 字节不变（来源：设计稿 §5.8 + config.rs:993 一手证据）
- 未知键补丁返回校验错误且 `user/settings.json` 不变（config.rs 缺 allowlist 的一手证据）
- 工具条有效集合 = 默认文件 ← 用户覆盖，未知 id 过滤 + 告警（slots.ts:30-47 现行为基准）
- `read_data_surface`/`patch_data_surface` 登记 html-toolbar 且走校验+快照（ai_agent.rs:187 现三工具基准）
