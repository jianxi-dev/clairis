# pr-automation Specification

## Purpose
TBD - created by archiving change fix-pr-automation-refs-only-commit. Update Purpose after archive.
## Requirements
### Requirement: REQ-1 refs-only 模式 commit message 关键字

当 `--refs-only` 标志启用时，commit message MUST 使用 `refs #N` 而非 `fixes #N`，与 PR body 第 228 行逻辑对齐，避免 GitHub 合并时提前关闭 parent/spec issue。

#### Scenario: refs-only 模式 commit message 不触发 issue 关闭

- Given 脚本以 `--refs-only` 标志运行
- When 执行 git commit
- Then commit message 使用 `refs #N`（与 PR body 一致，不触发 GitHub 自动关闭）

