## Why

`scripts/pr-automation.sh --refs-only` 创建 parent/spec issue 的 PR 时，commit message 硬编码 `fixes #$ISSUE`（第 211 行），但 PR body 正确使用了 `Refs #$ISSUE`（第 228 行）。GitHub 对 commit message 中的 `fixes` 关键字同样触发自动关闭，导致 parent/spec issue 在 PR 合并时被提前关闭，与 change-workflow SKILL 明文意图相悖（"避免合并提前关闭 parent/spec issue 生命周期，G4 才收口"）。

## What Changes

- `scripts/pr-automation.sh` 第 211 行：commit message 中的关键字根据 `REFS_ONLY` 变量动态选择 `refs #N` 或 `fixes #N`，与 PR body 第 228 行逻辑对齐。

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

（无 spec 级行为变更——这是脚本内部实现修复，不改变对外接口或需求规格）

## Impact

- **受影响文件**：`scripts/pr-automation.sh`（单行修改）
- **影响范围**：所有使用 `--refs-only` 的 change artifacts/parent PR 提交
- **风险**：极低——仅修改 commit message 文本，不改变脚本流程或接口
- **关联 issue**：#14
