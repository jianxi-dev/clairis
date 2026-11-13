/* 图片选中工具条与放大浮层（#652）。
 *
 * 工具条挂在 document.body（fixed），居中于选中图片的上方；九个按钮的动作由
 * 宿主注入，缺省回调的按钮禁用（缺省 = 禁用，绝不是「能点但没反应」）。
 * 选中态按文档偏移存放在模块级：装饰每次重建都会换新 widget DOM，新 widget
 * 的 toDOM 会按偏移重新套用选中态，工具条再按新 DOM 重新定位。
 */
import { renderIcon } from "../icons";

export type ImageAlignChoice = "left" | "center" | "right";

export interface ImageToolbarActions {
  onImageAi?: (path: string, alt: string) => void;
  onImageCrop?: (from: number) => void;
  onImageComment?: (from: number) => void;
  onImageSetTitle?: (from: number, title: string) => void;
  onImageAlign?: (from: number, align: ImageAlignChoice) => void;
  onImageCut?: (from: number) => void;
  onImageCopy?: (from: number) => void;
  onImageDelete?: (from: number) => void;
}

interface ButtonSpec {
  readonly testid: string;
  readonly icon: string;
  readonly label: string;
  readonly action: string;
  readonly disabledTitle?: string;
}

const BUTTON_SPECS: readonly ButtonSpec[] = [
  {
    testid: "img-toolbar-ai",
    icon: "AiEditOutlined",
    label: "AI 编辑",
    action: "ai",
  },
  {
    testid: "img-toolbar-crop",
    icon: "CropOutlined",
    label: "裁剪",
    action: "crop",
  },
  {
    testid: "img-toolbar-comment",
    icon: "TextEditOutlined",
    label: "描述",
    action: "comment",
  },
  {
    testid: "img-toolbar-align-left",
    icon: "AlignLeftOutlined",
    label: "左对齐",
    action: "align-left",
  },
  {
    testid: "img-toolbar-align-center",
    icon: "AlignCenterOutlined",
    label: "居中",
    action: "align-center",
  },
  {
    testid: "img-toolbar-align-right",
    icon: "AlignRightOutlined",
    label: "右对齐",
    action: "align-right",
  },
  {
    testid: "img-toolbar-cut",
    icon: "ScissorsOutlined",
    label: "剪切",
    action: "cut",
  },
  {
    testid: "img-toolbar-copy",
    icon: "CopyOutlined",
    label: "复制",
    action: "copy",
  },
  {
    testid: "img-toolbar-delete",
    icon: "DeleteTrashOutlined",
    label: "删除",
    action: "delete",
  },
];

const CORNER_POSITIONS: readonly { corner: "tl" | "tr" | "bl" | "br" }[] = [
  { corner: "tl" },
  { corner: "tr" },
  { corner: "bl" },
  { corner: "br" },
];

/** 缩放把手方位：e/w/n/s 四边中点 + 四角。 */
export type ImageHandleKind = "e" | "w" | "n" | "s" | "ne" | "nw" | "se" | "sw";

export interface ImageHandleSpec {
  readonly handle: ImageHandleKind;
  readonly cursor: string;
  readonly width: boolean;
  readonly height: boolean;
  /** 宽度位移符号：w/nw/sw 向左拖增长 */
  readonly signX: 1 | -1;
  /** 高度位移符号：n/ne/nw 向上拖增长 */
  readonly signY: 1 | -1;
  /** 预览时用 container margin-left 钉住对边（左边缘移动） */
  readonly offsetX: boolean;
  /** 预览时用 container margin-top 钉住对边（上边缘移动） */
  readonly offsetY: boolean;
}

/**
 * 8 个缩放把手，顺序即 DOM 顺序，e 必须第一个：旧 2.1 拖拽测试通过
   `[data-testid="cm-image-resize"]` 找它，新测试则断言 e 在最前。
 */
