## MODIFIED Requirements

### Requirement: CF-8 窗格预设配置（paneMode / paneScale）

配置 SHALL 提供两个枚举键：`paneMode`（`simple | standard | hardcore`，默认 `standard`）与 `paneScale`（`small | medium | large`，默认 `medium`）。缺省（键缺失）SHALL 回落到默认值；`validate_config` SHALL 拒绝未知值且不写盘；配置变更 SHALL 经既有 `config-changed` 事件在 1 秒内热应用，SHALL NOT 要求重启。`paneScale` 的容器级 `zoom` SHALL 作用于界面 chrome 白名单：顶栏 `.app-chrome`、底部状态栏 `.app-status-bar`、设置场景容器、阅读轨 `.rail-root`（含浮层形态）、状态栏浮窗菜单、大纲菜单、文档属性面板、tooltip 提示层、右键菜单、AI 气泡、撤销条、QuickOpen、命令面板与快捷键帮助；SHALL NOT 作用于正文 / 预览 / 编辑器内容。两键 SHALL 可由 AI 经既有 `patch_config` 调整：可写键集派生自 `AppConfig`（两键已在白名单），写入 SHALL 经 `validate_config` 枚举校验并生成写前快照，SHALL 可经 `restore_config_snapshot` 回滚。

#### Scenario: 缺省回落默认

- **WHEN** 配置中 `paneMode` 与 `paneScale` 均缺失
- **THEN** 有效值 SHALL 分别为 `standard` 与 `medium`，界面 SHALL 与改动前一致

#### Scenario: 未知值拒绝

- **WHEN** 提交 `paneMode = "ultra"` 或 `paneScale = "huge"`
- **THEN** 保存 SHALL 返回校验错误，`user/settings.json` SHALL 保持原内容

#### Scenario: 缩放不触及正文

- **WHEN** `paneScale` 为 `large`
- **THEN** 顶栏、状态栏、设置场景、阅读轨、大纲菜单、文档属性面板的计算 `zoom` SHALL 为 1.2，正文 / 预览 / 编辑器的计算 `zoom` 与尺寸 SHALL 不变

#### Scenario: AI 调整生效

- **WHEN** AI 经 `patch_config` 提交 `paneMode = "hardcore"` 或 `paneScale = "large"`
- **THEN** 有效值 SHALL 在本回合内生效并落盘到 user 层，快照 SHALL 记录写前状态且可回滚
- **AND WHEN** AI 提交未知值（如 `paneScale = "huge"`）
- **THEN** 保存 SHALL 拒绝、user 层 SHALL 零写盘，错误 SHALL 指明键名
