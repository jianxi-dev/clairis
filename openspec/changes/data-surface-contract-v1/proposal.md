## Why

`patch_config` 存在两个已裁定待修的根因缺陷：每次补丁用空默认值覆盖 `state/state.json`（用户「最近文件/阅读位置」静默丢失，`config.rs:993-1018` 一手证据），未知键被静默吞掉（写错键名无任何报错）。二者让「AI 可塑」承诺不可信，修复方案已在设计稿 `pluginization-datafile-settings-rail/02` §5.8 收敛。同时「后续新增功能自动文件化」需要先证明一个面的完整闭环（默认源唯一 → 改文件生效 → AI 可读写 → 可回滚），才能抽象通用机制（Codex 评审 #17 顺序裁定：先样板后抽象）。

## What Changes

- **补丁写边界加固**：`patch_config` 写入前做已知键校验（顶层 + 嵌套显式 allowlist，从 `AppConfig::default()` 序列化键集派生），未知键返回结构化错误且磁盘不变；state 专属键（`recentFiles` / `scrollPositions` / `embedScrollPositions`）在补丁边界一律拒绝；删除补丁对 state 层的写入，只写「合并后的 user 层 diff」；返回值改为真实有效配置。读取端保持宽松：旧配置含未知键仍可加载。
- **工具条单面样板（html-toolbar）**：默认按钮集合唯一来源迁至仓库内 JSON 默认文件（首次运行物化到 defaults 层），删除前端重复常量 `HTML_TOOLBAR_ITEMS`；有效集合 = 默认文件 ← 用户 settings 覆盖（未知 id 过滤 + 聚合告警，空覆盖回落默认），既有 `htmlToolbarItems` 字段与设置页 UI 行为不变。
- **面级加载与事件**：新增数据面加载命令与 `surfaces-changed(id)` 事件；外部修改面文件后按 500ms 指纹去抖只通知对应面，消费端只重载该面，不复用全量配置重放（避开 `SAVE_ECHO_WINDOW_MS` 与 `restorePaneLayout` 副作用）。
- **AI 数据面工具**：agent 工具从三个扩到五个——新增 `read_data_surface`（有效值 + 默认值 + 告警）与 `patch_data_surface`（面白名单、校验、快照、原子写），本变更只登记 `html-toolbar` 一个面；SKILL.md 配置地图增补两工具与该面说明（保持「存在不覆盖」语义）。
- 不引入 JSON Schema 运行时依赖；schema/类型手写并通过对账测试。

## Capabilities

### New Capabilities

- `data-surfaces`: 数据面的默认源、加载、变更事件与 AI 读写工具的行为契约（本变更以 html-toolbar 为首个登记面）。

### Modified Capabilities

- `configuration`: 新增 requirement「补丁写边界校验」——未知键与 state 专属键拒绝写入、只写 user 层 diff、state 层不被补丁触碰。
- `ai-agent`: AI-1 工具集合 3→5（新增两数据面工具）；AI-2 `patch_config` 行为收紧（未知键/state 键拒绝、只写 user diff、返回有效配置）。

## Impact

- 代码：`src-tauri/src/config.rs`（补丁边界 + 校验）、`src-tauri/src/surfaces.rs`（新增，面注册与默认源）、`src-tauri/src/ai_agent.rs`（工具 schema 与 dispatch）、`src/hooks/useConfig.ts`、`src/lib/dataSurfaces/loader.ts`（新增）、`src/lib/dataSurfaces/store.ts`（新增）、`src/editors/orchestration/slots.ts`（常量删除）、`src/editors/orchestration/horizontal-toolbar.ts`（消费面加载器）、`src-tauri/src/lib.rs`（命令/事件注册）。
- 数据：`defaults/surfaces/html-toolbar.json`（新增默认源文件）；`user/settings.json` 的 `htmlToolbarItems` 字段语义不变。
- AI 通路：工具 schema 3→5；SKILL.md 模板增补。
- 测试：Rust 集成测试进既有 `cargo test`（CI `rust-tests` job）；前端契约测试 vitest；e2e 用 mock 桥验证消费顺序。
- 兼容：旧配置未知键加载不报错；默认工具条顺序不变（回归保障）。
