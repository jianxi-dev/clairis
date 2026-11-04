/**
 * 拖拽落区命中判定（change layout-portal / 5.1）。
 *
 * 纯几何 → 纯落区：这里不碰 store、不碰 DOM、不读视口，只把
 * 「指针坐标 + 目标矩形」映射成落区枚举，便于单测断言。
 * 坐标系与 DOM 一致：x 向右、y 向下，矩形以左上角为原点。
 *
 * 两级落区：
 *  - 格级 `hitTestPane`：中心 = 互换，四边 = 移动重排。
 *  - 窗口级 `hitTestWindowEdge`：贴窗口四边 = 移到根层。
 */

import { sideToDir, type PaneDir, type PaneSide } from "./paneTree";

export type PaneZone = "center" | PaneSide;

export type RootZone = "root-left" | "root-right" | "root-top" | "root-bottom";

export type DropZone = PaneZone | RootZone | null;

export interface DropPoint {
  x: number;
  y: number;
}

export interface DropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface HitTestPaneOptions {
  /** 中心带占比（0..1）。缺省 0.5：中间 50% 为中心，两侧各 25% 为边缘。 */
  centerRatio?: number;
}

/** 角resolve的稳定顺序：同距时左 > 右 > 上 > 下。 */
const SIDE_ORDER: readonly PaneSide[] = ["left", "right", "top", "bottom"];

/**
 * 指针落在矩形内返回 'center' | 四边之一，落在矩形外返回 null。
 * 边缘带默认每侧 25%（centerRatio 0.5）；角上取归一化距离最近的一边，
 * 距离相同按 左→右→上→下 定序。
 */
export function hitTestPane(
  pointer: DropPoint,
  rect: DropRect,
  opts?: HitTestPaneOptions,
): PaneZone | null {
  const centerRatio = opts?.centerRatio ?? 0.5;
  const w = rect.width;
  const h = rect.height;
  if (!(w > 0) || !(h > 0)) return null;
  const dx = pointer.x - rect.x;
  const dy = pointer.y - rect.y;
  if (dx < 0 || dy < 0 || dx > w || dy > h) return null;

  const edge = (1 - centerRatio) / 2;
  const hits: { zone: PaneSide; dist: number }[] = [];
  if (dx < w * edge) hits.push({ zone: "left", dist: dx / w });
  if (dx > w * (1 - edge)) hits.push({ zone: "right", dist: (w - dx) / w });
  if (dy < h * edge) hits.push({ zone: "top", dist: dy / h });
  if (dy > h * (1 - edge)) hits.push({ zone: "bottom", dist: (h - dy) / h });
  if (hits.length === 0) return "center";

  hits.sort(
    (a, b) =>
      a.dist - b.dist ||
      SIDE_ORDER.indexOf(a.zone) - SIDE_ORDER.indexOf(b.zone),
  );
  return hits[0].zone;
}

/**
 * 指针贴窗口某条边（默认 24px 内）返回对应根层落区，否则 null。
 * 角上取像素距离最近的一边，同距按 左→右→上→下 定序。
 */
export function hitTestWindowEdge(
  pointer: DropPoint,
  viewport: ViewportSize,
  edgeBand = 24,
): RootZone | null {
  const { width, height } = viewport;
  if (!(width > 0) || !(height > 0)) return null;
  const hits: { zone: RootZone; dist: number; order: number }[] = [];
  if (pointer.x <= edgeBand) {
    hits.push({ zone: "root-left", dist: pointer.x, order: 0 });
  }
  if (pointer.x >= width - edgeBand) {
    hits.push({ zone: "root-right", dist: width - pointer.x, order: 1 });
  }
  if (pointer.y <= edgeBand) {
    hits.push({ zone: "root-top", dist: pointer.y, order: 2 });
  }
  if (pointer.y >= height - edgeBand) {
    hits.push({ zone: "root-bottom", dist: height - pointer.y, order: 3 });
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.dist - b.dist || a.order - b.order);
  return hits[0].zone;
}

export type PaneDropIntent =
  | { kind: "swap" }
  | { kind: "move"; dir: PaneDir; side: PaneSide }
  | { kind: "root"; side: PaneSide };

/**
 * 格拖拽的落区 → 声明式意图：中心=互换，四边=移动过去，窗口边=提到根层。
 * 拖到自身、或落区为空时无意图（null）。
 */
export function resolvePaneDrop(
  sourceLeafId: string,
  targetLeafId: string,
  zone: DropZone,
): PaneDropIntent | null {
  if (zone === null) return null;
  if (zone === "center") {
    return sourceLeafId === targetLeafId ? null : { kind: "swap" };
  }
  if (zone === "root-left") return { kind: "root", side: "left" };
  if (zone === "root-right") return { kind: "root", side: "right" };
  if (zone === "root-top") return { kind: "root", side: "top" };
  if (zone === "root-bottom") return { kind: "root", side: "bottom" };
  return sourceLeafId === targetLeafId
    ? null
    : { kind: "move", dir: sideToDir(zone), side: zone };
}

export type FileDropIntent = { kind: "split"; dir: PaneDir; side: PaneSide };

/**
 * 文件拖拽的落区 → 分裂意图。升级：文件没有「中心互换」语义，
 * center 一律当作 right（在该格右侧分裂出新格）。
 */
export function fileDropIntent(zone: DropZone): FileDropIntent | null {
  if (zone === null) return null;
  let side: PaneSide;
  switch (zone) {
    case "left":
      side = "left";
      break;
    case "top":
      side = "top";
      break;
    case "bottom":
      side = "bottom";
      break;
    case "root-left":
      side = "left";
      break;
    case "root-top":
      side = "top";
      break;
    case "root-bottom":
      side = "bottom";
      break;
    default:
      side = "right";
  }
  return { kind: "split", dir: sideToDir(side), side };
}
