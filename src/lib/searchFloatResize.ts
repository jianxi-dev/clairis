/**
 * 搜索浮窗缩放的壳层包装（search-float-refine / D1）。
 *
 * 几何一律复用 `previewAnchor`：8 向缩放走 `resizePreview`，尺寸钳制走
 * `clampPreviewSize`。这里只做一件事——把搜索浮窗的最小尺寸（宽 280、高 240）
 * 固定注入，避免 `previewAnchor` 的默认钳制（260×200）把默认 300×460 的
 * 搜索浮窗误钳到预览窗最小值。组件侧禁止另写一套钳制/方向判定数学。
 */

import {
  clampPreviewSize,
  resizePreview,
  type Rect,
  type ResizeEdge,
  type Size,
} from "./previewAnchor";

/** 搜索浮窗最小尺寸（宽 280、高 240）——显式注入 previewAnchor。 */
export const SEARCH_FLOAT_MIN: Size = { w: 280, h: 240 };

/** 尺寸钳制：固定注入搜索浮窗最小尺寸（非有限值回最小、小数取整）。 */
export function clampSearchFloatSize(size: Size): Size {
  return clampPreviewSize(size, SEARCH_FLOAT_MIN.w, SEARCH_FLOAT_MIN.h);
}

/**
 * 8 向缩放：固定注入搜索浮窗最小尺寸。
 * 被拖动的那条边跟随指针，对边锚死；任一维触底即钳到 280×240。
 */
export function resizeSearchFloat(
  edge: ResizeEdge,
  start: Rect,
  dx: number,
  dy: number,
): Rect {
  const rect = resizePreview(edge, start, dx, dy, SEARCH_FLOAT_MIN);
  const size = clampSearchFloatSize({ w: rect.w, h: rect.h });
  return { x: rect.x, y: rect.y, w: size.w, h: size.h };
}
