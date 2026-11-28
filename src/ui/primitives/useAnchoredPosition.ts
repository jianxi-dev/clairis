import { useLayoutEffect, useRef, useState } from "react";

const VIEWPORT_MARGIN = 8;

export interface AnchorPoint {
  x: number;
  y: number;
}

export interface AnchoredOptions {
  /**
   * 保持既有能力：把浮层夹进该容器的右 / 下缘（#1017 嵌入态面板溢出回归就靠它）。
   * 缺省只夹视口。
   */
  boundsOf?: () => HTMLElement | null;
  /**
   * "clamp"（缺省）= 旧定位 hook 行为：只夹视口 + 容器；
   * "flip" = 12 向翻转 / 位移，供新 Menu 使用。
   */
  placement?: "clamp" | "flip";
  /** flip 模式下与视口 / 容器的留白，缺省 8 */
  margin?: number;
}

/** 12 向：4 主方位 × 3 对齐 */
export type FlipSide =
  | "below-start"
  | "below-center"
  | "below-end"
  | "above-start"
  | "above-center"
  | "above-end"
  | "right-start"
  | "right-center"
  | "right-end"
  | "left-start"
  | "left-center"
  | "left-end";

/** 选点顺序：below-start → below-center → below-end → above-* → right-* → left-* */
const FLIP_ORDER: readonly FlipSide[] = [
  "below-start",
  "below-center",
  "below-end",
  "above-start",
  "above-center",
  "above-end",
  "right-start",
  "right-center",
  "right-end",
  "left-start",
  "left-center",
  "left-end",
];

type Align = "start" | "center" | "end";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type FlipDir = "below" | "above" | "right" | "left";

function parseSide(side: FlipSide): { dir: FlipDir; align: Align } {
  const dash = side.indexOf("-");
  return {
    dir: side.slice(0, dash) as FlipDir,
    align: side.slice(dash + 1) as Align,
  };
}

/** 该 side 的理想落点（不做 shift / 夹取） */
function idealPos(side: FlipSide, anchor: AnchorPoint, size: Rect): AnchorPoint {
  const { dir, align } = parseSide(side);
  let x: number;
  let y: number;
  if (dir === "below" || dir === "above") {
    y = dir === "below" ? anchor.y : anchor.y - size.height;
    x =
      align === "start"
        ? anchor.x
        : align === "end"
          ? anchor.x - size.width
          : anchor.x - size.width / 2;
  } else {
    x = dir === "right" ? anchor.x : anchor.x - size.width;
    y =
      align === "start"
        ? anchor.y
        : align === "end"
          ? anchor.y - size.height
          : anchor.y - size.height / 2;
  }
  return { x, y };
}

/** 单轴平移进 [min, max]；放不下则贴端点（交给上层夹取） */
function shiftInto(pos: number, size: number, min: number, max: number): number {
  if (pos < min) return min;
  if (pos + size > max) return Math.max(min, max - size);
  return pos;
}

/** 单轴夹取进 [min, max] */
function clampInto(pos: number, size: number, min: number, max: number): number {
  return Math.max(min, Math.min(pos, max - size));
}

/** 两轴平移进边界（不夹取） */
function shiftOnly(
  p: AnchorPoint,
  size: Rect,
  m: number,
  maxX: number,
  maxY: number,
): AnchorPoint {
  return {
    x: shiftInto(p.x, size.width, m, maxX),
    y: shiftInto(p.y, size.height, m, maxY),
  };
}

/** 两轴夹取进边界（兜底，保证永不越界） */
function clampBoth(
  p: AnchorPoint,
  size: Rect,
  m: number,
  maxX: number,
  maxY: number,
): AnchorPoint {
  return {
    x: clampInto(p.x, size.width, m, maxX),
    y: clampInto(p.y, size.height, m, maxY),
  };
}

function fits(
  p: AnchorPoint,
  size: Rect,
  m: number,
  maxX: number,
  maxY: number,
): boolean {
  return (
    p.x >= m &&
    p.y >= m &&
    p.x + size.width <= maxX &&
    p.y + size.height <= maxY
  );
}

/** 相对理想落点的位移量，用于「都放不下」时选最小位移 */
function displacement(ideal: AnchorPoint, shifted: AnchorPoint): number {
  return Math.abs(shifted.x - ideal.x) + Math.abs(shifted.y - ideal.y);
}

