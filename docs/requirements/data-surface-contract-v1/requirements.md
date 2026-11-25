---
title: "data-surface-contract-v1 需求四要素"
type: requirements
status: active
last_updated: 2026-11-25
spec_issue: https://github.com/jianxi-dev/clairis/issues/1458
---

# data-surface-contract-v1 需求四要素

> 输入对账：[spec issue #1458 · `## 输入对账` 评论](https://github.com/jianxi-dev/clairis/issues/1458#issuecomment-7154655960)（确认：全按默认，2026-11-25）。

## What

数据面契约 v1，两件事：

1. **patch 写边界加固（根因修复）**：`patch_config` 补丁在写入边界做已知键校验（未知键与 state 专属键拒绝、磁盘不变）；删除对 state 层的写入；只写合并后的 user 层 diff；返回真实有效配置；读取端保持宽松。
2. **工具条单面样板（html-toolbar）**：默认按钮集合唯一来源迁 JSON 默认文件（物化 defaults 层，删前端常量）；新增面级加载与 `surfaces-changed(id)` 事件（只重载对应面）；AI 新增 `read_data_surface` / `patch_data_surface` 两工具，本变更只登记此面。

## Why

- 用户让 AI 改配置会静默丢「最近文件/阅读位置」（state 被空默认覆盖）；写错键名静默失效（未知键被吞）。这两个缺陷让「AI 可塑」承诺不可信，且根因修复方案已在设计稿 §5.8 裁定，属既定欠账。
- 「后续新增功能自动文件化」需要先证明一个面的完整闭环（默认源唯一 → 改文件生效 → AI 可读写 → 可回滚），才能抽象通用 loader 与脚手架（Codex 评审 #17 顺序裁定）。

## Scope

- `openspec/changes/data-surface-contract-v1/` 全部任务（spec delta：configuration + ai-agent 两域）。
- 触及：配置补丁校验与写入语义、工具条默认源数据文件、面级加载/事件、AI 两工具、SKILL.md 配置地图增补。

## Non-goals

- 全局 registry / schema codegen / `surface:new` 脚手架（P1）
- 命令目录扩展；菜单/图标/键位/胶囊等其余面迁移（P1/P2）
- 插件 manifest v2 / 权限 / 贡献（P2）
- view-specs 独立文件化、捕获配置迁移（既有裁定保持现状）
