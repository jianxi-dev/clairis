/**
 * Render plain text as HTML-safe <pre> content.
 */
export function renderText(content: string): string {
  if (!content) return "";
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="white-space:pre-wrap;word-wrap:break-word">${escaped}</pre>`;
}
