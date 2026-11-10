# Proposal: 轮盘可配置化（命令注册表 + 扇区数据面）

## Why

用户要求「AI 可调整产品功能」，现有数据文件底座（三层配置 + 快照 + 热应用 + `patch_config`）已就位，但 UI 结构仍是代码常量：轮盘的 8 个根扇区写死在 `ROOT_SECTORS`，每个扇区内的动作是捕获 `EditorView` 的闭包，任何外部文件都无法表达「加一个动作 / 删一个扇区 / 换顺序」。

这带来两类真实损失：

- **改不了**：`createRoulette` 早已接受 `options.sectors` 用于隐藏/重排，但没有任何调用方传参——扩展点是断头的，改一次扇区要发版。
- **没法验证**：没有一条「改文件 → 界面变化」的闭环，数据文件化只能停留在文档承诺。

本 change 只做最小垂直切片：先让轮盘根层由配置驱动，证明链路（配置 → 校验 → 桥接 → 消费 → 回滚）可用；工具条槽位等复制动作留给后续 change，避免一次押注全部 UI。

## What Changes

1. **命令注册表**：新增 `src/editors/orchestration/commands.ts`，动作从闭包改为 `commandId + execute(id, ctx)`；轮盘条目增加 `commandId` 字段，`run` 保留为过渡兜底（expand）。
2. **轮盘扇区数据面**：`AppConfig` 新增 `rouletteSectors: string[] | null`；`createRoulette` 的 `options.sectors` 接上配置；缺省 = 现有 8 项顺序，未知 id 忽略并聚合告警。
3. **设置面与回滚**：设置·编辑器新增「轮盘扇区」勾选与上下移动；「恢复默认」写回 `null`；非法值由 `validate_config` 拒绝，磁盘不变。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `editing`：选区轮盘的扇区集合、顺序与动作执行由数据驱动；缺省行为与当前一致。

## Impact

- 代码：`src/editors/orchestration/commands.ts`（新增）、`roulette.ts`、`roulette-view.ts`、`floating-toolbar.ts`、`src-tauri/src/config.rs`、`src/hooks/useConfig.ts`、`src/components/SettingsView.tsx`、`src/types/index.ts`
- 数据：`user/settings.json` 新增 `rouletteSectors` 字段（可空，缺省回落内置 8 项）
- 测试：`src/__tests__/editor/roulette-sectors.test.ts`、`e2e/roulette-sectors.spec.ts`
