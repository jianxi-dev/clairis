# Proposal: 导出 HTML（A2a）

## Why

A1 落了 `.mdpkg` 读写层，但用户还没有任何「把当前文档带走」的入口。导出里 HTML 是最独立的一块：单文件、离线可看（D9），不依赖 PNG 光栅化或 docx 写盘，也不依赖 contentweave。先交付它，PNG/.mdpkg/docx 作为 A2b/A2c 继续。

## What Changes

- 新增 `src/lib/export/`：`buildHtmlDocument(markdown, options)`（自包含单文件：内联样式、可选内联图片）与 `inlineImages`（把相对路径图片转 data URL）。
- 复用现有渲染管线：`src/renderers/renderMarkdown`；样式来自 `src/styles/reader.css` + `tokens.css`（`?raw` 导入），不引入新依赖。
- UI 入口：页签右键菜单新增「导出 HTML…」→ 主进程保存对话框（复用 `save_as_file`）。
- 不做第三方署名徽章（与 A1「生成物不注入署名」一致）。

## Capabilities

### New Capabilities

- `export`：单文件 HTML 导出的内容保真、离线自包含与不注入署名。

### Modified Capabilities

<!-- 无 -->

## Impact

- 代码：`src/lib/export/{html,inlineImages}.ts`、`src/components/TabBar.tsx`（菜单项）、`src/lib/export/__tests__` 或 `src/__tests__/`。
- 风险：低。纯渲染 + 写盘；失败给出人话提示。
- 非目标：PNG（A2b）、docx（A2c）、.mdpkg 导出（A2d）、KaTeX 字体内联（后续）。
