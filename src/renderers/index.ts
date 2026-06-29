import type { FileKind } from "../types";
import { renderMarkdown, processMarkdownLinks } from "./markdown";
import { renderText } from "./text";

export { renderMarkdown, processMarkdownLinks } from "./markdown";
export { rewriteHtmlPaths } from "./html";
export { renderText } from "./text";

/**
 * Render document content to HTML based on its file kind.
 * Returns processed HTML that PreviewView can render directly
 * (via dangerouslySetInnerHTML for safe types, or pass to HtmlPreview for html).
 */
export function renderByKind(kind: FileKind, content: string): string {
  switch (kind) {
    case "markdown":
      return processMarkdownLinks(renderMarkdown(content));
    case "html":
      return content; // Raw — HtmlPreview handles srcdoc + path rewriting
    case "text":
      return renderText(content);
  }
}
