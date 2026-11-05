import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores";
import Icon from "../Icon";
import {
  PREVIEW_MIN_H,
  PREVIEW_MIN_W,
  RESIZE_EDGES,
  flipAnchor,
  resizePreview,
  type Rect,
  type ResizeEdge,
  type Viewport,
} from "../../lib/previewAnchor";
import { fileTypeOf } from "../../lib/fileType";
import { renderMarkdown, renderText } from "../../renderers";
import { resolveDocMediaHref } from "../../lib/mediaUrl";
import { isTauriEnv } from "../../utils/tauri";
import { log } from "../../utils/log";

/**
 * 悬浮预览窗（layout-portal 8.1）。
 *
 * 经 createPortal 渲到 document.body：逃出工作区的层叠上下文/overflow 裁剪，
 * 不卸载任何 pane 或 EditorView。渲染真文档内容（读 `open_file_direct`），
 * 标题栏可拖动、四边 + 四角可缩放、贴边翻转锚定边；底部动作区仅 hover 显示。
 * 位置是瞬态的——关闭再触发一律回默认锚定，不保留拖动后的旧坐标。
 */

const HANDLE_CURSOR: Record<ResizeEdge, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

/** 手柄在窗内的定位：贴内边缘，避免被 overflow-hidden 裁掉而命中不到。 */
const HANDLE_STYLE: Record<ResizeEdge, React.CSSProperties> = {
  n: { top: 0, left: 12, right: 12, height: 8 },
  s: { bottom: 0, left: 12, right: 12, height: 8 },
  e: { right: 0, top: 12, bottom: 12, width: 8 },
  w: { left: 0, top: 12, bottom: 12, width: 8 },
  ne: { top: 0, right: 0, width: 16, height: 16 },
  nw: { top: 0, left: 0, width: 16, height: 16 },
  se: { bottom: 0, right: 0, width: 16, height: 16 },
  sw: { bottom: 0, left: 0, width: 16, height: 16 },
};

