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
    icon: "AddCommentOutlined",
    label: "评论",
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

/** 无标题的文本态点击进入输入；Enter 提交、Esc / blur 回退到文本态。 */
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
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      const value = input.value.trim();
      if (value === "" || value === current) {
        setCaptionText(caption, widgetEl.dataset.imageTitle ?? "");
        return;
      }
      actions.onImageSetTitle?.(from, value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setCaptionText(caption, widgetEl.dataset.imageTitle ?? "");
    }
  });
  input.addEventListener("blur", () => {
    if (!caption.isConnected) return;
    setCaptionText(caption, widgetEl.dataset.imageTitle ?? "");
  });
  caption.appendChild(input);
  input.focus();
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
    return;
  }
  repositionFrame = requestAnimationFrame(() => {
    repositionFrame = null;
    positionToolbar();
  });
}

export function openImageMaximize(src: string | null, alt: string): void {
  closeImageMaximize();
  const overlay = document.createElement("div");
  overlay.className = "cm-image-maximize";
  overlay.dataset.testid = "img-maximize";
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    overlay.appendChild(img);
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = `[图片: ${alt}]`;
    overlay.appendChild(fallback);
  }
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeImageMaximize();
  });
  overlay.addEventListener("dblclick", () => closeImageMaximize());
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
