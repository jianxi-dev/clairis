---
type: learning
title: learning — jianxi-dev-clairis — 2026-11-15 — learnings
tags:
  - date:2026-11-15
  - learning
  - repo:jianxi-dev-clairis
---

{"skill":"learn","type":"pitfall","key":"print-pdf-wkwebview-vs-chromium","insight":"打印→存 PDF 的尾段截断是 WKWebView/macOS 打印栈专有：同一打印视图在 headless Chromium page.pdf() 里尾部完整，故既有打印 e2e（只断言打印根 DOM 的 textContent）永远漏网。根因方向：屏幕态块级裁剪（.code-block overflow:hidden、.katex-block overflow-y:hidden、pre/.mermaid-block overflow-x、video max-height）与 break-inside:avoid 叠加时 WebKit 分页器会丢弃该块之后的全部内容。修复=在 @media print 放开内容块自身 overflow/max-height。判据只能落在「打印媒体下的计算样式」（能红能绿）而非 Chromium PDF 文本（修复前也全量）。真机闭环需 npm run tauri dev → 打印 → Save-as-PDF。","confidence":8,"source":"observed","files":["src/styles/print.css","src/lib/printPreview.ts","e2e/print-pagination.spec.ts"],"ts":"2026-11-15T15:32:00.000Z","trusted":false}
{"skill":"learn","type":"pitfall","key":"subagent-fs-isolation-verify-worktree","insight":"本 harness 的 task() 子代理（含 deep-low）在**隔离文件面**运行：其 write/edit 不落到编排器的工作区（编排器 git status 干净、find -mmin 无改动），且后台记录偶发 `Task not found`。后果：实现类委派收不到代码；评审类委派读不到本地 diff。规避：① 实现票由编排器亲自做，或委派时把 diff/文件内容**内联**进 prompt；② 取结果用 session_read/session_search（session_search 用 prompt 特征串可反查 session id）；③ 判断子代理是否真在跑：看 session_info 的最后时间戳。","confidence":9,"source":"observed","ts":"2026-11-15T15:33:00.000Z","trusted":false}
{"skill":"learn","type":"pattern","key":"e2e-assertion-must-discriminate","insight":"判据必须能在修复前为红：① 本次两条 computed maxHeight 断言是死断言（.code-block/.katex-block 屏幕态本无 max-height，恒 'none'）——应改断言**屏幕态确有该属性**的元素（如 .mermaid-block 的 overflow-x、.code-block 的 overflow）。② DOM textContent 完整性断言在「DOM 本就完整、只是打印引擎丢内容」的缺陷面前不可判别，只能作完整性见证。选断言先问「修复前它会红吗？」。","confidence":9,"source":"observed","ts":"2026-11-15T15:33:30.000Z","trusted":false}
{"skill":"learn","type":"operational","key":"gh-project-number-from-conf","insight":"`.change-workflow.conf` 的 PROJECT_ID（PVT_…）对应的 gh **项目编号**未必等于直觉值：本仓 PROJECT_ID=PVT_kwDOE0POlM4BjPai 对应 owner jianxi-dev 下项目编号 **1**（MD-Bundle 开发看板），不是 8。入列用 `gh project item-add <编号> --owner <owner>`，先用 `gh project list --owner <owner>` 核对编号，别硬编码。","confidence":9,"source":"observed","ts":"2026-11-15T15:34:00.000Z","trusted":false}
{"skill":"learn","type":"operational","key":"e2e-side-effect-on-tracked-artifacts","insight":"本仓 `.artifacts/**` 多数被 .git/info/exclude 忽略，但**历史 .artifacts/807|824 等是 force-tracked**；跑打印 e2e 会重写其 pdf/png/state-coverage.json，使工作区变脏并可能被 pr-automation 白名单拒收。收口前先 `git restore .artifacts/807 .artifacts/824`，或把 e2e 产物目录纳入忽略。","confidence":8,"source":"observed","ts":"2026-11-15T15:34:30.000Z","trusted":false}