function viewportOf(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

function MediaPlaceholder({ path }: { path: string }) {
  const kind = fileTypeOf(path);
  const label =
    kind === "pdf"
      ? "PDF 预览"
      : kind === "video"
        ? "视频预览"
        : kind === "audio"
          ? "音频预览"
          : "图片预览";
  return (
    <div
      data-testid="preview-media-placeholder"
      data-media-kind={kind}
      className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-4 text-center text-xs text-gray-400 dark:text-gray-500"
    >
      <Icon name={kind} size={24} />
      <span>{label}</span>
      <span className="break-all px-2 text-[10px] text-gray-400 dark:text-gray-600">
        {path}
      </span>
    </div>
  );
}

export default function FloatingPreview({
  onOpenPath,
}: {
  onOpenPath: (path: string) => void | Promise<void>;
}) {
  const preview = useStore((s) => s.preview);
  const closePreview = useStore((s) => s.closePreview);
  const togglePreviewPin = useStore((s) => s.togglePreviewPin);

  const [loaded, setLoaded] = useState<{
    path: string;
    content: string;
  } | null>(null);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<ResizeEdge | null>(null);
  const dragOrigin = useRef({ px: 0, py: 0, ox: 0, oy: 0 });
  const resizeOrigin = useRef<{ rect: Rect; px: number; py: number } | null>(
    null,
  );

  const previewPath = preview?.path ?? null;
  const previewTitle = preview?.title ?? "";

  // 读真文档内容：只有 path 变化才重新拉取，拖动/缩放不触发
  useEffect(() => {
    if (!previewPath || !isTauriEnv()) return;
    let cancelled = false;
    invoke<{ content: string; path: string; file_size: number }>(
      "open_file_direct",
      { path: previewPath },
    )
      .then((res) => {
        if (!cancelled) setLoaded({ path: previewPath, content: res.content });
      })
      .catch((e) => log.warn("Preview", "读取预览内容失败", e));
    return () => {
      cancelled = true;
    };
  }, [previewPath]);

  const content = loaded && loaded.path === previewPath ? loaded.content : "";

  // 标题栏拖动：全局 pointermove/pointerup，起止成对清理
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const p = useStore.getState().preview;
      if (!p) return;
      const nx = Math.round(
        dragOrigin.current.ox + (e.clientX - dragOrigin.current.px),
      );
      const ny = Math.round(
        dragOrigin.current.oy + (e.clientY - dragOrigin.current.py),
      );
      const flipped = flipAnchor(
        { x: nx, y: ny, w: p.w, h: p.h },
        viewportOf(),
      );
      useStore.getState().movePreview(nx, ny, flipped.x, flipped.y);
    };
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]);

  // 缩放：按手柄语义改 x/y/w/h，最小值钳制 + 贴边翻转
  useEffect(() => {
    if (!resizeEdge) return;
    const move = (e: PointerEvent) => {
      const origin = resizeOrigin.current;
      if (!origin) return;
      const rect = resizePreview(
        resizeEdge,
        origin.rect,
        e.clientX - origin.px,
        e.clientY - origin.py,
      );
      const flipped = flipAnchor(rect, viewportOf());
      useStore.getState().resizePreviewTo(rect, flipped.x, flipped.y);
    };
    const up = () => setResizeEdge(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [resizeEdge]);

  const onHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const p = useStore.getState().preview;
    if (!p) return;
    e.preventDefault();
    dragOrigin.current = { px: e.clientX, py: e.clientY, ox: p.x, oy: p.y };
    setDragging(true);
  }, []);

  const onHandlePointerDown = useCallback(
    (edge: ResizeEdge, e: React.PointerEvent) => {
      const p = useStore.getState().preview;
      if (!p) return;
      e.preventDefault();
      e.stopPropagation();
      resizeOrigin.current = {
        rect: { x: p.x, y: p.y, w: p.w, h: p.h },
        px: e.clientX,
        py: e.clientY,
      };
      setResizeEdge(edge);
    },
    [],
  );

  const kind = previewPath ? fileTypeOf(previewPath) : "text";

  const body = useMemo(() => {
    if (!previewPath) return null;
    if (
      kind === "pdf" ||
      kind === "video" ||
      kind === "image" ||
      kind === "audio"
    ) {
      return <MediaPlaceholder path={previewPath} />;
    }
    if (kind === "html") {
      // 沙箱 iframe：无 allow-scripts，脚本不执行；只展示真内容
      return (
        <iframe
          data-testid="preview-html"
          title={previewTitle}
          sandbox=""
          srcDoc={content}
          className="h-full w-full border-0 bg-white"
        />
      );
    }
    const html =
      kind === "markdown"
        ? renderMarkdown(content, {
            resolveMedia: (href) => resolveDocMediaHref(href, previewPath),
          })
        : renderText(content);
    return (
      <div
        data-testid="preview-doc"
        data-doc-kind={kind}
        className="preview-content px-3 py-2 text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }, [content, kind, previewPath, previewTitle]);

  if (!preview) return null;

  const { x, y, w, h, flippedX, flippedY, pinned } = preview;

  const split = (dir: "row" | "col") => {
    useStore.getState().splitPane(dir);
    void Promise.resolve(onOpenPath(preview.path));
  };

  return createPortal(
    <div
      data-testid="floating-preview"
      data-preview-path={preview.path}
      data-flipped-x={flippedX ? "true" : "false"}
      data-flipped-y={flippedY ? "true" : "false"}
      data-pinned={pinned ? "true" : "false"}
      data-dragging={dragging ? "true" : "false"}
      style={{
        position: "fixed",
        left: x,
        top: y,
        width: w,
        height: h,
        zIndex: 60,
        minWidth: PREVIEW_MIN_W,
        minHeight: PREVIEW_MIN_H,
      }}
      className="flex flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-2xl dark:border-gray-600 dark:bg-gray-800"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        // 拖动/缩放中指针会短暂离开窗口，不能据此关闭；钉住态也不关
        if (pinned || dragging || resizeEdge) return;
        closePreview();
      }}
    >
      <div
        data-testid="preview-titlebar"
        onPointerDown={onHeaderPointerDown}
        className={`flex shrink-0 items-center gap-1 border-b border-gray-200 px-2 py-1 dark:border-gray-700 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <Icon name={kind} size={18} />
        <span
          data-testid="preview-title"
          className="mr-auto min-w-0 flex-1 truncate text-xs font-medium text-gray-700 dark:text-gray-200"
          title={preview.path}
        >
          {preview.title}
        </span>
        <button
          type="button"
          data-testid="preview-pin"
          data-pinned={pinned ? "true" : "false"}
          aria-pressed={pinned}
          title={pinned ? "取消钉住" : "钉住"}
          aria-label={pinned ? "取消钉住" : "钉住"}
          onClick={togglePreviewPin}
          className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <Icon
            name="pin"
            size={18}
            color={pinned ? "var(--app-accent)" : undefined}
          />
        </button>
        <button
          type="button"
          data-testid="preview-close"
          title="关闭"
          aria-label="关闭"
          onClick={closePreview}
          className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div
        data-testid="preview-content"
        className="min-h-0 flex-1 overflow-auto"
      >
        {body}
      </div>

      {hovering && (
        <div
          data-testid="preview-actions"
          className="flex shrink-0 items-center gap-1 border-t border-gray-200 px-2 py-1 text-[11px] dark:border-gray-700"
        >
          <button
            type="button"
            data-testid="preview-action"
            data-action="open"
            title="打开"
            aria-label="打开"
            onClick={() => void Promise.resolve(onOpenPath(preview.path))}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <Icon name="eye" size={18} />
            打开
          </button>
          <button
            type="button"
            data-testid="preview-action"
            data-action="split-right"
            title="向右分屏"
            aria-label="向右分屏"
            onClick={() => split("row")}
            className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <Icon name="splitRight" size={18} />
          </button>
          <button
            type="button"
            data-testid="preview-action"
            data-action="split-down"
            title="向下分屏"
            aria-label="向下分屏"
            onClick={() => split("col")}
            className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <Icon name="splitDown" size={18} />
          </button>
          <button
            type="button"
            data-testid="preview-action"
            data-action="path"
            title={preview.path}
            onClick={() => void Promise.resolve(onOpenPath(preview.path))}
            className="ml-auto min-w-0 truncate rounded px-1 text-left text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
          >
            {preview.path}
          </button>
        </div>
      )}

      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge}
          data-testid={`preview-handle-${edge}`}
          onPointerDown={(e) => onHandlePointerDown(edge, e)}
          style={{
            position: "absolute",
            cursor: HANDLE_CURSOR[edge],
            ...HANDLE_STYLE[edge],
          }}
          className="select-none"
        />
      ))}
    </div>,
    document.body,
  );
}
