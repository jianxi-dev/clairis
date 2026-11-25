---
title: "data-surface-expansion-v1 需求四要素"
type: requirements
status: active
last_updated: 2026-11-26
spec_issue: https://github.com/jianxi-dev/clairis/issues/1496
---

# data-surface-expansion-v1 需求四要素

> 输入对账：[spec issue #1496 · `## 输入对账` 评论](https://github.com/jianxi-dev/clairis/issues/1496)（确认：全按默认；#4 扩至右键菜单与悬浮窗；#4/#5 允许改名称；#5 仅 UI 图标；#7 后置）。

## What

数据面扩展 v1（P1），两件事：

1. **面注册表抽象**：把「面」从代码分支变成登记数据（面 = `{id, 默认文件名, 项形状, 校验器}`）；Rust 端删除 `SurfaceId` 枚举与三处 match，前端 loader 面清单由同一份登记数据派生；新增面 = 登记数据不改样板代码。
2. **三个面整体落地**：菜单面 `user/menus.json`（格头 ⋯ / AI 窗格 ⋯ / 导出子菜单 / 页签右键 / 预览右键 / AI 浮窗六处）、图标面 `user/icons.json`（仅 `src/ui/icons.ts`）、胶囊面 `user/capsules.json`；每面走完整闭环（默认文件 → 用户覆盖 → 面级热应用 → AI 读写 → 回滚）。
3. **`surface:new` 脚手架**：一条命令生成默认 JSON + 登记项 + 六栏表模板。

## Why

- P0 只证明了 html-toolbar 一个面的闭环；再加一个面仍要改四处（Rust 枚举 + 三处 match + 前端面清单），新增面等于代码改动，AI 与维护者都无法只靠数据文件完成（`src-tauri/src/surfaces.rs:29` 注释自述「P1 再抽象」）。
- 三类用户每天都在看的界面结构仍是前端代码常量：菜单（六处）、UI 图标、胶囊工具条。改一个菜单文案、换一个图标、调一次胶囊按钮都要改源码发版。
- 用户明确要求以「面」为单位推进：新增能力应当是新增数据面，而不是新增散点代码（issue #1496）。

## Scope

- `openspec/changes/data-surface-expansion-v1/` 全部任务（spec delta：data-surfaces + ai-agent 两域）。
- 触及：面注册表抽象、菜单/图标/胶囊三面默认源与用户覆盖、面级热应用、AI 两工具白名单、SKILL.md 配置地图增补、`surface:new` 脚手架。

## Non-goals

- 轮盘面（用户指令：暂停）、`readingMode` 文件化（单点后置）。
- 键位面 `keybindings.json`（依赖 `App.tsx` 按键分发重接线；设计稿 02 §4 B1 称 `src/lib/keybindings.ts` 86 行——**该文件不存在**，实际键位表为 `src/lib/shortcuts.ts` 573 行）。
- 编辑器图标 `src/editors/icons.ts`（与 UI 图标两套 ICONS 职责不同）。
- 块菜单 `block-menu`（CM6 内嵌 flyout，非声明式菜单表）。
- 插件贡献 / 权限 / manifest v2（P2）、schema codegen / JSON Schema 运行时（沿用 P0 裁定）。
