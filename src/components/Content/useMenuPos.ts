import { useLayoutEffect, useRef, useState } from "react";

const VIEWPORT_MARGIN = 8;

export interface MenuPos {
  x: number;
  y: number;
}

/**
 * 浮层定位：渲染后测量自身尺寸，把右缘 / 下缘夹进视口。
 * 沿用了 TabInfoPopover 的解法；anchor 为 null 时 pos 也为 null。
 */
export function useMenuPos(anchor: MenuPos | null) {
  const [pos, setPos] = useState<MenuPos | null>(anchor);
  const ref = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    if (!anchor) {
      setPos(null);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(
      VIEWPORT_MARGIN,
      Math.min(anchor.x, window.innerWidth - r.width - VIEWPORT_MARGIN),
    );
    const y = Math.max(
      VIEWPORT_MARGIN,
      Math.min(anchor.y, window.innerHeight - r.height - VIEWPORT_MARGIN),
    );
    setPos((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
  }, [anchor]);

  return { pos, ref };
}
