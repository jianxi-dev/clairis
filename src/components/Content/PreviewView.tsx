import { useMemo } from "react";
import { renderMarkdown, processMarkdownLinks } from "../../renderers";
import HtmlPreview from "./HtmlPreview";
import type { FileKind } from "../../types";

interface PreviewViewProps {
  content?: string;
  fileKind?: FileKind;
  filePath?: string | null;
}

export default function PreviewView({
  content = "",
  fileKind = "markdown",
  filePath = null,
}: PreviewViewProps) {
  const html = useMemo(() => {
    switch (fileKind) {
      case "html":
        return null; // HtmlPreview handles rendering
      case "text":
        return renderTextContent(content);
      default:
        return processMarkdownLinks(renderMarkdown(content));
    }
  }, [content, fileKind]);

  if (fileKind === "html") {
    return <HtmlPreview content={content} filePath={filePath} />;
  }

  return (
    <div
      className="preview-view markdown-body"
      style={{ padding: "16px", maxWidth: "680px", margin: "0 auto" }}
      dangerouslySetInnerHTML={{ __html: html ?? "" }}
    />
  );
}

function renderTextContent(content: string): string {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="white-space:pre-wrap;word-wrap:break-word">${escaped}</pre>`;
}
