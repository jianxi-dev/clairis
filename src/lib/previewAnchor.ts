/**
 * 悬浮预览窗的锚定与尺寸数学（layout-portal 8.1）——纯逻辑层。
 *
 * 没有任何 DOM / store 依赖：锚点坐标、最小尺寸钳制、8 向缩放、贴边翻转、
 * 开关归一化全部是可注入的纯函数，渲染侧只消费结果。这样 e2e 断言的状态机
 * 与单测断言的是同一份几何契约。
 *
 * 规格（navigation/spec.md）：
 * - 阅读空间 x 恒定 = 栏右缘 + 12、y 跟随悬停行（不随鼠标横移）；
 * - 网格贴卡片右缘 + 12、y 贴卡顶；
 * - 最小 260×200，四边 + 四角拖拽缩放，贴边翻转（锚定边互换）。
 */

/** 悬浮窗最小宽度（严格，e2e 会量）。 */
import { CARD_RATIO_W } from "./railCards";

export const PREVIEW_MIN_W = 260;
/** 悬浮窗最小高度（严格，e2e 会量）。 */
export const PREVIEW_MIN_H = 200;
/** 锚点与锚定对象（栏右缘 / 卡右缘）之间的间距。 */
export const PREVIEW_GAP = 12;
/** 阅读空间悬停多久才弹出预览。 */
export const HOVER_DELAY_MS = 250;
/** 指针离开预览窗后多久关闭（防抖）。 */
export const PREVIEW_LEAVE_CLOSE_MS = 180;

/** 首次打开预览窗的默认尺寸（均大于最小值）。 */
export const PREVIEW_DEFAULT_W = 320;
export const PREVIEW_DEFAULT_H = 300;

/**
 * 阅读空间唤出的预览窗宽度：上一版基准宽（PREVIEW_DEFAULT_W）+ 一个卡片缩略图宽。
 * 缩略图宽度是唯一变量，其余为常量偏移（navigation/spec.md 悬浮预览窗）。
 */
export const PREVIEW_RAIL_NARROW_W = PREVIEW_DEFAULT_W + CARD_RATIO_W;
/** 与初始同宽，只允许放大；默认窗仍钳到 PREVIEW_MIN_W。 */
export const PREVIEW_RAIL_NARROW_MIN_W = PREVIEW_RAIL_NARROW_W;
/** 阅读空间卡片右侧缩略图的唤出带宽（与缩略图等宽）。 */
export const RAIL_HOVER_ZONE_W = CARD_RATIO_W;

