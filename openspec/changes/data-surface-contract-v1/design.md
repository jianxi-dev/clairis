# Design: 数据面契约 v1（patch 写边界加固 + 工具条单面样板）

## 1. 现状与失败模式

| 事实 | 位置 | 后果 |
|---|---|---|
| `apply_patch_at` 只读 user、不读 state，`state_value` 用 `None` 生成空默认并 `atomic_write` 覆盖磁盘 | `config.rs:993-1018`、`state_value:451` | 每次 AI 补丁清空 `recentFiles`/`scrollPositions`/`embedScrollPositions`，零单测覆盖 |
| `apply_patch_at` 把补丁合并进 user 后反序列化为 `AppConfig`，再 `settings_value` 全量序列化写回 | `config.rs:1002-1014` | 代码默认值被固化进 user 层，削弱 defaults 升级语义；返回值是写入前旧 state 的假数据 |
| `AppConfig` 无 `deny_unknown_fields`，`merge_json` 对未知键静默保留后被 serde 丢弃 | `config.rs` 全文零命中 | AI 写错键名无报错、无痕迹 |
| 工具条默认集合是前端常量，`resolveToolbarOrder` 空配置回落常量 | `slots.ts:10-31`、`horizontal-toolbar.ts:209-213` | 默认源双真相；改默认需发版 |
| watcher 只盯 `user/settings.json`；`reloadAppConfig` 全量重放且受 1500ms `SAVE_ECHO_WINDOW_MS` 抑制 | `config.rs:1128-1149`、`useConfig.ts:135` | 新数据面无热应用通路；复用全量重放会吞未保存状态 |
| agent 工具仅 `read_config`/`patch_config`/`list_snapshots` | `ai_agent.rs:187-226` | AI 无法发现/读写结构化数据面 |
| SKILL_MAP 只在文件缺失时写盘，无任何代码读取或注入 | `config.rs:1020-1100` | AI 配置地图只写不读 |

## 2. 数据面分级（本变更）

| 项 | 分级 | 说明 |
|---|---|---|
| 补丁写边界校验 + state 保护 | D0 | 行为加固，不新增数据面；D0 理由：校验规则是安全边界，属代码职责 |
| html-toolbar 默认源文件 | **D1** | 可变值/顺序（默认集合 + 用户覆盖），宿主消费 |
| `read_data_surface` / `patch_data_surface` | D3 | 通路：数据面登记表（代码内常量注册）+ 通用工具代码 |

## 3. 决策

### D1 补丁写边界：显式 allowlist，读取宽松

- 已知键集 = `serde_json::to_value(AppConfig::default())` 的顶层键 ∪ 已知嵌套对象键（`propertyBar`、`headingFonts`、`searchPanel` 等结构体字段），递归校验：补丁键必须落在对应层级已知键集内。
- 未知键 → 结构化校验错误（列出键路径），磁盘不变。state 专属键（`recentFiles`/`scrollPositions`/`embedScrollPositions`）在补丁边界一律拒绝（派生状态不归补丁管）。
- 读取端（`load_config_at`）不变：旧配置含未知键仍可加载（前向兼容，Codex #2 裁定）。
- allowlist 从 default 序列化派生而非手写常量，减少维护漂移（新增字段自动纳入）。

### D2 补丁写入语义修复

- 删除 `apply_patch_at` 中的 state 写入（state 由应用维护，补丁无状态语义）。
- 写盘内容 = 「合并后的 user 层 JSON」（`current_user ⊕ patch`），不再是 `settings_value(serde 反序列化后的全量 AppConfig)`——不把代码默认固化进 user 层。
- 返回值 = `load_config_at`（真实有效配置，含 state 读取结果）。
- 写入链路复用既有「校验 → `snapshot_user` → 原子写」。

### D3 数据面注册与默认源（html-toolbar）

- 新增 `surfaces.rs`：`SurfaceId` 枚举（本变更仅 `HtmlToolbar`）+ `SURFACE_DEFAULTS`（`include_str!` 内嵌 `resources/html-toolbar.default.json`）+ 物化（首次运行写 `defaults/surfaces/html-toolbar.json`，语义同 `ensure_defaults`）+ 合并（默认 ← user 覆盖，未知 id 过滤 + 聚合告警，空覆盖回落默认）。
- 仓库内 JSON 文件是**唯一默认源**：`slots.ts` 的 `HTML_TOOLBAR_ITEMS`/`HTML_TOOLBAR_DEFAULT_ORDER` 常量删除；`resolveToolbarOrder` 改为消费面加载器输出。id 语义（动作实现）仍在代码（D3 混合面：数据声明顺序/可见性，代码声明动作）。
- 不建全局 registry JSON（Codex #7/#17：先样板后抽象；Rust 端注册用枚举 + match，P1 再抽象）。

### D4 面级加载与事件

