# Pull Request 模板

> 所有 PR 必填。按风险等级分级评审:
> - `risk-low`(注释/日志/单测/简单容错)→ CI 绿自动合并
> - `risk-medium`(普通功能/缺陷修复)→ CI 绿后自动合并（agent 直接 `gh pr merge --squash`，无需人工确认）
> - `risk-high`(核心逻辑/渲染/保存模型)→ 强制人工评审

## 变更概述
一句话说明解决的问题。

## 关联 Issue
- 缺陷修复票**必须**写 `fixes #<issue号>`（1 票 = 1 分支 = 1 PR，逐票一行，见 DQ-6）。
  仅引用（不关单）用 `Refs #<issue号>`。注意：evidence-check 只对 `closingIssuesReferences`
  里的票号做 state-coverage 校验 —— 写 `refs` 等于跳过检查。

## 变更内容
- 改动模块:
- 核心文件清单:
- 关键逻辑说明:

## 影响范围
- 接口变更:
- 下游影响:
- 线上风险:

## 验证方式与结果
- [ ] `npx tsc --noEmit`（含在 build 内）
- [ ] `npm test`
- [ ] (涉 e2e) `npx playwright test <spec>`
- [ ] (涉 ui-surface) `.artifacts/<票号>/state-coverage.json` ≥4 态 + 截图前后对比
- [ ] 自测结果/复现步骤验证:

## 风险评估
- **风险等级**: `risk-low` / `risk-medium` / `risk-high`
- **来源**: `ai-generated`（AI 生成）/ 人工
- **回滚方案**: `git revert <merge-commit>` 即可回滚
