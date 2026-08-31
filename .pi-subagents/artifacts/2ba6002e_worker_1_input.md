# Task for worker

[Read from: /Users/mason/folio/context.md, /Users/mason/folio/plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
实施 Phase 0.9: Lucide icon 替换。读取 /Users/mason/folio/doc/designs/design-consultation-20260702.md 了解完整设计决策。具体任务：

1. cd /Users/mason/folio && npm install lucide-react
2. 创建 /Users/mason/folio/src/components/FolioIcon.tsx，封装一个统一风格的 icon 组件，默认 strokeWidth={1.5}
3. 改造 /Users/mason/folio/src/components/Toolbar.tsx：
   - 用 Lucide icon 替换所有 emoji 和纯文字按钮
   - icon 在左，文字在右
   - 按钮组之间用分隔线
   - 模式切换用 icon+文字
4. 改造 /Users/mason/folio/src/components/TabBar.tsx：关闭按钮 × 替换为 Lucide X icon
5. 改造 /Users/mason/folio/src/components/Sidebar/FileTree.tsx：用 Lucide FileText 和 ChevronRight 替换 emoji
6. 改造 /Users/mason/folio/src/components/Sidebar/RecentFiles.tsx：用 Lucide FileText 替换 emoji
7. 改造 /Users/mason/folio/src/components/Content/ContentSplitView.tsx 中的 ModeButton（用 icon）
8. 验证: npm run build 通过

---
Update progress at: /Users/mason/folio/.pi-subagents/artifacts/progress/2ba6002e/progress.md

---
**Output:**
Write your findings to exactly this path: /Users/mason/folio/.pi-subagents/artifacts/outputs/2ba6002e/icons-phase-result.md
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```