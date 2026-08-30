import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { renderMarkdown, renderMermaid, takeDarkVars } from "../../renderers";
import HtmlPreview from "./HtmlPreview";
import ReaderSettingsPopover from "./ReaderSettingsPopover";
import { mediaPlayer } from "./mediaPlayerState";
import { useEditorStore } from "../../stores/editorStore";
import { applyReaderSkin } from "../../hooks/useConfig";
import { isTauriEnv } from "../../utils/tauri";
import type { FileKind } from "../../types";

interface PreviewViewProps {
  content?: string;
  fileKind?: FileKind;
  filePath?: string | null;
}

const PLAIN_TEXT_KINDS: FileKind[] = [
  "text",
  "css",
  "python",
  "json",
  "javascript",
  "yaml",
  "csv",
];

const PREVIEW_MIN_ZOOM = 0.5;
const PREVIEW_MAX_ZOOM = 4;

function clampPreviewZoom(z: number): number {
  return Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, z));
}

/** 文档预览缩放：双指捏合 / Ctrl+滚轮 / 双击复位 */
function usePreviewZoom() {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const startZoomRef = useRef(1);
  zoomRef.current = zoom;

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(clampPreviewZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 0.9)));
    }
  }, []);

  const resetZoom = useCallback(() => setZoom(1), []);

  // 触摸板双指捏合（WebKit gesture 事件）。监听挂在 document 捕获阶段，
  // 使 iframe 内（HTML/PDF 预览）的手势也能被父文档捕获；用容器包含判断过滤多实例。
  const bindGesture = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const isInside = (target: EventTarget | null): boolean => {
      const node = target instanceof Element ? target : null;
      return !!node && (el.contains(node) || node === el);
    };
    const onStart = (e: Event) => {
      if (!isInside(e.target)) return;
      startZoomRef.current = zoomRef.current;
    };
    const onChange = (e: Event) => {
      if (!isInside(e.target)) return;
      const scale = (e as unknown as { scale?: number }).scale;
      if (scale) setZoom(clampPreviewZoom(startZoomRef.current * scale));
    };
    document.addEventListener("gesturestart", onStart, true);
    document.addEventListener("gesturechange", onChange, true);
    return () => {
      document.removeEventListener("gesturestart", onStart, true);
      document.removeEventListener("gesturechange", onChange, true);
    };
  }, []);

  return { zoom, onWheel, onDoubleClick: resetZoom, bindGesture };
}

/** 视频/音频预览：注册到常驻播放器，由 MediaPlayerHost 全尺寸覆盖；卸载时保持播放移出视口（无迷你条） */
function MediaPreviewRegistrar({
  filePath,
  fileKind,
}: {
  filePath: string;
  fileKind: "video" | "audio";
}) {
  useEffect(() => {
    mediaPlayer.show({
      filePath,
      url: mediaUrlForPath(filePath),
      fileKind,
    });
    return () => mediaPlayer.minimize();
  }, [filePath, fileKind]);

  return (
    <div
      data-media-preview
      style={{ width: "100%", height: "100%", minHeight: 200 }}
    />
  );
}

