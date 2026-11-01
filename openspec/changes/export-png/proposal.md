# Proposal: 导出 PNG 长图（A2b）

## Why

A2a 已经能生成自包含 HTML。把同一份 HTML 经 SVG `foreignObject` + canvas 栅格化，就能得到「一键保存成图片」的长图，不需要 html2canvas 之类的新依赖（浏览器原生排版，CJK/emoji 走系统字体）。

## What Changes

- 搬 `exportPng` 的核心：HTML → 良构 XHTML → `foreignObject` SVG → `img` → canvas 2x → PNG Blob。
- 高度测量走可注入 seam（浏览器默认实现 + 单测 fake）。
- 主进程新增二进制保存命令（现有 `save_as_file` 只接受文本），用于写 PNG。
- 页签右键菜单新增「导出图片…」。
- 不加 byline、不内联 KaTeX 字体（v1 限制，数学公式随页面字体渲染）。

## Capabilities

### New Capabilities

<!-- 无新增；扩展 export 能力 -->

### Modified Capabilities

- `export`：新增 EX-4 PNG 长图导出（尺寸、良构、二进制写盘）。

## Impact

- 代码：`src/lib/export/png.ts`、`src-tauri/src/commands/file.rs`（`save_binary_as_file`）、`src/components/TabBar.tsx`。
- 风险：中。栅格化依赖浏览器排版；高度测量与字体加载需要等待 `document.fonts.ready`。
