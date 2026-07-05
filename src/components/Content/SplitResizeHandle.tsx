import { useCallback, useRef, useState, type RefObject } from "react";
import { useDragResize } from "../../hooks/useDragResize";

interface SplitResizeHandleProps {
  /** Split direction — "horizontal" means vertical bar (left/right drag). */
  direction: "horizontal" | "vertical";
  /** Called with ratio 0.0–1.0 during drag. Clamped to [0.1, 0.9]. */
  onRatioChange: (ratio: number) => void;
  /** Reset to 0.5 on double-click. */
  onReset?: () => void;
  /** Container ref for calculating relative position. */
  containerRef: RefObject<HTMLElement>;
}

/**
 * Draggable split bar between two content panels.
 * Uses useDragResize hook for the drag lifecycle.
 *
 * Horizontal split → vertical bar, col-resize cursor.
 * Vertical split   → horizontal bar, row-resize cursor.
 */
export default function SplitResizeHandle({
  direction,
  onRatioChange,
  onReset,
  containerRef,
}: SplitResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);

  const isHorizontal = direction === "horizontal";

  const drag = useDragResize({
    onDrag: useCallback(
      (e: MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const ratio = isHorizontal
          ? (e.clientX - rect.left) / rect.width
          : (e.clientY - rect.top) / rect.height;
        onRatioChange(Math.max(0.1, Math.min(0.9, ratio)));
      },
      [isHorizontal, onRatioChange, containerRef],
    ),
    onEnd: () => setDragging(false),
  });

  const startDrag = () => {
    setDragging(true);
    drag.startDrag(isHorizontal ? "col-resize" : "row-resize");
  };

  const handleDoubleClick = () => {
    onReset?.();
  };

  return (
    <div
      ref={handleRef}
      onMouseDown={startDrag}
      onDoubleClick={handleDoubleClick}
      className={`split-resize-handle shrink-0 ${
        isHorizontal ? "split-handle-h" : "split-handle-v"
      } ${dragging ? "dragging" : ""}`}
      role="separator"
      aria-orientation={isHorizontal ? "vertical" : "horizontal"}
      aria-valuenow={50}
      tabIndex={0}
      onKeyDown={(e) => {
        // Keyboard accessibility: arrow keys adjust ratio by 5%
        const step = 0.05;
        if (isHorizontal) {
          if (e.key === "ArrowLeft") onRatioChange(Math.max(0.1, 0.5 - step));
          if (e.key === "ArrowRight") onRatioChange(Math.min(0.9, 0.5 + step));
        } else {
          if (e.key === "ArrowUp") onRatioChange(Math.min(0.9, 0.5 + step));
          if (e.key === "ArrowDown") onRatioChange(Math.max(0.1, 0.5 - step));
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onReset?.();
        }
      }}
    />
  );
}
