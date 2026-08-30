import { useEffect, useState } from "react";
import { PDFViewer } from "@embedpdf/react-pdf-viewer";
import { loadPdfBytes } from "../../utils/pdfSource";

interface PdfViewerProps {
  filePath: string;
}

type PdfLoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; buffer: ArrayBuffer };

/**
 * PDF 预览组件：读取本地 PDF 字节后交给 EmbedPDF v2 查看器渲染。
 * 状态机：loading → ready（渲染 PDFViewer）/ error（展示错误信息）。
 * 配置为离线自托管（wasm 本地、禁用 CDN 图章/字体、主线程模式）。
 */
export default function PdfViewer({ filePath }: PdfViewerProps) {
  const [state, setState] = useState<PdfLoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    loadPdfBytes(filePath).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        const { bytes } = result;
        // 安全提取：bytes 可能是共享底层 ArrayBuffer 的视图，
        // 用 slice 截取自身区间，避免越界引用（atob 产物必为普通 ArrayBuffer）
        const buffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        setState({ status: "ready", buffer });
      } else {
        setState({ status: "error", error: result.error });
      }
    });

    return () => {
      cancelled = true;
      // 卸载或 filePath 变化时释放已持有的 ArrayBuffer 引用，避免大文件内存滞留
      setState((prev) =>
        prev.status === "ready" ? { status: "loading" } : prev,
      );
    };
  }, [filePath]);

  if (state.status === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#666",
        }}
      >
        正在加载 PDF…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#666" }}>
        <p>无法预览 PDF</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>{state.error}</p>
      </div>
    );
  }

  return (
    <PDFViewer
      config={{
        wasmUrl: "/pdfium.wasm",
        worker: false,
        fontFallback: null,
        fonts: { ui: null, signature: null },
        stamp: { defaultLibrary: false, manifests: [] },
        i18n: { defaultLocale: "zh-CN" },
        documentManager: {
          initialDocuments: [
            { buffer: state.buffer, name: fileNameFromPath(filePath) },
          ],
        },
      }}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

function fileNameFromPath(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(idx + 1) : path;
}
