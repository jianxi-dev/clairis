/* 图片内联裁剪（#779 / D19；坐标系与保存可靠性 #1349 / E-44）。
 *
 * 矩形一律用原图像素坐标（无损：原图与引用不变）。裁剪框直接覆盖在图片
 * widget 上，拖 handle 实时改显示，松手不退出；拖回整图范围即移除 crop；
 * Esc 取消并恢复进入裁剪前的显示。
 *
 * 单一显示坐标系：进入时清空裁剪样式量一次整图显示宽度 fullW，得到唯一
 * scale；框选、拖动、保存都在「显示矩形（CSS px）」这一套坐标里进行，写回
 * 只把显示矩形换算成原图矩形一次（imageRectFromDisplay）。显示用窗口
 * （overflow:hidden）+ 原图矩形尺寸的 img + transform: scale(scale)，使 img
 * 元素的显示尺寸严格等于显示矩形。
 *
 * 加载门：等页面 img 的 complete / load，2s 超时给出可见提示，绝不静默返回。
 * 常驻与收尾：进入裁剪后裁剪框一直挂着，拖动边界只改显示、不退出；只有主动
 * 确认（双击裁剪框 / 工具条「裁剪」按钮）才写回并退出，Esc / pointercancel /
 * 点框外取消。未拖动就确认视同取消，不写出默认裁剪。
 */
import { MIN_CROP_SIZE } from "./image";
import { renderIcon } from "../icons";
import { getSelectedImageFrom, notifyImageCropState } from "./imageToolbar";
import {
  displayRectFromImageRect,
  FULL_IMAGE_RATIO,
  imageRectFromDisplay,
  isFullImageRect,
} from "./imageCropMath";