export default function PreviewView({
  content = "",
  fileKind = "markdown",
  filePath = null,
}: PreviewViewProps) {
  const headingColors = useEditorStore((s) => s.headingColors);
  const readerFontSize = useEditorStore((s) => s.config.readerFontSize);
  const readerWidth = useEditorStore((s) => s.config.readerWidth);
  const readerSkin = useEditorStore((s) => s.config.readerSkin);

  const headingVars = useMemo(() => {
    if (!headingColors) return undefined;
    return {
      "--heading-h1": headingColors.h1,
      "--heading-h2": headingColors.h2,
      "--heading-h3": headingColors.h3,
      "--heading-h4": headingColors.h4,
      "--heading-h5": headingColors.h5,
      "--heading-h6": headingColors.h6,
    } as React.CSSProperties;
  }, [headingColors]);

  const typeVars = useMemo(() => {
    const vars: Record<string, string> = {};
    if (readerFontSize) vars["--type-font-size"] = `${readerFontSize}px`;
    if (readerWidth) {
      vars["--type-measure"] = `${readerWidth}px`;
      // 表格 / 代码块 / 图片走更宽的通道，宽内容不被正文宽度卡住
      vars["--type-measure-wide"] = `${Math.min(readerWidth + 120, 1400)}px`;
    }
    return vars as React.CSSProperties;
  }, [readerFontSize, readerWidth]);

  useEffect(() => {
    if (readerSkin) applyReaderSkin(readerSkin);
  }, [readerSkin]);

  const html = useMemo(() => {
    if (PLAIN_TEXT_KINDS.includes(fileKind)) {
      return renderTextContent(content);
    }
    switch (fileKind) {
      case "html":
        return null; // HtmlPreview handles rendering
      default:
        return renderMarkdown(content);
    }
  }, [content, fileKind]);

  // 图片/视频/音频/HTML/PDF 保持各自渲染（HTML/PDF 用整体缩放，避免重排偏移）
  if (fileKind === "html" || fileKind === "pdf") {
    return (
      <FramePreview content={content} fileKind={fileKind} filePath={filePath} />
    );
  }
  if (fileKind === "image" || fileKind === "video" || fileKind === "audio") {
    if (!filePath) {
      return (
        <div style={{ padding: "24px", textAlign: "center", color: "#666" }}>
          无法预览：文件路径缺失
        </div>
      );
    }
    if (fileKind === "image") {
      return <ImagePreview filePath={filePath} />;
    }
    // 视频/音频：由常驻播放器（MediaPlayerHost）全尺寸覆盖本区域
    return (
      <MediaPreviewRegistrar
        filePath={filePath}
        fileKind={fileKind === "audio" ? "audio" : "video"}
      />
    );
  }

  // markdown / 文本类走缩放容器
  return (
    <ZoomablePreview
      html={html}
      headingVars={headingVars}
      typeVars={typeVars}
    />
  );
}

const FRAME_MIN_SCALE = 0.5;
const FRAME_MAX_SCALE = 3;

function clampFrameScale(z: number): number {
  return Math.min(FRAME_MAX_SCALE, Math.max(FRAME_MIN_SCALE, z));
}

/**
 * 响应 App 层分发的 preview-scale 事件（Cmd/Ctrl+±/0）。
 * 由 App 的 bubble 阶段 keydown 统一分发（真机 WKWebView 中 Cmd 组合键
 * 不触发 capture 阶段监听，故缩放入口集中在 App 层）。
 */
function usePreviewScaleEvent(
  onZoomIn: () => void,
  onZoomOut: () => void,
  onReset: () => void,
) {
  useEffect(() => {
    const onScale = (e: Event) => {
      const delta = (e as CustomEvent<number>).detail;
      if (delta === 0) onReset();
      else if (delta > 0) onZoomIn();
      else onZoomOut();
    };
    window.addEventListener("preview-scale", onScale);
    return () => window.removeEventListener("preview-scale", onScale);
  }, [onZoomIn, onZoomOut, onReset]);
}

/** HTML/PDF 帧缩放状态：Cmd+±/0 与 Ctrl+滚轮 */
function useFrameScale() {
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  const zoomIn = useCallback(
    () => setScale(clampFrameScale(scaleRef.current * 1.1)),
    [],
  );
  const zoomOut = useCallback(
    () => setScale(clampFrameScale(scaleRef.current / 1.1)),
    [],
  );
  const reset = useCallback(() => setScale(1), []);
  usePreviewScaleEvent(zoomIn, zoomOut, reset);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setScale(clampFrameScale(scaleRef.current * (e.deltaY < 0 ? 1.1 : 0.9)));
    }
  }, []);

  return { scale, onWheel, onDoubleClick: reset };
}

