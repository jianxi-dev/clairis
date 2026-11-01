import { useEffect, useState } from "react";
import { PDFViewer } from "@embedpdf/react-pdf-viewer";
import type { EmbedPdfContainer } from "@embedpdf/snippet";
import { loadPdfBytes } from "../../utils/pdfSource";
import { isTauriEnv } from "../../utils/tauri";

interface PdfViewerProps {
  filePath: string;
}

/**
 * 裁剪未启用功能（范围外 UI）：snippet 默认装配全部 28 插件，
 * 不显式禁用则批注/导出/全屏/签名/表单/图章/附件/截图等 UI 全部暴露。
 * 类别名经源码实证（各 schema item 的 categories 数组），见
 * .omo/evidence/pdf-viewer-upgrade/f4-fix-evidence/01-categories-inventory.txt。
 *
 * 禁用：
 * - annotation      全部批注层级（批注/形状模式、批注工具栏、评论、批注图章/签名等）
 * - panel-comment   工具栏「评论」按钮
 * - redaction       遮蔽模式与遮蔽面板
 * - form            表单模式与表单工具
 * - insert          插入模式（签名/图章/图片/附件插入，无顶层 signature/stamp/attachment 类别）
 * - document-export 文件菜单「导出」
 * - document-fullscreen 页面设置/文件菜单「全屏」
 * - document-capture 文件菜单「截图」
 * - capture         截图工具
 * - document-protect 文件菜单「安全/保护」
 * - spread          双页/跨页视图
 *
 * 保留：search / thumbnail / outline / zoom / pan / scroll / rotate /
 * print / selection / bookmark / history（均不在禁用列表内）。
 */
const DISABLED_CATEGORIES = [
  "annotation",
  "panel-comment",
  "redaction",
  "form",
  "insert",
  "document-export",
  "document-fullscreen",
  "document-capture",
  "capture",
  "document-protect",
  "spread",
];

/**
 * 最小补充（disabledCategories 无法覆盖）：打印弹窗的「包含批注」复选框是
 * snippet 打印组件内硬编码 JSX（非 schema item，不受类别裁剪影响）。
 * 用一条仅命中该复选框的 CSS（其 span 类名 `text-fg-secondary text-sm font-medium`
 * 在整份 bundle 中唯一）注入 shadow root 隐藏。来源实证见
 * .omo/evidence/pdf-viewer-upgrade/f4-fix-evidence/03-print-modal-css.txt。
 */
function hidePrintAnnotationOption(container: EmbedPdfContainer): void {
  const shadow = container.shadowRoot;
  if (!shadow) return;
  if (shadow.querySelector("style[data-biaoyue-pdf-print]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-biaoyue-pdf-print", "");
  style.textContent =
    "label:has(> span.text-fg-secondary.text-sm.font-medium){display:none !important}";
  shadow.appendChild(style);
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
  // 非 Tauri 环境同步短路为错误态：loadPdfBytes 的降级是异步的，
  // 浏览器 dev / jsdom 下首帧会闪「正在加载 PDF…」再变错误态。
  // 文案与 loadPdfBytes 的降级文案保持一致。
  const [state, setState] = useState<PdfLoadState>(() =>
    isTauriEnv()
      ? { status: "loading" }
      : { status: "error", error: "无法预览 PDF：需在 Tauri 桌面环境中运行" },
  );

  useEffect(() => {
    if (!isTauriEnv()) return; // 非 Tauri 已在初始 state 短路为错误态
    let cancelled = false;

    loadPdfBytes(filePath)
      .then((result) => {
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
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ status: "error", error: msg });
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
        disabledCategories: DISABLED_CATEGORIES,
        documentManager: {
          initialDocuments: [
            { buffer: state.buffer, name: fileNameFromPath(filePath) },
          ],
        },
      }}
      onInit={hidePrintAnnotationOption}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

function fileNameFromPath(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(idx + 1) : path;
}