export const IMAGE_RESIZE_HANDLES: readonly ImageHandleSpec[] = [
  {
    handle: "e",
    cursor: "ew-resize",
    width: true,
    height: false,
    signX: 1,
    signY: 1,
    offsetX: false,
    offsetY: false,
  },
  {
    handle: "w",
    cursor: "ew-resize",
    width: true,
    height: false,
    signX: -1,
    signY: 1,
    offsetX: true,
    offsetY: false,
  },
  {
    handle: "n",
    cursor: "ns-resize",
    width: false,
    height: true,
    signX: 1,
    signY: -1,
    offsetX: false,
    offsetY: true,
  },
  {
    handle: "s",
    cursor: "ns-resize",
    width: false,
    height: true,
    signX: 1,
    signY: 1,
    offsetX: false,
    offsetY: false,
  },
  {
    handle: "ne",
    cursor: "nesw-resize",
    width: true,
    height: true,
    signX: 1,
    signY: -1,
    offsetX: false,
    offsetY: true,
  },
  {
    handle: "nw",
    cursor: "nwse-resize",
    width: true,
    height: true,
    signX: -1,
    signY: -1,
    offsetX: true,
    offsetY: true,
  },
  {
    handle: "se",
    cursor: "nwse-resize",
    width: true,
    height: true,
    signX: 1,
    signY: 1,
    offsetX: false,
    offsetY: false,
  },
  {
    handle: "sw",
    cursor: "nesw-resize",
    width: true,
    height: true,
    signX: -1,
    signY: 1,
    offsetX: true,
    offsetY: false,
  },
];

interface Selection {
  readonly from: number;
  readonly path: string;
  readonly alt: string;
}

let selection: Selection | null = null;
let actions: ImageToolbarActions = {};
let toolbarEl: HTMLElement | null = null;
let maximizeEl: HTMLElement | null = null;
let maximizeKeyHandler: ((event: KeyboardEvent) => void) | null = null;
let repositionFrame: number | null = null;

const MAXIMIZE_MIN_SCALE = 1;
const MAXIMIZE_MAX_SCALE = 8;
const MAXIMIZE_WHEEL_STEP = 1.1;

interface MaximizeTransform {
  scale: number;
  tx: number;
  ty: number;
  rotation: number;
}

let maximizeImg: HTMLImageElement | null = null;
let maximizeTransform: MaximizeTransform = {
  scale: 1,
  tx: 0,
  ty: 0,
  rotation: 0,
};
let maximizeCleanup: (() => void) | null = null;
const maximizePointers = new Map<number, { x: number; y: number }>();
let maximizePanStart: {
  px: number;
  py: number;
  tx: number;
  ty: number;
} | null = null;
let maximizePinchStart: { dist: number; scale: number } | null = null;
let maximizeDownPos: { x: number; y: number } | null = null;
/** 描述行「已收起」：点击带描述的描述行后置位，重新选中图片时复位。 */
let captionCollapsed = false;

const CAPTION_PLACEHOLDER = "输入图片描述";

export function getSelectedImageFrom(): number | null {
  return selection?.from ?? null;
}

export function setImageToolbarActions(next: ImageToolbarActions): void {
  actions = next;
  updateDisabledStates();
}

export function selectImage(from: number, path: string, alt: string): void {
  selection = { from, path, alt };
  captionCollapsed = false;
  applySelection();
  ensureToolbar();
  updateAlignStates();
  positionToolbar();
  scheduleReposition();
}

export function deselectImage(): void {
  if (!selection) return;
  selection = null;
  applySelection();
  removeToolbar();
}

export function scheduleImageToolbarReposition(): void {
  scheduleReposition();
}

/**
 * 把选中态套到某个 widget DOM 上：data-selected + 4 个角点 + 8 个缩放把手
 * + 描述行。描述行随选中态增删，内容按 data-image-title 渲染。
 */
