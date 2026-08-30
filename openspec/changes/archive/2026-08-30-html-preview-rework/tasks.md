# Tasks: HTML 预览重构

## 1. HtmlPreview asset:// 直载

- [x] 1.1 `src/components/Content/HtmlPreview.tsx`：有 filePath 时改 `iframe src = convertFileSrc(filePath)`（asset:// 直载），sandbox 加 `allow-scripts`；无 filePath 回退现有 srcdoc + rewriteHtmlPaths
- [x] 1.2 CSP 调整：srcdoc 回退路径保留 `script-src 'none'`；asset 直载路径不注入 CSP meta（子文档脚本自由）；`frame-src asset:` 保留
- [x] 1.3 移除不再需要的 `rewriteHtmlPaths` 调用（asset 直载下相对路径天然解析；仅 srcdoc 回退使用）

## 2. 阅读体验

- [x] 2.1 `src/styles/theme-light.css`/`theme-dark.css`：`--reader-max-width` 680 → 880px；`.preview-view h1-h6` 颜色改 `var(--heading-h1..h6, 默认值)` 变量
- [x] 2.2 `src/components/Content/PreviewView.tsx`：markdown 容器改用 `width: min(880px, 100% - 48px)`（替换硬编码 680）；读取 `useEditorStore.headingColors` 注入 `--heading-h1..h6` CSS 变量
- [x] 2.3 暗色主题下标题颜色兼容（沿用默认值，CSS 变量兜底）

## 3. 测试

- [x] 3.1 E2E（`e2e/tauri/`）：html 预览 iframe src = asset URL；iframe 内脚本执行（内联 JS 改 DOM 生效）；点击锚点不白屏（iframe 保持存在）；srcdoc 回退（无 path）仍工作
- [x] 3.2 vitest：PreviewView 宽度 class/变量、headingColors 变量注入
- [x] 3.3 检查既有 E2E（html-css.spec、app.spec）是否依赖 srcdoc/CSP 行为，更新断言
- [x] 3.4 `npx tsc --noEmit` / `eslint` / `npm test` / 浏览器层 Playwright 全绿（除既有失败）

## 4. 交付

- [x] 4.1 tasks 勾选、validate 通过
- [x] 4.2 手动走查：两个实测文件（SPA callout/调色板、Tailwind readme）完整显示；目录可点击；本地资源加载；markdown 宽度与标题配色
