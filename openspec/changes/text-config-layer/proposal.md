# Proposal: 配置三层、原子写、快照与热应用（C2）

## Why

现状是单个平铺的 `app_config.json`：所有设置项与派生状态（最近文件、滚动位置）混在一个文件，整文件覆盖写，没有默认层/用户层之分，没有快照，没有校验。这挡着产品铁律 D6（一切可变状态皆文本）与 D7（AI 可塑但必须可撤销）：AI 直接改文件没有回滚点，应用写入没有原子性，改坏只能手工翻找。

## What Changes

- **配置分层**：`defaults/settings.json`（随包只读）、`user/settings.json`（用户与 AI 可写）、`state/state.json`（派生状态）。有效配置 = defaults ⊕ user（user 覆盖同名键）。
- **原子写**：写临时文件再 rename；任一步失败保留原文件，不产生半截 JSON。
- **快照**：每次成功写 user 配置前，先把当前 user 文件复制进 `snapshots/`，保留最近 10 份。
- **校验**：非法值（字号 8–96、阅读宽度 480–2400、比例 0–1、主题/皮肤枚举）拒绝写入并返回错误，磁盘不变。
- **回滚命令**：`list_config_snapshots` / `restore_config_snapshot`（恢复前先给当前状态拍一份快照）。
- **热应用**：`user/settings.json` 被外部改动后 1 秒内向前端发 `config-changed` 事件。
- **迁移**：首次启动把旧 `app_config.json` 拆成 user + state，旧文件保留。

## Capabilities

### New Capabilities

- `configuration`：配置分层、原子写、快照回滚、校验与热应用的验收契约。

### Modified Capabilities

<!-- 无 -->

## Impact

- **代码**：`src-tauri/src/config.rs` 重写为分层模块；`commands/config_cmd.rs` 新增两个命令；`lib.rs` 注册命令并在启动时挂监听；`src/hooks/useConfig.ts` 监听事件并重载。
- **兼容**：`load_config` / `save_config` 的命令名与 `AppConfig` 结构保持不变，前端既有调用不动；旧 `app_config.json` 只读迁移。
- **不新增依赖**：监听用 500 ms 轮询目标文件 mtime+len（`notify` 不在依赖树；每轮按路径 stat，文件被 rename 替换不会丢监听）。
- **风险**：中。配置是全局状态，迁移与并发写都必须可回滚。
- **非目标**：本节不做 AI 工具调用（C3）、不做确认卡与撤销条 UI（C4）、不文本化视图规格（C8）。
