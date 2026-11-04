import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useStore } from "../stores";

const DRAG_THRESHOLD_PX = 4;

let suppressClick = false;

/**
 * 文件条目的拖拽源处理器（layout-portal 5.1）。
 *
 * 指针移过阈值后把路径写进 store，落区与投放由 usePaneDragController 接管；
 * 拖拽尾巴上的那次 click 要吞掉，否则会顺带触发条目自身的打开行为。
 * 返回的是普通对象而非 hook，可在列表 map 里直接展开。
 */
export function fileDragHandlers(path: string) {
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      suppressClick = false;
      const startX = e.clientX;
      const startY = e.clientY;
      let active = false;
      const onMove = (ev: PointerEvent) => {
        if (active) return;
        if (
          Math.abs(ev.clientX - startX) < DRAG_THRESHOLD_PX &&
          Math.abs(ev.clientY - startY) < DRAG_THRESHOLD_PX
        ) {
          return;
        }
        active = true;
        suppressClick = true;
        useStore.getState().setDraggingFilePath(path);
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    },
    onClickCapture: (e: ReactMouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