export function markImageWidgetSelected(
  el: HTMLElement,
  isSelected: boolean,
): void {
  el.dataset.selected = isSelected ? "true" : "false";
  el.querySelectorAll(".cm-image-corner").forEach((dot) => dot.remove());
  el.querySelectorAll(".cm-image-handle").forEach((handle) => handle.remove());
  el.querySelectorAll(".cm-image-caption").forEach((caption) =>
    caption.remove(),
  );
  if (!isSelected) return;
  for (const { corner } of CORNER_POSITIONS) {
    const dot = document.createElement("span");
    dot.className = "cm-image-corner";
    dot.dataset.corner = corner;
    el.appendChild(dot);
  }
  appendCaptionLine(el);
  // 文字回退（解析不出 URL）没有 <img>，不出缩放把手。
  if (!el.querySelector("img")) return;
  for (const { handle, cursor } of IMAGE_RESIZE_HANDLES) {
    const span = document.createElement("span");
    span.className = "cm-image-handle";
    span.dataset.handle = handle;
    span.style.cursor = cursor;
    span.title = "拖动调整图片大小";
    if (handle === "e") {
      // 旧单把手类名 / testid 保留在 e 上，2.1 拖拽测试靠它锚定。
      span.classList.add("cm-image-resize");
      span.setAttribute("data-testid", "cm-image-resize");
    }
    el.appendChild(span);
  }
}

// --- 描述行（#657） -----------------------------------------------------------

/** 描述行文本态：有标题显示标题，没有显示占位文字。 */
function setCaptionText(caption: HTMLElement, title: string): void {
  caption.textContent = "";
  const span = document.createElement("span");
  span.className =
    title === "" ? "cm-image-caption-placeholder" : "cm-image-caption-text";
  span.textContent = title === "" ? CAPTION_PLACEHOLDER : title;
  caption.appendChild(span);
}

/**
 * 把描述行切到输入态：Enter 提交并关闭，blur 同样提交（非丢弃），Esc 取消。
 * 已有标题时回填原值。
 */
function enterCaptionEdit(caption: HTMLElement, widgetEl: HTMLElement): void {
  const from = Number(widgetEl.dataset.imageFrom);
  const current = widgetEl.dataset.imageTitle ?? "";
  caption.textContent = "";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "cm-image-caption-input";
  input.dataset.testid = "img-caption-input";
  input.value = current;
  input.placeholder = CAPTION_PLACEHOLDER;
  input.setAttribute("aria-label", "图片描述");
  input.addEventListener("mousedown", (event) => event.stopPropagation());
  // Enter / Esc 会主动收尾：移除输入框触发的 blur 早于 isConnected 更新，
  // 没有这个标志，「取消」会被 blur 的保存逻辑二次写回。
  let finishing = false;
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      const value = input.value.trim();
      if (value === "" || value === current) {
        finishing = true;
        setCaptionText(caption, widgetEl.dataset.imageTitle ?? "");
        return;
      }
      finishing = true;
      actions.onImageSetTitle?.(from, value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finishing = true;
      setCaptionText(caption, widgetEl.dataset.imageTitle ?? "");
    }
  });
  input.addEventListener("blur", () => {
    if (finishing) return;
    const value = input.value.trim();
    if (value === "" || value === current) {
      setCaptionText(caption, widgetEl.dataset.imageTitle ?? "");
      return;
    }
    actions.onImageSetTitle?.(from, value);
  });
  caption.appendChild(input);
  input.focus();
}

/**
 * 工具条「描述」：让当前选中图片的描述行进入编辑态。已有标题时直接打开并
 * 回填，不走描述行的收起逻辑。
 */
export function editSelectedImageCaption(): void {
  if (!selection) return;
  const el = document.querySelector<HTMLElement>(
    `.cm-image-widget[data-image-from="${selection.from}"]`,
  );
  const caption = el?.querySelector<HTMLElement>(".cm-image-caption");
  if (!el || !caption) return;
  if (caption.querySelector("input")) return;
  if (typeof actions.onImageSetTitle !== "function") return;
  caption.style.display = "";
  captionCollapsed = false;
  enterCaptionEdit(caption, el);
}