export interface ImageCropOptions {
  /** 已有裁剪矩形（原图像素），没有则 null。 */
  crop: [number, number, number, number] | null;
  /** 写回回调：矩形（写回）或 null（移除 crop）。取消不会调用。 */
  onConfirm: (rect: [number, number, number, number] | null) => void;
  /** 目标图片的文档偏移；缺省取当前选中图片。 */
  from?: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 加载门超时：2s 内图片未加载完成则放弃并提示。 */
const LOAD_TIMEOUT_MS = 2000;

const WINDOW_CLASS = "image-crop-window";
const TOAST_CLASS = "image-crop-toast";

/** 四角括号把手统一用裁剪图标（A-4.4：与工具条裁剪按钮同一键名）。 */
const HANDLE_ICON = "CropOutlined";
/** 角标命中区边长（px）：四角与四边一致，明显可点。 */
const HANDLE_HIT_SIZE = 18;
/** 角标图标显示尺寸（px）。 */
const HANDLE_ICON_SIZE = 20;
/** 每个角标的旋转角：让裁剪括号的开口朝向框内。 */
const CORNER_ROTATE: Record<string, string> = {
  nw: "0deg",
  ne: "90deg",
  se: "180deg",
  sw: "270deg",
};
const CORNERS: readonly string[] = ["nw", "ne", "se", "sw"];

/** 当前挂着的裁剪收尾函数；null 表示没有裁剪框。 */
let activeCleanup: (() => void) | null = null;
/** 当前挂着的确认函数：工具条「裁剪」按钮在裁剪态下改为确认收尾。 */
let activeConfirm: (() => void) | null = null;

export function isImageCropActive(): boolean {
  return activeCleanup !== null;
}

/** 关闭内联裁剪并恢复显示（切换图片 / 重开裁剪前清场）。 */
export function closeImageCrop(): void {
  if (!activeCleanup) return;
  const cleanup = activeCleanup;
  activeCleanup = null;
  activeConfirm = null;
  cleanup();
}

/** 工具条「裁剪」按钮在裁剪态下改为确认：写回当前矩形并退出。 */
export function confirmImageCrop(): void {
  if (!activeConfirm) return;
  const confirm = activeConfirm;
  activeConfirm = null;
  confirm();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function defaultRect(natW: number, natH: number): Rect {
  const width = Math.max(MIN_CROP_SIZE, Math.round(natW * 0.8));
  const height = Math.max(MIN_CROP_SIZE, Math.round(natH * 0.8));
  return {
    left: Math.round((natW - width) / 2),
    top: Math.round((natH - height) / 2),
    width,
    height,
  };
}

function clampRect(rect: Rect, natW: number, natH: number): void {
  rect.left = clamp(rect.left, 0, natW - MIN_CROP_SIZE);
  rect.top = clamp(rect.top, 0, natH - MIN_CROP_SIZE);
  rect.width = clamp(rect.width, MIN_CROP_SIZE, natW - rect.left);
  rect.height = clamp(rect.height, MIN_CROP_SIZE, natH - rect.top);
}

/** 显示坐标下夹取：不越出整图显示尺寸，且不小于最小裁剪块。 */
function clampDisplayRect(
  rect: Rect,
  fullW: number,
  fullH: number,
  scale: number,
): void {
  const min = MIN_CROP_SIZE * scale;
  rect.left = clamp(rect.left, 0, Math.max(0, fullW - min));
  rect.top = clamp(rect.top, 0, Math.max(0, fullH - min));
  rect.width = clamp(rect.width, min, fullW - rect.left);
  rect.height = clamp(rect.height, min, fullH - rect.top);
}

/** 可见提示（非 console、不阻塞交互）。 */
function showCropToast(message: string): void {
  const el = document.createElement("div");
  el.className = TOAST_CLASS;
  el.setAttribute("role", "status");
  el.textContent = message;
  el.style.cssText =
    "position:fixed;left:50%;bottom:32px;transform:translateX(-50%);" +
    "z-index:2000;padding:8px 14px;border-radius:8px;pointer-events:none;" +
    "background:var(--app-surface);color:var(--app-text);" +
    "border:1px solid var(--app-border);" +
    "box-shadow:0 4px 16px rgba(0,0,0,0.18);font-size:13px;";
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 2600);
}

/** 清空裁剪样式后量整图显示宽度（唯一 scale 的来源）。 */
function measureFullWidth(img: HTMLImageElement): number {
  const parent = img.parentElement;
  const parentIsWindow = parent?.classList.contains(WINDOW_CLASS) ?? false;
  const prevParentDisplay = parent?.style.display ?? "";
  const prev = {
    width: img.style.width,
    height: img.style.height,
    maxWidth: img.style.maxWidth,
    position: img.style.position,
    objectFit: img.style.objectFit,
    objectPosition: img.style.objectPosition,
    transform: img.style.transform,
    transformOrigin: img.style.transformOrigin,
  };
  if (parentIsWindow && parent) parent.style.display = "contents";
  img.style.width = "";
  img.style.height = "";
  img.style.maxWidth = "100%";
  img.style.position = "";
  img.style.objectFit = "";
  img.style.objectPosition = "";
  img.style.transform = "";
  img.style.transformOrigin = "";
  const fullW = img.getBoundingClientRect().width;
  if (parentIsWindow && parent) parent.style.display = prevParentDisplay;
  img.style.width = prev.width;
  img.style.height = prev.height;
  img.style.maxWidth = prev.maxWidth;
  img.style.position = prev.position;
  img.style.objectFit = prev.objectFit;
  img.style.objectPosition = prev.objectPosition;
  img.style.transform = prev.transform;
  img.style.transformOrigin = prev.transformOrigin;
  return fullW;
}

/**
 * 打开内联裁剪。先等页面 img 加载完成；未加载完时给出可见提示并设 2s 超时，
 * 不在 scale <= 0 时静默返回。
 */
export function openImageCrop(options: ImageCropOptions): void {
  closeImageCrop();
  const from = options.from ?? getSelectedImageFrom();
  const widget =
    from !== null
      ? document.querySelector<HTMLElement>(
          `.cm-image-widget[data-image-from="${from}"]`,
        )
      : null;
  const img = widget?.querySelector<HTMLImageElement>("img") ?? null;
  if (!widget || !img) {
    showCropToast("图片尚未加载完成，暂不能裁剪");
    return;
  }
  if (img.complete) {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      mount(widget, img, options);
    } else {
      showCropToast("图片加载失败，暂不能裁剪");
    }
    return;
  }
  let settled = false;
  const cleanupWait = (): void => {
    img.removeEventListener("load", onLoad);
    window.clearTimeout(timer);
  };
  const onLoad = (): void => {
    if (settled) return;
    settled = true;
    cleanupWait();
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      mount(widget, img, options);
    } else {
      showCropToast("图片加载失败，暂不能裁剪");
    }
  };
  const timer = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanupWait();
    showCropToast("图片加载超时，暂不能裁剪");
  }, LOAD_TIMEOUT_MS);
  img.addEventListener("load", onLoad);
}

