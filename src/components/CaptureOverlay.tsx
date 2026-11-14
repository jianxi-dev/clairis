import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  getLinePrefix,
  useCaptureOverlayStore,
} from "../stores/captureOverlay";
import type { InboxEntry } from "../types";
import Icon from "./Icon";

const PREFIX_COLORS: Record<string, string> = {
  "": "text-gray-400",
  ".": "text-gray-900 dark:text-gray-100",
  "-": "text-amber-500",
  "!": "text-purple-500",
  "?": "text-[#0071e3]",
};

const TOP_BAR_H = 44;
const FOOTER_H = 40;
const HANDLE_H = 4;

// Detect overlay window mode
const urlParams = new URLSearchParams(window.location.search);
const IS_OVERLAY_WINDOW = urlParams.get("window") === "overlay";

export default function CaptureOverlay() {
  const store = useCaptureOverlayStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState(0);

  const pendingClick = useRef<number | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [dayCollapsed, setDayCollapsed] = useState<Record<string, boolean>>({});
  const [detailExpanded, setDetailExpanded] = useState<string | null>(null);

  // Panel resize drag state
  const panelDragRef = useRef<{
    startY: number;
    startRatio: number;
    containerH: number;
  } | null>(null);

  // Window resize drag state
  const winResizeRef = useRef<{
    edge: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  // Auto-focus edit textarea
  useEffect(() => {
    if (store.editingId) {
      requestAnimationFrame(() => editTextareaRef.current?.focus());
    }
  }, [store.editingId]);

  const isComposing = useRef(false);

  // In overlay window mode, always show; in main window mode, check store status
  const isVisible = IS_OVERLAY_WINDOW || store.status !== "closed";
  const isCapsule = !IS_OVERLAY_WINDOW && store.status === "capsule";

  // In overlay window mode, auto-open on mount
  useEffect(() => {
    if (IS_OVERLAY_WINDOW) {
      store.open();
    }
  }, []);

  const handleTopEnter = useCallback(() => setShowTop(true), []);
  const handleTopLeave = useCallback(() => setShowTop(false), []);
  const handleBottomEnter = useCallback(() => setShowBottom(true), []);
  const handleBottomLeave = useCallback(() => setShowBottom(false), []);

  // Hide overlay window via Rust
  const hideOverlayWindow = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("hide_overlay_window");
    } catch {
      // fallback: set store status to closed (main window mode)
      store.close();
    }
  };

  // Global keyboard handler
  useEffect(() => {
    if (!isVisible || isCapsule) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isComposing.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (store.editingId) {
          store.cancelEdit();
        } else if (IS_OVERLAY_WINDOW) {
          hideOverlayWindow();
        } else {
          store.close();
        }
      } else if (
        e.key === "ArrowUp" &&
        !store.editingId &&
        !store.draftContent
      ) {
        e.preventDefault();
        store.selectPrev();
      } else if (
        e.key === "ArrowDown" &&
        !store.editingId &&
        !store.draftContent
      ) {
        e.preventDefault();
        store.selectNext();
      } else if (
        e.key === "Enter" &&
        store.selectedIndex >= 0 &&
        !store.editingId &&
        !store.draftContent
      ) {
        e.preventDefault();
        const entry = store.history[store.selectedIndex];
        if (entry) store.archiveEntry(entry.id);
      }
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [isVisible, isCapsule, store]);

  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node))
        setShowPopover(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopover]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      const menuEl = document.querySelector(`[data-menu-for="${showMenu}"]`);
      if (!menuEl || !menuEl.contains(e.target as Node)) setShowMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (e.key === "Backspace" && store.draftPrefix && !store.draftContent) {
      store.setDraftContent("");
      return;
    }

    if (isComposing.current) return;

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      store.handleCmdEnter();
    } else if (e.key === "Enter") {
      const ta = e.currentTarget;
      const pos = ta.selectionStart;
      const val = ta.value;
      const beforeCursor = val.slice(0, pos);
      const lastNewline = beforeCursor.lastIndexOf("\n");
      const currentLine = beforeCursor.slice(lastNewline + 1);
      if (currentLine.trim() === "" && store.draftPrefix) {
        store.setDraftPrefix("");
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      store.setDraftContent(
        val.slice(0, start) + "  " + val.slice(end),
        start + 2,
      );
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    } else if (e.key === "n" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      store.handleCmdN();
    } else if ((e.key === "=" || e.key === "-") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      store.setFontSize(store.fontSize + (e.key === "=" ? 1 : -1));
    }
  };

  // ===== OVERLAY DRAG (main window mode) =====
  const onBarMouseDown = (e: React.MouseEvent) => {
    if (IS_OVERLAY_WINDOW) return; // use native window drag
    if ((e.target as HTMLElement).closest("button")) return;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = {
      x: e.clientX - store.positionX,
      y: e.clientY - store.positionY,
    };
    didDrag.current = false;
    const onMove = (ev: MouseEvent) => {
      if (!dragOffset.current || !dragStartPos.current) return;
      const dx = ev.clientX - dragStartPos.current.x;
      const dy = ev.clientY - dragStartPos.current.y;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      dragStartPos.current = null;
      didDrag.current = true;
      store.setPosition(
        ev.clientX - dragOffset.current.x,
        ev.clientY - dragOffset.current.y,
      );
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (dragStartPos.current) {
        dragStartPos.current = null;
        dragOffset.current = null;
      } else {
        const rect = containerRef.current?.getBoundingClientRect();
        store.clampPosition(rect?.width, rect?.height);
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ===== OVERLAY DRAG (overlay window mode) — uses native Tauri drag =====
  const onBarMouseDownOverlay = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    // CRITICAL: do NOT await startDragging() — it blocks drag initiation.
    // The Promise resolves when drag ENDS, not when it starts.
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        getCurrentWindow().startDragging();
      })
      .catch((err) => {
        console.warn("[Biaoyue] startDragging failed:", err);
      });
  };

  const onBarDoubleClick = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (IS_OVERLAY_WINDOW) {
      // Tell main window to show capsule, then hide overlay
      import("@tauri-apps/api/event")
        .then(({ emit }) => {
          emit("overlay-to-capsule");
        })
        .catch(() => {});
      hideOverlayWindow();
    } else {
      store.minimize();
    }
  };

  // ===== X BUTTON: SAVE & CLOSE =====
  const handleXClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { draftContent } = store;
    if (draftContent.trim()) {
      await store.handleCmdEnter();
    }
    if (IS_OVERLAY_WINDOW) {
      hideOverlayWindow();
    } else {
      store.close();
    }
  };

  // ===== PANEL RESIZE (drag handle between textarea & history) =====
  const onPanelHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Use actual rendered height, not store.overlayHeight (which is wrong in overlay mode)
    const containerH = rect.height - TOP_BAR_H - FOOTER_H - HANDLE_H;
    panelDragRef.current = {
      startY: e.clientY,
      startRatio: store.panelRatio,
      containerH,
    };
    const onMove = (ev: MouseEvent) => {
      if (!panelDragRef.current) return;
      const dy = ev.clientY - panelDragRef.current.startY;
      const newRatio =
        panelDragRef.current.startRatio + dy / panelDragRef.current.containerH;
      store.setPanelRatio(newRatio);
    };
    const onUp = () => {
      panelDragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ===== WINDOW RESIZE (edges) — main window mode only =====
  const onWindowResizeMouseDown = (e: React.MouseEvent, edge: string) => {
    if (IS_OVERLAY_WINDOW) return; // overlay window resize handled via Tauri API
    e.preventDefault();
    e.stopPropagation();
    winResizeRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startW: store.overlayWidth,
      startH: store.overlayHeight,
    };
    const onMove = (ev: MouseEvent) => {
      if (!winResizeRef.current) return;
      const { edge, startX, startY, startW, startH } = winResizeRef.current;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newW = startW,
        newH = startH;
      if (edge.includes("e")) newW = startW + dx;
      if (edge.includes("w")) newW = startW - dx;
      if (edge.includes("s")) newH = startH + dy;
      if (edge.includes("n")) newH = startH - dy;
      store.setOverlaySize(newW, newH);
    };
    const onUp = () => {
      winResizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ===== WINDOW RESIZE (overlay window mode via Tauri API) =====
  const onWindowResizeMouseDownOverlay = async (
    e: React.MouseEvent,
    edge: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const { LogicalSize } = await import("@tauri-apps/api/dpi");
      const startW = containerRef.current?.offsetWidth ?? store.overlayWidth;
      const startH = containerRef.current?.offsetHeight ?? store.overlayHeight;
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = async (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let newW = startW,
          newH = startH;
        if (edge.includes("e")) newW = startW + dx;
        if (edge.includes("w")) newW = startW - dx;
        if (edge.includes("s")) newH = startH + dy;
        if (edge.includes("n")) newH = startH - dy;
        newW = Math.max(320, Math.min(800, newW));
        newH = Math.max(280, Math.min(900, newH));
        await win.setSize(new LogicalSize(newW, newH));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    } catch (err) {
      console.warn("[Biaoyue] overlay resize failed:", err);
    }
  };

  // ===== CAPSULE (main window mode only) =====
  const handleCapsuleClick = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (pendingClick.current) {
      window.clearTimeout(pendingClick.current);
      pendingClick.current = null;
      store.restore();
    } else {
      pendingClick.current = window.setTimeout(() => {
        setShowPopover((p) => !p);
        pendingClick.current = null;
      }, 200);
    }
  };

  const onCapsuleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    didDrag.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    dragOffset.current = {
      x: e.clientX - (store.capsuleX || window.innerWidth - 24 - 44),
      y: e.clientY - (store.capsuleY || window.innerHeight - 24 - 44),
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragOffset.current) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      store.setCapsulePosition(
        ev.clientX - dragOffset.current.x,
        ev.clientY - dragOffset.current.y,
      );
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (didDrag.current) {
        store.clampCapsulePosition();
      }
      dragOffset.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  if (!isVisible) return null;

  // ===== CAPSULE MODE (main window mode only) =====
  if (isCapsule) {
    const capX =
      store.capsuleX === 0 ? window.innerWidth - 24 - 44 : store.capsuleX;
    const capY =
      store.capsuleY === 0 ? window.innerHeight - 24 - 44 : store.capsuleY;
    const capStyle =
      store.capsuleX === 0 && store.capsuleY === 0
        ? { right: 24, bottom: 24 }
        : { left: capX, top: capY };
    const popoverAbove = capY > 340;
    const popoverLeft = capX + 44 + 288 > window.innerWidth;
    const popoverCls =
      "absolute w-72 max-h-80 p-4 rounded-xl bg-white/95 dark:bg-gray-800/95 shadow-lg border border-black/6 dark:border-white/10 overflow-auto z-20";
    const popoverPos = `${popoverAbove ? "bottom-12" : "top-12"} ${popoverLeft ? "right-0" : "left-0"}`;
    return (
      <div ref={popoverRef} className="fixed z-[2147483647]" style={capStyle}>
        <div className="relative">
          <button
            onClick={handleCapsuleClick}
            onMouseDown={onCapsuleMouseDown}
            className="w-11 h-11 rounded-[11px] bg-white/90 dark:bg-gray-800/90 border border-black/6 dark:border-white/10 shadow-sm backdrop-blur-sm hover:shadow-md hover:scale-105 transition-all cursor-grab active:cursor-grabbing"
          >
            <span className="text-gray-400 text-base leading-none select-none">
              ⊕
            </span>
          </button>
          {showPopover && (
            <div className={`${popoverCls} ${popoverPos}`}>
              <h4 className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                当前 buffer:
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-200 mt-1 whitespace-pre-wrap">
                {store.draftContent || "(空)"}
              </p>
              <h4 className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-3">
                最近:
              </h4>
              <ul className="mt-1 space-y-1">
                {store.history.slice(0, 3).map((e) => (
                  <li
                    key={e.id}
                    className="text-xs text-gray-600 dark:text-gray-300 truncate"
                  >
                    {e.content}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  setShowPopover(false);
                  store.restore();
                }}
                className="mt-3 text-xs text-[#0071e3] font-medium"
              >
                展开查看 ▸
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== OVERLAY MODE =====
  const groupedHistory: Record<string, InboxEntry[]> = {};
  let itemCount = 0;
  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = toLocalDate(new Date());
  const yesterday = toLocalDate(new Date(Date.now() - 86400000));
  // Defensive date parser: handles ISO, local datetime, and fallback
  const safeParseDate = (capturedAt: string | undefined | null): Date => {
    if (!capturedAt) return new Date();
    const d = new Date(capturedAt);
    if (!isNaN(d.getTime())) return d;
    // Try parsing as local datetime (e.g. "2026-07-17 10:30:00")
    const d2 = new Date(capturedAt.replace(" ", "T"));
    if (!isNaN(d2.getTime())) return d2;
    return new Date(); // fallback to now
  };
  for (const entry of store.history) {
    if (itemCount >= store.displayLimit) break;
    const entryDate = toLocalDate(safeParseDate(entry.capturedAt));
    const label =
      entryDate === today
        ? "今天"
        : entryDate === yesterday
          ? "昨天"
          : entryDate;
    if (!groupedHistory[label]) groupedHistory[label] = [];
    groupedHistory[label].push(entry);
    itemCount++;
  }

  // Use CSS flex for height calculation instead of JS pixel math
  // In overlay mode store.overlayHeight is wrong (420 vs actual 100vh)
  const panelsH = IS_OVERLAY_WINDOW
    ? 0
    : store.overlayHeight - TOP_BAR_H - FOOTER_H;
  const textareaH = IS_OVERLAY_WINDOW
    ? 0
    : store.collapsed
      ? panelsH
      : Math.max(60, Math.round(panelsH * store.panelRatio) - HANDLE_H / 2);
  // Overlay window: fill entire window, no fixed positioning
  // Main window: position: fixed with stored coordinates
  const containerStyle: React.CSSProperties = IS_OVERLAY_WINDOW
    ? { width: "100vw", height: "100vh" }
    : {
        width: store.overlayWidth,
        height: store.overlayHeight,
        left: store.positionX,
        top: store.positionY,
      };

  const containerClass = IS_OVERLAY_WINDOW
    ? "w-full h-full"
    : "fixed z-[2147483647]";

  const resizeHandler = IS_OVERLAY_WINDOW
    ? onWindowResizeMouseDownOverlay
    : onWindowResizeMouseDown;

  return (
    <div ref={containerRef} className={containerClass} style={containerStyle}>
      <div className="h-full flex flex-col rounded-[14px] bg-white/88 dark:bg-[#1c1c1e]/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.06)] border border-black/6 dark:border-white/10 overflow-hidden">
        {/* TOP BAR */}
        <div
          onMouseDown={
            IS_OVERLAY_WINDOW ? onBarMouseDownOverlay : onBarMouseDown
          }
          onDoubleClick={onBarDoubleClick}
          onMouseOver={handleTopEnter}
          onMouseOut={handleTopLeave}
          className="shrink-0 flex items-center h-11 px-3 select-none cursor-pointer"
          style={{ opacity: showTop ? 1 : 0, transition: "opacity 200ms" }}
        >
          <div className="w-7 rounded-md flex items-center justify-center text-[13px] text-gray-500 cursor-grab">
            ≡
          </div>
          <span className="ml-2 text-[13px] text-gray-600 dark:text-gray-300 font-medium">
            标月
          </span>
          <div className="flex-1" />
          <span className="text-[12px] text-gray-400 mr-2">
            {store.history.filter((e) => !e.archivedAt).length} 条
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              store.setPinned(!store.pinned);
            }}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${store.pinned ? "text-orange-500 bg-orange-50 dark:bg-orange-900/30" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
            title={store.pinned ? "取消收藏" : "收藏"}
          >
            <Icon name={store.pinned ? "pinOff" : "pin"} size={18} />
          </button>
          <button
            onClick={handleXClick}
            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="关闭"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* TEXTAREA PANEL */}
        <div
          className="shrink-0 px-2 pb-1 overflow-hidden"
          style={{ flex: store.collapsed ? "1" : `${store.panelRatio}` }}
        >
          <div className="flex items-start gap-2 h-full">
            {(() => {
              const displayPrefix =
                store.draftPrefix ||
                getLinePrefix(store.draftContent, cursorPos);
              return (
                <>
                  {displayPrefix && (
                    <div
                      className={`shrink-0 mt-2 px-2 py-0.5 rounded text-xs font-semibold select-none ${PREFIX_COLORS[displayPrefix]}`}
                    >
                      {displayPrefix}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    data-capture-input
                    value={store.draftContent}
                    onChange={(e) => {
                      setCursorPos(e.target.selectionStart);
                      store.setDraftContent(
                        e.target.value,
                        e.target.selectionStart,
                      );
                    }}
                    onSelect={(e) => {
                      setCursorPos(
                        (e.target as HTMLTextAreaElement).selectionStart,
                      );
                    }}
                    onKeyUp={(e) => {
                      setCursorPos(
                        (e.target as HTMLTextAreaElement).selectionStart,
                      );
                    }}
                    onClick={(e) => {
                      setCursorPos(
                        (e.target as HTMLTextAreaElement).selectionStart,
                      );
                    }}
                    onKeyDown={handleTextareaKeyDown}
                    onCompositionStart={() => {
                      isComposing.current = true;
                    }}
                    onCompositionEnd={() => {
                      isComposing.current = false;
                    }}
                    placeholder={
                      displayPrefix
                        ? "继续输入…"
                        : "记录…  .问题  -待办  !灵感  ?思考"
                    }
                    rows={3}
                    autoFocus
                    className="flex-1 h-full px-3 py-2.5 border-0 outline-none resize-none text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-transparent"
                    style={{ fontSize: store.fontSize, lineHeight: 1.7 }}
                  />
                </>
              );
            })()}
          </div>
        </div>

        {/* PANEL DRAG HANDLE */}
        {!store.collapsed && (
          <div
            onMouseDown={onPanelHandleMouseDown}
            className="shrink-0 flex items-center justify-center cursor-row-resize group"
            style={{ height: HANDLE_H }}
          >
            <div className="w-8 h-[2px] rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-gray-400 dark:group-hover:bg-gray-500 transition-colors" />
          </div>
        )}

        {/* HISTORY PANEL */}
        {!store.collapsed && (
          <div
            className="overflow-y-auto min-h-0"
            style={{ flex: `${1 - store.panelRatio}` }}
          >
            {Object.entries(groupedHistory).map(([label, items]) => (
              <div key={label} className="mb-1">
                <div className="flex items-center px-3 py-1 text-gray-500 dark:text-gray-400 text-xs">
                  <span className="flex-1">{label}</span>
                  <button
                    onClick={() => store.openInMainWindow(label)}
                    className="text-[#0071e3] hover:underline mr-2"
                  >
                    [查看]
                  </button>
                  <button
                    onClick={() =>
                      setDayCollapsed((p) => ({ ...p, [label]: !p[label] }))
                    }
                    className="hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {dayCollapsed[label] ? "[展开 ▾]" : "[折叠 ▴]"}
                  </button>
                </div>
                {!dayCollapsed[label] &&
                  items.map((entry) => {
                    const globalIdx = store.history.findIndex(
                      (e) => e.id === entry.id,
                    );
                    const isUndo = store.undo?.entryId === entry.id;
                    const isDetail = detailExpanded === entry.id;
                    const isEditing = store.editingId === entry.id;
                    return (
                      <div
                        key={entry.id}
                        className="relative"
                        style={
                          entry.id === store.savedAckId
                            ? { animation: "fadeInSlide 300ms ease-out" }
                            : undefined
                        }
                      >
                        <div
                          onClick={() => {
                            if (!isEditing) {
                              setDetailExpanded(isDetail ? null : entry.id);
                              store.setSelectedIndex(globalIdx);
                            }
                          }}
                          className={`group flex items-start gap-2 px-3 py-1.5 rounded-lg mb-0.5 cursor-pointer transition-colors ${globalIdx === store.selectedIndex && !isEditing ? "bg-[#0071e3]/10 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/60"} ${isUndo ? "bg-amber-50/60 dark:bg-amber-900/10" : ""}`}
                        >
                          <span
                            className={`mt-0.5 font-bold shrink-0 w-4 text-center ${PREFIX_COLORS[entry.prefix || ""]}`}
                          >
                            {entry.prefix || "·"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-700 dark:text-gray-200 truncate">
                              {entry.content}
                            </div>
                          </div>
                          {isUndo ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                已归档
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  store.undoArchive(entry.id);
                                }}
                                className="text-xs px-2 py-1 rounded-md bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-[#0071e3] font-medium"
                              >
                                撤销
                              </button>
                            </div>
                          ) : isEditing ? null : (
                            <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  store.archiveEntry(entry.id);
                                }}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-500"
                                title="归档"
                              >
                                <Icon name="check" size={18} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const r = (
                                    e.currentTarget as HTMLElement
                                  ).getBoundingClientRect();
                                  setMenuPos({ x: r.left, y: r.bottom });
                                  setShowMenu(
                                    showMenu === entry.id ? null : entry.id,
                                  );
                                }}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                title="更多"
                              >
                                ⋯
                              </button>
                            </div>
                          )}
                        </div>
                        {isDetail && !isEditing && (
                          <div className="px-3 py-1.5 ml-7 mb-0.5 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                            {entry.content}
                          </div>
                        )}
                        {isEditing && (
                          <div className="px-3 py-1.5 ml-7 mb-0.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                            <textarea
                              ref={editTextareaRef}
                              value={store.editBuffer}
                              onChange={(e) =>
                                store.setEditBuffer(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  (e.metaKey || e.ctrlKey)
                                ) {
                                  e.preventDefault();
                                  store.saveEdit();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  store.cancelEdit();
                                }
                              }}
                              className="w-full p-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-600 resize-none"
                              rows={3}
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => store.saveEdit()}
                                className="text-xs px-3 py-1.5 rounded-md bg-[#0071e3] text-white font-medium"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => store.cancelEdit()}
                                className="text-xs px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        )}
                        {showMenu === entry.id &&
                          createPortal(
                            <div
                              data-menu-for={entry.id}
                              className="fixed w-24 py-1 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-[2147483647]"
                              style={{ left: menuPos.x, top: menuPos.y }}
                            >
                              <button
                                onClick={() => {
                                  store.startEdit(entry.id, entry.content);
                                  setShowMenu(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => {
                                  store.deleteEntry(entry.id);
                                  setShowMenu(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                删除
                              </button>
                            </div>,
                            document.body,
                          )}
                      </div>
                    );
                  })}
                {store.history.length > itemCount && (
                  <button
                    onClick={store.loadMore}
                    className="w-full py-1 text-xs text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    显示更早的 20 条
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* FOOTER */}
        <div
          onMouseOver={handleBottomEnter}
          onMouseOut={handleBottomLeave}
          className="shrink-0 px-4 pb-3 pt-2 flex items-center justify-between"
          style={{ opacity: showBottom ? 1 : 0, transition: "opacity 200ms" }}
        >
          <button
            onClick={() => store.setCollapsed(!store.collapsed)}
            className="text-xs text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            {store.collapsed ? "[展开历史 ▾]" : "[收起历史 ▴]"}
          </button>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 border border-gray-200 dark:border-gray-700">
              ↑↓
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 border border-gray-200 dark:border-gray-700">
              ⌘ Enter
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 border border-gray-200 dark:border-gray-700">
              Esc
            </kbd>
          </div>
        </div>
      </div>

      {/* WINDOW RESIZE HANDLES (main window mode only) */}
      {!IS_OVERLAY_WINDOW && (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-1 cursor-n-resize"
            onMouseDown={(e) => resizeHandler(e, "n")}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-1 cursor-s-resize"
            onMouseDown={(e) => resizeHandler(e, "s")}
          />
          <div
            className="absolute top-0 bottom-0 left-0 w-1 cursor-w-resize"
            onMouseDown={(e) => resizeHandler(e, "w")}
          />
          <div
            className="absolute top-0 bottom-0 right-0 w-1 cursor-e-resize"
            onMouseDown={(e) => resizeHandler(e, "e")}
          />
          <div
            className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize"
            onMouseDown={(e) => resizeHandler(e, "nw")}
          />
          <div
            className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize"
            onMouseDown={(e) => resizeHandler(e, "ne")}
          />
          <div
            className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize"
            onMouseDown={(e) => resizeHandler(e, "sw")}
          />
          <div
            className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
            onMouseDown={(e) => resizeHandler(e, "se")}
          />
        </>
      )}
      {/* WINDOW RESIZE HANDLES (overlay window mode via Tauri) */}
      {IS_OVERLAY_WINDOW && (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-1.5 cursor-n-resize z-10"
            onMouseDown={(e) => resizeHandler(e, "n")}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize z-10"
            onMouseDown={(e) => resizeHandler(e, "s")}
          />
          <div
            className="absolute top-0 bottom-0 left-0 w-1.5 cursor-w-resize z-10"
            onMouseDown={(e) => resizeHandler(e, "w")}
          />
          <div
            className="absolute top-0 bottom-0 right-0 w-1.5 cursor-e-resize z-10"
            onMouseDown={(e) => resizeHandler(e, "e")}
          />
          <div
            className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10"
            onMouseDown={(e) => resizeHandler(e, "nw")}
          />
          <div
            className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-10"
            onMouseDown={(e) => resizeHandler(e, "ne")}
          />
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10"
            onMouseDown={(e) => resizeHandler(e, "sw")}
          />
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
            onMouseDown={(e) => resizeHandler(e, "se")}
          />
        </>
      )}
    </div>
  );
}