/** HTML/PDF 预览帧：iframe 元素 zoom 整体缩放（不重排，避免视口变宽导致内容偏移） */
function FramePreview({
  content,
  fileKind,
  filePath,
}: {
  content: string;
  fileKind: FileKind;
  filePath?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { scale, onWheel, onDoubleClick } = useFrameScale();

  // 跨源 iframe（asset://）聚焦后，父文档收不到任何输入事件（focusin/pointerdown 均不跨文档传播），
  // 键盘焦点留在 iframe 文档内导致 Cmd+±/0 失效。唯一可靠手段是轮询 activeElement 抢回焦点。
  // 但立即抢焦点会让 iframe 内原生控件（<select> 下拉 / <input type="color"> 取色器）
  // 失焦即关闭（"点击闪一下就消失"）。故进入 iframe 或抢回后各留一个交互窗口，窗口内不抢。
  useEffect(() => {
    const GRACE_MS = 2500;
    let graceUntil = 0;
    let lastInIframe = false;
    const id = setInterval(() => {
      const el = containerRef.current;
      if (!el) return;
      const active = document.activeElement;
      const inIframe =
        active instanceof HTMLIFrameElement && el.contains(active);
      if (!inIframe) {
        lastInIframe = false;
        return;
      }
      if (!lastInIframe) graceUntil = Date.now() + GRACE_MS;
      lastInIframe = true;
      if (Date.now() >= graceUntil) {
        el.focus({ preventScroll: true });
        graceUntil = Date.now() + GRACE_MS;
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  if (!filePath) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#666" }}>
        无法预览：文件路径缺失
      </div>
    );
  }
  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      style={{ height: "100%", overflow: "auto" }}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
    >
      {fileKind === "html" ? (
        <HtmlPreview content={content} filePath={filePath} zoom={scale} />
      ) : isTauriEnv() ? (
        <iframe
          src={convertFileSrc(filePath)}
          title="PDF 预览"
          style={{ zoom: scale, width: "100%", height: "100%", border: "none" }}
        />
      ) : (
        <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
          无法预览 PDF：需在 Tauri 桌面环境中运行
        </div>
      )}
      <div
        style={{
          textAlign: "center",
          color: "#999",
          fontSize: 12,
          marginTop: 4,
          userSelect: "none",
        }}
      >
        ⌘+/⌘- 缩放 · ⌘0 复位 · Ctrl+滚轮
      </div>
    </div>
  );
}

function ZoomablePreview({
  html,
  headingVars,
  typeVars,
}: {
  html: string | null;
  headingVars: React.CSSProperties | undefined;
  typeVars: React.CSSProperties;
}) {
  const { zoom, onWheel, onDoubleClick, bindGesture } = usePreviewZoom();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 内嵌 HTML 内联颜色的深色替代值：--dc-N 定义在 .dark 下，原色作兜底
  const darkVarsCss = useMemo(() => {
    const vars = takeDarkVars();
    const body = Object.entries(vars)
      .map(([k, v]) => `--${k}:${v}`)
      .join(";");
    return body ? `.dark .preview-content{${body}}` : "";
  }, [html]);

  useEffect(() => bindGesture(containerRef.current), [bindGesture]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    void renderMermaid(el);
    // 深浅切换后 mermaid 要重新出图，源码仍留在 DOM 里可重复渲染
    const mo = new MutationObserver(() => void renderMermaid(el));
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => mo.disconnect();
  }, [html]);

  // 代码块复制按钮：事件委托，避免给每个代码块单独挂监听
  const onClick = useCallback((e: React.MouseEvent) => {
    const btn = (e.target as HTMLElement).closest?.(".code-copy");
    if (!(btn instanceof HTMLElement)) return;
    const code = btn.parentElement?.querySelector("pre")?.textContent ?? "";
    const label = btn.textContent;
    btn.textContent = "已复制";
    setTimeout(() => {
      btn.textContent = label;
    }, 1500);
    void navigator.clipboard?.writeText(code).catch(() => {});
  }, []);

  return (
    <div
      ref={containerRef}
      className="preview-shell"
      style={{ zoom }}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
    >
      {darkVarsCss && <style>{darkVarsCss}</style>}
      <div
        className="preview-content"
        style={{ ...typeVars, ...headingVars }}
        dangerouslySetInnerHTML={{ __html: html ?? "" }}
      />
      <ReaderSettingsPopover />
    </div>
  );
}

/** 本地文件 → media:// URL（自定义协议，支持 Range 流式播放） */
function mediaUrlForPath(path: string): string {
  // 只编码路径中除 / 以外的字符：Rust decode_uri_path 期望斜杠未编码，
  // 否则 encodeURIComponent 的 %2F 会被解码成双斜杠 //，WKWebView 对
  // 含全角字符的长路径解析出错（视频轨加载失败、仅音频正常）。
  // host 后不追加斜杠（path 以 / 开头），避免 media://localhost// 双斜杠
  const encoded = encodeURIComponent(path).replace(/%2F/g, "/");
  const withSlash = encoded.startsWith("/") ? encoded : "/" + encoded;
  return "media://localhost" + withSlash;
}

const IMAGE_BASE_WIDTH = 1180;
const IMAGE_MIN_ZOOM = 0.2;
const IMAGE_MAX_ZOOM = 5;

function clampZoom(z: number): number {
  return Math.min(IMAGE_MAX_ZOOM, Math.max(IMAGE_MIN_ZOOM, z));
}

function ImagePreview({ filePath }: { filePath: string }) {
  const [zoom, setZoom] = useState(1);
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const startZoomRef = useRef(1);

  zoomRef.current = zoom;

  const baseWidth = naturalWidth
    ? Math.min(naturalWidth, IMAGE_BASE_WIDTH)
    : IMAGE_BASE_WIDTH;

  const zoomIn = useCallback(
    () => setZoom(clampZoom(zoomRef.current * 1.1)),
    [],
  );
  const zoomOut = useCallback(
    () => setZoom(clampZoom(zoomRef.current / 1.1)),
    [],
  );
  const resetZoom = useCallback(() => setZoom(1), []);
  usePreviewScaleEvent(zoomIn, zoomOut, resetZoom);

  // 触摸板双指捏合（WebKit gesture 事件）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onStart = () => {
      startZoomRef.current = zoomRef.current;
    };
    const onChange = (e: Event) => {
      const scale = (e as unknown as { scale?: number }).scale;
      if (scale) setZoom(clampZoom(startZoomRef.current * scale));
    };
    el.addEventListener("gesturestart", onStart);
    el.addEventListener("gesturechange", onChange);
    return () => {
      el.removeEventListener("gesturestart", onStart);
      el.removeEventListener("gesturechange", onChange);
    };
  }, []);

  if (!isTauriEnv()) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
        无法预览图片：需在 Tauri 桌面环境中运行
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      style={{ height: "100%", overflow: "auto", padding: 16 }}
      onClick={(e) => {
        const el = containerRef.current;
        if (el && document.activeElement !== el) el.focus();
        e.stopPropagation();
      }}
      onWheel={(e) => {
        // Ctrl/⌘+滚轮缩放（触摸板捏合之外的手势）
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom(clampZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 0.9)));
        }
      }}
      onDoubleClick={() => setZoom(1)}
    >
      <img
        src={convertFileSrc(filePath)}
        alt=""
        style={{
          width: Math.round(baseWidth * zoom),
          height: "auto",
          objectFit: "contain",
          cursor: "zoom-in",
          display: "block",
          margin: "0 auto",
        }}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0) setNaturalWidth(img.naturalWidth);
        }}
      />
      <div
        style={{
          textAlign: "center",
          color: "#999",
          fontSize: 12,
          marginTop: 8,
          userSelect: "none",
        }}
      >
        滚轮/双指捏合缩放 · 双击复位
      </div>
    </div>
  );
}

function renderTextContent(content: string): string {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="white-space:pre-wrap;word-wrap:break-word">${escaped}</pre>`;
}
