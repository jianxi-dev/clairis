---
title: AI 入口分期与语音第二输入源
type: adr
status: accepted
last_updated: 2026-11-01
---

# ADR 0008 — AI 入口分期与语音第二输入源

- **Status**: accepted
- **Date**: 2026-11-01

## Context

AI 可塑需要入口，但入口形态与分期未定的情况下，容易一次做重、概念膨胀。同时语音输入作为第二输入源，需要明确它与文本输入的关系与边界。

## Decision

- **唯一 AI 入口**：顶栏星芒图标（全产品仅此一个）。默认**小窗 285×260 右下 16px**，四边四角缩放，可拖/关；「停靠到右侧」⇄ 嵌入窗格（⋯「脱离为小窗」），共享对话历史；⌘K 快捷浮层；选区动作。
- **四入口分期**：V1（⌘K 浮层 + 选区动作）→ V2（命令面板 AI 区，并入 ⌘P 统一文件面板）→ V3（右侧常驻小窗/嵌入窗格）。四入口共享同一 agent 后端、同一确认密度、同一套撤销/快照骨架。
- **供应商**：单一 OpenAI 兼容通道 + provider 预设（DeepSeek / 通义 / Kimi / GLM / WorkBuddy(codebuddy) / OpenCode / Pi / 自定义），API key 只存 OS keyring（ADR 0005）；本地 LLM 与多 agent 标「规划中」。
- **语音 = 第二输入源**：每个输入面挂麦克风；正文三件套（状态栏连续听写 / ⌘⇧Space PTT / 选区替换）；草稿=浅灰斜体 decoration（不落盘），停止=普通事务（可撤销）；ASR 引擎待定。
- **信息层级三档**：人话层（默认，确认卡/撤销条禁技术语言）/ 高级层（可选变更记录）/ 实现层（不进 UI）。

## Consequences

- 入口分期落地，最快证明 AI 可塑闭环；四入口只是皮肤，底下只有一套机制。
- 语音不是「模式」，是文本输入的第二来源；换 ASR 引擎只换后端，界面零改动。
- 确认卡与撤销条禁止出现技术语言（`patch_config` / 字段名），一律自然语言。

## 关联

- 产品铁律：`docs/product/principles.md` D3/D6/D7/D10。
- 布局规格：`docs/design/approved/layout-portal/spec.md` §7。
- 摘要登记：`CONTEXT.md` §二 决策 #8。
