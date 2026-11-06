import { useCallback, useEffect, useRef } from "react";

interface UseDragResizeOptions {
  /** Called on each pointermove during drag. */
  onDrag: (e: PointerEvent) => void;
  /** Called on pointerup/pointercancel after drag ends. */
  onEnd?: () => void;
  /** RAF throttle. Default true. */
  throttle?: boolean;
}

/**
 * Reusable drag-to-resize hook.
 *
 * Pointer capture is set on the handle so moves over embedded iframes still
 * reach us; without it the iframe swallows pointermove and the drag sticks.
 */
export function useDragResize({
  onDrag,
  onEnd,
  throttle = true,
}: UseDragResizeOptions) {
  const dragging = useRef(false);
  const capture = useRef<{ el: Element; pointerId: number } | null>(null);
  const onDragRef = useRef(onDrag);
  const onEndRef = useRef(onEnd);

  onDragRef.current = onDrag;
  onEndRef.current = onEnd;

  const finish = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const cap = capture.current;
    capture.current = null;
    if (cap && cap.el.hasPointerCapture?.(cap.pointerId)) {
      cap.el.releasePointerCapture(cap.pointerId);
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onEndRef.current?.();
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      onDragRef.current(e);
    };

    const moveHandler = throttle
      ? (e: PointerEvent) => {
          requestAnimationFrame(() => onMove(e));
        }
      : onMove;

    document.addEventListener("pointermove", moveHandler);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
    return () => {
      document.removeEventListener("pointermove", moveHandler);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      finish();
    };
  }, [throttle, finish]);

  const startDrag = useCallback(
    (cursor: string, target?: Element, pointerId?: number) => {
      dragging.current = true;
      capture.current =
        target && pointerId !== undefined ? { el: target, pointerId } : null;
      if (capture.current) {
        target!.setPointerCapture(pointerId!);
      }
      document.body.style.cursor = cursor;
      document.body.style.userSelect = "none";
    },
    [],
  );

  return { startDrag };
}
