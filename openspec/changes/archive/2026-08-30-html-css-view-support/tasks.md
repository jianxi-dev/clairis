# Tasks: HTML 预览资源补齐 + 复杂 CSS 渲染支持

## 1. HTML 资源解析补齐

- [x] 1.1 `src/renderers/html.ts`：抽 `rewriteSrcsetAttr(value, resolve)` 纯函数（候选按 `,` 拆分 → URL 与描述符分离 → 逐项 resolve → `, ` 重组）；`rewriteHtmlPaths` 新增 `srcset="..."` 属性重写
- [x] 1.2 `src/renderers/html.ts`：inline `<style>` 处理追加 `@import ["']path["']`（无 `url()` 形式）重写；`@import url(...)` 由既有规则覆盖
- [x] 1.3 `src/components/Content/HtmlPreview.tsx`：CSP 补齐 `frame-src 'self' asset:`、`font-src 'self' asset: data:`、`media-src 'self' asset:`（`script-src 'none'` 与既有 img/style 许可不变）
- [x] 1.4 单测 `src/__tests__/htmlRewrite.test.ts`：srcset 拆分/重组（1x/2x/100w 描述符、data:/http: 跳过、畸形候选兜底）、`@import "..."` 重写、既有 src/href/poster 回归

## 2. 复杂 CSS 渲染验收

- [x] 2.1 E2E（`e2e/tauri/`）：打开含复杂 CSS 的 HTML（grid 布局 + 自定义字体名 + 背景色 + CSS 变量 + `@keyframes` 动画），断言 iframe 内 computed style 生效（display:grid、font-family 应用、背景色、变量计算值）
- [x] 2.2 E2E：打开含 `<video>`/`@font-face`（data URI 形式）的 HTML，断言媒体元素存在且无 CSP 报错（console 无 violation）
- [x] 2.3 手动走查清单（`npm run tauri dev`）：本地 `@font-face` 字体文件、外部 CSS 相对 `url()`/`@import`（含 `..` 引用）、`<video>` 本地文件、内嵌 iframe 子页——真实 asset 协议路径验证，标注结论

## 3. 验证与交付

- [x] 3.1 `npx tsc --noEmit` / `npx eslint src/` / `npm test`（除既有 docsGovernanceGate 失败）全绿
- [x] 3.2 `bash scripts/css-manifest-check.sh` 与浏览器层 Playwright 通过
- [x] 3.3 更新 `docs/delivery/roadmap.md` 或 CHANGELOG 相关条目（如适用）；tasks 全部勾选
