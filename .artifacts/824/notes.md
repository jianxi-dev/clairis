# #824 打印预览丢页 / mermaid 跨页截断 / 视频空白 — 交付记录

## 结论

- **分页**：打印根 `#biaoyue-print-root` 直接挂在 `body` 下，`src/styles/editor.css:15-21` 给 `html/body/#root` 定了 `height:100%; overflow:hidden`。打印态必须放开父链，否则多页内容被视口高度夹住（反向实测：注入该样式后 120 节长文只剩 1 页）。本次把 `#biaoyue-print-root`、`.preview-shell`、`.preview-content` 一并纳入放开清单。
- **mermaid**：`.mermaid-block` 的 `break-inside: avoid` 救不了「块高 > 一页」的图，Chromium 仍会在页边界切断。打印态给 `.mermaid-view svg` 加 `max-height: 240mm; width: auto`，超高图等比缩到单页内；短图不受影响。
- **视频**：打印根内把 `<video>` 替换为可见占位（有 poster 用图片，否则文件名 + 图标），只改打印根，不动屏幕预览。

## 复现命令

```bash
npm run dev              # http://localhost:1420
npx playwright test e2e/print-pagination.spec.ts --reporter=line
```

复现脚本（定位用）：`page.emulateMedia({ media: "print" })` + `page.pdf({ format: "A4", printBackground: true, margin: 10mm })`，
`pdfinfo` / `/Type /Page` 计页数，`pdftoppm` 出 PNG 直读。

## 实测（修复后）

| 文档 | 页数 | 关键断言 |
| --- | --- | --- |
| `formula-mermaid.md` | 2 | mermaid 完整在第 1 页，图后代码/引用在第 2 页 |
| 120 节长文（含 120 表格） | 30 | 第 120 节与表格在最后一段；`body overflow:visible`、`.preview-content min-height:0` |
| 26 节点竖图（SVG 108×2464） | 2 | mermaid 块高 943px（≤240mm），整图在一页，图后正文/表格在第 2 页 |
| 视频文档 | 1 | `.print-video` 占位含 `clip.mp4`，打印根内无 `<video>` |

反向验证（根因）：打印态注入 `html,body,#root{height:100%!important;overflow:hidden!important}` 后，同一 120 节长文 `page.pdf()` 只剩 **1 页**。

## 变更文件

| 文件 | 作用 |
| --- | --- |
| `src/styles/print.css` | 父链放开清单加入 `.app-root` / `#biaoyue-print-root` / `.preview-shell` / `.preview-content`；`.mermaid-view svg` 超高缩放；`.print-video` 占位样式 |
| `src/lib/printPreview.ts` | 新增 `replaceVideosWithPrintPlaceholder(root)`，渲染后替换 `<video>` |
| `e2e/print-pagination.spec.ts` | 新增 4 条真实浏览器用例（page.pdf 页数 / mermaid 不跨页 / 视频占位） |

## 验收输出

- `npx tsc --noEmit` → 0
- `npx eslint src/lib/printPreview.ts` → 0
- `npm test` → 124 files / 1579 tests 全绿
- `npx playwright test e2e/print-pagination.spec.ts` → 4 passed
- `npx playwright test e2e/print.spec.ts` → 10 passed（既有断言未删改）

## 证据

- `formula.pdf` / `final-formula-1.png` / `final-formula-2.png`
- `tall-mermaid.pdf` / `final-tall-mermaid-1.png` / `final-tall-mermaid-2.png`
- `video.pdf` / `final-video-1.png`
- `long.pdf` / `final-long-p1-01.png` / `final-long-p30-30.png`
- `state-coverage.json`

## 假设与限制

1. `max-height: 240mm` 取 A4 内容高（297−2×10mm=277mm）扣除块内边距/边框后的安全值；短图（<240mm）不受影响。用户若在打印对话框把页边距调到 ≥20mm，可用高度会小于 240mm，此时 `break-inside: avoid` 会尝试整块移到下一页。
2. 视频占位取 `src` 末段作文件名；`poster` 属性当前不在 DOMPurify 白名单内，故 `renderMarkdown` 输出的视频不会带 poster，走占位分支。
3. 未做真实 Tauri 窗口打印对话框验证；按任务约定用 Playwright Chromium `page.pdf()` 验证。原生打印预览若仍有差异，需真机复测。
