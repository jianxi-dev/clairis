import { useCallback, useEffect, useRef } from "react";

interface UseDragResizeOptions {
  /** Called on each mousemove during drag. Receives the raw MouseEvent. */
  onDrag: (e: MouseEvent) => void;
  /** Called on mouseup after drag ends. */
  onEnd?: () => void;
  /** RAF throttle. Default true. */
  throttle?: boolean;
}

/**
 * Reusable drag-to-resize hook.
 * Encapsulates the mousedown/mousemove/mouseup lifecycle with cursor
 * management and user-select toggling. Used by both Layout sidebars
 * and SplitResizeHandle.
 *
 * Usage:
 *   const { startDrag } = useDragResize({ onDrag: (e) => updateWidth(e.clientX) });
 *   <div onMouseDown={() => startDrag("col-resize")} />
 */
export function useDragResize({
  onDrag,
  onEnd,
  throttle = true,
}: UseDragResizeOptions) {
  const dragging = useRef(false);
  const onDragRef = useRef(onDrag);
  const onEndRef = useRef(onEnd);

  // Keep refs current without re-registering listeners
  onDragRef.current = onDrag;
  onEndRef.current = onEnd;

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onDragRef.current(e);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onEndRef.current?.();
    };

    const moveHandler = throttle
      ? (e: MouseEvent) => {
          requestAnimationFrame(() => onMouseMove(e));
        }
      : onMouseMove;

    document.addEventListener("mousemove", moveHandler);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", moveHandler);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [throttle]);

  const startDrag = useCallback((cursor: string) => {
    dragging.current = true;
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
  }, []);

  return { startDrag };
}
