// 触控板 / 鼠标滚轮的亮度音量手势换算（#1149）。
//
// 浏览器把触控板双指上下滑动派发为**无修饰键 wheel**（捏合才是 ctrl/cmd+wheel），
// 而亮度/音量手势原先只挂在 touch 通道，导致触控板滑动零响应。这里把左右半判定
// 与步进换算抽成纯函数，供 VideoPlayer 的 wheel 分支与单测共用。

export type WheelGestureSide = "left" | "right";

export interface WheelGestureRect {
  left: number;
  width: number;
}

/** 指针所在半区：左半调亮度，右半调音量。 */
export function wheelGestureSide(
  rect: WheelGestureRect,
  clientX: number,
): WheelGestureSide {
  return clientX < rect.left + rect.width / 2 ? "left" : "right";
}

/**
 * 把 wheel 纵向增量换算为亮度/音量的增量（上滑为正）。
 * deltaMode：0=像素（默认）、1=行、2=页；行/页先折回像素量级，再按 1200px=1.0。
 */
export function wheelGestureStep(deltaY: number, deltaMode = 0): number {
  const pixels =
    deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 100 : deltaY;
  return -pixels / 1200;
}

export const BRIGHTNESS_MIN = 0.3;
export const BRIGHTNESS_MAX = 2;
export const VOLUME_MIN = 0;
export const VOLUME_MAX = 1;

export function clampBrightness(value: number): number {
  return Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, value));
}

export function clampVolume(value: number): number {
  return Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, value));
}
