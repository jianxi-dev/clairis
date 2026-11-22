/* 图片内联裁剪（#779 / D19；坐标系与保存可靠性 #1349 / E-44）。
 *
 * 矩形一律用原图像素坐标（无损：原图与引用不变）。裁剪框直接覆盖在图片
 * widget 上，拖 handle 实时改显示，松手写回 crop；拖回整图范围即移除 crop；
 * Esc 取消并恢复进入裁剪前的显示。
 *
 * 单一显示坐标系：进入时清空裁剪样式量一次整图显示宽度 fullW，得到唯一
 * scale；框选、拖动、保存都在「显示矩形（CSS px）」这一套坐标里进行，写回
 * 只把显示矩形换算成原图矩形一次（imageRectFromDisplay）。显示用窗口
 * （overflow:hidden）+ 原图矩形尺寸的 img + transform: scale(scale)，使 img
 * 元素的显示尺寸严格等于显示矩形。
 *
 * 加载门：等页面 img 的 complete / load，2s 超时给出可见提示，绝不静默返回。
 * 保存双入口：显式「保存」按钮 + window 级 pointerup（装饰重建销毁裁剪框后
 * 仍兜底），两路经同一状态机去重，只写一次；Esc 取消不写回并清理全部监听。
 */
import { MIN_CROP_SIZE } from "./image";
import { getSelectedImageFrom, notifyImageCropState } from "./imageToolbar";
import {
  cancelCropSession,
  displayRectFromImageRect,
  FULL_IMAGE_RATIO,
  imageRectFromDisplay,
  isFullImageRect,
  resolveCropTrigger,
  type CropSessionStatus,
  type CropTrigger,
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

/** 指针位移超过它才算拖动，避免单击误写 crop。 */
const DRAG_THRESHOLD_PX = 2;
/** 加载门超时：2s 内图片未加载完成则放弃并提示。 */
const LOAD_TIMEOUT_MS = 2000;

const WINDOW_CLASS = "image-crop-window";
const TOAST_CLASS = "image-crop-toast";
const SAVE_BUTTON_TESTID = "img-crop-save";

/** 当前挂着的裁剪收尾函数；null 表示没有裁剪框。 */
let activeCleanup: (() => void) | null = null;

export function isImageCropActive(): boolean {
  return activeCleanup !== null;
}

/** 关闭内联裁剪并恢复显示（再次点击工具条裁剪按钮 / 切换图片时用）。 */
export function closeImageCrop(): void {
  if (!activeCleanup) return;
  const cleanup = activeCleanup;
  activeCleanup = null;
  cleanup();
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

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "image-crop-save";
  saveBtn.dataset.testid = SAVE_BUTTON_TESTID;
  saveBtn.title = "保存裁剪";
  saveBtn.setAttribute("aria-label", "保存裁剪");
  saveBtn.textContent = "保存";
  saveBtn.style.cssText =
    "position:absolute;top:100%;right:0;margin-top:4px;z-index:2;" +
    "padding:2px 8px;font-size:12px;line-height:1.5;color:var(--app-text);" +
    "background:var(--app-surface);border:1px solid var(--app-border);" +
    "border-radius:6px;cursor:pointer;";
  saveBtn.addEventListener("pointerdown", (event) => event.stopPropagation());
  saveBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    requestFinish("save");
  });
  frame.appendChild(saveBtn);

  for (const handle of Object.keys(HANDLE_AXES)) {
    const span = document.createElement("span");
    span.className = "cm-image-handle";
    span.dataset.handle = handle;
    span.style.cursor = HANDLE_CURSOR[handle];
    span.title = "拖动调整裁剪区域";
    const mark = document.createElement("i");
    mark.className = "image-crop-mark";
    mark.style.cssText =
      "position:absolute; display:block; pointer-events:none;" +
      (HANDLE_MARK[handle] ?? "");
    span.appendChild(mark);
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
    moved: boolean;
  }
  let drag: DragState | null = null;
  let session: CropSessionStatus = "open";

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

  const onWindowPointerUp = (): void => {
    // 只有拖拽中松手才收尾；点击工具条等无关 pointerup 不关裁剪。
    if (!drag) return;
    requestFinish("pointerup");
  };

  const cleanup = (): void => {
    frame.remove();
    widget.classList.remove("cm-image-crop-active");
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("pointerup", onWindowPointerUp);
    restoreWindow();
    restoreDisplay();
    if (activeCleanup === cleanup) activeCleanup = null;
    notifyImageCropState(false);
  };

  const cancel = (): void => {
    session = cancelCropSession(session).status;
    // 拖拽中 Esc：先丢掉 drag，pointerup 的收尾就不会写回。
    drag = null;
    cleanup();
  };

  const requestFinish = (trigger: CropTrigger): void => {
    const result = resolveCropTrigger(session, trigger);
    if (!result.write) return;
    if (trigger !== "save" && !drag) return;
    const shouldWrite = trigger === "save" || (drag?.moved ?? false);
    if (!shouldWrite) {
      // 未拖动的松手：不写回，恢复进入前显示。
      session = "cancelled";
      drag = null;
      cleanup();
      return;
    }
    session = result.status;
    const end = imageRectFromDisplay(rect, scale);
    drag = null;
    cleanup();
    if (isFullImageRect(end, natW, natH, FULL_IMAGE_RATIO)) {
      options.onConfirm(null);
      return;
    }
    options.onConfirm([end.left, end.top, end.width, end.height]);
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
      moved: false,
    };
  });

  frame.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dxScreen = event.clientX - drag.startX;
    const dyScreen = event.clientY - drag.startY;
    if (Math.hypot(dxScreen, dyScreen) >= DRAG_THRESHOLD_PX) drag.moved = true;
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

  frame.addEventListener("pointerup", () => requestFinish("pointerup"));
  frame.addEventListener("pointercancel", cancel);
  frame.addEventListener("click", (event) => event.stopPropagation());
  frame.addEventListener("dblclick", (event) => event.stopPropagation());
  window.addEventListener("pointerup", onWindowPointerUp);

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  };
  document.addEventListener("keydown", onKey, true);

  activeCleanup = cleanup;
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
  nw: "left:2px; top:2px; width:4px; height:4px; border-left:2px solid #fff; border-top:2px solid #fff;",
  ne: "right:2px; top:2px; width:4px; height:4px; border-right:2px solid #fff; border-top:2px solid #fff;",
  sw: "left:2px; bottom:2px; width:4px; height:4px; border-left:2px solid #fff; border-bottom:2px solid #fff;",
  se: "right:2px; bottom:2px; width:4px; height:4px; border-right:2px solid #fff; border-bottom:2px solid #fff;",
  n: "left:50%; top:2px; width:8px; height:2px; margin-left:-4px; background:#fff;",
  s: "left:50%; bottom:2px; width:8px; height:2px; margin-left:-4px; background:#fff;",
  e: "top:50%; right:2px; width:2px; height:8px; margin-top:-4px; background:#fff;",
  w: "top:50%; left:2px; width:2px; height:8px; margin-top:-4px; background:#fff;",
};
