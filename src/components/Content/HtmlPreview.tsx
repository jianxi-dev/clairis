import { useState, useMemo } from "react";
import { rewriteHtmlPaths } from "../../renderers";

interface HtmlPreviewProps {
  content: string;
  filePath?: string | null;
}

export default function HtmlPreview({ content, filePath }: HtmlPreviewProps) {
  const [error, setError] = useState<string | null>(null);

  const sandboxed = useMemo(() => {
    if (!content) {
      return "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body></body></html>";
    }

    // Rewrite relative paths to asset://localhost URLs
    const processed = rewriteHtmlPaths(content, filePath ?? null);

    return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self' 'unsafe-inline'; img-src 'self' data: asset:; style-src 'self' 'unsafe-inline' asset:; script-src 'none';">
</head>
<body>
<!-- Preview rendered by JianXi — paths rewritten for local asset loading -->
${processed}
</body></html>`;
  }, [content, filePath]);

  // Handle iframe load errors
  const handleError = () => {
    setError("HTML 预览加载失败。尝试右键 → 在浏览器打开。");
  };

  if (error) {
    return (
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          color: "#666",
        }}
      >
        <p>{error}</p>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={sandboxed}
      sandbox="allow-same-origin allow-popups"
      style={{ width: "100%", height: "100%", border: "none" }}
      title="HTML 预览"
      onError={handleError}
    />
  );
}
