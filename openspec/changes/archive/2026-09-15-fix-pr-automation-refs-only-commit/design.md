## Context

`scripts/pr-automation.sh` 在 `--refs-only` 模式下存在不一致：
- **PR body**（第 228 行）：正确使用 `Refs #$ISSUE`（不触发 GitHub 自动关闭）
- **commit message**（第 211 行）：硬编码 `fixes #$ISSUE`（触发 GitHub 自动关闭）

GitHub 对 commit message 和 PR body 中的关闭关键字（`fixes`/`closes`/`resolves`）一视同仁，都会在合并时自动关闭关联 issue。这导致 `--refs-only` 的意图（不提前关闭 parent/spec issue）被破坏。

## Goals / Non-Goals

**Goals:**
- 使 commit message 与 PR body 的关键字行为一致：`REFS_ONLY=1` 时用 `refs #N`，否则用 `fixes #N`

**Non-Goals:**
- 不改变脚本其他流程（push/PR/标签/门禁）
- 不改变 `--resume-branch` 路径的行为（该路径不经过第 211 行）
- 不涉及 spec 级需求变更

## Decisions

**决策 1：复用现有 `REFS_ONLY` 变量做三元判断**

与第 228 行 PR body 的逻辑完全对称：
```bash
$( [[ "$REFS_ONLY" == "1" ]] && echo "refs #$ISSUE" || echo "fixes #$ISSUE" )
```

理由：
- 最小改动，与现有代码风格一致
- 不引入新变量或新逻辑路径
- 可读性高，维护成本低

**替代方案**：在脚本顶部定义 `COMMIT_KEYWORD` 变量——被否决，因为单行修改不需要额外抽象。

## Risks / Trade-offs

- **风险**：无。`refs` 和 `fixes` 都是 GitHub 识别的标准关键字，行为可预测。
- **Trade-off**：无。修复后 `--refs-only` 和默认模式的行为差异更加清晰一致。
