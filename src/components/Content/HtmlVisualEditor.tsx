import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../../stores/editorStore";
import {
  commandForSelection,
  parseBridgeMessage,
} from "../../editors/html/bridge";
import { buildEditableDoc } from "../../editors/html/runtime";

interface HtmlVisualEditorProps {
  content: string;
  filePath?: string | null;
}

/**
 * HTML 可视化编辑面板（E-16 / H2）。
 *
 * 与 `HtmlPreview` 是**两条通道**（design D1）：预览禁一切脚本，这里只放行
 * 带 nonce 的注入运行时。刻意不复用同一个组件加开关——两种安全姿态混在
 * 一个 iframe 里，迟早会漂移。
 *
 * 高亮框画在 iframe 自己里面（切片 3）：主应用与 srcdoc 跨源，主文档拿不到
 * iframe 的布局坐标，也画不到上面去。主侧只负责判定选中的是哪个节点。
 */
export default function HtmlVisualEditor({
  content,
  filePath,
}: HtmlVisualEditorProps) {
  const fontSize = useEditorStore((s) => s.fontSize);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const srcDoc = useMemo(
    () => buildEditableDoc(content, { filePath, fontSize }),
    [content, filePath, fontSize],
  );

  // 收上报：只认自己这一帧发来的，载荷交给 bridge 解析（版本位/形状不对就丢）
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || e.source !== frame.contentWindow) return;
      const msg = parseBridgeMessage(e.data);
      if (!msg) return;
      if (msg.type === "selection") setSelected(msg.nodeId);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // 选中变化 → 下发命令让 iframe 自己挪框。文档重建后也重发一次，否则框会丢。
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      commandForSelection(selected),
      "*",
    );
  }, [selected, srcDoc]);

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
