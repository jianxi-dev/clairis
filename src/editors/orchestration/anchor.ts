/* 编排层锚点与摆放纯函数（md-orchestration 1.1，对应 design.md D3/D4）。
 *
 * 这里只做几何：把 CM6 的坐标换成 AnchorRect，再做翻转 / 夹取。
 * 不碰 DOM 布局、不挂监听——滚动后由调用方重新计算即可。
 *
 * 纯函数、无状态、无定时器，行为由单测钉死（D4 的「裁剪结果可断言」）。
 */

/** 浮层锚点矩形。所有浮层只接受这个矩形，不接受任意 DOM 位置（D3）。 */
export interface AnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** 菜单相对锚点的翻转方向。 */
export type Flip = "none" | "vertical" | "horizontal";

/** 把可能为 NaN / Infinity 的数值收敛为有限数。 */
function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * 由 `coordsAtPos` 的结果构造锚点矩形。
 *
 * `coords` 为 `null`（jsdom 无布局、或位置超出文档）时返回零宽矩形：
 * `left = right = 0`、`top = fallbackTop`、`bottom = fallbackTop + 1`，
 * 保证永不为 NaN 且高度恒为 1。
 */
export function rectFromCoords(
  coords: { left: number; top: number; bottom: number; right?: number } | null,
  fallbackTop: number,
): AnchorRect {
  const safeTop = finite(fallbackTop, 0);
  if (coords === null) {
    return {
      left: 0,
      top: safeTop,
      right: 0,
      bottom: safeTop + 1,
      width: 0,
      height: 1,
    };
  }

  const left = finite(coords.left, 0);
  const right = finite(coords.right ?? coords.left, left);
  const top = finite(coords.top, safeTop);
  const bottom = finite(coords.bottom, top + 1);

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
}

/** 与边界求交。交集为空时退化为边界原点处的零尺寸矩形（宽高不为负）。 */
export function clampRect(rect: AnchorRect, bounds: AnchorRect): AnchorRect {
  const left = Math.max(rect.left, bounds.left);
  const right = Math.min(rect.right, bounds.right);
  const top = Math.max(rect.top, bounds.top);
  const bottom = Math.min(rect.bottom, bounds.bottom);

  if (right < left || bottom < top) {
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.left,
      bottom: bounds.top,
      width: 0,
      height: 0,
    };
  }

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

/** 锚点与菜单之间的默认间距（设计：4 的倍数）。 */
const MENU_GAP = 4;

/** 把 `value` 夹进 `[lo, hi]`；`hi < lo`（零尺寸容器）时收敛到 `lo`，不产生 NaN。 */
function clampRange(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), Math.max(lo, hi));
}

/**
 * 计算菜单左上角。
 *
 * 默认开在锚点下方 `MENU_GAP`；底部溢出先翻到锚点上方，仍溢出则夹进 `bounds`；
 * 水平溢出先翻到锚点左侧，再夹取。`margin` 是菜单与边界的最小间距（默认 8）。
 */
export function placeMenu(
  anchor: AnchorRect,
  size: { width: number; height: number },
  bounds: AnchorRect,
  margin = 8,
): { left: number; top: number; flipped: Flip } {
  const minLeft = bounds.left + margin;
  const maxRight = bounds.right - margin;
  const minTop = bounds.top + margin;
  const maxBottom = bounds.bottom - margin;

  let top = anchor.bottom + MENU_GAP;
  let left = anchor.left;
  let flipped: Flip = "none";

  // 垂直：优先向下；下方放不下翻到上方；再不行夹进边界（D4 规则 2）。
  if (top + size.height > maxBottom) {
    const flippedTop = anchor.top - size.height - MENU_GAP;
    top =
      flippedTop >= minTop && flippedTop + size.height <= maxBottom
        ? flippedTop
        : clampRange(top, minTop, maxBottom - size.height);
    flipped = "vertical";
  }

  // 水平：优先贴锚点左侧；右侧放不下翻到左侧；再不行夹进边界（D4 规则 1）。
  if (left + size.width > maxRight) {
    const flippedLeft = anchor.right - size.width - MENU_GAP;
    left =
      flippedLeft >= minLeft && flippedLeft + size.width <= maxRight
        ? flippedLeft
        : clampRange(left, minLeft, maxRight - size.width);
    flipped = "horizontal";
  }

  return { left, top, flipped };
}
