/**
 * 网格键盘导航（layout-portal 11.1）——纯逻辑层。
 *
 * 只消费 DOM 几何（getBoundingClientRect 的结果）与视口矩形，无 DOM / 无 store /
 * 无 React。渲染侧（components/GridView.tsx）负责量取几何、调用本层、把结果写回
 * `gridSelectedPath`；单测与 e2e 断言的是同一份确定性契约。
 *
 * 语义（批准设计 §5）：
 * - j/k 上下「整行」：以当前卡为基准找下一个视觉行，行内取 x 中心最近者；
 * - h/l 行内左右：仅承认与当前卡垂直重叠 ≥ 50% 的「同一行」卡，取最近边；
 *   无同行候选时返回 null（不跨行）；
 * - PageDown/PageUp 整页：scrollTop ±= 容器高 − 24px；
 * - 按住 ⌘ 显示的视口编号：按视觉阅读顺序（先上后左）取前 N 张。
 */

/** 一张卡在视口坐标系下的外接矩形（已含滚动偏移，可直接比较）。 */
export interface GridBox {
  path: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** 视口 / 容器可见矩形（同样在视口坐标系下）。 */
export interface GridViewport {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** 几何比较容差（px）：吸收 sub-pixel 与边框取整误差。 */
const EPS = 1;

function centerX(box: GridBox): number {
  return (box.left + box.right) / 2;
}

/** 两矩形是否相交（边贴边不算相交）。 */
function intersects(box: GridBox, vp: GridViewport): boolean {
  return (
    box.bottom > vp.top &&
    box.top < vp.bottom &&
    box.right > vp.left &&
    box.left < vp.right
  );
}

/**
 * 视口内可见卡片的编号顺序（视觉阅读顺序：先按 top 升序，再按 left 升序），
 * 最多取 `limit` 张。传入顺序不要求已排序。
 */
export function sequenceOfVisible(
  boxes: readonly GridBox[],
  viewport: GridViewport,
  limit = 9,
): string[] {
  return boxes
    .filter((b) => intersects(b, viewport))
    .sort((a, b) => a.top - b.top || a.left - b.left)
    .slice(0, limit)
    .map((b) => b.path);
}

/**
 * 竖直移动（j/k）：找「下一个视觉行」，行内取 x 中心最近者。
 *
 * 行的判定：候选卡的 `top` 不早于当前卡 `bottom`（下行），或 `bottom` 不晚于
 * 当前卡 `top`（上行）。这样 2×2 大卡不会被误判成它跨越的某一行里的邻居。
 * 先最小化行间距，再最小化 x 中心距离；都没有时退回数组顺序 ±1。
 */
export function moveVertical(
  boxes: readonly GridBox[],
  currentPath: string,
  dir: 1 | -1,
): string | null {
  const idx = boxes.findIndex((b) => b.path === currentPath);
  if (idx < 0) return null;
  const current = boxes[idx];

  let best: GridBox | null = null;
  let bestRowDist = Infinity;
  let bestXDist = Infinity;

  for (let i = 0; i < boxes.length; i += 1) {
    if (i === idx) continue;
    const candidate = boxes[i];
    const rowDist =
      dir === 1
        ? candidate.top - current.bottom
        : current.top - candidate.bottom;
    if (rowDist < -EPS) continue;
    const rowScore = Math.max(0, rowDist);
    const xDist = Math.abs(centerX(candidate) - centerX(current));
    if (
      best === null ||
      rowScore < bestRowDist - EPS ||
      (Math.abs(rowScore - bestRowDist) <= EPS && xDist < bestXDist)
    ) {
      best = candidate;
      bestRowDist = rowScore;
      bestXDist = xDist;
    }
  }

  if (best) return best.path;
  const fallback = idx + dir;
  return fallback >= 0 && fallback < boxes.length ? boxes[fallback].path : null;
}

/**
 * 水平移动（h/l）：只承认与当前卡「同一行」的候选——垂直重叠 ≥ 两卡较小高度的
 * 50%。方向上取最近边（右移取 `left - current.right`，左移取 `current.left - right`）；
 * 无同行候选时返回 null（不跨行）。
 */
export function moveHorizontal(
  boxes: readonly GridBox[],
  currentPath: string,
  dir: 1 | -1,
): string | null {
  const idx = boxes.findIndex((b) => b.path === currentPath);
  if (idx < 0) return null;
  const current = boxes[idx];
  const currentHeight = current.bottom - current.top;

  let best: GridBox | null = null;
  let bestEdge = Infinity;

  for (let i = 0; i < boxes.length; i += 1) {
    if (i === idx) continue;
    const candidate = boxes[i];
    const candidateHeight = candidate.bottom - candidate.top;
    const minHeight = Math.min(currentHeight, candidateHeight);
    if (minHeight <= 0) continue;
    const overlap =
      Math.min(current.bottom, candidate.bottom) -
      Math.max(current.top, candidate.top);
    if (overlap / minHeight < 0.5) continue;

    const edge =
      dir === 1
        ? candidate.left - current.right
        : current.left - candidate.right;
    if (edge < -EPS) continue;
    const score = Math.max(0, edge);
    if (best === null || score < bestEdge - EPS) {
      best = candidate;
      bestEdge = score;
    }
  }

  return best ? best.path : null;
}

/** 整页步长：容器高 − 24px（24px 作上下文重叠，避免跨页时漏看一行）。 */
export function pageStep(clientHeight: number): number {
  return Math.max(0, clientHeight - 24);
}

/**
 * 从 `KeyboardEvent.code` 解析 1–9 数字键（含小键盘 `Numpad1`–`Numpad9`）。
 * 必须用 code 而非 key：mac 上 Alt+3 / Shift+3 的 `key` 会是怪字符，
 * code 恒为 `Digit3`。
 */
export function digitFromCode(code: string): number | null {
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return match ? Number(match[1]) : null;
}
