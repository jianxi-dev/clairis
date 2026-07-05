# Task for worker

[Read from: /Users/mason/folio/context.md, /Users/mason/folio/plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
实施 Phase 0.85: 浮动目录面板。读取 /Users/mason/folio/doc/designs/design-consultation-20260702.md 了解完整设计决策。具体任务：

1. 创建 /Users/mason/folio/src/components/Content/FloatingOutline.tsx
   - 从 activeTab.content 解析标题（复用 Outline.tsx 的 parseHeadings 逻辑）
   - 渲染为 sticky 浮动面板，position: sticky; top: 32px; right: 0;
   - 苹果原生浮层风格背景: rgba(255,255,255,0.85) + backdrop-filter: blur(8px)
   - 标题缩进: H2→0, H3→14px, H4→28px, H5→42px, H6→56px
   - 当前标题高亮: 左侧 2px indigo 竖线 + 微变色背景
   - IntersectionObserver: 自动跟踪滚动位置，高亮当前标题
   - 点击标题: scrollIntoView 跳转
2. 修改 /Users/mason/folio/src/components/Content/ContentArea.tsx：
   - 在 PreviewView 旁边渲染 FloatingOutline（当 mode === 'preview' 且有标题时）
   - 阅读模式时隐藏
3. 从侧边栏 Outline Tab 移除目录（已由 sidebar-phase-result.md 处理）
4. 验证: npm run build 通过

---
Update progress at: /Users/mason/folio/.pi-subagents/artifacts/progress/2ba6002e/progress.md

---
**Output:**
Write your findings to exactly this path: /Users/mason/folio/.pi-subagents/artifacts/outputs/2ba6002e/outline-phase-result.md
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