export interface Size {
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** 某一轴是否已翻转到另一侧。 */
export interface FlipState {
  x: boolean;
  y: boolean;
}

export interface AnchorResult {
  x: number;
  y: number;
  flipped: FlipState;
}

/** 8 个缩放手柄：四边 + 四角。 */
export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const RESIZE_EDGES: readonly ResizeEdge[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];

/** 尺寸钳制：非有限值回最小尺寸，越界贴边，小数取整。minW/minH 按模式注入。 */
export function clampPreviewSize(
  size: Size,
  minW: number = PREVIEW_MIN_W,
  minH: number = PREVIEW_MIN_H,
): Size {
  const w = Number.isFinite(size.w) ? Math.round(size.w) : minW;
  const h = Number.isFinite(size.h) ? Math.round(size.h) : minH;
  return {
    w: Math.max(minW, w),
    h: Math.max(minH, h),
  };
}

/** 把 y 夹进视口（顶部不越界，底部不越过）。 */
function clampY(y: number, h: number, viewport: Viewport): number {
  return Math.min(Math.max(0, y), Math.max(0, viewport.height - h));
}

/**
 * 阅读空间锚点：x 恒 = 栏右缘 + 12；y = 悬停行顶（夹进视口）。
 *
 * x 绝不从指针位置推导——横移鼠标不得让窗口左右跳。仅当右侧放不下
 * （栏右缘 + 12 + 宽 > 视口宽）时翻到栏左缘另一侧，`flipped.x` 置真。
 */
export function anchorFromRail(input: {
  railRightX: number;
  rowTopY: number;
  rowHeight: number;
  size: Size;
  viewport: Viewport;
}): AnchorResult {
  const { railRightX, rowTopY, size, viewport } = input;
  const w = size.w;
  const h = size.h;

  const rightSide = railRightX + PREVIEW_GAP;
  const overflowRight = rightSide + w > viewport.width;
  const x = overflowRight ? railRightX - PREVIEW_GAP - w : rightSide;

  return {
    x,
    y: clampY(rowTopY, h, viewport),
    flipped: { x: overflowRight, y: false },
  };
}

/**
 * 网格锚点：x 恒 = 卡右缘 + 12；y = 卡顶（夹进视口）。
 *
 * 与 `anchorFromRail` 同契约，只是锚定对象换成网格卡片。网格场景的接线
 * 由 10.1 落地；本函数在此先行定义，供其直接消费。
 */
export function anchorFromGrid(input: {
  cardRightX: number;
  cardTopY: number;
  size: Size;
  viewport: Viewport;
}): AnchorResult {
  const { cardRightX, cardTopY, size, viewport } = input;
  const w = size.w;
  const h = size.h;

  const rightSide = cardRightX + PREVIEW_GAP;
  const overflowRight = rightSide + w > viewport.width;
  const x = overflowRight ? cardRightX - PREVIEW_GAP - w : rightSide;

  return {
    x,
    y: clampY(cardTopY, h, viewport),
    flipped: { x: overflowRight, y: false },
  };
}

/**
 * 8 向缩放。被拖动的那条边跟随指针移动，对边保持不动：
 * 西边拖拽改 x 同时收窄宽度（东边锚死），北边拖拽改 y 同时收窄高度（南边锚死）。
 * 任一维触底即钳到最小值，绝不出现负尺寸。
 */
export function resizePreview(
  edge: ResizeEdge,
  start: Rect,
  dx: number,
  dy: number,
  min: Size = { w: PREVIEW_MIN_W, h: PREVIEW_MIN_H },
): Rect {
  const east = edge.includes("e");
  const west = edge.includes("w");
  const south = edge.includes("s");
  const north = edge.includes("n");

  let w = start.w;
  let h = start.h;
  if (east) w = start.w + dx;
  if (west) w = start.w - dx;
  if (south) h = start.h + dy;
  if (north) h = start.h - dy;

  if (w < min.w) w = min.w;
  if (h < min.h) h = min.h;

  // 对边锚死：西/北拖拽时由对边位置反推新起点
  const x = west ? start.x + start.w - w : start.x;
  const y = north ? start.y + start.h - h : start.y;

  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
}

/**
 * 判断当前矩形在视口里哪一轴已经越过边缘（锚定边需要互换）。
 * 越过右缘 → x 翻转；越过下缘 → y 翻转。
 */
export function flipAnchor(
  rect: Rect,
  viewport: Viewport,
  gap = PREVIEW_GAP,
): FlipState {
  return {
    x: rect.x + rect.w + gap > viewport.width,
    y: rect.y + rect.h + gap > viewport.height,
  };
}

/** 预览窗由哪一侧触发打开——用于「换行重锚」时只重锚同源预览。 */
export type PreviewAnchorSource = "rail" | "grid" | "tab";

/** 悬浮预览窗的瞬时状态；不持久化（关闭即丢，重开回默认锚定）。 */
export interface PreviewState {
  id: string;
  path: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  flippedX: boolean;
  flippedY: boolean;
  pinned: boolean;
  source: PreviewAnchorSource;
  /** 阅读空间右半触发的窄窗模式：初始宽 = 缩略图宽 + 内边距，拖拽最小宽同步收窄。 */
  narrow?: boolean;
}

/** 网格侧触发预览的方式。 */
export type PreviewGridMode = "hover" | "click" | "off";

/**
 * 网格触发判定（10.1 接入点）：把 gridMode 语义收口在一处，避免网格场景
 * 各自重推 default='click'。`onHover`/`onClick` 即该模式下应挂的事件。
 */
export function gridTriggerOf(mode: PreviewGridMode): {
  onHover: boolean;
  onClick: boolean;
} {
  return {
    onHover: mode === "hover",
    onClick: mode === "click" || mode === "hover",
  };
}

/** 双轨独立开关；持久化到 Rust `preview_settings`。 */
export interface PreviewSettings {
  railHover: boolean;
  gridMode: PreviewGridMode;
  enabled: boolean;
}

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  railHover: true,
  gridMode: "click",
  enabled: true,
};

