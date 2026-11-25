/* 图片内联裁剪（#779 / D19；坐标系与保存可靠性 #1349 / E-44）。
 *
 * 矩形一律用原图像素坐标（无损：原图与引用不变）。裁剪框直接覆盖在图片
 * widget 上，拖 handle 实时改显示，松手不退出；拖回整图范围即移除 crop；
 * Esc 取消并恢复进入裁剪前的显示。
 *
 * 逐轴显示坐标系：进入时以「进入前可见显示矩形」为基准求 (sx, sy)——声明了
 * width/height 的图片可能被非等比拉伸，必须逐轴换算才能所见即所得。框选、
 * 拖动、保存都在「显示矩形（CSS px）」这一套坐标里进行，写回只把显示矩形
 * 换算成原图矩形一次（imageRectFromDisplay）。显示用窗口（overflow:hidden）
 * + 原图矩形尺寸的 img + transform: scale(sx, sy)。窗口按整图尺寸展开，可见
 * 内容保持进入前的尺寸与位置，裁剪框与可见矩形四边重合。
 *
 * 加载门：等页面 img 的 complete / load，2s 超时给出可见提示，绝不静默返回。
 * 常驻与收尾：进入裁剪后裁剪框一直挂着，拖动边界只改显示、不退出；只有主动
 * 确认（双击裁剪框 / 工具条「裁剪」按钮 / 点框外）才写回并退出，Esc /
 * pointercancel 取消。未拖动就确认视同取消，不写出默认裁剪。
 */
import { markCropProbe } from "../../utils/cropJumpProbe";
import { MIN_CROP_SIZE, cropDisplayCache, cropDisplayKey } from "./image";
import { getSelectedImageFrom, notifyImageCropState } from "./imageToolbar";
import {
  displayRectFromImageRect,
  FULL_IMAGE_RATIO,
  imageRectFromDisplay,
  isFullImageRect,
  type Scale2D,
} from "./imageCropMath";

