# Proposal: AI agent 循环与配置工具（C3）

## Why

C2 已经把配置拆成可回滚的三层，但还没有任何东西能**改**它：AI 需要读配置、打补丁、看快照，并且能连续多轮调用工具。现在只有一个单轮翻译通道（`translate.rs`），没有 tool calling、没有循环、没有 provider 预设，也没有给模型的心智地图。没有 C3，C4 的 ⌘K 浮层无通道可接。

## What Changes

- **三工具**：`read_config`（返回有效配置）、`patch_config`（JSON 合并补丁，走 C2 的校验 + 快照 + 原子写）、`list_snapshots`。
- **agent 循环**：OpenAI 兼容 `chat/completions` + `tools`；收到 `tool_calls` 就执行工具、把结果作为 `tool` 消息回灌，直到模型不再调用工具；轮次上限 8。
- **provider 预设**：DeepSeek / 通义 / Kimi / GLM / WorkBuddy(codebuddy) / OpenCode / Pi / 自定义；endpoint 与 model 可覆盖。
- **keyring**：key 仍只走 `get/set/delete_api_key`，不进配置文件。
- **SKILL.md 心智地图**：首次运行在 `$APPCONFIG/skills/biaoyue/SKILL.md` 写一份配置地图（可被 AI 读取），已存在则不覆盖。
- **结构化错误**：工具参数非法、provider 失败、超轮次都返回结构化错误，不静默吞掉。

## Capabilities

### New Capabilities

- `ai-agent`：三工具、循环上限、provider 预设、keyring 与 SKILL.md 的验收契约。

### Modified Capabilities

<!-- 无 -->

## Impact

- **代码**：新增 `src-tauri/src/ai_agent.rs`（循环 + 工具注册 + Completer 抽象）、`src-tauri/src/commands/ai_agent_cmd.rs`（命令）、`src-tauri/src/config.rs`（`apply_patch` 复用 C2 原语）、`lib.rs`（注册 + 首次写 SKILL.md）、`src/lib/providers.ts`（预设表，C4 消费）。
- **测试**：脚本化 Completer 驱动真实循环（不 mock 循环本身）；工具补丁非法值不落盘；轮次上限；预设完整性。
- **风险**：中。涉及网络与文件写入；工具写路径复用 C2 的快照/校验，失败可回滚。
- **非目标**：不做 UI 入口（C4）、不做语音（C9）、不接 MCP、不做本地 LLM。
