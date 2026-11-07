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
  /** 生效中的帧合并 flush；finish 时先 flush，避免丢掉最后一帧位置。 */
  const flushRef = useRef<() => void>(() => {});

  onDragRef.current = onDrag;
  onEndRef.current = onEnd;

  const finish = useCallback(() => {
    if (!dragging.current) return;
    flushRef.current();
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
    let rafId: number | null = null;
    let pending: PointerEvent | null = null;

    const flush = () => {
      rafId = null;
      const ev = pending;
      pending = null;
      if (ev && dragging.current) onDragRef.current(ev);
    };

    // 一帧只排一次、只取最新事件。旧实现每个 pointermove 都排一帧，
    // 高频移动会把几十次 setState 堆进同一帧，拖动因此发涩。
    const moveHandler = throttle
      ? (e: PointerEvent) => {
          if (!dragging.current) return;
          pending = e;
          if (rafId === null) rafId = requestAnimationFrame(flush);
        }
      : (e: PointerEvent) => {
          if (!dragging.current) return;
          onDragRef.current(e);
        };

    const cancelFrame = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pending = null;
    };

    flushRef.current = () => {
      cancelFrame();
      flush();
    };

    document.addEventListener("pointermove", moveHandler);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
    return () => {
      document.removeEventListener("pointermove", moveHandler);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      cancelFrame();
      flushRef.current = () => {};
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
