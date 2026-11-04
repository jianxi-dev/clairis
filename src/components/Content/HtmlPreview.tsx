import { useState, useMemo } from "react";
import { rewriteHtmlPaths } from "../../renderers";
import { useEditorStore } from "../../stores/editorStore";

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

  // 一律用 srcdoc，不再走 asset 协议直载磁盘文件。
  //
  // 直载的好处是脚本能跑、相对引用天然解析；代价是**预览读的是磁盘上的旧内容**
  // ——编辑态改了还没保存时，切回预览看到的还是上一次保存的版本（E-15 要求
  // 编辑改动切回预览可见）。相对资源改由 rewriteHtmlPaths 重写成 asset://，
  // 效果等价；脚本执行留给 H2 的可视化编辑专门设计（届时需要 postMessage 桥，
  // 现在的 CSP `script-src 'none'` 正好不会让半成品脚本干扰预览）。

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
