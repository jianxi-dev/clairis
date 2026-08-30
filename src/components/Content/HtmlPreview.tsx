import { useState, useMemo } from "react";
import { buildAssetUrl } from "../../renderers";
import { rewriteHtmlPaths } from "../../renderers";
import { useEditorStore } from "../../stores/editorStore";
import { isTauriEnv } from "../../utils/tauri";

interface HtmlPreviewProps {
  content: string;
  filePath?: string | null;
  /** 整体缩放比例（iframe 元素 zoom，视觉缩放不重排） */
  zoom?: number;
}

export default function HtmlPreview({
  content,
  filePath,
  zoom = 1,
}: HtmlPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const fontSize = useEditorStore((s) => s.fontSize);

  // Asset 直载：iframe 通过 asset 协议加载真实本地文件——脚本可执行但与主窗口跨源隔离，
  // 相对资源按文件路径天然解析（buildAssetUrl 保留目录结构，convertFileSrc 会塌缩路径
  // 导致文档内相对引用 404），锚点导航正常。无路径或非 Tauri 环境时回退 srcdoc
  // （convertFileSrc 在浏览器环境无 __TAURI_INTERNALS__ 会同步抛错击穿渲染树）。
  const assetSrc = filePath && isTauriEnv() ? buildAssetUrl(filePath) : null;

  const sandboxed = useMemo(() => {
    if (!content) {
      return "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body></body></html>";
    }

    // 仅 srcdoc 回退路径需要重写相对路径与注入禁脚本 CSP
    const processed = rewriteHtmlPaths(content, filePath ?? null);

    return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self' 'unsafe-inline'; img-src 'self' data: asset:; style-src 'self' 'unsafe-inline' asset:; font-src 'self' asset: data:; media-src 'self' asset:; frame-src 'self' asset:; script-src 'none';">
<style>html { font-size: ${fontSize}px; }</style>
</head>
<body>
<!-- Preview rendered by Clairis — paths rewritten for local asset loading -->
${processed}
</body></html>`;
  }, [content, filePath, fontSize]);

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

  if (assetSrc) {
    return (
      <iframe
        src={assetSrc}
        sandbox="allow-scripts allow-same-origin allow-popups"
        style={{ zoom, width: "100%", height: "100%", border: "none" }}
        title="HTML 预览"
        onError={handleError}
      />
    );
  }

  return (
    <iframe
      srcDoc={sandboxed}
      sandbox="allow-same-origin allow-popups"
      style={{ zoom, width: "100%", height: "100%", border: "none" }}
      title="HTML 预览"
      onError={handleError}
    />
  );
}
