# Proposal: 轮盘标注类型全集（roulette-callout-types）

## Why

轮盘「转换 › 高亮」最初内联了 5 类（提示/信息/注意/警告/危险），而编辑器 `CALLOUT_EDIT_TYPES` 支持 13 类。用户 2026-11-10 要求补全；实现已在 #530 / PR #531 落地，本 change 把需求写回主规格，消除实现与规格的漂移。

## What Changes

- 「高亮」三层由 5 类扩展为 13 类：注释 / 信息 / 摘要 / 待办 / 提示 / 成功 / 问题 / 警告 / 失败 / 危险 / Bug / 示例 / 引用，各自写入 `> [!key]`。
- 悬停/激活扇区改用实色混合（accent 22% + surface），不再因 `--app-accent-soft` 的 alpha 发虚（视觉实现，不改变几何条款）。

## Capabilities

### Modified Capabilities

- `editing`：选区浮动工具条的高亮三层类型集与写入 token。

## Impact

- 规格：`openspec/specs/editing/spec.md`「选区浮动工具条」。
- 代码：已由 PR #531 落地（`floating-toolbar.ts` 复用 `CALLOUT_EDIT_TYPES`，新增 6 个图标）。
- 风险：无数据迁移；回滚为 revert。
