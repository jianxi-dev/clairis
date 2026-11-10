# Proposal: 横向工具条槽位化

## Why

命令注册表与扇区数据面已在 `ui-command-registry` 验证可用（配置 → 校验 → 桥接 → 消费 → 回滚五段闭合）。横向工具条仍是三组硬编码数组：`aiActions` / `formatActions` / `alignActions` 的顺序与可见性写死在 `build()` 里，用户或 AI 无法调整。

这带来两个问题：

- **不能复制已验证的链路**：轮盘可配置、工具条不可配置，同一产品出现两套规则。
- **窄窗口/个人习惯无解**：高频动作无法前置，低频动作无法隐藏，只能改代码发版。

本 change 只做横向工具条（HTML 源码态与横条形态）的槽位化，不碰块菜单与状态栏，避免一次押注全部 UI。

## What Changes

1. **槽位模型**：新增 `src/editors/orchestration/slots.ts`，把 12 个动作（智能 3 / 格式 6 / 对齐 3，另加颜色与清除格式固定位）声明为带 `id/label/icon/group` 的数据；顺序由 `resolveToolbarOrder` 解析。
2. **命令注册表复用**：12 项各自注册为命令，工具条按钮只持 `commandId`，执行走 `executeCommand(id, { view })`。
3. **配置字段**：`AppConfig.htmlToolbarItems: string[] | null`；缺省 = 12 项默认顺序，未知 id 忽略，空数组拒绝，重复去重。
4. **设置面与回滚**：设置·编辑器新增「文字工具条」勾选与排序；「恢复默认」写 `null`；写前快照沿用既有链路。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `editing`：HTML 源码态与横条工具条的按钮集合、顺序由数据驱动；缺省行为与当前一致。

## Impact

- 代码：`src/editors/orchestration/slots.ts`（新增）、`horizontal-toolbar.ts`、`src-tauri/src/config.rs`、`src/hooks/useConfig.ts`、`src/types/index.ts`、`src/components/SettingsView.tsx`
- 数据：`user/settings.json` 新增 `htmlToolbarItems`（可空）
- 测试：`src/__tests__/editor/toolbar-slots.test.ts`、`e2e/toolbar-slots.spec.ts`