- 新命令 `load_surfaces`（返回已注册面的有效集合与告警）；新事件 `surfaces-changed(id)`。
- watcher 扩展：监听已注册面的 defaults/user 落点，500ms 指纹去抖（沿用既有模式），命中只发对应 `surfaces-changed(id)`。
- 前端 `src/lib/dataSurfaces/`：`loader.ts`（归一化 + 合并 + 告警聚合）+ `store.ts`（按面缓存，事件到达只重载对应面）。**不复用** `applyRustConfig` 全量重放（避开 `SAVE_ECHO_WINDOW_MS` 与 `restorePaneLayout` 副作用，Codex #10）。
- 消费端：`horizontal-toolbar.ts` 从 store 读有效集合；`SettingsView` 既有编辑 UI 行为不变。

### D5 AI 数据面工具

- `tool_schemas` 扩到 5：`read_data_surface(id)` 返回 `{ effective, defaults, warnings }`；`patch_data_surface(id, patch|items)` 走 D1 校验 + 既有快照 + 原子写，返回新有效值。
- 面白名单：`id` 枚举校验，未登记 id 返回结构化错误（本变更仅 `html-toolbar`）。
- SKILL.md 模板增补：两工具说明 + html-toolbar 面的路径/字段/示例；保持「文件已存在不覆盖」语义（AI-4 不变）。
- 确认卡与撤销链路复用既有 AI 写路径（patch_config 同款三档密度）。

### D6 不引入 JSON Schema 运行时依赖

- 校验仍手写（Rust）；JSON 默认文件与 TS 类型通过对账测试锁定（默认文件反序列化结果 ↔ TS `ToolbarSlotItem` 形状）。
- Codex #3 裁定采纳：不承诺「只写 schema + 消费者」；Rust 校验是代码职责。

### D7 测试策略

- Rust（进 `cargo test`，CI `rust-tests` job 已在）：state 字节不变；未知顶层/嵌套键拒绝；state 键拒绝；只写 user diff（user 层不出现未改动的默认键）；返回值含 state；默认面物化与合并；未知 id 过滤告警。
- 前端 vitest：loader 归一化三态（默认/覆盖/空回落）；store 按 id 重载；默认文件 ↔ TS 类型对账。
- e2e（mock 桥）：`config.htmlToolbarItems` 顺序 A→B 驱动渲染顺序（消费链路可观测）；「文件→UI」链路由 Rust 集成 + 契约测试覆盖并在票面声明（QG-2 豁免）。
- 回归：既有工具条顺序/设置页 e2e 保持通过。

### D8 兼容与迁移

- `htmlToolbarItems` 既有字段与设置页行为不变；默认值来源变化对用户不可见（顺序不变）。
- 无 schemaVersion（本变更单一面、无迁移需求）；P1 registry 落地时再引入。

## 4. 数据面（六栏契约，C10）

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | D1/D2/D3/D4/D5 | — | 本变更 anchors 逐条断言 |
| 存储 | src-tauri/src/config.rs | apply_patch_at | 只写合并后的 user 层 diff；state 层字节不变 |
| 存储 | src-tauri/src/resources/html-toolbar.default.json | SURFACE_DEFAULTS | html-toolbar 默认集合唯一来源（include_str 内嵌 + 物化 defaults 层） |
| 校验 | src-tauri/src/config.rs | validate_patch_keys | 未知键/state 键拒绝，结构化错误，磁盘不变 |
| 桥接 | src/lib/dataSurfaces/loader.ts | normalizeSurface | 默认←覆盖合并，未知 id 过滤+聚合告警，空回落默认 |
| 消费 | src/editors/orchestration/horizontal-toolbar.ts | resolveToolbarOrder | 有效集合顺序即渲染顺序；无前端常量兜底 |
| 回滚 | snapshots/ | restore_config_snapshot | 补丁写前快照（沿用 10 份），一步恢复 |

票面第 8 字段（数据面）：T1=`存储,校验`；T2=`存储,桥接,消费`；T3=`校验`（工具侧复用 T1 校验 + 登记）。

## 5. 风险

- **默认文件与常量双轨期**：`slots.ts` 常量删除与消费端切换必须同一票完成，不留过渡态。
- **事件与既有 config-changed 竞态**：`surfaces-changed` 只由面文件 watcher 触发；`config-changed` 仍只管 `user/settings.json` 全量重放，两事件消费端不同（store vs reloadAppConfig），无交叉。
- **AI 写坏默认文件**：AI 工具只写 user 覆盖（settings 层），不写 defaults 物化文件；defaults 文件损坏时回落内嵌 `SURFACE_DEFAULTS`（物化文件可重建）。
- **补丁边界误拒**：allowlist 从 default 序列化派生，新增 AppConfig 字段自动纳入；嵌套对象以 default 值为对象者递归收集键集——单测覆盖嵌套键场景。

## 6. 明确不做

- 全局 registry JSON / schema codegen / `surface:new`（P1）
- 其余面（菜单/图标/键位/胶囊）迁移（P1/P2）
- 插件贡献与权限（P2）
- view-specs / 捕获配置迁移（既有裁定保持现状）
