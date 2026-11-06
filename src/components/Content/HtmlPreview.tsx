import { useState, useMemo } from "react";
import { rewriteHtmlPaths, buildAssetUrl } from "../../renderers";
import { useEditorStore } from "../../stores/editorStore";
import { isTauriEnv } from "../../utils/tauri";

interface HtmlPreviewProps {
  content: string;
  filePath?: string | null;
  /** 整体缩放比例（iframe 元素 zoom，视觉缩放不重排） */
  zoom?: number;
  /**
   * 直载磁盘文件（asset URL）：脚本与 CDN/字体等外链照常执行/加载。
   * 仅已保存文件可直载；未保存（dirty）必须回退 srcdoc + 禁脚本 CSP。
   */
  live?: boolean;
}

export default function HtmlPreview({
  content,
  filePath,
  zoom = 1,
  live = false,
}: HtmlPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const fontSize = useEditorStore((s) => s.fontSize);

  // 已保存文件走 asset 直载：脚本能跑、相对引用天然解析、CDN/外链字体不被拦。
  // dirty 内容仍走 srcdoc——预览必须反映未保存的编辑（E-15），且未保存内容
  // 不可信，绝不给它脚本执行权。

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
<!-- Preview rendered by Biaoyue — paths rewritten for local asset loading -->
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

  if (live && filePath && isTauriEnv()) {
    return (
      <iframe
        src={buildAssetUrl(filePath)}
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
