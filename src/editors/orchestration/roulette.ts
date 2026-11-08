export const ROULETTE_BOX = 420;
export const ROULETTE_CENTER = ROULETTE_BOX / 2;
export const CENTER_DEAD_ZONE = 24;
export const ROOT_RADIUS = 150;
export const ROOT_SECTOR_SIZE = 46;
export const FAN_RADIUS = 107;
export const FAN_STEP_DEG = 15;
export const FAN_ITEM_SIZE = 38;

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
  icon:
    | "sparkle"
    | "layoutAuto"
    | "text"
    | "splitRight"
    | "rotate"
    | "close"
    | "pencil"
    | "tune";
  /** 12:00 起顺时针，单位度；-90 表示正上方。 */
  angle: number;
}

export const ROOT_SECTORS: readonly RootSector[] = [
  { id: "smart", label: "智能", icon: "sparkle", angle: -90 },
  { id: "convert", label: "转换", icon: "layoutAuto", angle: -45 },
  { id: "align", label: "对齐", icon: "text", angle: 0 },
  { id: "columns", label: "分栏", icon: "splitRight", angle: 45 },
  { id: "history", label: "历史", icon: "rotate", angle: 90 },
  { id: "clear", label: "清格", icon: "close", angle: 135 },
  { id: "format", label: "格式", icon: "pencil", angle: 180 },
  { id: "color", label: "颜色", icon: "tune", angle: 225 },
];

export interface Point {
  x: number;
  y: number;
}

export function polar(angle: number, radius: number): Point {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
}

/** 扇形：以父扇区角度为中心，每格固定 15°，总跨度不超过 136°。 */
export function fanAngles(centerAngle: number, count: number): number[] {
  if (count <= 0) return [];
  const span = Math.min(136, (count - 1) * FAN_STEP_DEG);
  const start = centerAngle - span / 2;
  return Array.from({ length: count }, (_, i) => start + i * FAN_STEP_DEG);
}

/** 圆环等分：颜色双圈用。 */
export function ringAngles(count: number, startAngle = -90): number[] {
  return Array.from(
    { length: count },
    (_, i) => startAngle + (360 / Math.max(1, count)) * i,
  );
}

/** 把 420×420 托盘的左上角夹进视口安全区。 */
export function clampBoxCenter(
  x: number,
  y: number,
  viewport: { width: number; height: number },
): Point {
  const half = ROULETTE_BOX / 2;
  return {
    x: Math.min(Math.max(x, half + 8), viewport.width - half - 8),
    y: Math.min(Math.max(y, half + 8), viewport.height - half - 8),
  };
}

/** 指针是否在圆心死区内。 */
export function insideCenterDeadZone(point: Point, center: Point): boolean {
  return Math.hypot(point.x - center.x, point.y - center.y) < CENTER_DEAD_ZONE;
}
