# Tasks: 导出 HTML

> 本 change 只有一个交付任务（1 change = 1 issue = 1 PR）。

- [x] 1.1 导出 HTML：页签右键「导出 HTML…」→ 生成离线单文件（内联样式、尽力内联图片、无署名）→ 系统保存对话框写盘

  执行步骤：

  1. `src/lib/export/html.ts`：`buildHtmlDocument(markdown, { title, css, extraHead? })`，用 `renderMarkdown` + `?raw` 样式。
  2. `src/lib/export/inlineImages.ts`：相对路径图片 → data URL（读文件走 `read_file_base64`），返回失败计数。
  3. `src/components/TabBar.tsx`：右键菜单加「导出 HTML…」，调用 `save_as_file`。
  4. 测试：`src/__tests__/exportHtml.test.ts`（结构/离线/无署名/图片内联）+ `e2e/tauri/export-html.spec.ts`（菜单出现、调用 save_as_file）。
  5. 验证：`npx tsc --noEmit`、`npx vitest run src/__tests__/exportHtml.test.ts`、两套 Playwright。
