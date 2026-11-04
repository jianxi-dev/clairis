import { useEffect, useMemo, useRef } from "react";
import { useEditorStore } from "../../stores/editorStore";
import {
  buildEditableDoc,
  type BridgeMessage,
} from "../../editors/html/runtime";

interface HtmlVisualEditorProps {
  content: string;
  filePath?: string | null;
  /** 桥上报的入口，切片 3 之后在这里派发 selection / textEdit。 */
  onBridgeMessage?: (msg: BridgeMessage) => void;
}

/**
 * HTML 可视化编辑面板（E-16 / H2）。
 *
 * 与 `HtmlPreview` 是**两条通道**（design D1）：预览禁一切脚本，这里只放行
 * 带 nonce 的注入运行时。刻意不复用同一个组件加开关——两种安全姿态混在
 * 一个 iframe 里，迟早会漂移。
 */
export default function HtmlVisualEditor({
  content,
  filePath,
  onBridgeMessage,
}: HtmlVisualEditorProps) {
  const fontSize = useEditorStore((s) => s.fontSize);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const srcDoc = useMemo(
    () => buildEditableDoc(content, { filePath, fontSize }),
    [content, filePath, fontSize],
  );

  useEffect(() => {
    if (!onBridgeMessage) return;
    const onMessage = (e: MessageEvent) => {
      // 只收自己 iframe 发来的消息：srcdoc + sandbox 下 origin 是 "null"，
      // 靠 source 比对才靠得住。
      if (frameRef.current && e.source !== frameRef.current.contentWindow)
        return;
      const data = e.data as BridgeMessage | undefined;
      if (
        !data ||
        typeof data.v !== "number" ||
        typeof data.type !== "string"
      ) {
        return;
      }
      onBridgeMessage(data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onBridgeMessage]);

  return (
    <iframe
      ref={frameRef}
      // sandbox 不给 allow-same-origin：编辑态文档与主应用跨源隔离，
      // 用户 HTML 里的脚本即便绕开 CSP 也碰不到主窗口
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      title="HTML 可视化编辑"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        background: "#fff",
      }}
    />
  );
}
