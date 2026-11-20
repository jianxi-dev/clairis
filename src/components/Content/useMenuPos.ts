import { useLayoutEffect, useRef, useState } from "react";

const VIEWPORT_MARGIN = 8;

export interface MenuPos {
  x: number;
  y: number;
}

/**
 * 浮层定位：渲染后测量自身尺寸，把右缘 / 下缘夹进视口。
 * 传入 boundsOf 时再夹进该容器右缘——嵌入态属性面板宿主（doc-property-host）
 * 比视口窄（正文列内缩），只夹视口会让菜单探出面板（#1017 回归）。
 * 沿用了 TabInfoPopover 的解法；anchor 为 null 时 pos 也为 null。
 */
export function useMenuPos(
  anchor: MenuPos | null,
  boundsOf?: () => HTMLElement | null,
) {
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
    const boundsRight = boundsOf?.()?.getBoundingClientRect().right ?? Infinity;
    const x = Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        anchor.x,
        Math.min(window.innerWidth, boundsRight) - r.width - VIEWPORT_MARGIN,
      ),
    );
    const y = Math.max(
      VIEWPORT_MARGIN,
      Math.min(anchor.y, window.innerHeight - r.height - VIEWPORT_MARGIN),
    );
    setPos((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
  }, [anchor, boundsOf]);

  return { pos, ref };
}
