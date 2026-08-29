# Proposal: HTML 预览重构（asset:// 直载 + 脚本默认允许 + 阅读宽度/配色修复）

## Why

用户实测反馈三类问题，根因均已定位：
1. **复杂 HTML 显示不全**（callout、调色板、Tailwind CDN 样式失效）：预览用 srcdoc iframe + CSP `script-src 'none'`，依赖脚本注入样式（`window.__STYLE__` 写 CSS 变量、Tailwind Play CDN 运行时生成 class）的页面全部失效。用户决策：**默认允许脚本**。
2. **点击目录（锚点）崩溃**：srcdoc iframe 无真实 URL，点击 `<a href="#x">` 被解析为父页面顶层 URL 导航，sandbox 拦截后预览白屏。
3. **阅读体验**：markdown 预览硬编码 680px 过窄；`headingColors` 配置未应用到预览（标题"纯色"）。

技术约束：Tauri asset 协议 CORS 固定为 window_origin——srcdoc 若去掉 `allow-same-origin`，本地资源加载失败；保留则脚本可访问父页面（可 invoke Tauri 命令，风险高）。

## What Changes

- **HTML 预览改 asset:// 直载**：`HtmlPreview` 从 `srcDoc` 改为 `iframe src = convertFileSrc(filePath)`（asset 协议加载真实文件）。iframe origin 为 asset 域，与主窗口**跨源隔离**——脚本默认执行（满足复杂 HTML 需求）但无法访问父页面 DOM/Tauri API（安全边界）；锚点导航有真实 URL（目录崩溃修复）；本地相对资源由 asset 协议按文件相对路径解析（CSS `url()`/`@import` 含 `..` 均天然工作）。无路径时回退 srcdoc。
- **CSP 调整**：父页面 CSP 不再约束 asset 子文档脚本（子文档无 CSP 头则脚本自由执行）；保留 `frame-src asset:` 放行；外部 CDN（Tailwind/Google Fonts）`style-src`/`script-src` 经 asset 子文档自身加载不受父 CSP 限制。
- **阅读宽度**：markdown 预览 `--reader-max-width` 680px → 880px（自适应 `min(880px, 100% - 48px)`）。
- **标题配色**：`headingColors`（editorStore 配置）应用到预览 h1-h6（CSS 变量注入，明暗主题兼容）。
- **规格变更**：reading A-3 从"禁脚本 + srcdoc"改为"asset:// 直载 + 脚本默认允许 + 跨源隔离"。

## Capabilities

### New Capabilities

<!-- 无新能力 -->

### Modified Capabilities

- `reading`：A-3 HTML 预览重定义——asset:// 直载、脚本默认允许（跨源隔离）、锚点导航正常、阅读宽度与标题配色。

## Impact

- `src/components/Content/HtmlPreview.tsx`：iframe src 模式 + srcdoc 回退
- `src/components/Content/PreviewView.tsx`：markdown 宽度 880px、headingColors CSS 变量注入
- `src/styles/theme-light.css` / `theme-dark.css`：h1-h6 颜色变量、宽度变量
- 测试：E2E 调整（iframe src 断言、脚本执行断言、锚点导航断言）、vitest headingColors/宽度
- **注意**：mock 环境 `convertFileSrc` 返回 `asset://localhost/...`（无真实文件，iframe 内容空）——E2E 断言 iframe 存在与 src 属性；真实文件加载走手动走查

## 验收门槛

- tsc / eslint / vitest 全绿（除既有 docsGovernanceGate）
- E2E：iframe src = asset URL、脚本执行（iframe 内 JS 生效）、锚点点击不再白屏
- `npm run tauri dev` 手动走查：两个实测文件（SPA callout/调色板、Tailwind readme）完整显示、目录可点击、本地图片/CSS 加载
