# Design: AI agent 循环与配置工具

## D1 循环骨架

```rust
pub trait Completer: Send + Sync {
    async fn complete(&self, req: CompletionRequest) -> Result<CompletionResponse, AgentError>;
}

pub struct CompletionRequest { pub messages: Vec<Message>, pub tools: Vec<Value>, pub model: String, pub endpoint: String, pub api_key: String }
pub struct CompletionResponse { pub content: Option<String>, pub tool_calls: Vec<ToolCall> }
```

`run_loop(completer, messages, max_turns = 8)`：

1. 调 `complete`。
2. 无 `tool_calls` → 返回最终文本。
3. 有 `tool_calls` → 逐个 `dispatch_tool(name, args)`，把每个结果作为 `{"role":"tool","tool_call_id":…,"content": <json>}` 追加。
4. 回到 1；超过 `max_turns` → `AgentError::TurnLimit`。

真实 `Completer` 用 reqwest 调 OpenAI 兼容端点；测试用 `ScriptedCompleter`（按顺序返回预设响应），循环本身不被 mock。

## D2 工具契约

| 工具 | 入参 | 行为 | 失败 |
|---|---|---|---|
| `read_config` | `{}` | 返回有效配置 JSON（与 `load_config` 同源） | IO 错误结构化返回 |
| `patch_config` | `{ "patch": object }` | RFC 7396 合并到 user 层 → 校验 → 快照 → 原子写 → 返回新有效配置 | 校验失败返回 `{error, field, message}`，磁盘不变 |
| `list_snapshots` | `{}` | 返回快照名数组（旧→新） | IO 错误结构化返回 |

`patch_config` 复用 `config::apply_patch(base, patch)`：读 user → `merge_json` → 反序列化 → `validate_config` → `snapshot_user` → 原子写。**不经** UI、不弹确认卡（确认卡是 C4 的层）。

## D3 provider 预设

`src/lib/providers.ts` 导出 `PROVIDERS`：
`deepseek` / `qwen` / `kimi` / `glm` / `workbuddy` / `opencode` / `pi` / `custom`，每条含 `id`、`label`、`endpoint`、`defaultModel`、`docsUrl?`。key 一律走 keyring；`custom` 的 endpoint/model 由用户填。

Rust 侧只接受 `endpoint` + `model` + `key`，不维护第二份预设表（避免双源）。

## D4 SKILL.md

`$APPCONFIG/skills/biaoyue/SKILL.md`，首次启动写；内容为配置地图：三层目录、`patch_config` 能改的键与取值范围、快照位置、禁止改 keyring。已存在不覆盖（用户可改）。

## D5 错误

`AgentError`：`TurnLimit` / `Provider { status, body }` / `Tool { name, message }` / `Validation`。全部可序列化，交给 C4 显示为人话。

## D6 不变量

- 工具写路径必须过 C2 的校验与快照，不允许绕过 `save_config_at` 的写入语义。
- API key 不出现在日志、错误体与 SKILL.md。
- 循环不吞错误：任一工具失败作为 tool 消息回灌，但连续 3 次同错误即终止并报错。
