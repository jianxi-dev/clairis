# pr-automation 脚本规格

## 概述

`scripts/pr-automation.sh` 自动化 change 工作流的 PR 创建流程，包括分支管理、提交、推送、PR 创建和标签管理。

## 需求

### REQ-1: refs-only 模式

当 `--refs-only` 标志启用时：
- PR body 使用 `Refs #N`（不触发 GitHub 自动关闭）
- commit message 使用 `refs #N`（不触发 GitHub 自动关闭）

#### Scenario: refs-only 模式提交

- Given 脚本以 `--refs-only` 标志运行
- When 执行 git commit
- Then commit message 包含 `refs #N` 而非 `fixes #N`

### REQ-2: 默认模式

当 `--refs-only` 未启用时：
- PR body 使用 `Closes #N`（触发 GitHub 自动关闭）
- commit message 使用 `fixes #N`（触发 GitHub 自动关闭）

#### Scenario: 默认模式提交

- Given 脚本未使用 `--refs-only` 标志运行
- When 执行 git commit
- Then commit message 包含 `fixes #N`

## ADDED Requirements

### Requirement: REQ-1 refs-only 模式 commit message 关键字

当 `--refs-only` 标志启用时，commit message MUST 使用 `refs #N` 而非 `fixes #N`，与 PR body 第 228 行逻辑对齐，避免 GitHub 合并时提前关闭 parent/spec issue。

#### Scenario: refs-only 模式 commit message 不触发 issue 关闭

- Given 脚本以 `--refs-only` 标志运行
- When 执行 git commit
- Then commit message 使用 `refs #N`（与 PR body 一致，不触发 GitHub 自动关闭）