function appendCaptionLine(el: HTMLElement): void {
  const title = el.dataset.imageTitle ?? "";
  const caption = document.createElement("div");
  caption.className = "cm-image-caption";
  caption.dataset.testid = "img-caption";
  setCaptionText(caption, title);
  // mousedown 不冒泡：CM6 会抢焦点，输入框还没聚焦就被打掉。
  caption.addEventListener("mousedown", (event) => event.stopPropagation());
  caption.addEventListener("click", (event) => {
    event.stopPropagation();
    if (caption.querySelector("input")) return;
    if (title === "") {
      if (typeof actions.onImageSetTitle !== "function") return;
      enterCaptionEdit(caption, el);
      return;
    }
    caption.style.display = "none";
    captionCollapsed = true;
  });
  if (captionCollapsed) caption.style.display = "none";
  el.appendChild(caption);
}

function applySelection(): void {
  const selectedFrom = selection?.from ?? null;
  document.querySelectorAll<HTMLElement>(".cm-image-widget").forEach((el) => {
    const from = el.dataset.imageFrom ? Number(el.dataset.imageFrom) : null;
    markImageWidgetSelected(el, from !== null && from === selectedFrom);
  });
}

function ensureToolbar(): void {
  if (toolbarEl) return;
  toolbarEl = document.createElement("div");
  toolbarEl.className = "cm-image-toolbar";
  toolbarEl.dataset.testid = "img-toolbar";
  for (const spec of BUTTON_SPECS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.testid = spec.testid;
    btn.title = spec.label;
    btn.setAttribute("aria-label", spec.label);
    btn.appendChild(renderIcon(spec.icon));
    btn.addEventListener("click", () => runAction(spec.action));
    toolbarEl.appendChild(btn);
  }
  document.body.appendChild(toolbarEl);
  updateDisabledStates();
}

function removeToolbar(): void {
  toolbarEl?.remove();
  toolbarEl = null;
}

const ALIGN_BUTTON_TESTIDS: Readonly<Record<string, string>> = {
  left: "img-toolbar-align-left",
  center: "img-toolbar-align-center",
  right: "img-toolbar-align-right",
};

/**
 * 按选中图片的 data-align 标注工具条对齐按钮的 active 态。容器缺省按 center
 * 渲染，属性块被清掉后（用户选居中）仍要保持居中按钮为 true。
 */
function updateAlignStates(): void {
  if (!toolbarEl || !selection) return;
  const el = document.querySelector<HTMLElement>(
    `.cm-image-widget[data-image-from="${selection.from}"]`,
  );
  const align = el?.dataset.align ?? "center";
  for (const [key, testid] of Object.entries(ALIGN_BUTTON_TESTIDS)) {
    const btn = toolbarEl.querySelector<HTMLButtonElement>(
      `[data-testid="${testid}"]`,
    );
    btn?.setAttribute("aria-pressed", key === align ? "true" : "false");
  }
}

function updateDisabledStates(): void {
  if (!toolbarEl) return;
  for (const spec of BUTTON_SPECS) {
    const btn = toolbarEl.querySelector<HTMLButtonElement>(
      `[data-testid="${spec.testid}"]`,
    );
    if (!btn) continue;
    const available = isActionAvailable(spec.action);
    btn.disabled = !available;
    if (!available && spec.disabledTitle) btn.title = spec.disabledTitle;
  }
}

function isActionAvailable(action: string): boolean {
  switch (action) {
    case "ai":
      return typeof actions.onImageAi === "function";
    case "crop":
      return typeof actions.onImageCrop === "function";
    case "comment":
      return typeof actions.onImageComment === "function";
    case "align-left":
    case "align-center":
    case "align-right":
      return typeof actions.onImageAlign === "function";
    case "cut":
      return typeof actions.onImageCut === "function";
    case "copy":
      return typeof actions.onImageCopy === "function";
    case "delete":
      return typeof actions.onImageDelete === "function";
    default:
      return false;
  }
}

