import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores";
import Icon from "../Icon";
import {
  PREVIEW_LEAVE_CLOSE_MS,
  PREVIEW_MIN_H,
  PREVIEW_MIN_W,
  RESIZE_EDGES,
  flipAnchor,
  resizePreview,
  shouldScheduleLeaveClose,
  type Box,
  type Rect,
  type ResizeEdge,
  type Viewport,
} from "../../lib/previewAnchor";
import { fileTypeOf, type FileTypeKind } from "../../lib/fileType";
import { parentFolderNameOf } from "../../lib/railCards";
import { renderMarkdown, renderText } from "../../renderers";
import { mediaUrlForPath, resolveDocMediaHref } from "../../lib/mediaUrl";
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

function boxOf(el: HTMLElement | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function railBox(): Box | null {
  return boxOf(document.querySelector<HTMLElement>(".rail-root"));
}

/** 媒体真实渲染：图片 img、视频/音频播放器；PDF 与非 Tauri 环境回占位。 */
function MediaBody({ path, kind }: { path: string; kind: FileTypeKind }) {
  if (!isTauriEnv()) return <MediaPlaceholder path={path} />;
  if (kind === "image") {
    return (
      <div
        data-testid="preview-media"
        data-media-kind="image"
        className="flex h-full items-center justify-center bg-[var(--app-sunken)]"
      >
        <img
          src={convertFileSrc(path)}
          alt={path}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }
  const url = mediaUrlForPath(path);
  if (kind === "video") {
    return (
      <div
        data-testid="preview-media"
        data-media-kind="video"
        className="flex h-full items-center justify-center bg-black"
      >
        <video src={url} controls className="max-h-full max-w-full" />
      </div>
    );
  }
  return (
    <div
      data-testid="preview-media"
      data-media-kind="audio"
      className="flex h-full flex-col items-center justify-center gap-3 p-4"
    >
      <Icon name="audio" size={24} className="text-[var(--app-text-3)]" />
      <audio src={url} controls className="w-full" />
    </div>
  );
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
      className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-4 text-center text-xs text-[var(--app-text-3)]"
    >
      <Icon name={kind} size={24} />
      <span>{label}</span>
      <span className="break-all px-2 text-[10px] text-[var(--app-text-3)]">
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
  const previewRef = useRef<HTMLDivElement>(null);
  const interactingRef = useRef(false);

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

  // 标题栏拖动：全局 pointermove/pointerup，起止成对清理。
  // pointermove 只记录最新坐标并调度一帧 rAF；rAF 里写一次 store，
  // 避免每个 pointermove 都触发整棵订阅树重渲染（卡顿根因）。
  useEffect(() => {
    if (!dragging) return;
    let rafId: number | null = null;
    let pending: { x: number; y: number } | null = null;
    const commit = () => {
      rafId = null;
      const next = pending;
      pending = null;
      if (!next) return;
      const p = useStore.getState().preview;
      if (!p) return;
      const flipped = flipAnchor(
        { x: next.x, y: next.y, w: p.w, h: p.h },
        viewportOf(),
      );
      useStore.getState().movePreview(next.x, next.y, flipped.x, flipped.y);
    };
    const move = (e: PointerEvent) => {
      const p = useStore.getState().preview;
      if (!p) return;
      pending = {
        x: Math.round(
          dragOrigin.current.ox + (e.clientX - dragOrigin.current.px),
        ),
        y: Math.round(
          dragOrigin.current.oy + (e.clientY - dragOrigin.current.py),
        ),
      };
      if (rafId === null) rafId = requestAnimationFrame(commit);
    };
    const up = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      commit();
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      pending = null;
    };
  }, [dragging]);

  // 缩放：按手柄语义改 x/y/w/h，最小值钳制 + 贴边翻转。
  // rAF 合并：pointermove 只记最新偏移，一帧写一次 store。
  useEffect(() => {
    if (!resizeEdge) return;
    let rafId: number | null = null;
    let pending: { dx: number; dy: number } | null = null;
    const commit = () => {
      rafId = null;
      const next = pending;
      pending = null;
      if (!next) return;
      const origin = resizeOrigin.current;
      if (!origin) return;
      const rect = resizePreview(resizeEdge, origin.rect, next.dx, next.dy);
      const flipped = flipAnchor(rect, viewportOf());
      useStore.getState().resizePreviewTo(rect, flipped.x, flipped.y);
    };
    const move = (e: PointerEvent) => {
      const origin = resizeOrigin.current;
      if (!origin) return;
      pending = { dx: e.clientX - origin.px, dy: e.clientY - origin.py };
      if (rafId === null) rafId = requestAnimationFrame(commit);
    };
    const up = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      commit();
      setResizeEdge(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      pending = null;
    };
  }, [resizeEdge]);

  useEffect(() => {
    interactingRef.current = dragging || resizeEdge !== null;
  }, [dragging, resizeEdge]);

  const previewSource = preview?.source ?? null;

  // rail 源离窗关闭：全局 pointermove 180ms 防抖；钉住/拖拽/缩放豁免，指针仍在 rail 保持
  useEffect(() => {
    if (previewSource !== "rail") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const onMove = (e: PointerEvent) => {
      clear();
      const st = useStore.getState();
      const p = st.preview;
      if (!p || p.source !== "rail") return;
      if (
        !shouldScheduleLeaveClose({
          pointer: { x: e.clientX, y: e.clientY },
          previewBox: boxOf(previewRef.current),
          railBox: railBox(),
          pinned: p.pinned,
          interacting: interactingRef.current,
        })
      ) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        const cur = useStore.getState().preview;
        if (!cur || cur.source !== "rail" || cur.pinned) return;
        // 拖拽/缩放可能在首个 pointermove 之前就把 interactingRef 置真；
        // 到期时再确认一次，避免把进行中的拖动误关。
        if (interactingRef.current) return;
        useStore.getState().closePreview();
      }, PREVIEW_LEAVE_CLOSE_MS);
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      clear();
      window.removeEventListener("pointermove", onMove);
    };
  }, [previewSource]);

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

  // 视频/音频经 media:// 播放：先注册到白名单，否则协议 404 只剩控件
  useEffect(() => {
    if (!previewPath) return;
    if (kind !== "video" && kind !== "audio") return;
    void invoke("register_media_path", { path: previewPath }).catch(() => {});
  }, [kind, previewPath]);

  const body = useMemo(() => {
    if (!previewPath) return null;
    if (kind === "image" || kind === "video" || kind === "audio") {
      return <MediaBody path={previewPath} kind={kind} />;
    }
    if (kind === "pdf") {
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
      ref={previewRef}
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
      className="flex flex-col overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        // rail 源的离窗关闭由全局 pointermove 防抖处理；网格源保持即关
        if (preview.source === "rail") return;
        if (pinned || dragging || resizeEdge) return;
        closePreview();
      }}
    >
      <div
        data-testid="preview-titlebar"
        onPointerDown={onHeaderPointerDown}
        className={`flex shrink-0 items-center gap-1 border-b border-[var(--app-border)] px-2 py-0.5 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <Icon name={kind} size={18} />
        <span
          data-testid="preview-title"
          className="mr-auto min-w-0 flex-1 truncate text-xs font-medium text-[var(--app-text-2)]"
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
          className="shrink-0 rounded p-0.5 text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
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
          className="shrink-0 rounded p-0.5 text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
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
          className="flex shrink-0 items-center gap-1 border-t border-[var(--app-border)] px-2 py-1 text-[11px]"
        >
          <button
            type="button"
            data-testid="preview-action"
            data-action="open"
            title="打开"
            aria-label="打开"
            onClick={() => void Promise.resolve(onOpenPath(preview.path))}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
          >
            <Icon name="eye" size={18} />
          </button>
          <button
            type="button"
            data-testid="preview-action"
            data-action="split-right"
            title="向右分屏"
            aria-label="向右分屏"
            onClick={() => split("row")}
            className="rounded p-0.5 text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
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
            className="rounded p-0.5 text-[var(--app-text-2)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
          >
            <Icon name="splitDown" size={18} />
          </button>
          <button
            type="button"
            data-testid="preview-action"
            data-action="path"
            title={preview.path}
            onClick={() => void Promise.resolve(onOpenPath(preview.path))}
            className="ml-auto flex min-w-0 items-center gap-1 rounded px-1 text-left text-[var(--app-text-3)] hover:text-[var(--app-text-2)]"
          >
            <Icon name="folder" size={18} />
            <span className="min-w-0 truncate">
              {parentFolderNameOf(preview.path)}
            </span>
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
