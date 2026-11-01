# Tasks: AI agent 循环与配置工具

> 本 change 只有一个交付任务（1 change = 1 issue = 1 PR）。

- [x] 1.1 三工具 + while-tool_use 循环 + provider 预设 + keyring + SKILL.md：让 AI 能读配置、打补丁（校验/快照/原子写）、列快照，并在 OpenAI 兼容端点上连续调用工具直到给出结论

  执行步骤：

  1. `config.rs`：新增 `apply_patch(base, patch)`（读 user → 深合并 → 反序列化 → validate → snapshot → 原子写），复用 C2 原语。
  2. `ai_agent.rs`：`Completer` 抽象、`run_loop`、工具 schema 与 `dispatch_tool`、`AgentError`。
  3. 真实 Completer：reqwest 调 `{endpoint}/v1/chat/completions`，带 `tools`；复用 `translate.rs` 的请求头/超时风格；支持非流式返回。
  4. `commands/ai_agent_cmd.rs`：`run_agent_turn(messages, endpoint, model)` 读取 keyring 后跑循环；`get_provider_presets` 可选（以 TS 表为准）。
  5. `lib.rs`：注册命令；首次启动写 SKILL.md。
  6. `src/lib/providers.ts`：八条预设表。
  7. 测试：脚本化 Completer 走两轮（工具调用 → 最终答复）、轮次上限、`patch_config` 非法值不落盘、`read_config` 返回有效配置、预设表完整。
  8. 验证：`cargo test`、`npx tsc --noEmit`、`npm test`、`verify.sh`。