export interface ImageCropOptions {
  /** 已有裁剪矩形（原图像素），没有则 null。 */
  crop: [number, number, number, number] | null;
  /** 写回回调：原图矩形（null = 移除 crop）与最终显示尺寸。取消不会调用。 */
  onConfirm: (
    rect: [number, number, number, number] | null,
    display: {
      width: number;
      height: number;
      fullWidth: number;
      fullHeight: number;
    },
  ) => void;
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

/** 角标命中区边长（px）：四角与四边一致，明显可点。 */
const HANDLE_HIT_SIZE = 18;
/** 角标图标显示尺寸（px）。 */
const HANDLE_ICON_SIZE = 20;

/**
 * 四角标识：按用户示例改为粗直角括号字形（20×20、描边 2.5、方帽），逐角
 * 朝向、开口朝框内——nw=⌜ ne=⌝ se=﹂ sw=⌞，顶点贴近所在角。颜色沿用主题
 * （editor.css 的 `.cm-image-crop-frame .cm-image-handle svg`）。
 */
const CORNER_MARK_PATHS: Record<string, string> = {
  nw: "M4 16 V4 H16",
  ne: "M16 16 V4 H4",
  se: "M16 4 V16 H4",
  sw: "M4 4 V16 H16",
};
const CORNER_MARK_STROKE = 2.5;

function cornerMarkSvg(handle: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("width", String(HANDLE_ICON_SIZE));
  svg.setAttribute("height", String(HANDLE_ICON_SIZE));
  svg.setAttribute("fill", "none");
  svg.dataset.icon = "CropCorner";
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", CORNER_MARK_PATHS[handle] ?? CORNER_MARK_PATHS.se);
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", String(CORNER_MARK_STROKE));
  path.setAttribute("stroke-linecap", "square");
  path.setAttribute("stroke-linejoin", "miter");
  svg.appendChild(path);
  return svg;
}

const CORNERS: readonly string[] = ["nw", "ne", "se", "sw"];

/** 当前挂着的裁剪收尾函数；null 表示没有裁剪框。 */
let activeCleanup: (() => void) | null = null;
/** 当前挂着的确认函数：工具条「裁剪」按钮在裁剪态下改为确认收尾。 */
let activeConfirm: (() => void) | null = null;
/** 裁剪框所属图片的文档偏移与宿主 widget。 */
let activeFrom: number | null = null;
let activeHost: HTMLElement | null = null;

/**
 * 会话是否仍有效。文档变化会让编辑器重建 widget，旧裁剪框的 DOM 随旧 widget
 * 一起被丢弃，但模块级收尾函数还在——不判存活，后续每次「裁剪」都会落到
 * 「确认一个已经不在文档里的框」，表现为点了没有任何反应（#1453 复测）。
 */
function activeAlive(): boolean {
  return (
    activeCleanup !== null && activeHost !== null && activeHost.isConnected
  );
}

export function isImageCropActive(): boolean {
  return activeAlive();
}

/** 这张图是否正挂着裁剪框：工具条据此区分「确认当前框」与「给这张重开」。 */
export function isImageCropActiveFor(from: number): boolean {
  return activeAlive() && activeFrom === from;
}

function clearActive(): void {
  activeCleanup = null;
  activeConfirm = null;
  activeFrom = null;
  activeHost = null;
}

/** 关闭内联裁剪并恢复显示（切换图片 / 重开裁剪前清场）。 */
export function closeImageCrop(): void {
  if (!activeCleanup) return;
  const cleanup = activeCleanup;
  clearActive();
  cleanup();
}

/**
 * 视口护栏：进入与确认都要替换 / 重建 widget DOM，浏览器或编辑器会做滚动
 * 补偿（WebKit 还会在可编辑 DOM 变更后把选区滚进视口，跳变可能晚于首帧），
 * 视口因此「跳一下」。裁剪是就地编辑，视口不该动——在接下来若干帧内把滚动
 * 位置钉回裁剪前的值（窗口 ~400ms，跳变可能迟于首帧）；期间用户滚动立即让位。
 */
function pinScroll(
  scroller: HTMLElement | null,
  scrollTop: number | null,
): void {
  if (!scroller || scrollTop === null) return;
  let stopped = false;
  const stop = (): void => {
    stopped = true;
  };
  // 用户在这段窗口里的滚动意图（滚轮 / 触摸 / 按键）立即让位。
  scroller.addEventListener("wheel", stop, { passive: true });
  scroller.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);
  const startedAt = performance.now();
  const pin = (): void => {
    scroller.removeEventListener("wheel", stop);
    scroller.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
    if (stopped || !scroller.isConnected) return;
    if (Math.abs(scroller.scrollTop - scrollTop) >= 0.5) {
      scroller.scrollTop = scrollTop;
    }
    // 时间窗而非帧数：headless / 高刷屏的帧率差异不会缩短覆盖时长。
    if (performance.now() - startedAt < 450) requestAnimationFrame(pin);
  };
  requestAnimationFrame(pin);
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
  scale: Scale2D,
): void {
  const minX = MIN_CROP_SIZE * scale.x;
  const minY = MIN_CROP_SIZE * scale.y;
  rect.left = clamp(rect.left, 0, Math.max(0, fullW - minX));
  rect.top = clamp(rect.top, 0, Math.max(0, fullH - minY));
  rect.width = clamp(rect.width, minX, fullW - rect.left);
  rect.height = clamp(rect.height, minY, fullH - rect.top);
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
  if (!widget.isConnected) return;
  const scroller = widget.closest(".cm-scroller") as HTMLElement | null;
  const scrollAtMount = scroller ? scroller.scrollTop : null;
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;

  // 进入前的可见显示矩形（CSS px）：图片实际按 {width=…} 或既有 crop 显示，
  // 清空样式量到的「整图容器宽」并不是它。以进入前的可见尺寸为基准，进入裁剪
  // 不改变可见内容的尺寸与位置（#1409）。
  const enterRect = img.getBoundingClientRect();
  const enterW = enterRect.width;
  const enterH = enterRect.height;
  if (!(enterW > 0) || !(enterH > 0)) {
    showCropToast("图片尚未加载完成，暂不能裁剪");
    return;
  }

  // 裁剪基准（原图像素）：既有 crop 优先；没有则取整图。
  const base: Rect = options.crop
    ? {
        left: options.crop[0],
        top: options.crop[1],
        width: options.crop[2],
        height: options.crop[3],
      }
    : { left: 0, top: 0, width: natW, height: natH };
  clampRect(base, natW, natH);

  // 逐轴 scale：进入前可见宽(高) / 可见内容对应的原图宽(高)。既有 crop 时可见
  // 内容就是 crop 矩形，不能按 enterW/natW 换算——那只适用于无 crop 的整图显示。
  // 声明了 width/height 的图片被非等比拉伸，sy 必须独立求出，否则进入裁剪的
  // 瞬间显示高度会从「声明比」跳回「自然比」（#1453 跟进：第 2 张图压缩）。
  const scale: Scale2D = { x: enterW / base.width, y: enterH / base.height };
  if (!(scale.x > 0) || !(scale.y > 0)) {
    showCropToast("图片尚未加载完成，暂不能裁剪");
    return;
  }
  const fullW = natW * scale.x;
  const fullH = natH * scale.y;
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

  // 窗口：布局盒 = 可见内容（rect），不撑大 widget、不引发重排；overflow:hidden
  // 把图像裁在框内，框外不溢出到正文。img 以原图矩形尺寸 + transform 缩放，并
  // 平移到裁剪起点，使框内正是裁剪内容；拖边向外时长大窗口即露出新纳入的内容。
  let win: HTMLSpanElement;
  let restoreWindow: () => void;
  if (existingWindow) {
    win = existingWindow;
    restoreWindow = () => {};
  } else {
    win = document.createElement("span");
    win.className = WINDOW_CLASS;
    win.style.overflow = "hidden";
    win.style.display = "block";
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
    span.style.cursor = cropCursor(handle);
    span.style.width = `${HANDLE_HIT_SIZE}px`;
    span.style.height = `${HANDLE_HIT_SIZE}px`;
    span.title = "拖动调整裁剪区域";
    if (CORNERS.includes(handle)) {
      const icon = cornerMarkSvg(handle);
      icon.style.position = "absolute";
      icon.style.left = "50%";
      icon.style.top = "50%";
      // 颜色跟随主题（浅底深标 / 暗底浅标），见 editor.css 的
      // `.cm-image-crop-frame .cm-image-handle svg`；不在这里写死。
      icon.style.transform = "translate(-50%, -50%)";
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
    img.style.left = `${-rect.left}px`;
    img.style.top = `${-rect.top}px`;
    img.style.maxWidth = "none";
    img.style.objectFit = "none";
    img.style.objectPosition = "0px 0px";
    img.style.width = `${natW}px`;
    img.style.height = `${natH}px`;
    img.style.transform = `scale(${scale.x}, ${scale.y})`;
    img.style.transformOrigin = "0 0";
    win.style.width = `${rect.width}px`;
    win.style.height = `${rect.height}px`;
    const cropKey = imageRectFromDisplay(rect, scale);
    cropDisplayCache.set(
      cropDisplayKey(img.getAttribute("src"), [
        cropKey.left,
        cropKey.top,
        cropKey.width,
        cropKey.height,
      ]),
      { width: rect.width, height: rect.height },
    );
    // 裁剪框与可见内容重合：框就落在窗口布局盒上。
    frame.style.left = "0px";
    frame.style.top = "0px";
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;
  };
  applyDisplay();

  interface DragState {
    mode: "move" | "resize" | "draw";
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
    // 兜底清扫：widget 被编辑器重建、跨图重开等路径可能留下旧框或裁剪态类，
    // 让「保存后裁剪标识隐约存留」不再可能。
    document
      .querySelectorAll(".cm-image-crop-frame")
      .forEach((el) => el.remove());
    document
      .querySelectorAll(".cm-image-widget.cm-image-crop-active")
      .forEach((el) => el.classList.remove("cm-image-crop-active"));
    widget.classList.remove("cm-image-crop-active");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("click", onOutsideClick, true);
    restoreWindow();
    restoreDisplay();
    if (scroller) {
      scroller.removeEventListener("scroll", onScrollGuard);
      scroller.removeEventListener("wheel", noteUserScroll);
      scroller.removeEventListener("touchstart", noteUserScroll);
      window.removeEventListener("keydown", noteUserScroll);
    }
    if (activeCleanup === cleanup) clearActive();
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
    const scrollBefore = scroller ? scroller.scrollTop : null;
    markCropProbe("crop-confirm", {
      changed,
      rect: { ...rect },
      scrollBefore,
    });
    cleanup();
    pinScroll(scroller, scrollBefore);
    if (!changed) return;
    const display = {
      width: rect.width,
      height: rect.height,
      fullWidth: natW * scale.x,
      fullHeight: natH * scale.y,
    };
    if (isFullImageRect(end, natW, natH, FULL_IMAGE_RATIO)) {
      options.onConfirm(null, display);
    } else {
      options.onConfirm([end.left, end.top, end.width, end.height], display);
    }
    pinScroll(scroller, scrollBefore);
  };

  // 点框外 = 确认收尾（未改动即不写回，与工具条「裁剪」按钮同语义）；Esc 才取消。
  const onOutsideClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    if (!target) return;
    if (target.closest(".cm-image-widget")) return;
    if (target.closest('[data-testid="img-toolbar"]')) return;
    if (target.closest('[data-testid="img-maximize"]')) return;
    confirm();
  };

  frame.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target as Element | null;
    const handleEl = target?.closest("[data-handle]") as HTMLElement | null;
    frame.setPointerCapture(event.pointerId);
    // 整图状态下框体无处可移（可移动区间为 0），拖框体按「画新选区」处理，
    // 否则用户以为裁剪不可用。
    const atFullImage = rect.width >= fullW - 1 && rect.height >= fullH - 1;
    drag = {
      mode: handleEl ? "resize" : atFullImage ? "draw" : "move",
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
    if (drag.mode === "draw") {
      // 画出新选区：起点到当前指针（显示坐标），夹在整图范围内。
      const x = clamp(drag.start.left + dxScreen, 0, fullW);
      const y = clamp(drag.start.top + dyScreen, 0, fullH);
      const minX = MIN_CROP_SIZE * scale.x;
      const minY = MIN_CROP_SIZE * scale.y;
      rect.left = Math.min(x, drag.start.left);
      rect.top = Math.min(y, drag.start.top);
      rect.width = Math.max(minX, Math.abs(x - drag.start.left));
      rect.height = Math.max(minY, Math.abs(y - drag.start.top));
      rect.width = Math.min(rect.width, fullW - rect.left);
      rect.height = Math.min(rect.height, fullH - rect.top);
    } else if (drag.mode === "move") {
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
      const minX = MIN_CROP_SIZE * scale.x;
      const minY = MIN_CROP_SIZE * scale.y;
      let left = drag.start.left;
      let top = drag.start.top;
      let right = drag.start.left + drag.start.width;
      let bottom = drag.start.top + drag.start.height;
      if (axes.x === "r") right = clamp(right + dxScreen, left + minX, fullW);
      if (axes.x === "l") left = clamp(left + dxScreen, 0, right - minX);
      if (axes.y === "b") bottom = clamp(bottom + dyScreen, top + minY, fullH);
      if (axes.y === "t") top = clamp(top + dyScreen, 0, bottom - minY);
      rect.left = left;
      rect.top = top;
      rect.width = right - left;
      rect.height = bottom - top;
    }
    // 显示矩形与写回矩形同源：取整到原图像素再换算回显示，保存前后严格一致。
    const snapped = imageRectFromDisplay(rect, scale);
    rect.left = snapped.left * scale.x;
    rect.top = snapped.top * scale.y;
    rect.width = snapped.width * scale.x;
    rect.height = snapped.height * scale.y;
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

  markCropProbe("crop-enter", {
    from: options.from ?? null,
    crop: options.crop,
  });
  // 会话级滚动夹取护栏：第一次裁剪时 widget 结构由普通 img 换成裁剪窗口，
  // 内容高度会瞬时塌陷，浏览器把 scrollTop 夹成 0；内容恢复后不回填 →
  // 「跳到顶部」（WebKit 无 scroll anchoring，真机必现；Chromium 掩盖了它）。
  // 会话存活期间把归零的滚动位置补回；用户滚轮 / 触摸 / 按键立即让位。
  let guardTop = scroller ? scroller.scrollTop : 0;
  let guardHeight = scroller ? scroller.scrollHeight : 0;
  let userScrollIntent = false;
  const noteUserScroll = (): void => {
    userScrollIntent = true;
    if (scroller) {
      guardTop = scroller.scrollTop;
      guardHeight = scroller.scrollHeight;
    }
  };
  /**
   * 只处理「内容变矮 → 浏览器夹取 scrollTop」这一种签名：scrollHeight 变小且
   * scrollTop 随之变小。合法滚动（点选其它图片、跳转、键入跟光标）不改变
   * 高度，一律放行。检测到夹取后，等内容高度恢复再把滚动位置补回进入值。
   */
  const onScrollGuard = (): void => {
    if (!scroller || userScrollIntent || !scroller.isConnected) return;
    const h = scroller.scrollHeight;
    const top = scroller.scrollTop;
    if (h + 2 < guardHeight && top + 2 < guardTop) {
      const target = guardTop;
      const needHeight = guardHeight;
      let frames = 0;
      const restore = (): void => {
        if (!scroller || userScrollIntent || !scroller.isConnected) return;
        frames += 1;
        if (frames > 40) return;
        // 高度恢复（布局落地）后再补，避免和塌陷中的布局打架。
        if (scroller.scrollHeight >= needHeight - 2) {
          if (Math.abs(scroller.scrollTop - target) > 2) {
            scroller.scrollTop = target;
          }
          return;
        }
        requestAnimationFrame(restore);
      };
      requestAnimationFrame(restore);
    }
    guardHeight = h;
  };
  if (scroller) {
    scroller.addEventListener("scroll", onScrollGuard);
    scroller.addEventListener("wheel", noteUserScroll, { passive: true });
    scroller.addEventListener("touchstart", noteUserScroll, { passive: true });
    window.addEventListener("keydown", noteUserScroll);
  }

  activeCleanup = cleanup;
  activeConfirm = confirm;
  const hostFrom = Number(widget.dataset.imageFrom);
  activeFrom = Number.isFinite(hostFrom) ? hostFrom : null;
  activeHost = widget;
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

/**
 * 裁剪专用指针（按用户示例定稿）：
 * - 四角 = 直角括号，各自朝向（nw=⌜、ne=⌝、se=﹂、sw=⌞），顶点为热点；
 * - 四边 = 「⊥」形（与边平行的粗条 + 指向框外的短杆，即示例的 T 形旋转），
 *   热点落在粗条中点（抓的就是这条边）。
 * 24×24、白描边 + 黑主色，深浅底可见；与图片缩放的方向箭头（ew/nwse/ns-resize）
 * 形状家族不同，不会混淆。
 */
interface CropCursorGlyph {
  readonly d: readonly string[];
  readonly hotspot: string;
}

const CROP_CURSOR_GLYPHS: Record<string, CropCursorGlyph> = {
  nw: { d: ["M9 19 V9 H19"], hotspot: "9 9" },
  ne: { d: ["M15 19 V9 H5"], hotspot: "15 9" },
  se: { d: ["M15 5 V15 H5"], hotspot: "15 15" },
  sw: { d: ["M9 5 V15 H19"], hotspot: "9 15" },
  e: { d: ["M8 5 V19", "M8 12 H18"], hotspot: "8 12" },
  w: { d: ["M16 5 V19", "M16 12 H6"], hotspot: "16 12" },
  s: { d: ["M5 8 H19", "M12 8 V18"], hotspot: "12 8" },
  n: { d: ["M5 16 H19", "M12 16 V6"], hotspot: "12 16" },
};

function cropCursor(handle: string): string {
  const glyph = CROP_CURSOR_GLYPHS[handle];
  if (!glyph) return "crosshair";
  const strokes = (color: string, width: number): string =>
    glyph.d
      .map((d) => `<path d='${d}' stroke='${color}' stroke-width='${width}'/>`)
      .join("");
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' " +
    "fill='none' stroke-linecap='square' stroke-linejoin='miter'>" +
    `${strokes("%23fff", 4.5)}${strokes("%23000", 2)}` +
    "</svg>";
  return `url("data:image/svg+xml;charset=utf-8,${svg}") ${glyph.hotspot}, crosshair`;
}

const HANDLE_MARK: Record<string, string> = {
  n: "left:50%; top:2px; width:16px; height:3px; margin-left:-8px;",
  s: "left:50%; bottom:2px; width:16px; height:3px; margin-left:-8px;",
  e: "top:50%; right:2px; width:3px; height:16px; margin-top:-8px;",
  w: "top:50%; left:2px; width:3px; height:16px; margin-top:-8px;",
};
