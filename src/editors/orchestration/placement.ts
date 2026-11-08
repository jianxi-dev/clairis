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

/** 菜单相对锚点的翻转结果（沿用旧接口，供调用方区分是否需要改箭头方向）。 */
export type Flip = "none" | "vertical" | "horizontal";

/** 摆放基准：`below` 从锚点下方左对齐；`right` 贴锚点右侧纵向居中。 */
export type MenuAlign = "below" | "right";

export interface MenuPlacement {
  left: number;
  top: number;
  flippedX: boolean;
  flippedY: boolean;
}

const MENU_GAP = 4;

interface Candidate {
  left: number;
  top: number;
}

/** 菜单矩形到锚点矩形的距离（重叠或相接为 0），用于「取最近」。 */
function distanceToAnchor(
  candidate: Candidate,
  size: { width: number; height: number },
  anchor: AnchorRect,
): number {
  const dx = Math.max(
    0,
    anchor.left - (candidate.left + size.width),
    candidate.left - anchor.right,
  );
  const dy = Math.max(
    0,
    anchor.top - (candidate.top + size.height),
    candidate.top - anchor.bottom,
  );
  return dx * dx + dy * dy;
}

function fits(
  candidate: Candidate,
  size: { width: number; height: number },
  viewport: AnchorRect,
  margin: number,
): boolean {
  return (
    candidate.left >= viewport.left + margin &&
    candidate.top >= viewport.top + margin &&
    candidate.left + size.width <= viewport.right - margin &&
    candidate.top + size.height <= viewport.bottom - margin
  );
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), Math.max(lo, hi));
}

/**
 * 统一的菜单落位（最短路径规则，替代各调用点各写一套翻转/夹取）。
 *
 * 候选按「下方左对齐 → 上翻 → 左移 → 上翻且左移」（`align: "right"` 时换成
 * 右侧居中 → 右侧顶对齐 → 左侧居中 → 左侧顶对齐）排列；取**完全落在视口内**
 * 且离锚点最近的一个，距离相同时按候选顺序（即上面的优先级）。全都放不下时
 * 把首选候选夹进视口——始终留出 `margin`（默认 8px）边距，不产生 NaN。
 */
export function placeMenu(
  anchor: AnchorRect,
  size: { width: number; height: number },
  viewport: AnchorRect,
  margin = 8,
  align: MenuAlign = "below",
): MenuPlacement {
  const width = Math.max(0, size.width);
  const height = Math.max(0, size.height);
  const box = { width, height };

  const centredTop = anchor.top + anchor.height / 2 - height / 2;

  if (align === "right") {
    // 贴锚点右侧、纵向以锚点行居中；居中被视口挡住时夹进边界（保持「尽量居中」），
    // 右侧放不下翻到左侧；两侧都放不下退回右侧再夹取。
    const top = clamp(
      centredTop,
      viewport.top + margin,
      viewport.bottom - margin - height,
    );
    const rightLeft = anchor.right + MENU_GAP;
    const leftLeft = anchor.left - MENU_GAP - width;
    let left = rightLeft;
    if (rightLeft + width > viewport.right - margin) {
      left = leftLeft >= viewport.left + margin ? leftLeft : rightLeft;
    }
    left = clamp(left, viewport.left + margin, viewport.right - margin - width);
    return {
      left,
      top,
      flippedX: left !== rightLeft,
      flippedY: top !== centredTop,
    };
  }

  const candidates: Candidate[] = [
    { left: anchor.left, top: anchor.bottom + MENU_GAP },
    { left: anchor.left, top: anchor.top - height - MENU_GAP },
    {
      left: anchor.right - width - MENU_GAP,
      top: anchor.bottom + MENU_GAP,
    },
    {
      left: anchor.right - width - MENU_GAP,
      top: anchor.top - height - MENU_GAP,
    },
  ];

  let chosen: Candidate | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (!fits(candidate, box, viewport, margin)) continue;
    const distance = distanceToAnchor(candidate, box, anchor);
    if (distance < bestDistance) {
      chosen = candidate;
      bestDistance = distance;
    }
  }

  if (chosen === null) {
    chosen = {
      left: clamp(
        candidates[0].left,
        viewport.left + margin,
        viewport.right - margin - width,
      ),
      top: clamp(
        candidates[0].top,
        viewport.top + margin,
        viewport.bottom - margin - height,
      ),
    };
  }

  return {
    left: chosen.left,
    top: chosen.top,
    flippedX: chosen.left !== candidates[0].left,
    flippedY: chosen.top !== candidates[0].top,
  };
}
