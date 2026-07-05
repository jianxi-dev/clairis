import { useCallback, useRef, useEffect, useState, type ReactNode } from "react";
import { useStore } from "../stores";
import { useDragResize } from "../hooks/useDragResize";

const LEFT_MIN = 180;
const LEFT_MAX = 500;
const RIGHT_MIN = 200;
const RIGHT_MAX = 500;
const SNAP_THRESHOLD = 80; // drag below this → auto-collapse

interface LayoutProps {
  leftSidebar: ReactNode;
  center: ReactNode;
  rightSidebar: ReactNode;
  /** Initial left sidebar width from persisted config. Default 280. */
  initialLeftWidth?: number;
  /** Initial right sidebar width from persisted config. Default 320. */
  initialRightWidth?: number;
  onLeftWidthChange: (width: number) => void;
  onRightWidthChange: (width: number) => void;
}

export default function Layout({
  leftSidebar,
  center,
  rightSidebar,
  initialLeftWidth = 280,
  initialRightWidth = 320,
  onLeftWidthChange,
  onRightWidthChange,
}: LayoutProps) {
  const sidebarLeftVisible = useStore((s) => s.sidebarLeftVisible);
  const sidebarRightVisible = useStore((s) => s.sidebarRightVisible);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftWidth = useRef(initialLeftWidth);
  const rightWidth = useRef(initialRightWidth);

  // Track whether a drag is active to disable CSS transitions during drag
  const [draggingLeft, setDraggingLeft] = useState(false);
  const [draggingRight, setDraggingRight] = useState(false);

  // ── Width updates (clamp + snap integration) ──────────────────

  const applyLeftWidth = useCallback(
    (w: number) => {
      // Snap: drag below threshold → collapse sidebar
      if (w < SNAP_THRESHOLD) {
        useStore.getState().setSidebarLeftVisible(false);
        return;
      }
      const clamped = Math.max(LEFT_MIN, Math.min(LEFT_MAX, w));
      leftWidth.current = clamped;
      if (leftRef.current) {
        leftRef.current.style.width = `${clamped}px`;
      }
      onLeftWidthChange(clamped);
    },
    [onLeftWidthChange],
  );

  const applyRightWidth = useCallback(
    (w: number) => {
      if (w < SNAP_THRESHOLD) {
        useStore.getState().setSidebarRightVisible(false);
        return;
      }
      const clamped = Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, w));
      rightWidth.current = clamped;
      if (rightRef.current) {
        rightRef.current.style.width = `${clamped}px`;
      }
      onRightWidthChange(clamped);
    },
    [onRightWidthChange],
  );

  // ── Drag hooks ────────────────────────────────────────────────

  const leftDrag = useDragResize({
    onDrag: (e) => applyLeftWidth(e.clientX),
    onEnd: () => setDraggingLeft(false),
  });

  const rightDrag = useDragResize({
    onDrag: (e) => {
      const containerRight =
        containerRef.current?.getBoundingClientRect().right || window.innerWidth;
      applyRightWidth(containerRight - e.clientX);
    },
    onEnd: () => setDraggingRight(false),
  });

  // ── Init widths from config on mount ──────────────────────────

  useEffect(() => {
    if (leftRef.current) {
      leftRef.current.style.width = `${initialLeftWidth}px`;
    }
    if (rightRef.current) {
      rightRef.current.style.width = `${initialRightWidth}px`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ──────────────────────────────────────────────────

  const startLeftDrag = () => {
    setDraggingLeft(true);
    leftDrag.startDrag("col-resize");
  };

  const startRightDrag = () => {
    setDraggingRight(true);
    rightDrag.startDrag("col-resize");
  };

  const isDragging = draggingLeft || draggingRight;

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden layout-container">
      {/* Left sidebar */}
      {sidebarLeftVisible && (
        <>
          <div
            ref={leftRef}
            className="shrink-0 overflow-hidden border-r border-gray-200 dark:border-gray-700"
            style={{
              width: leftWidth.current,
              transition: isDragging ? "none" : "width 0.2s ease",
            }}
          >
            {leftSidebar}
          </div>
          {/* Resize handle */}
          <div
            onMouseDown={startLeftDrag}
            className="w-1 hover:w-1.5 bg-transparent hover:bg-blue-300 dark:hover:bg-blue-700 cursor-col-resize transition-all shrink-0"
          />
        </>
      )}

      {/* Center */}
      <div className="flex-1 min-w-0 overflow-hidden">{center}</div>

      {/* Right sidebar */}
      {sidebarRightVisible && (
        <>
          <div
            onMouseDown={startRightDrag}
            className="w-1 hover:w-1.5 bg-transparent hover:bg-blue-300 dark:hover:bg-blue-700 cursor-col-resize transition-all shrink-0"
          />
          <div
            ref={rightRef}
            className="shrink-0 overflow-hidden border-l border-gray-200 dark:border-gray-700"
            style={{
              width: rightWidth.current,
              transition: isDragging ? "none" : "width 0.2s ease",
            }}
          >
            {rightSidebar}
          </div>
        </>
      )}
    </div>
  );
}
