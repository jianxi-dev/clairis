/**
 * 选区轮盘·纯几何（无 DOM）。
 *
 * 数值来自批准设计 `docs/design/approved/selection-roulette/README.md` §4/§6
 * 与原型 `prototype.html` 的常量（1310–1315 行），实现只消费、不再发明。
 *
 * 角度约定：0° = 12:00，顺时针为正（与原型 `polarC` 的 `(deg - 90)` 换算一致）。
 */

export const ROULETTE_BOX = 420;
export const ROULETTE_CENTER = ROULETTE_BOX / 2;

/** 圆心（格式刷）半径。 */
export const HUB_RADIUS = 31;

/** 根环：8 个 45° 扇区。 */
export const ROOT_IN = 30;
export const ROOT_OUT = 86;
export const ROOT_SECTOR_DEG = 45;
export const ROOT_LABEL_RADIUS = 60;

/** 二级：等宽窄格。 */
export const FAN_IN = 92;
export const FAN_OUT = 122;

/** 三级：二层外环。 */
export const THIRD_IN = 126;
export const THIRD_OUT = 152;

/** 颜色：内圈文字色 / 外圈背景色。 */
export const COLOR_FONT_IN = 90;
export const COLOR_FONT_OUT = 106;
export const COLOR_FONT_DEG = 18;
export const COLOR_BG_IN = 111;
export const COLOR_BG_OUT = 127;
export const COLOR_BG_DEG = 15;

/** 每格固定角度与缝隙。 */
export const ITEM_DEG = 15;
export const GAP_DEG = 0.35;

/** 展开下级后一二层的不透明度（第九轮：0.7）。 */
export const SUB_DIM_OPACITY = 0.8;

export type SectorId =
  | "smart"
  | "convert"
  | "align"
  | "columns"
  | "history"
  | "clear"
  | "format"
  | "color";

export interface RootSector {
  id: SectorId;
  label: string;
  /** 12:00 起顺时针，单位度；0 = 正上方。 */
  angle: number;
}

export const ROOT_SECTORS: readonly RootSector[] = [
  { id: "smart", label: "智能", angle: 0 },
  { id: "convert", label: "转换", angle: 45 },
  { id: "align", label: "对齐", angle: 90 },
  { id: "columns", label: "分栏", angle: 135 },
  { id: "history", label: "历史", angle: 180 },
  { id: "clear", label: "清格", angle: 225 },
  { id: "format", label: "格式", angle: 270 },
  { id: "color", label: "颜色", angle: 315 },
];

export interface Point {
  x: number;
  y: number;
}

/** 极坐标 → 画布坐标（相对 210,210 中心）。 */
export function polar(angle: number, radius: number): Point {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
}

/** 扇形 path：a0 → a1 顺时针。 */
export function sectorPath(
  rIn: number,
  rOut: number,
  a0: number,
  a1: number,
): string {
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const [x0, y0] = svgPoint(polar(a0, rOut));
  const [x1, y1] = svgPoint(polar(a1, rOut));
  const [x2, y2] = svgPoint(polar(a1, rIn));
  const [x3, y3] = svgPoint(polar(a0, rIn));
  return [
    `M${x0} ${y0}`,
    `A${rOut} ${rOut} 0 ${large} 1 ${x1} ${y1}`,
    `L${x2} ${y2}`,
    `A${rIn} ${rIn} 0 ${large} 0 ${x3} ${y3}`,
    "Z",
  ].join(" ");
}

function svgPoint(p: Point): [number, number] {
  return [
    Number((ROULETTE_CENTER + p.x).toFixed(2)),
    Number((ROULETTE_CENTER + p.y).toFixed(2)),
  ];
}

/** 等宽扇形：以 centerAngle 为中心对称展开，返回每格中心角。 */
export function fanAngles(
  centerAngle: number,
  count: number,
  width = ITEM_DEG,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [centerAngle];
  const start = centerAngle - ((count - 1) * width) / 2;
  return Array.from({ length: count }, (_, i) => start + i * width);
}

/** 扇形覆盖的总角度（含每格自身宽度）。 */
export function fanSpan(count: number, width = ITEM_DEG): number {
  return Math.max(0, count * width);
}

/** 圆环等分：从 12:00 起。 */
export function ringAngles(count: number, startAngle = 0): number[] {
  return Array.from(
    { length: count },
    (_, i) => startAngle + (360 / Math.max(1, count)) * i,
  );
}

/** 整轮 420×420 夹进视口安全区，返回圆心。 */
export function clampBoxCenter(
  x: number,
  y: number,
  viewport: { width: number; height: number },
  margin = 8,
): Point {
  const half = ROULETTE_BOX / 2;
  return {
    x: Math.min(Math.max(x, half + margin), viewport.width - half - margin),
    y: Math.min(Math.max(y, half + margin), viewport.height - half - margin),
  };
}

/** 指针相对圆心的角度（0 = 12:00，顺时针 0–360）。 */
export function angleOfPoint(center: Point, point: Point): number {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return (deg + 360) % 360;
}

/** 命中判定：点是否落在某环带与角度区间内。 */
export function hitInBand(
  point: Point,
  center: Point,
  rIn: number,
  rOut: number,
  a0: number,
  a1: number,
): boolean {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const r = Math.hypot(dx, dy);
  if (r < rIn || r > rOut) return false;
  let angle = angleOfPoint(center, point);
  const start = ((a0 % 360) + 360) % 360;
  let end = ((a1 % 360) + 360) % 360;
  if (end < start) end += 360;
  if (angle < start) angle += 360;
  return angle >= start && angle <= end;
}
