# Design: HTML 预览重构

## Context

当前 HtmlPreview 用 iframe srcdoc + sandbox + CSP `script-src 'none'`。实测三个问题（见 proposal），根因：
- srcdoc 无真实 URL：锚点 `#x` 解析为父 URL → sandbox 拦截 → 白屏崩溃
- CSP 禁脚本：依赖 JS 注入样式/运行时生成 class 的页面失效
- srcdoc + allow-scripts 无法同时满足"资源加载"（需 allow-same-origin，CORS 绑定 window_origin）与"脚本隔离"（allow-same-origin 让脚本可访问父页面）

## Goals / Non-Goals

**Goals**
1. 复杂 HTML（内联脚本、Tailwind CDN、CSS 变量注入）完整显示。
2. 目录锚点导航正常，不崩溃。
3. 脚本默认允许但**跨源隔离**（不能访问父窗口/Tauri API）。
4. 阅读宽度与标题配色符合预期。
5. 本地相对资源（图片/CSS/字体/`..` 路径）加载正常。

**Non-Goals**
- 不实现脚本白名单/按域许可（用户决策：默认允许）。
- 不做 sandbox 渐进增强 UI（本期直接默认允许）。
- 不迁移既有 srcdoc 重写管线（asset 直载下相对路径天然解析，rewrite 仅作无路径回退保留）。

## Decisions

### D1 iframe 用 asset:// 直载替代 srcdoc

**决策**：有 `filePath` 时 `iframe src = convertFileSrc(filePath)`（`asset://localhost/<path>`）；无路径时回退现有 srcdoc（新文档未落盘场景）。

**理由**（三层收益）：
- **安全**：asset iframe 的 origin 是 `asset://localhost`，与主窗口（`tauri://localhost` / `http://localhost`）跨源。脚本可执行但 `window.parent` 跨源不可访问 → 无法触碰父页面 DOM、Zustand、`window.__TAURI_INTERNALS__` → 恶意本地 HTML 无法 invoke Tauri 命令。这是 srcdoc（同源）无法达到的隔离。
- **锚点**：iframe 有真实 URL，`href="#x"` fragment 导航在 iframe 文档内正常滚动，目录崩溃消除。
- **资源**：相对路径（含 `..`、CSS `url()`/`@import`）由 asset 协议按 iframe 文档位置解析，无需 JS 重写；CORS 同源（asset→asset）通过。

**代价**：真实文件内容由协议直接加载，rewriteHtmlPaths 不再介入（保留用于 srcdoc 回退路径）；mock/E2E 环境无真实文件，iframe 内容为空——测试断言 iframe 存在 + src。

### D2 CSP 与脚本执行

**决策**：
- 父页面 CSP 保留 `frame-src asset:`（放行 iframe 加载）；移除针对子文档的 `script-src 'none'` 影响面——asset 子文档由 Tauri asset 协议响应（无 CSP 头），脚本自由执行（Tailwind CDN `<script src=https://...>` 与内联脚本均可）。
- sandbox 属性：`allow-scripts allow-same-origin allow-popups`（asset 域内同源，脚本可访问 iframe 自身与 asset 资源；跨源隔离父窗口是协议层保证，不依赖 sandbox）。

**风险**：asset 子文档脚本可 fetch 同 scope 内其他本地文件（scope `["**"]`）——属用户显式打开本地文件的文件级风险，接受（用户决策默认允许）。

### D3 阅读宽度 880px

**决策**：`--reader-max-width` 680 → 880px；PreviewView markdown 容器用 `width: min(880px, 100% - 48px); margin: 0 auto`（替换硬编码 680 inline style）。HTML 预览不受此限（asset iframe 全宽）。

### D4 标题配色应用

**决策**：PreviewView 读取 `useEditorStore.headingColors`（默认 h1-h6 六色），渲染时给 `.markdown-body` 容器注入 CSS 变量（`--heading-h1`…`--heading-h6`）；theme css 的 `.preview-view h1 { color: var(--heading-h1, inherit) }` 等。明暗主题下颜色可能需微调（亮/暗两套默认色）——先沿用现有 headingColors 默认值，暗色下若对比不足记录为后续调色项。

## Risks / Trade-offs

- **[asset 子文档脚本自由执行]** → 跨源隔离父窗口（无 invoke/无父 DOM）；同 scope 文件读取为残余风险，用户决策接受。
- **[mock E2E 无法验证真实加载]** → 断言 iframe src 与存在性；真实加载走手动走查（两个实测文件）。
- **[headingColors 暗色对比]** → 沿用现有默认色，手动走查记录。
- **[宽度变化影响既有 E2E 布局断言]** → 检查现有测试是否依赖 680px（app.spec 等），必要时更新。

## Migration Plan

1. HtmlPreview 改造 → PreviewView 宽度/配色 → theme css → E2E/vitest 更新 → 验证。
2. 无数据迁移；无配置字段变化。
3. 回滚：分支级。

## Open Questions

- 暗色主题下 headingColors 是否需要独立配色（后续调色项，本期沿用默认）。
