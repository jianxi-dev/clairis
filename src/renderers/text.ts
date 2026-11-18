import { renderPreviewLineNumbers } from "../lib/previewLineNumbers";

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Render plain text as HTML-safe <pre> content.
 */
export function renderText(content: string): string {
  if (!content) return "";
  return `<pre style="white-space:pre-wrap;word-wrap:break-word">${escapeHtmlText(content)}</pre>`;
}

/**
 * 预览态文本块（#1051 / reading「文本与脚本预览语法」）：与主预览
 * `PreviewView.renderTextContent` 的纯文本分支同构，带逐行行号列。
 * 供 `FloatingPreview`（真实 `open_file_direct` 预览面）复用，使同一需求在
 * 主预览与悬浮预览两条渲染层上口径一致。
 */
export function renderTextPreview(content: string): string {
  if (!content) return "";
  const numbers = renderPreviewLineNumbers(content);
  return `<div class="code-block wide has-line-numbers"><div class="code-lines">${numbers}<pre style="white-space:pre-wrap;word-wrap:break-word">${escapeHtmlText(content)}</pre></div></div>`;
}
