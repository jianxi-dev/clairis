## MODIFIED Requirements

### Requirement: AI-1 三工具与多轮循环

agent SHALL 以 OpenAI 兼容 `chat/completions` 调用，携带 `read_config` / `patch_config` / `list_snapshots` / `read_data_surface` / `patch_data_surface` 五个工具的 schema。收到 `tool_calls` 时 SHALL 执行对应工具并把结果作为 `tool` 消息回灌，重复直到模型不再请求工具；轮次 SHALL 上限为 8，超过 SHALL 返回 `TurnLimit` 错误。

#### Scenario: 工具调用后收敛

- **WHEN** 模型第一轮请求 `read_config`，第二轮给出文本结论
- **THEN** 循环 SHALL 执行一次 `read_config`、把结果回灌，并返回第二轮的文本

#### Scenario: 轮次上限

- **WHEN** 模型连续 8 轮都请求工具
- **THEN** 循环 SHALL 以 `TurnLimit` 错误终止，SHALL NOT 继续第 9 轮

### Requirement: AI-2 patch_config 可逆写入

`patch_config` SHALL 把补丁合并进 user 层，并复用配置层的校验、快照与原子写：非法值、未知键与 state 专属键 SHALL 返回结构化错误且磁盘不变；补丁 SHALL NOT 清空 state 层；合法值 SHALL 在写入前生成快照，返回值 SHALL 为真实有效配置。

#### Scenario: 非法字号被拒

- **WHEN** 模型调用 `patch_config` 传 `{"fontSize": 200}`
- **THEN** 工具 SHALL 返回校验错误，`user/settings.json` SHALL 保持原内容

#### Scenario: 补丁不清空 state

- **WHEN** `state/state.json` 含 `recentFiles`，模型调用 `patch_config` 改 `theme`
- **THEN** `state/state.json` SHALL 逐字节不变

#### Scenario: 合法补丁可回滚

- **WHEN** 模型把 `theme` 改为 `dark`
- **THEN** user 层 SHALL 更新且写入前产生一份快照，`list_snapshots` SHALL 能看到它

## ADDED Requirements

### Requirement: AI-5 数据面读写工具

agent SHALL 提供 `read_data_surface(id)`（返回 `{effective, defaults, warnings}`）与 `patch_data_surface(id, patch)`（面白名单、写边界校验、写前快照、原子写，返回新有效值）。`id` 未登记 SHALL 返回结构化错误。本变更登记面为 `html-toolbar`。`patch_data_surface` 对 `html-toolbar` 的补丁 SHALL 只作用于用户覆盖集合，SHALL NOT 修改 defaults 物化文件。

#### Scenario: 读面返回三段

- **WHEN** 模型调用 `read_data_surface("html-toolbar")`
- **THEN** SHALL 返回有效集合、默认集合与告警列表

#### Scenario: 改面生效可回滚

- **WHEN** 模型调用 `patch_data_surface("html-toolbar", {"items":["format-bold","format-italic"]})`
- **THEN** 用户覆盖 SHALL 更新、有效集合 SHALL 变化、写前 SHALL 产生快照

#### Scenario: 未登记 id 被拒

- **WHEN** 模型调用 `read_data_surface("menus")`
- **THEN** SHALL 返回结构化错误（面未登记），SHALL NOT 产生任何写入
