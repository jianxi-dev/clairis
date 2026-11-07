# Proposal: HTML 可视化编辑的拖拽移动与区域截图（H4）

## Why

E-16 给了「点选 + 改字 + 拆块」，E-19 补了「换标签 / 改样式 / 改属性」。逆向报告 §3.4 的五项交互里，还剩两项没落地：

- **拖拽移动节点**：想把一个段落挪到另一段后面，现在只能切源码模式剪切粘贴，且极易破坏缩进与嵌套。
- **区域截图**：报告里这套能力是供 AI 引用页面局部；本仓库没有 AI 引用链路，但「把页面某块导出成图片」本身就是可视化阅读/编辑的常见诉求，且渲染管线（`src/lib/export/png.ts` 的 SVG → canvas）已经存在，复用它几乎零成本。

## What Changes

1. **拖拽移动**：编辑态按住元素拖到目标位置，落点按垂直中线判定插到目标之前或之后；移动 4px 以内视为点击（不触发拖拽）。拖拽中显示插入位置指示线，非法落点（拖进自己的子树）不接受。
2. **区域截图**：工具条新增「截图」入口 → iframe 内拖出选框 → 主侧把该区域渲染成 PNG 并保存。

## Capabilities

### New Requirements

- **E-20 HTML 可视化编辑：拖拽移动节点**
- **E-21 HTML 可视化编辑：区域截图**

### Modified Requirements

- **E-19**（工具条）：新增「截图」入口，工具条不再只是标签/样式/属性三类。

## Impact

- 前端（editing 域）：`src/editors/html/{bridge,runtime,edit}.ts`、新增 `src/editors/html/capture.ts`、`src/components/Content/{HtmlVisualEditor,HtmlEditToolbar}.tsx`
- 复用：`src/lib/export/png.ts`（`svgFromHtml` / `rasterizeSvgToPng` / `blobToBase64`）、`src/lib/export/inlineImages.ts`（相对图片内联）
- Rust：无改动（截图落盘走既有 `save_binary_as_file`）
- 规格：`openspec/specs/editing/spec.md` 增 E-20 / E-21

## Non-goals

- 不做跨文件拖拽、不做拖拽复制（Alt 复制）。
- 不做截图自动上传/AI 引用（本仓库没有该链路）。
- 不保证截图包含外链样式表（`<link rel=stylesheet>`）与 `@import`——SVG 作为图片栅格化时浏览器不加载外部资源。内联 `<style>` 与相对路径图片会保留。
- 不做撤销栈：拖拽与截图都沿用既有 content 派生链路。
