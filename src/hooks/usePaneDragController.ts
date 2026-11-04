import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../stores";
import { log } from "../utils/log";
import {
  fileDropIntent,
  hitTestPane,
  hitTestWindowEdge,
  resolvePaneDrop,
  type DropRect,
  type DropZone,
  type PaneZone,
  type RootZone,
  type ViewportSize,
} from "../lib/paneDrop";
import type { PaneSide } from "../lib/paneTree";

/** 指针超过该像素才算拖拽，以下视为点击。 */
const DRAG_THRESHOLD_PX = 4;
/** 贴窗口多少像素内算「移到根层」。 */
const ROOT_EDGE_BAND = 24;

export interface DropOverlayState {
  kind: "pane" | "file" | null;
  /** 格级落区（center/left/right/top/bottom）。 */
  zone: PaneZone | null;
  /** 命中格的视口矩形，供落区指示覆盖。 */
  rect: DropRect | null;
  /** 窗口级落区；与 zone 互斥（根层优先）。 */
  rootZone: RootZone | null;
  viewport: ViewportSize | null;
}

const EMPTY_OVERLAY: DropOverlayState = {
  kind: null,
  zone: null,
  rect: null,
  rootZone: null,
  viewport: null,
};

interface Hit {
  viewport: ViewportSize;
  rootZone: RootZone | null;
  zone: PaneZone | null;
  rect: DropRect | null;
  targetId: string | null;
}

interface PaneDragSession {
  sourceId: string;
  startX: number;
  startY: number;
  active: boolean;
  cancelled: boolean;
}

/** 从指针坐标解析出窗口落区 + 其下的格落区。纯 DOM 查询，无副作用。 */
function computeAt(x: number, y: number): Hit {
  const viewport: ViewportSize = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const rootZone = hitTestWindowEdge({ x, y }, viewport, ROOT_EDGE_BAND);
  const paneEl = paneUnderPoint(x, y);
  if (!paneEl) {
    return { viewport, rootZone, zone: null, rect: null, targetId: null };
  }
  const r = paneEl.getBoundingClientRect();
  const rect: DropRect = {
    x: r.left,
    y: r.top,
    width: r.width,
    height: r.height,
  };
  return {
    viewport,
    rootZone,
    zone: hitTestPane({ x, y }, rect),
    rect,
    targetId: paneEl.getAttribute("data-pane-id"),
  };
}

/**
 * 命中指针下的格：优先用 elementFromPoint；门户/网格覆盖层挡住工作区时，
 * 退化为按格矩形做几何命中，这样从门户拖文件也能落在背后的格上。
 */
function paneUnderPoint(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y);
  const direct =
    el instanceof Element ? el.closest<HTMLElement>("[data-pane-id]") : null;
  if (direct) return direct;
  const panes = document.querySelectorAll<HTMLElement>("[data-pane-id]");
  for (const pane of panes) {
    const r = pane.getBoundingClientRect();
    if (
      r.width > 0 &&
      r.height > 0 &&
      x >= r.left &&
      x <= r.right &&
      y >= r.top &&
      y <= r.bottom
    ) {
      return pane;
    }
  }
  return null;
}

async function openFileIntoPane(
  path: string,
  targetId: string,
  side: PaneSide,
): Promise<void> {
  try {
    const result = await invoke<{
      content: string;
      path: string;
      file_size: number;
    }>("open_file_direct", { path });
    useStore
      .getState()
      .dropFileOnPane(result.path, result.content, targetId, side);
  } catch (e) {
    log.error("PaneDrag", "拖入文件失败", e);
  }
}

/**
 * 工作区拖拽控制器（layout-portal 5.1）。
 *
 * 一个控制器统管两种拖拽，保证语义互斥：
 *  - 格拖拽：由 PaneHeader 调 `startPaneDrag` 启动；算落区 → 互换/移动/提根层。
 *  - 文件拖拽：由文件条目把 `draggingFilePath` 写进 store 触发；算落区 → 分裂。
 * 两种拖拽都在 window 上挂 pointermove/pointerup 与 Escape 取消，随组件卸载清理。
 */
