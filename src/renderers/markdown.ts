import { marked } from "marked";
import DOMPurify from "dompurify";

export function renderMarkdown(content: string): string {
  if (!content) return "";

  const raw = marked.parse(content, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      "p", "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "pre", "code",
      "blockquote", "table", "thead", "tbody", "tr", "th", "td",
      "img", "a", "em", "strong", "del", "hr", "br",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "target"],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  });
}

/** Add target="_blank" to all links after sanitization */
export function processMarkdownLinks(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("a").forEach((a) => {
    if (!a.getAttribute("target")) {
      a.setAttribute("target", "_blank");
    }
  });
  return doc.body.innerHTML;
}
