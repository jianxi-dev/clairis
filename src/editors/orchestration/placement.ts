/* 编排层锚点追踪器（md-orchestration 1.1，对应 design.md D3）。
 *
 * `view.coordsAtPos(pos)` 返回视口坐标（含行内偏移与折行处理），滚动后会漂移。
 * 所以这里返回一个「取当前锚点」的函数：调用方在滚动 / resize 后重新调用即可，
 * 不缓存、不订阅。`coordsAtPos` 为 `null` 时回退到 `view.documentTop`，不抛错。
 */
import type { EditorView } from "@codemirror/view";
import { rectFromCoords, type AnchorRect } from "./anchor";

/** 安全读取坐标：jsdom 无布局或位置越界时返回 null。 */
function coordsAt(view: EditorView, pos: number) {
  try {
    return view.coordsAtPos(pos);
  } catch {
    return null;
  }
}

/**
 * 为块创建锚点追踪器。
 *
 * 块首用 `from`、块尾用 `to` 各取一次坐标，取并集作为锚点矩形；任一次为 `null`
 * 时退化为单次矩形，两次都为 `null` 时退化为 `view.documentTop` 上的零宽矩形。
 */
export function createAnchorTracker(
  view: EditorView,
  block: { from: number; to: number },
): () => AnchorRect {
  return () => {
    const fallbackTop = view.documentTop;
    const start = coordsAt(view, block.from);
    const end = coordsAt(view, block.to);

    if (start === null && end === null) {
      return rectFromCoords(null, fallbackTop);
    }
    if (start === null) {
      return rectFromCoords(end, fallbackTop);
    }
    if (end === null) {
      return rectFromCoords(start, fallbackTop);
    }

    const left = Math.min(start.left, end.left);
    const right = Math.max(start.right, end.right);
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    };
  };
}