function mount(
  widget: HTMLElement,
  img: HTMLImageElement,
  options: ImageCropOptions,
): void {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const fullW = measureFullWidth(img);

  // 原图坐标下的初始矩形（用于求唯一 scale）。
  const base: Rect = options.crop
    ? {
        left: options.crop[0],
        top: options.crop[1],
        width: options.crop[2],
        height: options.crop[3],
      }
    : defaultRect(natW, natH);
  clampRect(base, natW, natH);

  // 唯一 scale：清空裁剪样式后的整图显示宽 / 原图宽。
  const scale = fullW / natW;
  if (!(scale > 0)) {
    showCropToast("图片尚未加载完成，暂不能裁剪");
    return;
  }
  const fullH = natH * scale;
  // 显示坐标系下的裁剪矩形。
  const rect: Rect = displayRectFromImageRect(base, scale);
  clampDisplayRect(rect, fullW, fullH, scale);

  // 进入前的显示样式（取消 / 退出时恢复）。applyDisplay 会写脏这些内联样式，
  // 只拆窗口不还原会让 img 脱流、容器塌陷。
  const enterImgStyles = {
    width: img.style.width,
    height: img.style.height,
    maxWidth: img.style.maxWidth,
    position: img.style.position,
    left: img.style.left,
    top: img.style.top,
    objectFit: img.style.objectFit,
    objectPosition: img.style.objectPosition,
    transform: img.style.transform,
    transformOrigin: img.style.transformOrigin,
    clipPath: img.style.clipPath,
  };
  const existingWindow = img.parentElement?.classList.contains(WINDOW_CLASS)
    ? (img.parentElement as HTMLSpanElement)
    : null;
  const enterWindowStyles = existingWindow
    ? { width: existingWindow.style.width, height: existingWindow.style.height }
    : null;

  // 窗口：控制布局尺寸并裁剪溢出；img 以原图矩形尺寸 + transform 缩放。
  let win: HTMLSpanElement;
  let restoreWindow: () => void;
  if (existingWindow) {
    win = existingWindow;
    restoreWindow = () => {};
  } else {
    win = document.createElement("span");
    win.className = WINDOW_CLASS;
    win.style.overflow = "hidden";
    win.style.display = "inline-block";
    win.style.position = "relative";
    win.style.maxWidth = "100%";
    img.replaceWith(win);
    win.appendChild(img);
    restoreWindow = () => {
      win.replaceWith(img);
    };
  }

  widget.classList.add("cm-image-crop-active");

  const frame = document.createElement("div");
  frame.className = "cm-image-crop-frame";
  frame.dataset.testid = "img-crop-frame";

  for (const handle of Object.keys(HANDLE_AXES)) {
    const span = document.createElement("span");
    span.className = "cm-image-handle";
    span.dataset.handle = handle;
    span.style.cursor = HANDLE_CURSOR[handle];
    span.style.width = `${HANDLE_HIT_SIZE}px`;
    span.style.height = `${HANDLE_HIT_SIZE}px`;
    span.title = "拖动调整裁剪区域";
    if (CORNERS.includes(handle)) {
      const icon = renderIcon(HANDLE_ICON);
      icon.style.width = `${HANDLE_ICON_SIZE}px`;
      icon.style.height = `${HANDLE_ICON_SIZE}px`;
      icon.style.position = "absolute";
      icon.style.left = "50%";
      icon.style.top = "50%";
      icon.style.color = "#fff";
      icon.style.transform = `translate(-50%, -50%) rotate(${CORNER_ROTATE[handle]})`;
      span.appendChild(icon);
    } else {
      const mark = document.createElement("i");
      mark.className = "image-crop-mark";
      mark.style.cssText =
        "position:absolute; display:block; pointer-events:none;" +
        (HANDLE_MARK[handle] ?? "");
      span.appendChild(mark);
    }
    frame.appendChild(span);
  }
  widget.appendChild(frame);

  const applyDisplay = (): void => {
    img.style.position = "absolute";
    img.style.left = "0px";
    img.style.top = "0px";
    img.style.maxWidth = "none";
    img.style.objectFit = "none";
    img.style.objectPosition = `${-rect.left / scale}px ${-rect.top / scale}px`;
    img.style.width = `${rect.width / scale}px`;
    img.style.height = `${rect.height / scale}px`;
    img.style.transform = `scale(${scale})`;
    img.style.transformOrigin = "0 0";
    win.style.width = `${rect.width}px`;
    win.style.height = `${rect.height}px`;
    frame.style.left = "0px";
    frame.style.top = "0px";
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;
  };
  applyDisplay();

  interface DragState {
    mode: "move" | "resize";
    handle: string | null;
    startX: number;
    startY: number;
    start: Rect;
  }
  let drag: DragState | null = null;
  const baseDisplay: Rect = { ...rect };

  const restoreDisplay = (): void => {
    img.style.width = enterImgStyles.width;
    img.style.height = enterImgStyles.height;
    img.style.maxWidth = enterImgStyles.maxWidth;
    img.style.position = enterImgStyles.position;
    img.style.left = enterImgStyles.left;
    img.style.top = enterImgStyles.top;
    img.style.objectFit = enterImgStyles.objectFit;
    img.style.objectPosition = enterImgStyles.objectPosition;
    img.style.transform = enterImgStyles.transform;
    img.style.transformOrigin = enterImgStyles.transformOrigin;
    img.style.clipPath = enterImgStyles.clipPath;
    if (enterWindowStyles) {
      win.style.width = enterWindowStyles.width;
      win.style.height = enterWindowStyles.height;
    }
  };

  const cleanup = (): void => {
    frame.remove();
    widget.classList.remove("cm-image-crop-active");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("click", onOutsideClick, true);
    restoreWindow();
    restoreDisplay();
    if (activeCleanup === cleanup) activeCleanup = null;
    if (activeConfirm === confirm) activeConfirm = null;
    notifyImageCropState(false);
  };

  const cancel = (): void => {
    drag = null;
    cleanup();
  };

  const confirm = (): void => {
    const changed =
      rect.left !== baseDisplay.left ||
      rect.top !== baseDisplay.top ||
      rect.width !== baseDisplay.width ||
      rect.height !== baseDisplay.height;
    const end = imageRectFromDisplay(rect, scale);
    drag = null;
    cleanup();
    if (!changed) return;
    if (isFullImageRect(end, natW, natH, FULL_IMAGE_RATIO)) {
      options.onConfirm(null);
      return;
    }
    options.onConfirm([end.left, end.top, end.width, end.height]);
  };

  const onOutsideClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    if (!target) return;
    if (target.closest(".cm-image-widget")) return;
    if (target.closest('[data-testid="img-toolbar"]')) return;
    if (target.closest('[data-testid="img-maximize"]')) return;
    cancel();
  };

  frame.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target as Element | null;
    const handleEl = target?.closest("[data-handle]") as HTMLElement | null;
    frame.setPointerCapture(event.pointerId);
    drag = {
      mode: handleEl ? "resize" : "move",
      handle: handleEl?.dataset.handle ?? null,
      startX: event.clientX,
      startY: event.clientY,
      start: { ...rect },
    };
  });

  frame.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dxScreen = event.clientX - drag.startX;
    const dyScreen = event.clientY - drag.startY;
    if (drag.mode === "move") {
      rect.left = clamp(
        drag.start.left + dxScreen,
        0,
        Math.max(0, fullW - drag.start.width),
      );
      rect.top = clamp(
        drag.start.top + dyScreen,
        0,
        Math.max(0, fullH - drag.start.height),
      );
    } else {
      const axes = HANDLE_AXES[drag.handle ?? ""];
      if (!axes) return;
      const min = MIN_CROP_SIZE * scale;
      let left = drag.start.left;
      let top = drag.start.top;
      let right = drag.start.left + drag.start.width;
      let bottom = drag.start.top + drag.start.height;
      if (axes.x === "r") right = clamp(right + dxScreen, left + min, fullW);
      if (axes.x === "l") left = clamp(left + dxScreen, 0, right - min);
      if (axes.y === "b") bottom = clamp(bottom + dyScreen, top + min, fullH);
      if (axes.y === "t") top = clamp(top + dyScreen, 0, bottom - min);
      rect.left = left;
      rect.top = top;
      rect.width = right - left;
      rect.height = bottom - top;
    }
    // 显示矩形与写回矩形同源：取整到原图像素再换算回显示，保存前后严格一致。
    const snapped = imageRectFromDisplay(rect, scale);
    rect.left = snapped.left * scale;
    rect.top = snapped.top * scale;
    rect.width = snapped.width * scale;
    rect.height = snapped.height * scale;
    applyDisplay();
  });

  // 拖动只改显示，不收尾；裁剪框保持到主动确认或取消（常驻）。
  frame.addEventListener("pointerup", () => {
    drag = null;
  });
  frame.addEventListener("pointercancel", cancel);
  frame.addEventListener("click", (event) => event.stopPropagation());
  frame.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    confirm();
  });

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("click", onOutsideClick, true);

  activeCleanup = cleanup;
  activeConfirm = confirm;
  notifyImageCropState(true);
}

const HANDLE_AXES: Record<
  string,
  { x: "l" | "r" | null; y: "t" | "b" | null }
> = {
  e: { x: "r", y: null },
  w: { x: "l", y: null },
  n: { x: null, y: "t" },
  s: { x: null, y: "b" },
  ne: { x: "r", y: "t" },
  nw: { x: "l", y: "t" },
  se: { x: "r", y: "b" },
  sw: { x: "l", y: "b" },
};

const HANDLE_CURSOR: Record<string, string> = {
  e: "ew-resize",
  w: "ew-resize",
  n: "ns-resize",
  s: "ns-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

const HANDLE_MARK: Record<string, string> = {
  n: "left:50%; top:2px; width:16px; height:3px; margin-left:-8px; background:#fff;",
  s: "left:50%; bottom:2px; width:16px; height:3px; margin-left:-8px; background:#fff;",
  e: "top:50%; right:2px; width:3px; height:16px; margin-top:-8px; background:#fff;",
  w: "top:50%; left:2px; width:3px; height:16px; margin-top:-8px; background:#fff;",
};
