/* 裁剪浮层（#656）。矩形一律用原图像素坐标（无损：原图与引用不变）。
 *
 * 打开时按已有 crop 还原；没有 crop 时给居中 80% 的默认框（确认即产生
 * 一个比原图小的可见区域）。覆盖层像素上拖拽，确认时换算回原图并取整。
 * Esc / 点背景 / 取消按钮 = 放弃（不回调）；确认写回；恢复整图 = 清空。
 */
import { MIN_CROP_SIZE } from "./image";

export interface ImageCropOptions {
  /** 解析后的图片 URL（能加载出 natural 尺寸才有得裁）。 */
  src: string;
  /** 已有裁剪矩形（原图像素），没有则 null。 */
  crop: [number, number, number, number] | null;
  /** 确认回调：矩形（写回）或 null（清空）。取消不会调用。 */
  onConfirm: (rect: [number, number, number, number] | null) => void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const STAGE_MAX_RATIO = 0.7;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function fitScale(natW: number, natH: number): number {
  const maxW = window.innerWidth * STAGE_MAX_RATIO;
  const maxH = window.innerHeight * STAGE_MAX_RATIO;
  return Math.min(1, maxW / natW, maxH / natH);
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

function cropToRect(crop: [number, number, number, number]): Rect {
  return { left: crop[0], top: crop[1], width: crop[2], height: crop[3] };
}

function rectToCrop(
  rect: Rect,
  scale: number,
): [number, number, number, number] {
  return [
    Math.round(rect.left / scale),
    Math.round(rect.top / scale),
    Math.round(rect.width / scale),
    Math.round(rect.height / scale),
  ];
}

function clampRect(rect: Rect, natW: number, natH: number): void {
  rect.left = clamp(rect.left, 0, natW - MIN_CROP_SIZE);
  rect.top = clamp(rect.top, 0, natH - MIN_CROP_SIZE);
  rect.width = clamp(rect.width, MIN_CROP_SIZE, natW - rect.left);
  rect.height = clamp(rect.height, MIN_CROP_SIZE, natH - rect.top);
}

function applyRectStyle(el: HTMLElement, rect: Rect, scale: number): void {
  el.style.left = `${rect.left * scale}px`;
  el.style.top = `${rect.top * scale}px`;
  el.style.width = `${rect.width * scale}px`;
  el.style.height = `${rect.height * scale}px`;
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

/** 打开裁剪浮层；图片加载失败时静默不打开（无 natural 尺寸裁不了）。 */
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
  const scale = fitScale(natW, natH);
  const rect: Rect = options.crop
    ? cropToRect(options.crop)
    : defaultRect(natW, natH);
  clampRect(rect, natW, natH);

  const overlay = document.createElement("div");
  overlay.className = "cm-image-crop-overlay";
  overlay.dataset.testid = "img-crop-overlay";

  const stage = document.createElement("div");
  stage.className = "cm-image-crop-stage";
  stage.style.width = `${natW * scale}px`;
  stage.style.height = `${natH * scale}px`;

  const img = document.createElement("img");
  img.src = options.src;
  img.style.width = `${natW * scale}px`;
  img.style.height = `${natH * scale}px`;
  stage.appendChild(img);

  const rectEl = document.createElement("div");
  rectEl.className = "cm-image-crop-rect";
  applyRectStyle(rectEl, rect, scale);
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
    rectEl.appendChild(span);
  }
  stage.appendChild(rectEl);
  overlay.appendChild(stage);

  const actions = document.createElement("div");
  actions.className = "cm-image-crop-actions";
  for (const spec of [
    { testid: "img-crop-restore", label: "恢复整图" },
    { testid: "img-crop-cancel", label: "取消" },
    { testid: "img-crop-confirm", label: "确认" },
  ]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.testid = spec.testid;
    btn.textContent = spec.label;
    actions.appendChild(btn);
  }
  overlay.appendChild(actions);

  let keyHandler: ((event: KeyboardEvent) => void) | null = null;
  const detach = (): void => {
    overlay.remove();
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler, true);
      keyHandler = null;
    }
  };
  const finish = (result: [number, number, number, number] | null): void => {
    detach();
    options.onConfirm(result);
  };
  const cancel = (): void => {
    detach();
  };

  for (const btn of Array.from(actions.children) as HTMLElement[]) {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (btn.dataset.testid === "img-crop-cancel") cancel();
      else if (btn.dataset.testid === "img-crop-confirm")
        finish(rectToCrop(rect, scale));
      else finish(null);
    });
  }

  keyHandler = (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    cancel();
  };
  document.addEventListener("keydown", keyHandler, true);

  // 背景取消要求按下与抬起都在背景上：把手拖拽中途落在背景上的合成
  // click（target=overlay）不算取消。
  let downOnBackdrop = false;
  overlay.addEventListener("mousedown", (event) => {
    downOnBackdrop = event.target === overlay;
    if (downOnBackdrop) event.preventDefault();
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay && downOnBackdrop) cancel();
  });

  // 把手拖拽：覆盖层像素位移换算回原图像素，调整矩形边界。
  stage.addEventListener("mousedown", (event) => {
    const target = event.target;
    const handle =
      target instanceof Element
        ? (target.closest("[data-handle]") as HTMLElement | null)
        : null;
    if (handle) {
      event.preventDefault();
      event.stopPropagation();
      const axes = HANDLE_AXES[handle.dataset.handle ?? ""];
      if (!axes) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const start = { ...rect };
      const onMove = (move: MouseEvent): void => {
        const dx = (move.clientX - startX) / scale;
        const dy = (move.clientY - startY) / scale;
        let left = start.left;
        let top = start.top;
        let right = start.left + start.width;
        let bottom = start.top + start.height;
        if (axes.x === "r")
          right = clamp(right + dx, left + MIN_CROP_SIZE, natW);
        if (axes.x === "l") left = clamp(left + dx, 0, right - MIN_CROP_SIZE);
        if (axes.y === "b")
          bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, natH);
        if (axes.y === "t") top = clamp(top + dy, 0, bottom - MIN_CROP_SIZE);
        rect.left = left;
        rect.top = top;
        rect.width = right - left;
        rect.height = bottom - top;
        applyRectStyle(rectEl, rect, scale);
      };
      const onUp = (): void => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return;
    }
    if (!(target instanceof Element) || !rectEl.contains(target)) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...rect };
    const onMove = (move: MouseEvent): void => {
      const dx = (move.clientX - startX) / scale;
      const dy = (move.clientY - startY) / scale;
      rect.left = clamp(start.left + dx, 0, natW - start.width);
      rect.top = clamp(start.top + dy, 0, natH - start.height);
      applyRectStyle(rectEl, rect, scale);
    };
    const onUp = (): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  document.body.appendChild(overlay);
}