function runAction(action: string): void {
  if (!selection) return;
  const { from, path, alt } = selection;
  switch (action) {
    case "ai":
      actions.onImageAi?.(path, alt);
      break;
    case "crop":
      actions.onImageCrop?.(from);
      break;
    case "comment":
      actions.onImageComment?.(from);
      break;
    case "align-left":
      actions.onImageAlign?.(from, "left");
      break;
    case "align-center":
      actions.onImageAlign?.(from, "center");
      break;
    case "align-right":
      actions.onImageAlign?.(from, "right");
      break;
    case "cut":
      actions.onImageCut?.(from);
      break;
    case "copy":
      actions.onImageCopy?.(from);
      break;
    case "delete":
      actions.onImageDelete?.(from);
      break;
  }
}

function positionToolbar(): void {
  if (!toolbarEl || !selection) return;
  const el = document.querySelector<HTMLElement>(
    `.cm-image-widget[data-image-from="${selection.from}"]`,
  );
  if (!el) {
    // 选中的图片已随文档改动消失（删除 / 剪切）：选中态与工具条一起收掉。
    deselectImage();
    return;
  }
  const rect = el.getBoundingClientRect();
  toolbarEl.style.left = `${rect.left + rect.width / 2}px`;
  toolbarEl.style.top = `${rect.top - 8}px`;
}

function scheduleReposition(): void {
  if (repositionFrame !== null) return;
  if (typeof requestAnimationFrame !== "function") {
    positionToolbar();
    updateAlignStates();
    return;
  }
  repositionFrame = requestAnimationFrame(() => {
    repositionFrame = null;
    positionToolbar();
    updateAlignStates();
  });
}

