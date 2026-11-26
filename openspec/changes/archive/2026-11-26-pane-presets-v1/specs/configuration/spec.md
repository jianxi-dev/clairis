## ADDED Requirements

### Requirement: CF-8 窗格预设配置（paneMode / paneScale）

配置 SHALL 提供两个枚举键：`paneMode`（`simple | standard | hardcore`，默认 `standard`）与 `paneScale`（`small | medium | large`，默认 `medium`）。缺省（键缺失）SHALL 回落到默认值；`validate_config` SHALL 拒绝未知值且不写盘；配置变更 SHALL 经既有 `config-changed` 事件在 1 秒内热应用，SHALL NOT 要求重启。`paneScale` 的缩放 SHALL NOT 作用于正文/预览/编辑器内容。

#### Scenario: 缺省回落默认

- **WHEN** 配置中 `paneMode` 与 `paneScale` 均缺失
- **THEN** 有效值 SHALL 分别为 `standard` 与 `medium`，界面 SHALL 与改动前一致

#### Scenario: 未知值拒绝

- **WHEN** 提交 `paneMode = "ultra"` 或 `paneScale = "huge"`
- **THEN** 保存 SHALL 返回校验错误，`user/settings.json` SHALL 保持原内容

#### Scenario: 缩放不触及正文

- **WHEN** `paneScale` 为 `large`
- **THEN** 顶栏、状态栏与设置场景的计算 `zoom` SHALL 为 1.2，正文/预览/编辑器的计算 `zoom` 与尺寸 SHALL 不变