export interface Point {
  x: number;
  y: number;
}

/** DOMRect 风格的矩形（left/top/width/height）。 */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 指针是否落在矩形内（含边界）。 */
export function pointInBox(p: Point, b: Box | null | undefined): boolean {
  if (!b) return false;
  return (
    p.x >= b.left &&
    p.x <= b.left + b.width &&
    p.y >= b.top &&
    p.y <= b.top + b.height
  );
}

/**
 * 指针是否位于条目右半区（预览触发区）。
 * 奇数宽度时中线所在的那一列归右——指针坐标为整数，居中悬停必须触发。
 */
export function isRightHalfOfBox(p: Point, b: Box): boolean {
  return p.x >= b.left + Math.floor(b.width / 2);
}

/**
 * 指针是否落在卡片右侧唤出带内（宽度 = 缩略图宽度）。
 * 缩略图左侧的正文区不唤出悬浮窗。
 */
export function isThumbZoneOfBox(
  point: { x: number; y: number },
  box: Box,
  zoneWidth: number = RAIL_HOVER_ZONE_W,
): boolean {
  const right = box.left + box.width;
  return point.x >= right - zoneWidth && point.x <= right;
}

/**
 * 是否应当安排离窗关闭：钉住 / 拖拽缩放中 / 指针仍在预览窗或 rail（含桥接带）均不关。
 */
export function shouldScheduleLeaveClose(input: {
  pointer: Point;
  previewBox: Box | null;
  railBox: Box | null;
  pinned: boolean;
  interacting: boolean;
}): boolean {
  if (input.pinned || input.interacting) return false;
  const tol = PREVIEW_LEAVE_BRIDGE_TOLERANCE;
  if (pointNearBox(input.pointer, input.previewBox, tol)) return false;
  if (pointNearBox(input.pointer, input.railBox, tol)) return false;
  return true;
}

/**
 * 指针距盒边缘多少 px 内仍算「未离开」。
 * 悬浮窗锚在栏右缘 + PREVIEW_GAP 的空隙上，指针滑入途中必经空隙，
 * 无桥接带时 180ms 防抖会在滑入前就关窗（#639）。
 * 不变量：必须大于 PREVIEW_GAP，两侧桥接带才能在整段空隙上重叠
 * （gap=12 时 rail 带 [R,R+20] 与窗带 [R-8,R+12] 完全覆盖）；gap 调大需同步调本值。
 */
export const PREVIEW_LEAVE_BRIDGE_TOLERANCE = 20;

export function pointNearBox(
  p: Point,
  b: Box | null | undefined,
  tolerance: number,
): boolean {
  if (!b) return false;
  return (
    p.x >= b.left - tolerance &&
    p.x <= b.left + b.width + tolerance &&
    p.y >= b.top - tolerance &&
    p.y <= b.top + b.height + tolerance
  );
}

/**
 * 归一化持久化开关注入值：老配置缺字段 / 非法值一律退回默认，绝不抛错。
 * 未知字段只取受控键，避免持久化文件把垃圾带进 store。
 */
export function normalizePreviewSettings(raw: unknown): PreviewSettings {
  const src = (raw ?? {}) as Partial<Record<keyof PreviewSettings, unknown>>;
  const gridModes: PreviewGridMode[] = ["hover", "click", "off"];
  return {
    railHover:
      typeof src.railHover === "boolean"
        ? src.railHover
        : DEFAULT_PREVIEW_SETTINGS.railHover,
    gridMode: gridModes.includes(src.gridMode as PreviewGridMode)
      ? (src.gridMode as PreviewGridMode)
      : DEFAULT_PREVIEW_SETTINGS.gridMode,
    enabled:
      typeof src.enabled === "boolean"
        ? src.enabled
        : DEFAULT_PREVIEW_SETTINGS.enabled,
  };
}