function maximizeApplyTransform(): void {
  if (!maximizeImg) return;
  const { scale, tx, ty, rotation } = maximizeTransform;
  maximizeImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rotation}deg)`;
}

/**
 * 平移钳制：旋转后的包围盒半宽/半高就是中心可移动的上限，图像始终盖住浮层
 * 中心，不会被拖出视野。
 */
function maximizeClampTranslation(): void {
  const img = maximizeImg;
  if (!img) return;
  const rect = img.getBoundingClientRect();
  const baseW = img.clientWidth || rect.width / maximizeTransform.scale;
  const baseH = img.clientHeight || rect.height / maximizeTransform.scale;
  const s = maximizeTransform.scale;
  const rad = (maximizeTransform.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const sn = Math.abs(Math.sin(rad));
  const halfW = (baseW * s * c + baseH * s * sn) / 2;
  const halfH = (baseW * s * sn + baseH * s * c) / 2;
  maximizeTransform.tx = Math.min(
    halfW,
    Math.max(-halfW, maximizeTransform.tx),
  );
  maximizeTransform.ty = Math.min(
    halfH,
    Math.max(-halfH, maximizeTransform.ty),
  );
}

/** 以指针处为锚点缩放：保持指针下的图像点不动。 */
function maximizeZoom(nextScale: number, cx: number, cy: number): void {
  const img = maximizeImg;
  if (!img) return;
  const prev = maximizeTransform.scale;
  const next = Math.min(
    MAXIMIZE_MAX_SCALE,
    Math.max(MAXIMIZE_MIN_SCALE, nextScale),
  );
  if (next === prev) return;
  const rect = img.getBoundingClientRect();
  const vx = cx - (rect.left + rect.width / 2);
  const vy = cy - (rect.top + rect.height / 2);
  maximizeTransform.tx += vx * (1 - next / prev);
  maximizeTransform.ty += vy * (1 - next / prev);
  maximizeTransform.scale = next;
  if (next === MAXIMIZE_MIN_SCALE) {
    maximizeTransform.tx = 0;
    maximizeTransform.ty = 0;
  }
  maximizeClampTranslation();
  maximizeApplyTransform();
}

function maximizeOnWheel(event: WheelEvent): void {
  event.preventDefault();
  const factor =
    event.deltaY < 0 ? MAXIMIZE_WHEEL_STEP : 1 / MAXIMIZE_WHEEL_STEP;
  maximizeZoom(maximizeTransform.scale * factor, event.clientX, event.clientY);
}

function maximizeOnPointerDown(event: PointerEvent): void {
  maximizeDownPos = { x: event.clientX, y: event.clientY };
  if (!maximizeImg || event.target !== maximizeImg) return;
  maximizePointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
  });
  if (maximizePointers.size === 1) {
    if (maximizeTransform.scale > MAXIMIZE_MIN_SCALE) {
      maximizePanStart = {
        px: event.clientX,
        py: event.clientY,
        tx: maximizeTransform.tx,
        ty: maximizeTransform.ty,
      };
    }
  } else if (maximizePointers.size === 2) {
    const [a, b] = [...maximizePointers.values()];
    maximizePinchStart = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      scale: maximizeTransform.scale,
    };
    maximizePanStart = null;
  }
}

function maximizeOnPointerMove(event: PointerEvent): void {
  if (!maximizePointers.has(event.pointerId)) return;
  maximizePointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
  });
  if (maximizePointers.size === 1 && maximizePanStart) {
    maximizeTransform.tx =
      maximizePanStart.tx + (event.clientX - maximizePanStart.px);
    maximizeTransform.ty =
      maximizePanStart.ty + (event.clientY - maximizePanStart.py);
    maximizeClampTranslation();
    maximizeApplyTransform();
  } else if (maximizePointers.size === 2 && maximizePinchStart) {
    const [a, b] = [...maximizePointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (dist > 0 && maximizePinchStart.dist > 0) {
      maximizeZoom(
        maximizePinchStart.scale * (dist / maximizePinchStart.dist),
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
      );
    }
  }
}

function maximizeOnPointerEnd(event: PointerEvent): void {
  if (!maximizePointers.has(event.pointerId)) return;
  maximizePointers.delete(event.pointerId);
  if (maximizePointers.size === 1) {
    const [p] = [...maximizePointers.values()];
    maximizePanStart = {
      px: p.x,
      py: p.y,
      tx: maximizeTransform.tx,
      ty: maximizeTransform.ty,
    };
  } else {
    maximizePanStart = null;
  }
  maximizePinchStart = null;
}

function maximizeControlButton(
  testid: string,
  label: string,
  icon: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.testid = testid;
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.style.cssText =
    "width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:none;border-radius:8px;background:rgba(255,255,255,0.14);color:inherit;cursor:pointer;";
  btn.appendChild(renderIcon(icon));
  btn.addEventListener("click", onClick);
  return btn;
}

function maximizeDownloadName(src: string, alt: string): string {
  const match = /\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#]|$)/i.exec(src);
  const ext = match ? match[1].toLowerCase() : "png";
  const base =
    alt
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "_")
      .slice(0, 60) || "image";
  return `${base}.${ext}`;
}

export function openImageMaximize(
  src: string | null,
  alt: string,
  crop?: [number, number, number, number] | null,
): void {
  closeImageMaximize();
  const overlay = document.createElement("div");
  overlay.className = "cm-image-maximize";
  overlay.dataset.testid = "img-maximize";
  overlay.style.touchAction = "none";
  overlay.style.userSelect = "none";

  let img: HTMLImageElement | null = null;
  if (src) {
    img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.draggable = false;
    if (crop) {
      // 与行内裁剪显示同一坐标系：盒子=裁剪矩形，object-fit:none 平移到 (l,t)。
      const [l, t, w, h] = crop;
      img.style.objectFit = "none";
      img.style.objectPosition = `${-l}px ${-t}px`;
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
    }
    overlay.appendChild(img);
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = `[图片: ${alt}]`;
    overlay.appendChild(fallback);
  }
  maximizeImg = img;
  maximizeTransform = { scale: 1, tx: 0, ty: 0, rotation: 0 };
  maximizeApplyTransform();

  const controls = document.createElement("div");
  controls.dataset.testid = "img-max-controls";
  controls.style.cssText =
    "position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:1;";
  controls.appendChild(
    maximizeControlButton(
      "img-max-rotate",
      "旋转 90°",
      "RotateOutlined",
      () => {
        maximizeTransform.rotation = (maximizeTransform.rotation + 90) % 360;
        maximizeClampTranslation();
        maximizeApplyTransform();
      },
    ),
  );
  controls.appendChild(
    maximizeControlButton(
      "img-max-download",
      "下载原图",
      "DownloadOutlined",
      () => {
        if (!src) return;
        const a = document.createElement("a");
        a.href = src;
        a.download = maximizeDownloadName(src, alt);
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
    ),
  );
  controls.appendChild(
    maximizeControlButton(
      "img-max-reset",
      "恢复原始尺寸",
      "RestoreOutlined",
      () => {
        maximizeTransform = { scale: 1, tx: 0, ty: 0, rotation: 0 };
        maximizeApplyTransform();
      },
    ),
  );
  controls.appendChild(
    maximizeControlButton("img-max-close", "关闭预览", "CloseOutlined", () => {
      closeImageMaximize();
    }),
  );
  overlay.appendChild(controls);

  overlay.addEventListener("click", (event) => {
    const down = maximizeDownPos;
    maximizeDownPos = null;
    if (event.target !== overlay) return;
    // 拖动结束后 pointerup 落在浮层背景上会补一次 click；位移超过阈值不算点击。
    if (
      down &&
      Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4
    ) {
      return;
    }
    closeImageMaximize();
  });
  // 双击恢复原始尺寸（design D16），不当关闭用。
  overlay.addEventListener("dblclick", () => {
    maximizeTransform = { scale: 1, tx: 0, ty: 0, rotation: 0 };
    maximizeApplyTransform();
  });
  overlay.addEventListener("wheel", maximizeOnWheel, { passive: false });
  overlay.addEventListener("pointerdown", maximizeOnPointerDown);
  document.addEventListener("pointermove", maximizeOnPointerMove);
  document.addEventListener("pointerup", maximizeOnPointerEnd);
  document.addEventListener("pointercancel", maximizeOnPointerEnd);
  maximizeCleanup = () => {
    overlay.removeEventListener("wheel", maximizeOnWheel);
    overlay.removeEventListener("pointerdown", maximizeOnPointerDown);
    document.removeEventListener("pointermove", maximizeOnPointerMove);
    document.removeEventListener("pointerup", maximizeOnPointerEnd);
    document.removeEventListener("pointercancel", maximizeOnPointerEnd);
  };

  maximizeKeyHandler = (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closeImageMaximize();
  };
  document.addEventListener("keydown", maximizeKeyHandler, true);
  document.body.appendChild(overlay);
  maximizeEl = overlay;
}

export function closeImageMaximize(): void {
  maximizeEl?.remove();
  maximizeEl = null;
  if (maximizeKeyHandler) {
    document.removeEventListener("keydown", maximizeKeyHandler, true);
    maximizeKeyHandler = null;
  }
  if (maximizeCleanup) {
    maximizeCleanup();
    maximizeCleanup = null;
  }
  maximizeImg = null;
  maximizeTransform = { scale: 1, tx: 0, ty: 0, rotation: 0 };
  maximizePointers.clear();
  maximizePanStart = null;
  maximizePinchStart = null;
  maximizeDownPos = null;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const target = event.target as Node | null;
    if (target instanceof Element) {
      if (target.closest(".cm-image-widget")) return;
      if (target.closest('[data-testid="img-toolbar"]')) return;
      if (target.closest('[data-testid="img-maximize"]')) return;
    }
    deselectImage();
  });
  document.addEventListener("scroll", scheduleReposition, true);
  window.addEventListener("resize", scheduleReposition);
}
