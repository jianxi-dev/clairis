// 导出 HTML：把 Markdown 渲染成单文件、离线可看的 HTML 文档。
// 样式由调用方以原文传入（Vite `?raw` 导入 reader.css / tokens.css），
// 这里只负责拼装，不读文件、不引用任何外部资源（D1 单文件离线）。
import { renderMarkdown } from "../../renderers/markdown";

export interface BuildHtmlOptions {
  title: string;
  /** 已读入的 CSS 原文，整体内联进一个 <style> */
  css: string;
  /** 正文容器的额外 class（默认就是阅读区的 .preview-content） */
  bodyClassName?: string;
  /**
   * 可选的同步图表渲染器：把 mermaid 源码块换成内联 SVG（design D7）。
   * 返回 null 时保留源码块——单图失败不阻断整份导出。
   */
  diagramSvg?: (source: string) => string | null;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 导出产物的外壳样式：reader.css 的排版规则都挂在 `.preview-content` 下，
 * 而那个选择器在应用里依赖 `.preview-shell` 提供纸面背景与居中。
 * 这里补一层最小外壳，让独立打开的 HTML 也有纸面、页边距与居中通道。
 */
const EXPORT_SHELL_CSS = `
html { background: var(--app-bg, #f7f7f6); }
body { margin: 0; }
.export-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg, #f7f7f6);
}
`;

/** 正文容器默认 class：直接复用阅读区的排版规则 */
const DEFAULT_BODY_CLASS = "preview-content";

/** renderMarkdown 对 mermaid 块输出的确切 markup（见 renderers/markdown.ts）。 */
const MERMAID_SOURCE_RE = /<pre class="mermaid">([\s\S]*?)<\/pre>/g;

/** 还原 renderMarkdown 对图源码做的 HTML 转义；&amp; 必须最后替换，避免二次还原。 */
function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** 用内联 SVG 替换 mermaid 源码块；渲染器返回 null 时原样保留该块。 */
function injectDiagrams(
  body: string,
  render: (source: string) => string | null,
): string {
  return body.replace(MERMAID_SOURCE_RE, (block, escaped: string) => {
    const svg = render(unescapeHtml(escaped));
    return svg && svg.trim() ? svg : block;
  });
}

export function buildHtmlDocument(
  markdown: string,
  opts: BuildHtmlOptions,
): string {
  const rendered = renderMarkdown(markdown);
  const body = opts.diagramSvg
    ? injectDiagrams(rendered, opts.diagramSvg)
    : rendered;
  const title = escapeHtml(opts.title);
  const bodyClass = [DEFAULT_BODY_CLASS, opts.bodyClassName]
    .filter(Boolean)
    .join(" ");

  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${title}</title>`,
    `<style>${opts.css}\n${EXPORT_SHELL_CSS}</style>`,
    "</head>",
    "<body>",
    '<div class="export-root">',
    `<div class="${bodyClass}">`,
    body,
    "</div>",
    "</div>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
