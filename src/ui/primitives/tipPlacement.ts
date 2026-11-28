/**
 * 提示方位与锚点（ui-quality-primitives-v1 / 2.3）。
 *
 * 从 `components/TooltipLayer.tsx` 抽出，供提示使用、也可被其他胶囊类浮层复用。
 * 逻辑逐字沿用原实现——其中包含三条实测修复，改动前请先确认不会回退：
 *   - 浮层菜单内的行固定上/下（#1640：块菜单「无序」提示跑到图标左侧压住图标）；
 *   - 上下都放不下才侧弹，侧弹按离视口中线更近的一侧选左右；
 *   - 锚点在视口内按提示自身尺寸夹取，避免贴边时探出。
 */

/** 提示与箭头之间的间距（px），与 CSS transform 的 8px 一致。 */
export const TIP_GAP = 8;
/** 提示与视口边缘的最小留白（px）。 */
export const TIP_VIEWPORT_MARGIN = 4;

/** 弹出方位：above=提示在触发元素上方（箭头朝下），其余同理。 */
export type TipSide = "above" | "below" | "left" | "right";

export interface TipSize {
  width: number;
  height: number;
}

/** 浮层菜单容器：其内的行不侧弹。 */
const MENU_ROW_SELECTOR =
  ".cm-block-menu-flyout, .tab-context-menu, .context-menu, .dpb-menu, .biaoyue-outline";

export interface Viewport {
  width: number;
  height: number;
}

/**
 * 按触发元素在视口中的位置选弹出方位：优先上 / 下，都放不下才侧弹。
 * 底部状态栏按钮因此落在图标正上方。
 */
export function chooseTipSide(
  el: Element,
  size: TipSize,
  viewport: Viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): TipSide {
  const rect = el.getBoundingClientRect();
  const verticalNeed = size.height + TIP_GAP;
  // 浮层菜单内的行：提示固定在行上方/下方，不要跑到左右两侧去盖住同一行
  // （#1640 用户反馈：块菜单「无序」提示跑到图标左侧并压住图标）。
  const inMenu = el.closest(MENU_ROW_SELECTOR);
  if (inMenu) {
    return rect.top - verticalNeed >= 0 ? "above" : "below";
  }
  if (rect.top - verticalNeed >= TIP_VIEWPORT_MARGIN) return "above";
  if (rect.bottom + verticalNeed <= viewport.height - TIP_VIEWPORT_MARGIN)
    return "below";
  const horizontalNeed = size.width + TIP_GAP;
  const fitsRight =
    rect.right + horizontalNeed <= viewport.width - TIP_VIEWPORT_MARGIN;
  const fitsLeft = rect.left - horizontalNeed >= TIP_VIEWPORT_MARGIN;
  if (fitsRight && fitsLeft)
    return rect.left + rect.width / 2 < viewport.width / 2 ? "right" : "left";
  if (fitsRight) return "right";
  if (fitsLeft) return "left";
  return rect.left > viewport.width - rect.right ? "left" : "right";
}

/** 把 value 夹进 [min, max]。 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 弹出锚点：above/below 取元素上下沿水平居中，left/right 取元素左右沿垂直居中。 */
export function tipAnchorFor(
  el: Element,
  side: TipSide,
  size: TipSize,
  viewport: Viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const halfW = Math.min(size.width / 2, viewport.width / 2);
  const halfH = Math.min(size.height / 2, viewport.height / 2);
  if (side === "right" || side === "left") {
    return {
      x: side === "right" ? rect.right : rect.left,
      y: clamp(cy, halfH, viewport.height - halfH),
    };
  }
  return {
    x: clamp(cx, halfW, viewport.width - halfW),
    y: side === "above" ? rect.top : rect.bottom,
  };
}
