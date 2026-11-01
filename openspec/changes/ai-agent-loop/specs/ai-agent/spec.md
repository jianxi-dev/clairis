## ADDED Requirements

### Requirement: AI-1 三工具与多轮循环

agent SHALL 以 OpenAI 兼容 `chat/completions` 调用，携带 `read_config` / `patch_config` / `list_snapshots` 三个工具的 schema。收到 `tool_calls` 时 SHALL 执行对应工具并把结果作为 `tool` 消息回灌，重复直到模型不再请求工具；轮次 SHALL 上限为 8，超过 SHALL 返回 `TurnLimit` 错误。

#### Scenario: 工具调用后收敛

- **WHEN** 模型第一轮请求 `read_config`，第二轮给出文本结论
- **THEN** 循环 SHALL 执行一次 `read_config`、把结果回灌，并返回第二轮的文本

#### Scenario: 轮次上限

- **WHEN** 模型连续 8 轮都请求工具
- **THEN** 循环 SHALL 以 `TurnLimit` 错误终止，SHALL NOT 继续第 9 轮

### Requirement: AI-2 patch_config 可逆写入

`patch_config` SHALL 把补丁合并进 user 层，并复用配置层的校验、快照与原子写：非法值 SHALL 返回结构化错误且磁盘不变；合法值 SHALL 在写入前生成快照。

#### Scenario: 非法字号被拒

- **WHEN** 模型调用 `patch_config` 传 `{"fontSize": 200}`
- **THEN** 工具 SHALL 返回校验错误，`user/settings.json` SHALL 保持原内容

#### Scenario: 合法补丁可回滚

- **WHEN** 模型把 `theme` 改为 `dark`
- **THEN** user 层 SHALL 更新且写入前产生一份快照，`list_snapshots` SHALL 能看到它

### Requirement: AI-3 provider 预设与 key 隔离

内置预设 SHALL 覆盖 DeepSeek / 通义 / Kimi / GLM / WorkBuddy / OpenCode / Pi / 自定义，每条含 endpoint 与默认模型。API key SHALL 只从 keyring 读取，SHALL NOT 写入配置文件、日志或 SKILL.md。

#### Scenario: 预设完整

- **WHEN** 读取 `src/lib/providers.ts` 的预设表
- **THEN** SHALL 恰好包含上述八条，且每条都有 `id` / `label` / `endpoint` / `defaultModel`

#### Scenario: key 不进配置

- **WHEN** 任一次 agent 调用完成
- **THEN** `user/settings.json` 与 SKILL.md SHALL NOT 含 API key

### Requirement: AI-4 SKILL.md 心智地图

首次启动 SHALL 在 `$APPCONFIG/skills/biaoyue/SKILL.md` 写一份配置地图（三层目录、可改键与范围、快照位置、key 禁止项）。文件已存在时 SHALL NOT 覆盖。

#### Scenario: 首次生成、再次保留

- **WHEN** 应用第一次启动后用户改了 SKILL.md 再启动
- **THEN** 文件 SHALL 保留用户的修改，不被重新写入覆盖