/**
 * 12 向选点：先取零位移的 side；都放不下时取「两轴 shift 后位移最小」的 side
 * （竖直候选在 FLIP_ORDER 中更前，并列时竖直胜出）；shift 后仍越界才夹取。
 */
function chooseFlip(
  anchor: AnchorPoint,
  size: Rect,
  m: number,
  maxX: number,
  maxY: number,
): { side: FlipSide; pos: AnchorPoint } {
  for (const s of FLIP_ORDER) {
    const ideal = idealPos(s, anchor, size);
    if (fits(ideal, size, m, maxX, maxY)) return { side: s, pos: ideal };
  }

  let best: { side: FlipSide; pos: AnchorPoint; d: number } | null = null;
  for (const s of FLIP_ORDER) {
    const ideal = idealPos(s, anchor, size);
    const shifted = shiftOnly(ideal, size, m, maxX, maxY);
    const d = displacement(ideal, shifted);
    if (!best || d < best.d) best = { side: s, pos: shifted, d };
  }
  if (best && fits(best.pos, size, m, maxX, maxY)) {
    return { side: best.side, pos: best.pos };
  }

  const first = FLIP_ORDER[0];
  return {
    side: first,
    pos: clampBoth(idealPos(first, anchor, size), size, m, maxX, maxY),
  };
}

/**
 * 浮层定位（ui-quality-primitives-v1 / 2.2）。
 *
 * `placement: "clamp"`（缺省）与旧定位 hook 逐字等价：先渲染、再量
 * `getBoundingClientRect()`，把 x / y 夹进 `[margin, min(innerWidth|boundsRight) - width - margin]`；
 * anchor 为 null → pos 为 null。既有 8 处调用点因此可零行为变化地换 import。
 *
 * `placement: "flip"` 做 12 向翻转 / 位移，返回 `side` 供断言。
 */
export function useAnchoredPosition<T extends HTMLElement = HTMLSpanElement>(
  anchor: AnchorPoint | null,
  options?: AnchoredOptions,
): { pos: AnchorPoint | null; ref: React.RefObject<T>; side?: FlipSide } {
  const { boundsOf, placement = "clamp", margin = VIEWPORT_MARGIN } = options ?? {};
  const [pos, setPos] = useState<AnchorPoint | null>(anchor);
  const [side, setSide] = useState<FlipSide | undefined>(undefined);
  const ref = useRef<T | null>(null);

  // options 的回调引用不稳定（调用点常内联箭头），用 ref 存最新值，避免 effect 无限循环。
  const boundsRef = useRef(boundsOf);
  boundsRef.current = boundsOf;
  const marginRef = useRef(margin);
  marginRef.current = margin;
  const placementRef = useRef(placement);
  placementRef.current = placement;

  useLayoutEffect(() => {
    if (!anchor) {
      setPos(null);
      setSide(undefined);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const size = { left: 0, top: 0, width: r.width, height: r.height };
    const bounds = boundsRef.current?.() ?? null;
    const boundsRect = bounds?.getBoundingClientRect() ?? null;
    const m = marginRef.current;
    const maxX = Math.min(window.innerWidth, boundsRect?.right ?? Infinity) - m;
    const maxY = Math.min(window.innerHeight, boundsRect?.bottom ?? Infinity) - m;

    if (placementRef.current === "clamp") {
      // 与旧定位 hook 逐字等价（旧实现只夹右 / 下缘，不夹 bounds 下缘）
      const boundsRight = boundsRect?.right ?? Infinity;
      const x = Math.max(
        m,
        Math.min(anchor.x, Math.min(window.innerWidth, boundsRight) - r.width - m),
      );
      const y = Math.max(m, Math.min(anchor.y, window.innerHeight - r.height - m));
      setSide(undefined);
      setPos((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
      return;
    }

    const { side: nextSide, pos: nextPos } = chooseFlip(anchor, size, m, maxX, maxY);
    setSide(nextSide);
    setPos((prev) =>
      prev && prev.x === nextPos.x && prev.y === nextPos.y ? prev : nextPos,
    );
  }, [anchor]);

  return { pos, ref, side };
}