export function usePaneDragController() {
  const [overlay, setOverlay] = useState<DropOverlayState>(EMPTY_OVERLAY);
  const sessionRef = useRef<PaneDragSession | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastHitRef = useRef<Hit | null>(null);
  const draggingFilePath = useStore((s) => s.draggingFilePath);

  const endPaneDrag = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    sessionRef.current = null;
    lastHitRef.current = null;
    document.body.style.userSelect = "";
    setOverlay(EMPTY_OVERLAY);
    useStore.getState().setDragPaneSource(null);
  }, []);

  const startPaneDrag = useCallback(
    (
      sourceId: string,
      e: { button: number; clientX: number; clientY: number },
    ) => {
      if (e.button !== 0) return;
      if (sessionRef.current) return;
      // 互斥：开起格拖拽即清掉任何进行中的文件拖拽
      useStore.getState().setDraggingFilePath(null);

      const session: PaneDragSession = {
        sourceId,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        cancelled: false,
      };
      sessionRef.current = session;
      lastHitRef.current = null;

      const onMove = (ev: PointerEvent) => {
        if (session.cancelled) return;
        if (!session.active) {
          if (
            Math.abs(ev.clientX - session.startX) < DRAG_THRESHOLD_PX &&
            Math.abs(ev.clientY - session.startY) < DRAG_THRESHOLD_PX
          ) {
            return;
          }
          session.active = true;
          document.body.style.userSelect = "none";
          useStore.getState().setDragPaneSource(sourceId);
        }
        const hit = computeAt(ev.clientX, ev.clientY);
        lastHitRef.current = hit;
        // 贴窗口边时根层落区优先，格内落区让位
        setOverlay({
          kind: "pane",
          zone: hit.rootZone ? null : hit.zone,
          rect: hit.rootZone ? null : hit.rect,
          rootZone: hit.rootZone,
          viewport: hit.viewport,
        });
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
      };
      const onUp = () => {
        const hit = lastHitRef.current;
        const wasActive = session.active && !session.cancelled;
        cleanup();
        cleanupRef.current = null;
        sessionRef.current = null;
        lastHitRef.current = null;
        document.body.style.userSelect = "";
        setOverlay(EMPTY_OVERLAY);
        const store = useStore.getState();
        store.setDragPaneSource(null);
        if (!wasActive || !hit) return;
        const zone: DropZone = hit.rootZone ?? hit.zone;
        const intent = resolvePaneDrop(
          session.sourceId,
          hit.targetId ?? "",
          zone,
        );
        if (!intent) return;
        if (intent.kind === "swap" && hit.targetId) {
          store.swapPanes(session.sourceId, hit.targetId);
        } else if (intent.kind === "move" && hit.targetId) {
          store.movePane(session.sourceId, hit.targetId, intent.side);
        } else if (intent.kind === "root") {
          store.movePaneToRoot(session.sourceId, intent.side);
        }
      };
      const onCancel = () => {
        session.cancelled = true;
        endPaneDrag();
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape") return;
        ev.preventDefault();
        ev.stopPropagation();
        session.cancelled = true;
        endPaneDrag();
      };

      cleanupRef.current = cleanup;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
    },
    [endPaneDrag],
  );

  // 文件拖拽：挂在 store 的 draggingFilePath 上，非空即接管指针
  useEffect(() => {
    if (!draggingFilePath) return;
    if (sessionRef.current) endPaneDrag();
    lastHitRef.current = null;

    const onMove = (ev: PointerEvent) => {
      const hit = computeAt(ev.clientX, ev.clientY);
      lastHitRef.current = hit;
      setOverlay({
        kind: "file",
        zone: hit.zone,
        rect: hit.rect,
        rootZone: null,
        viewport: hit.viewport,
      });
    };
    const clear = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
    };
    const onUp = () => {
      const hit = lastHitRef.current;
      clear();
      lastHitRef.current = null;
      setOverlay(EMPTY_OVERLAY);
      const store = useStore.getState();
      const intent = hit ? fileDropIntent(hit.zone) : null;
      if (hit && hit.targetId && intent) {
        void openFileIntoPane(draggingFilePath, hit.targetId, intent.side);
      }
      store.setDraggingFilePath(null);
    };
    const onCancel = () => {
      clear();
      lastHitRef.current = null;
      setOverlay(EMPTY_OVERLAY);
      useStore.getState().setDraggingFilePath(null);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      onCancel();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    return clear;
  }, [draggingFilePath, endPaneDrag]);

  useEffect(() => () => endPaneDrag(), [endPaneDrag]);

  return { startPaneDrag, overlay };
}
