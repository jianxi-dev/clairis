/* 图片内联裁剪（#779 / D19）。矩形一律用原图像素坐标（无损：原图与引用不变）。
 *
 * 不再开独立浮层：裁剪框直接覆盖在图片 widget 上，拖 handle 实时改显示
 * （object-fit:none + object-position），松手写回 crop；拖回整图范围即移除
 * crop；Esc 取消并恢复进入裁剪前的显示。
 */
import { MIN_CROP_SIZE } from "./image";
import { getSelectedImageFrom } from "./imageToolbar";

export interface ImageCropOptions {
  /** 解析后的图片 URL（只用于探测 natural 尺寸）。 */
  src: string;
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

/** 框覆盖到整图 99% 以上即视为「拖回整图」，移除 crop。 */
const FULL_IMAGE_RATIO = 0.99;
/** 指针位移超过它才算拖动，避免单击误写 crop。 */
const DRAG_THRESHOLD_PX = 2;

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

/**
 * 打开内联裁剪。图片未加载出 natural 尺寸时静默不打开（没得分母）。
 */
export function openImageCrop(options: ImageCropOptions): void {
  const probe = new Image();
  probe.onload = () => {
    if (probe.naturalWidth <= 0 || probe.naturalHeight <= 0) return;
    mount(probe.naturalWidth, probe.naturalHeight, options);
  };
  probe.onerror = () => {};
  probe.src = options.src;
}

function mount(natW: number, natH: number, options: ImageCropOptions): void {
  const from = options.from ?? getSelectedImageFrom();
  const widget =
    from !== null
      ? document.querySelector<HTMLElement>(
          `.cm-image-widget[data-image-from="${from}"]`,
        )
      : null;
  const img = widget?.querySelector<HTMLImageElement>("img");
  if (!widget || !img) return;

  // 整图显示缩放：清空裁剪样式后量一次，让裁剪盒与 crop 数值同一坐标系。
  const enterStyles = {
    objectFit: img.style.objectFit,
    objectPosition: img.style.objectPosition,
    width: img.style.width,
    height: img.style.height,
  };
  img.style.objectFit = "";
  img.style.objectPosition = "";
  img.style.width = "";
  img.style.height = "";
  const fullW = img.getBoundingClientRect().width;
  img.style.objectFit = enterStyles.objectFit;
  img.style.objectPosition = enterStyles.objectPosition;
  img.style.width = enterStyles.width;
  img.style.height = enterStyles.height;
  const scale = fullW / natW;
  if (!(scale > 0)) return;

  const rect: Rect = options.crop
    ? {
        left: options.crop[0],
        top: options.crop[1],
        width: options.crop[2],
        height: options.crop[3],
      }
    : defaultRect(natW, natH);
  clampRect(rect, natW, natH);

  widget.classList.add("cm-image-crop-active");

  const frame = document.createElement("div");
  frame.className = "cm-image-crop-frame";
  frame.dataset.testid = "img-crop-frame";
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
    img.style.objectFit = "none";
    img.style.objectPosition = `${-rect.left * scale}px ${-rect.top * scale}px`;
    img.style.width = `${rect.width * scale}px`;
    img.style.height = `${rect.height * scale}px`;
    frame.style.left = "0px";
    frame.style.top = "0px";
    frame.style.width = `${rect.width * scale}px`;
    frame.style.height = `${rect.height * scale}px`;
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

  const cleanup = (): void => {
    frame.remove();
    widget.classList.remove("cm-image-crop-active");
    document.removeEventListener("keydown", onKey, true);
  };

  const cancel = (): void => {
    // 拖拽中 Esc：先丢掉 drag，pointerup 的 finish 就不会写回。
    drag = null;
    cleanup();
    img.style.objectFit = enterStyles.objectFit;
    img.style.objectPosition = enterStyles.objectPosition;
    img.style.width = enterStyles.width;
    img.style.height = enterStyles.height;
  };

  const finish = (): void => {
    if (!drag) return;
    const { moved } = drag;
    const end = { ...rect };
    drag = null;
    cleanup();
    if (!moved) {
      img.style.objectFit = enterStyles.objectFit;
      img.style.objectPosition = enterStyles.objectPosition;
      img.style.width = enterStyles.width;
      img.style.height = enterStyles.height;
      return;
    }
    if (
      end.width >= natW * FULL_IMAGE_RATIO &&
      end.height >= natH * FULL_IMAGE_RATIO
    ) {
      options.onConfirm(null);
      return;
    }
    options.onConfirm([
      Math.round(end.left),
      Math.round(end.top),
      Math.round(end.width),
      Math.round(end.height),
    ]);
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
    const dx = dxScreen / scale;
    const dy = dyScreen / scale;
    if (drag.mode === "move") {
      rect.left = clamp(drag.start.left + dx, 0, natW - drag.start.width);
      rect.top = clamp(drag.start.top + dy, 0, natH - drag.start.height);
    } else {
      const axes = HANDLE_AXES[drag.handle ?? ""];
      if (!axes) return;
      let left = drag.start.left;
      let top = drag.start.top;
      let right = drag.start.left + drag.start.width;
      let bottom = drag.start.top + drag.start.height;
      if (axes.x === "r") right = clamp(right + dx, left + MIN_CROP_SIZE, natW);
      if (axes.x === "l") left = clamp(left + dx, 0, right - MIN_CROP_SIZE);
      if (axes.y === "b")
        bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, natH);
      if (axes.y === "t") top = clamp(top + dy, 0, bottom - MIN_CROP_SIZE);
      rect.left = left;
      rect.top = top;
      rect.width = right - left;
      rect.height = bottom - top;
    }
    applyDisplay();
  });

  frame.addEventListener("pointerup", finish);
  frame.addEventListener("pointercancel", cancel);
  frame.addEventListener("click", (event) => event.stopPropagation());
  frame.addEventListener("dblclick", (event) => event.stopPropagation());

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  };
  document.addEventListener("keydown", onKey, true);
}
