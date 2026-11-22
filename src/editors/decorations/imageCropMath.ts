/* 图片裁剪坐标系纯函数（#1349 / E-44）。
 *
 * 裁剪框、拖动与写回共用一套显示坐标系：显示矩形 = 原图矩形 × scale，
 * 写回 = 显示矩形 ÷ scale（只换算一次）。这里只放不依赖 DOM 的换算、
 * 整图阈值与保存/取消状态机，供 imageCrop.ts 与单测共用。
 */

/** 原图像素矩形（crop 值，整数）。 */
export interface ImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 显示矩形（CSS px，相对图片显示左上角）。 */
export interface DisplayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 框覆盖到整图 99% 以上即视为「拖回整图」，移除 crop。 */
export const FULL_IMAGE_RATIO = 0.99;

/**
 * 原图矩形 → 显示矩形。scale 非正时返回零矩形（调用方应先等图片加载）。
 */
export function displayRectFromImageRect(
  rect: ImageRect,
  scale: number,
): DisplayRect {
  if (!(scale > 0)) return { left: 0, top: 0, width: 0, height: 0 };
  return {
    left: rect.left * scale,
    top: rect.top * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/**
 * 显示矩形 → 原图矩形（写回只换算一次），四舍五入到整数原图像素。
 * scale 非正时返回零矩形。
 */
export function imageRectFromDisplay(
  rect: DisplayRect,
  scale: number,
): ImageRect {
  if (!(scale > 0)) return { left: 0, top: 0, width: 0, height: 0 };
  return {
    left: Math.round(rect.left / scale),
    top: Math.round(rect.top / scale),
    width: Math.round(rect.width / scale),
    height: Math.round(rect.height / scale),
  };
}

/** 宽高都达到原图 `ratio` 以上才视为整图（拖回整图即移除 crop）。 */
export function isFullImageRect(
  rect: ImageRect,
  natW: number,
  natH: number,
  ratio: number = FULL_IMAGE_RATIO,
): boolean {
  return rect.width >= natW * ratio && rect.height >= natH * ratio;
}

/** 裁剪会话状态：open 进行中 / saved 已写回 / cancelled 已取消。 */
export type CropSessionStatus = "open" | "saved" | "cancelled";

/** 写回触发来源：显式保存按钮 / window pointerup（装饰重建销毁裁剪框后仍兜底）。 */
export type CropTrigger = "save" | "pointerup";

export interface CropResolveResult {
  status: CropSessionStatus;
  /** 本次是否应写回源码（幂等：只有 open 态的第一次触发为 true）。 */
  write: boolean;
}

/**
 * 触发裁剪收尾。只有 open 态的第一次触发会写回，随后状态转 saved；
 * saved / cancelled 态的重复触发一律不写（幂等守卫）。
 */
export function resolveCropTrigger(
  status: CropSessionStatus,
  _trigger: CropTrigger,
): CropResolveResult {
  if (status !== "open") return { status, write: false };
  return { status: "saved", write: true };
}

/** Esc 取消：open → cancelled，不写回；终态不可再变。 */
export function cancelCropSession(
  status: CropSessionStatus,
): CropResolveResult {
  if (status !== "open") return { status, write: false };
  return { status: "cancelled", write: false };
}
