# #671 PDF 按钮栏固定显示/隐藏与快捷键 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #660 / tasks 8.1，design D10）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-8.1 | 固定隐藏后按钮栏计算 display 严格 = none | PASS（e2e shadow DOM 探针读 computedStyle.display === "none"） |
| A-8.2 | 快捷键切换后按钮栏可见 | PASS（⌘⇧D → display ≠ none） |
| A-8.3 | 切换文档后恢复默认且无残留 | PASS（切 md 再切回 PDF → 可见；视图级状态随卸载复位） |

## 实现要点

- `src/components/Content/pdfToolbarPin.ts`：按文件路径登记「固定开关」回调（`Map<path, toggle>`），`PdfViewer` 挂载登记 / 卸载注销——状态随视图存活，切页签即复位，不写配置、不写文档（D10「只影响当前 PDF 视图」）。
- `PdfViewer`：`toolbarPinnedHidden` 视图级 state；CSS 注入 `:host(.pdf-chrome-pinned-hidden) [data-epdf-i="main-toolbar"]{display:none !important}`；固定隐藏时清除 #570 的 `chromeHidden/chromePeek` 以免两套收起互斥冲突。
- 同源两入口：按钮栏右组注入 `command-button`（`pdf:toggle-toolbar-pin`，图标 eye）+ 全局快捷键 ⌘⇧D（App.tsx，仅活动页签为 PDF 时生效，已 preventDefault）。
- 快捷键登记 `src/lib/shortcuts.ts`（family mode，`⌘⇧D`，implemented: true）；冲突核查：注册表内无其它 ⌘⇧D。

## 回归（亲测）

- `npx playwright test e2e/pdf-toolbar.spec.ts --workers=1`：2 passed（新文件）
- `npx playwright test e2e/pdf-chrome.spec.ts --workers=1`：2 passed（#570 双击收起交互无回归）
- `npx vitest run`：124 文件 / 1532 用例（串行，避免并行 jsdom 饥饿）
- `npx tsc --noEmit` / css-manifest / eslint（0 error）通过
- Rust 未改动（数据面：无）
