## MODIFIED Requirements

### Requirement: CF-8 窗格预设配置（paneMode / paneScale）

配置 SHALL 提供两个键：`paneMode` 与 `paneScale`，均**只存选中的 id**（既有存储值本就是 id，零迁移）。两键的档内参数定义来自数据面：`paneScale` 的倍率来自 `care-scale` 面（DS-10），`paneMode` 的热区高度 / 临时显现时长 / 提示线厚度来自 `pane-modes` 面（DS-11）。缺省（键缺失）SHALL 回落到默认 id（`standard` / `medium`）；`validate_config` SHALL 拒绝未知 id 且不写盘；配置变更 SHALL 经既有 `config-changed` 事件在 1 秒内热应用，SHALL NOT 要求重启。`paneScale` 的容器级 `zoom` SHALL 作用于界面 chrome 白名单：顶栏 `.app-chrome`、底部状态栏 `.app-status-bar`、设置场景容器、阅读轨 `.rail-root`（含浮层形态）、状态栏浮窗菜单、大纲菜单、文档属性面板、tooltip 提示层、右键菜单、AI 气泡、撤销条、QuickOpen、命令面板与快捷键帮助；SHALL NOT 作用于正文 / 预览 / 编辑器内容。两键的档内参数 SHALL 可由 AI 经 `patch_data_surface` 调整：`care-scale` 的 `scale` ∈ [0.8, 1.5]（步长 0.05，归整后校验），`pane-modes` 的 `hotzonePx` ∈ [12, 24]、`revealMs` ∈ [1000, 10000]（0 仅非 hardcore 行）、`hintLinePx` ∈ [0, 2]；越界项 SHALL 被过滤并聚合为一条告警，写入 SHALL 生成面级快照并可经 `restore_surface_snapshot` 回滚。

#### Scenario: 缺省回落默认

- **WHEN** 配置中 `paneMode` 与 `paneScale` 均缺失
- **THEN** 有效值 SHALL 分别为 `standard` 与 `medium`，界面 SHALL 与改动前一致

#### Scenario: 未知 id 拒绝

- **WHEN** 提交 `paneMode = "ultra"` 或 `paneScale = "huge"`
- **THEN** 保存 SHALL 返回校验错误，`user/settings.json` SHALL 保持原内容

#### Scenario: 缩放白名单取值来自面

- **WHEN** `paneScale` 选中的档 `scale` 为 1.3
- **THEN** 顶栏、状态栏、设置场景、阅读轨、大纲菜单、文档属性面板的计算 `zoom` SHALL 为 1.3，正文 / 预览 / 编辑器的计算 `zoom` 与尺寸 SHALL 不变

#### Scenario: AI 调整档内参数

- **WHEN** AI 经 `patch_data_surface` 把 `care-scale` 某档 `scale` 改为 1.3，或把 `pane-modes` hardcore 行 `revealMs` 改为 5000
- **THEN** 有效值 SHALL 在本回合内生效并落盘到 user 层，面级快照 SHALL 记录写前状态且可回滚
- **AND WHEN** AI 提交越界值（如 `scale = 1.6` 或 `revealMs = 500`）
- **THEN** 该项 SHALL 被过滤、产生一条聚合告警，其余合法档 SHALL 保持不变
