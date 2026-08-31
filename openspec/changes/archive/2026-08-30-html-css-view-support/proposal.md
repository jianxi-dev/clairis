# Proposal: HTML 预览资源解析补齐 + 复杂 CSS 样式渲染支持

## Why

HTML 预览（reading A-3）规格已批准，但实现有两个缺口：① `rewriteHtmlPaths` 只重写 `src`/`href`/`poster` 与内联 `<style>` 的 `url()`——`srcset`、`picture`、CSS `@import "..."`（无 `url()` 形式）、iframe 内嵌资源（CSP 缺 `frame-src asset:`）均未处理；② 预览 CSP 只放行了图片/样式/内嵌页许可，`font-src` 与 `media-src` 未声明（回退 `default-src 'self'`），本地 CSS 中常见的 `@font-face` 字体文件、`<video>/<audio>` 资源在预览中被拦截——含复杂 CSS（自定义字体、背景、动画等）的本地 HTML 无法在预览中完整呈现。

## What Changes

- **HTML 资源解析补齐**：
  - `img` / `source` 的 `srcset` 属性按候选拆分逐项重写相对路径（`img.png 1x, img2.png 2x` 形式，data:/http:/asset: 跳过）
  - CSS `@import "path"`（无 `url()` 包裹形式）重写为可解析路径
  - CSP 增加 `frame-src 'self' asset:`，允许 iframe 内嵌同目录 HTML（子文档继承父级 CSP，禁脚本性质不变）
- **复杂 CSS 渲染保障**：
  - CSP 补齐 `font-src 'self' asset: data:`（本地/内嵌字体）与 `media-src 'self' asset:`（本地音视频）
  - 外部 `<link>` CSS 及其内部 `url()`/`@import` 相对引用：浏览器请求前按 URL 标准折叠 `..`，asset 协议按剩余路径映射文件系统，无需 JS 重写（协议级验证）
  - 复杂 CSS 能力（flex/grid/动画/变量/calc/伪元素/媒体查询）为渲染引擎原生能力，srcdoc 下天然支持——以 E2E 断言 + 手动走查锁定

## Capabilities

### New Capabilities

<!-- 无新能力：全部为现有规格 reading 域落地 -->

### Modified Capabilities

- `reading`：A-3 HTML 预览的验收细化——相对路径资源（`srcset`/`picture`/外部 CSS/内嵌 iframe）SHALL 正确加载；本地字体与音视频（`@font-face`、`<video>/<audio>`）SHALL 不受 CSP 拦截；复杂 CSS 样式 SHALL 正常渲染；脚本仍 SHALL 全部禁止。

## Impact

- **前端**：
  - `src/renderers/html.ts` — `srcset` 重写、`@import "..."` 重写；抽 `rewriteSrcsetAttr` 纯函数便于单测
  - `src/components/Content/HtmlPreview.tsx` — CSP 补 `frame-src`/`font-src`/`media-src`
- **测试**：`src/__tests__/` 新增 srcset/@import 重写单测；E2E 打开含复杂 CSS 的 HTML，断言 iframe 内样式生效（grid 布局、自定义字体名、背景色）
- **无 Rust 改动、无新依赖**

## 验收门槛

- `npx tsc --noEmit` / `npx eslint src/` / vitest 全绿（除既有 docsGovernanceGate）
- E2E：HTML 预览中复杂 CSS 样式生效（E2E 断言 computed style）
- `npm run tauri dev` 手动走查：本地 HTML 的相对图片/字体/样式/音视频/内嵌 iframe 加载、复杂 CSS 完整呈现
