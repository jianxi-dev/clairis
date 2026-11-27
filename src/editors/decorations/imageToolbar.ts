/* 图片选中工具条与放大浮层（#652）。
 *
 * 工具条挂在 document.body（fixed），居中于选中图片的上方；九个按钮的动作由
 * 宿主注入，缺省回调的按钮禁用（缺省 = 禁用，绝不是「能点但没反应」）。
 * 选中态按文档偏移存放在模块级：装饰每次重建都会换新 widget DOM，新 widget
 * 的 toDOM 会按偏移重新套用选中态，工具条再按新 DOM 重新定位。
 */
import type { EditorView } from "@codemirror/view";
import { renderIcon } from "../icons";

export type ImageAlignChoice = "left" | "center" | "right";

export interface ImageToolbarActions {
  onImageAi?: (path: string, alt: string) => void;
  onImageCrop?: (from: number) => void;
  onImageReset?: (from: number) => void;
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
    testid: "img-toolbar-reset",
    icon: "RotateOutlined",
    label: "重置图片",
    action: "reset",
  },
  {
    testid: "img-toolbar-comment",
    icon: "ImageCaptionOutlined",
    label: "添加描述",
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
/** 滚动容器（选中图片的祖先 `.cm-scroller`）：滚动判定只挂它，不挂 document。 */
let scrollTarget: HTMLElement | null = null;
let onScrollTarget: (() => void) | null = null;
/** 滚动期隐藏态：进入即隐藏工具条且不重算位置，停滚防抖到期后一次定位复位。 */
let scrolling = false;
let scrollDebounce: number | null = null;
/** 视口判定：IntersectionObserver 观察选中图片，替代逐帧读布局的视口夹取。 */
let viewportObserver: IntersectionObserver | null = null;

/** 停滚防抖窗口：滚动事件间隔实测 8-19ms，80ms 有余量且不拖慢停滚复位。 */
const SCROLL_DEBOUNCE_MS = 80;

const MAXIMIZE_MIN_SCALE = 0.5;
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
/** 描述行是否折叠：点击描述行切换，重新选中图片时复位。 */
let captionCollapsed = false;
/** 描述区是否由工具条按钮显式打开；裁剪态强制隐藏，退出后恢复。 */
let captionVisible = false;
/** 裁剪框是否挂着：由 imageCrop 通知，工具条据此标注裁剪按钮按下态。 */
let cropActive = false;
/** 当前编辑器视图：仅用于判断选中的图片是否仍在文档里（区分滚出视口与删除）。 */
let imageView: EditorView | null = null;
/** 工具条按下期间不把描述框的 blur 当成提交（否则点击「添加描述」会先关再开）。 */
let toolbarInteraction = false;
/**
 * 描述刚提交（blur/Enter）后的短窗口：同一次点击的 document 捕获监听与 IO
 * deselect 在此期间豁免，避免「点外部保存」把刚写回的标题连同选中态一起清掉。
 */
let captionCommitUntil = 0;
const CAPTION_COMMIT_WINDOW_MS = 300;

function captionJustCommitted(): boolean {
  return Date.now() < captionCommitUntil;
}

const CAPTION_PLACEHOLDER = "输入图片描述";

const TOOLBAR_VIEWPORT_MARGIN = 8;

export function getSelectedImageFrom(): number | null {
  return selection?.from ?? null;
}

export function setImageView(view: EditorView | null): void {
  imageView = view;
}

export function setImageToolbarActions(next: ImageToolbarActions): void {
  actions = next;
  updateDisabledStates();
}

export function selectImage(from: number, path: string, alt: string): void {
  selection = { from, path, alt };
  captionCollapsed = false;
  captionVisible = false;
  applySelection();
  ensureToolbar();
  setEditActive(false);
  setCaptionActive(false);
  updateAlignStates();
  updateResetVisibility();
  positionToolbar();
  bindScrollWatcher();
  bindViewportObserver();
  scheduleReposition();
}

export function deselectImage(): void {
  if (!selection) return;
  selection = null;
  captionVisible = false;
  clearScrollWatcher();
  if (viewportObserver) {
    viewportObserver.disconnect();
    viewportObserver = null;
  }
  applySelection();
  setEditActive(false);
  removeToolbar();
}

export function scheduleImageToolbarReposition(): void {
  scheduleReposition();
}

/**
 * 选中图片的文档偏移漂移了（上方键入 / 撤销）：把选中态迁到新偏移。
 *
 * 只在偏移真的变化时调用——纯文本输入每键都触发一次全量重定位会让工具条
 * 与图片在 WKWebView 上抖动（#1320）。
 */
export function moveImageSelection(
  nextFrom: number,
  nextDoc: { sliceString: (from: number, to: number) => string },
): void {
  if (!selection) return;
  // 判据是「映射后的偏移还落在图片引用上吗」，不是「偏移动了吗」——
  // 删除整块时 mapPos(0) 仍是 0，但图片已经不在文档里了。用事务的新文档
  // 判定，模块级 imageView 此刻还是旧 state。
  const stillInDoc = nextDoc.sliceString(nextFrom, nextFrom + 2) === "![";
  if (!stillInDoc) {
    deselectImage();
    return;
  }
  if (nextFrom === selection.from) return;
  selection = { ...selection, from: nextFrom };
  applySelection();
  // 滚动期偏移漂移：清隐藏态再定位，避免防抖定时器把新偏移的定位覆盖掉。
  setScrolling(false);
  updateResetVisibility();
  positionToolbar();
  bindScrollWatcher();
  bindViewportObserver();
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
  const caption = appendCaptionLine(el);
  applyCaptionVisibility(caption);
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

const CAPTION_TEXT_SELECTOR =
  ".cm-image-caption-text, .cm-image-caption-placeholder, .cm-image-caption-collapsed";

const CAPTION_COLLAPSED_TEXT = "显示描述";

/** 描述行文本态：折叠态显示「显示描述」，否则有标题显示标题、没有显示占位。 */
function setCaptionText(caption: HTMLElement, title: string): void {
  let span = caption.querySelector<HTMLElement>(CAPTION_TEXT_SELECTOR);
  if (!span) {
    span = document.createElement("span");
    caption.insertBefore(span, caption.firstChild);
  }
  if (captionCollapsed) {
    span.className = "cm-image-caption-collapsed";
    span.textContent = CAPTION_COLLAPSED_TEXT;
  } else {
    span.className =
      title === "" ? "cm-image-caption-placeholder" : "cm-image-caption-text";
    span.textContent = title === "" ? CAPTION_PLACEHOLDER : title;
  }
  caption.setAttribute("aria-expanded", captionCollapsed ? "false" : "true");
}

function captionInputOf(caption: HTMLElement): HTMLInputElement | null {
  return caption.querySelector<HTMLInputElement>(
    '[data-testid="img-caption-input"]',
  );
}

function showCaptionText(caption: HTMLElement): void {
  const span = caption.querySelector<HTMLElement>(CAPTION_TEXT_SELECTOR);
  if (span) span.style.display = "";
}

/**
 * 描述输入框：默认 `display:none` 挂在描述行里，点「添加描述」或占位行时
 * 才显示。Enter 提交、blur 提交、Esc 取消；收尾后移除输入框回到文本态。
 */
function createCaptionInput(
  caption: HTMLElement,
  widgetEl: HTMLElement,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "cm-image-caption-input";
  input.dataset.testid = "img-caption-input";
  input.style.display = "none";
  input.placeholder = CAPTION_PLACEHOLDER;
  input.setAttribute("aria-label", "图片描述");
  input.addEventListener("mousedown", (event) => event.stopPropagation());

  const finish = (value: string): void => {
    input.dataset.finishing = "1";
    const from = Number(widgetEl.dataset.imageFrom);
    const current = widgetEl.dataset.imageTitle ?? "";
    if (value === current) {
      setCaptionText(caption, current);
    } else {
      captionCommitUntil = Date.now() + CAPTION_COMMIT_WINDOW_MS;
      actions.onImageSetTitle?.(from, value);
    }
    input.remove();
    showCaptionText(caption);
    setCaptionActive(captionVisible);
    applyCaptionVisibility(caption);
  };

  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      finish(input.value.trim());
    } else if (event.key === "Escape") {
      event.preventDefault();
      input.dataset.finishing = "1";
      setCaptionText(caption, widgetEl.dataset.imageTitle ?? "");
      input.remove();
      showCaptionText(caption);
      setCaptionActive(captionVisible);
      applyCaptionVisibility(caption);
    }
  });
  // blur 也提交（非丢弃）。主动收尾 / 切换显隐时用标记跳过，避免二次写回。
  input.addEventListener("blur", () => {
    if (toolbarInteraction) return;
    if (input.dataset.finishing === "1" || input.dataset.closing === "1") {
      return;
    }
    finish(input.value.trim());
  });
  caption.appendChild(input);
  return input;
}

function showCaptionInput(caption: HTMLElement, widgetEl: HTMLElement): void {
  const input =
    captionInputOf(caption) ?? createCaptionInput(caption, widgetEl);
  const span = caption.querySelector<HTMLElement>(CAPTION_TEXT_SELECTOR);
  if (span) span.style.display = "none";
  delete input.dataset.closing;
  delete input.dataset.finishing;
  input.style.display = "";
  input.value = widgetEl.dataset.imageTitle ?? "";
  input.focus();
  input.select();
  setCaptionActive(true);
  applyCaptionVisibility(caption);
}

function hideCaptionInput(caption: HTMLElement, widgetEl: HTMLElement): void {
  const input = captionInputOf(caption);
  if (!input) return;
  const value = input.value.trim();
  const current = widgetEl.dataset.imageTitle ?? "";
  input.dataset.closing = "1";
  input.style.display = "none";
  showCaptionText(caption);
  setCaptionActive(false);
  applyCaptionVisibility(caption);
  if (value !== current) {
    captionCommitUntil = Date.now() + CAPTION_COMMIT_WINDOW_MS;
    actions.onImageSetTitle?.(Number(widgetEl.dataset.imageFrom), value);
  }
}

/**
 * 工具条「描述」：切换描述区显隐。默认隐藏；打开时回填已有标题并进入编辑，
 * 再点收起。
 */
export function editSelectedImageCaption(): void {
  if (!selection) return;
  const el = document.querySelector<HTMLElement>(
    `.cm-image-widget[data-image-from="${selection.from}"]`,
  );
  const caption = el?.querySelector<HTMLElement>(".cm-image-caption");
  if (!el || !caption) return;
  captionVisible = !captionVisible;
  setCaptionActive(captionVisible);
  if (!captionVisible) {
    hideCaptionInput(caption, el);
    return;
  }
  if (typeof actions.onImageSetTitle !== "function") return;
  captionCollapsed = false;
  showCaptionInput(caption, el);
}

function appendCaptionLine(el: HTMLElement): HTMLElement {
  const title = el.dataset.imageTitle ?? "";
  const caption = document.createElement("div");
  caption.className = "cm-image-caption";
  caption.dataset.testid = "img-caption";
  setCaptionText(caption, title);
  createCaptionInput(caption, el);
  // mousedown 不冒泡：CM6 会抢焦点，输入框还没聚焦就被打掉。
  caption.addEventListener("mousedown", (event) => event.stopPropagation());
  caption.addEventListener("click", (event) => {
    event.stopPropagation();
    const input = captionInputOf(caption);
    if (input && input.style.display !== "none") return;
    if (title === "") {
      if (typeof actions.onImageSetTitle !== "function") return;
      showCaptionInput(caption, el);
      return;
    }
    captionCollapsed = !captionCollapsed;
    setCaptionText(caption, title);
  });
  el.appendChild(caption);
  return caption;
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
  toolbarEl.addEventListener("pointerdown", () => {
    toolbarInteraction = true;
    window.setTimeout(() => {
      toolbarInteraction = false;
    }, 0);
  });
  toolbarEl.addEventListener("click", () => {
    toolbarInteraction = false;
  });
  updateDisabledStates();
  updateCropState();
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

function updateCropState(): void {
  if (!toolbarEl) return;
  const btn = toolbarEl.querySelector<HTMLButtonElement>(
    '[data-testid="img-toolbar-crop"]',
  );
  if (!btn) return;
  btn.classList.toggle("is-active", cropActive);
  btn.setAttribute("aria-pressed", cropActive ? "true" : "false");
}

/**
 * 「重置图片」按钮可见性（E-39）：仅当当前选中图片已有 crop 属性时出现。
 * 判据用 widget DOM 上的 `.image-crop-window`（有 crop 时 toDOM 才渲染它），
 * 不重新解析文档。DOM 常驻，只切 display，不重建工具条。
 */
function updateResetVisibility(): void {
  if (!toolbarEl || !selection) return;
  const btn = toolbarEl.querySelector<HTMLButtonElement>(
    '[data-testid="img-toolbar-reset"]',
  );
  if (!btn) return;
  const el = document.querySelector<HTMLElement>(
    `.cm-image-widget[data-image-from="${selection.from}"]`,
  );
  const hasCrop = !!el?.querySelector(".image-crop-window");
  btn.style.display = hasCrop ? "" : "none";
}

/** 「添加描述」按钮选中态：与描述输入区显隐同步（默认未选中）。 */
function setCaptionActive(active: boolean): void {
  const btn = toolbarEl?.querySelector<HTMLButtonElement>(
    '[data-testid="img-toolbar-comment"]',
  );
  if (!btn) return;
  btn.classList.toggle("is-active", active);
  btn.setAttribute("aria-pressed", active ? "true" : "false");
}

/** 「AI 编辑」按钮选中态：默认不选中，仅由显式调用决定。 */
function setEditActive(active: boolean): void {
  const btn = toolbarEl?.querySelector<HTMLButtonElement>(
    '[data-testid="img-toolbar-ai"]',
  );
  if (!btn) return;
  btn.classList.toggle("is-active", active);
  btn.setAttribute("aria-pressed", active ? "true" : "false");
}

/** 描述区实际显隐：按钮打开且不在裁剪态。 */
function captionDisplayed(): boolean {
  return captionVisible && !cropActive;
}

function applyCaptionVisibility(caption: HTMLElement): void {
  caption.style.display = captionDisplayed() ? "" : "none";
}

/** 裁剪框开关：imageCrop 在挂载 / 收尾时调用，工具条同步按下态并强制隐藏描述区。 */
export function notifyImageCropState(active: boolean): void {
  cropActive = active;
  updateCropState();
  updateResetVisibility();
  const el = selection
    ? document.querySelector<HTMLElement>(
        `.cm-image-widget[data-image-from="${selection.from}"]`,
      )
    : null;
  const caption = el?.querySelector<HTMLElement>(".cm-image-caption");
  if (caption) applyCaptionVisibility(caption);
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
    case "reset":
      return typeof actions.onImageReset === "function";
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
    case "reset":
      actions.onImageReset?.(from);
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

function selectedImageStillInDoc(): boolean {
  if (!imageView || !selection) return false;
  const doc = imageView.state.doc.toString();
  return (
    doc.charAt(selection.from) === "!" && doc.charAt(selection.from + 1) === "["
  );
}

function positionToolbar(): void {
  if (!toolbarEl || !selection) return;
  // 滚动期一律不读布局：读到的滚动位置滞后于当前帧，写回就是逐帧追图。
  if (scrolling) return;
  updateResetVisibility();
  const el = document.querySelector<HTMLElement>(
    `.cm-image-widget[data-image-from="${selection.from}"]`,
  );
  if (!el) {
    // 图片仍在文档里：只是滚出视口被 CM6 卸载了 widget——收起工具条但保留
    // 选中，滚回时由 widget 的 toDOM 重新套选中态。只有文档里也不再有
    // 该图片（删除 / 剪切）才收掉选中态。
    if (selectedImageStillInDoc()) {
      toolbarEl.style.display = "none";
      return;
    }
    deselectImage();
    return;
  }

  // 先显示再测量：隐藏态的 getBoundingClientRect 全为 0，无法夹取。
  toolbarEl.style.display = "";
  const rect = el.getBoundingClientRect();
  const toolbarRect = toolbarEl.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const margin = TOOLBAR_VIEWPORT_MARGIN;

  // 目标：工具条底边中点贴在图片上方 margin 处；transform 为
  // translate(-50%, -100%)，所以 left/top 是渲染左上角偏移后的锚点。
  const centerX = rect.left + rect.width / 2;
  const anchorY = rect.top - margin;
  const halfW = toolbarRect.width / 2;
  const left = Math.min(
    Math.max(margin + halfW, centerX),
    viewportW - margin - halfW,
  );
  const top = Math.min(
    Math.max(margin + toolbarRect.height, anchorY),
    viewportH - margin,
  );
  toolbarEl.style.left = `${left}px`;
  toolbarEl.style.top = `${top}px`;
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

/** 工具条进入 / 退出滚动隐藏态。class 是唯一判据，CSS 负责 display。 */
function setScrolling(next: boolean): void {
  if (!toolbarEl || scrolling === next) return;
  scrolling = next;
  toolbarEl.classList.toggle("is-scrolling", next);
}

/**
 * 滚动期隐藏（方案A）：滚动事件只置标志 + 起防抖，不做任何位置重算；
 * 停滚防抖到期后清标志并一次定位，工具条在图片当前位置重现。
 */
function onToolbarScroll(): void {
  setScrolling(true);
  if (scrollDebounce !== null) window.clearTimeout(scrollDebounce);
  scrollDebounce = window.setTimeout(() => {
    scrollDebounce = null;
    setScrolling(false);
    positionToolbar();
    updateAlignStates();
  }, SCROLL_DEBOUNCE_MS);
}

function clearScrollWatcher(): void {
  if (scrollDebounce !== null) {
    window.clearTimeout(scrollDebounce);
    scrollDebounce = null;
  }
  setScrolling(false);
  if (scrollTarget && onScrollTarget) {
    scrollTarget.removeEventListener("scroll", onScrollTarget);
  }
  scrollTarget = null;
  onScrollTarget = null;
}

/**
 * 滚动判定挂当前选中图片所在的编辑器滚动容器（`.cm-scroller`），passive。
 * 多 panel / 多编辑器实例各挂自己的 scroller，切图时先解绑旧的。
 */
function bindScrollWatcher(): void {
  clearScrollWatcher();
  if (!selection) return;
  const el = document.querySelector<HTMLElement>(
    `.cm-image-widget[data-image-from="${selection.from}"]`,
  );
  const scroller = el?.closest(".cm-scroller") as HTMLElement | null;
  if (!scroller) return;
  scrollTarget = scroller;
  onScrollTarget = onToolbarScroll;
  scroller.addEventListener("scroll", onToolbarScroll, { passive: true });
}

/**
 * 视口判定改 IntersectionObserver：图片完全离开视口时隐藏工具条并清选中态，
 * 不再由 positionToolbar 逐帧读 rect 判断。观察对象随选中图片切换。
 */
function bindViewportObserver(): void {
  if (viewportObserver) {
    viewportObserver.disconnect();
    viewportObserver = null;
  }
  if (!selection) return;
  const el = document.querySelector<HTMLElement>(
    `.cm-image-widget[data-image-from="${selection.from}"]`,
  );
  if (!el || typeof IntersectionObserver !== "function") return;
  viewportObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      // 已脱离文档的旧 widget（属性编辑触发重建后旧元素被替换）ratio 同样是 0，
      // 但那是「观察目标失效」而非「图片离开视口」——据此 deselect 会误清活选中态。
      if (!entry.target.isConnected) return;
      if (captionJustCommitted()) return;
      if (entry.intersectionRatio === 0) {
        deselectImage();
      }
    },
    { threshold: [0, 1] },
  );
  viewportObserver.observe(el);
}

/** 缩放 UI 同步钩子：由 openImageMaximize 注入，滚轮/捏合/按钮/复位共用。 */
let maximizeRefreshUi: (() => void) | null = null;

function maximizeApplyTransform(): void {
  if (!maximizeImg) return;
  const { scale, tx, ty, rotation } = maximizeTransform;
  maximizeImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rotation}deg)`;
  maximizeRefreshUi?.();
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
  tooltip?: MaximizeTooltip,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.testid = testid;
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.style.cssText =
    "width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid var(--app-border);border-radius:var(--app-radius);background:var(--app-surface);color:inherit;cursor:pointer;";
  btn.appendChild(renderIcon(icon));
  btn.addEventListener("click", onClick);
  tooltip?.bind(btn, label);
  return btn;
}

/** 悬停延迟：与全局胶囊提示同档（200-300ms 内），不新引入配置项。 */
const MAXIMIZE_TOOLTIP_DELAY_MS = 250;

interface MaximizeTooltip {
  bind(button: HTMLButtonElement, label: string): void;
  destroy(): void;
}

/**
 * 放大层自制气泡提示（#1563）。
 *
 * macOS WKWebView 基本不渲染原生 `title`，按钮写了也看不见；这里挂 body
 * （`position:fixed`，不被浮层裁剪）自绘深灰气泡，悬停满 250ms 出现、移开
 * 即消失。全局 TooltipLayer 只接管带 `title` 的元素，气泡类名独立
 * （`cm-image-max-tooltip`），两者互不干扰。
 */
function createMaximizeTooltip(): MaximizeTooltip {
  let bubble: HTMLDivElement | null = null;
  let timer: number | null = null;
  let anchor: HTMLButtonElement | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const hide = (): void => {
    clearTimer();
    anchor = null;
    bubble?.remove();
    bubble = null;
  };

  const show = (btn: HTMLButtonElement, label: string): void => {
    clearTimer();
    anchor = btn;
    timer = window.setTimeout(() => {
      timer = null;
      if (anchor !== btn) return;
      const rect = btn.getBoundingClientRect();
      const el = document.createElement("div");
      el.className = "cm-image-max-tooltip";
      el.dataset.testid = "img-max-tooltip";
      el.setAttribute("role", "tooltip");
      el.textContent = label;
      el.style.left = `${rect.left + rect.width / 2}px`;
      el.style.top = `${rect.top - 8}px`;
      document.body.appendChild(el);
      bubble = el;
    }, MAXIMIZE_TOOLTIP_DELAY_MS);
  };

  return {
    bind(btn: HTMLButtonElement, label: string): void {
      btn.addEventListener("pointerenter", () => show(btn, label));
      btn.addEventListener("pointerleave", hide);
      btn.addEventListener("pointerdown", hide);
      btn.addEventListener("blur", hide);
    },
    destroy: hide,
  };
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

export interface MaximizeImageItem {
  readonly src: string | null;
  readonly alt: string;
  readonly crop?: [number, number, number, number] | null;
  /** 文档偏移；多图切换时「重置图片」只对当前图生效。 */
  readonly from?: number;
}

export interface OpenImageMaximizeOptions {
  /** 多图列表（#1564 消费）；缺省 = 单图模式，向后兼容既有调用。 */
  readonly images?: readonly MaximizeImageItem[];
  /** `images` 中的初始索引；缺省 0。 */
  readonly index?: number;
}

export function openImageMaximize(
  src: string | null,
  alt: string,
  crop?: [number, number, number, number] | null,
  from?: number,
  options?: OpenImageMaximizeOptions,
): void {
  closeImageMaximize();
  const items = options?.images?.length
    ? options.images
    : [{ src, alt, crop, from }];
  const startIndex = Math.min(
    Math.max(options?.index ?? 0, 0),
    items.length - 1,
  );
  let currentIndex = startIndex;
  const overlay = document.createElement("div");
  overlay.className = "cm-image-maximize";
  overlay.dataset.testid = "img-maximize";
  overlay.style.touchAction = "none";
  overlay.style.userSelect = "none";

  const tooltip = createMaximizeTooltip();

  const stage = document.createElement("div");
  stage.style.cssText =
    "display:flex;align-items:center;justify-content:center;max-width:90vw;max-height:90vh;";
  overlay.appendChild(stage);

  const multi = items.length > 1;
  const zoomOutBtn = maximizeControlButton(
    "img-max-zoom-out",
    "缩小",
    "ZoomOutOutlined",
    () => {
      maximizeZoom(
        maximizeTransform.scale / MAXIMIZE_WHEEL_STEP,
        window.innerWidth / 2,
        window.innerHeight / 2,
      );
    },
    tooltip,
  );
  const zoomInBtn = maximizeControlButton(
    "img-max-zoom-in",
    "放大",
    "ZoomInOutlined",
    () => {
      maximizeZoom(
        maximizeTransform.scale * MAXIMIZE_WHEEL_STEP,
        window.innerWidth / 2,
        window.innerHeight / 2,
      );
    },
    tooltip,
  );
  const scaleLabel = document.createElement("span");
  scaleLabel.dataset.testid = "img-max-scale";
  scaleLabel.style.cssText =
    "align-self:center;min-width:44px;text-align:center;font-size:12px;font-variant-numeric:tabular-nums;color:var(--app-text-2);";

  /** 缩放变化后同步百分比与 ± 按钮的边界禁用态。 */
  function refreshZoomUi(): void {
    scaleLabel.textContent = `${Math.round(maximizeTransform.scale * 100)}%`;
    zoomOutBtn.disabled = maximizeTransform.scale <= MAXIMIZE_MIN_SCALE;
    zoomInBtn.disabled = maximizeTransform.scale >= MAXIMIZE_MAX_SCALE;
  }
  const prevBtn = maximizeControlButton(
    "img-max-prev",
    "上一张",
    "ChevronLeftOutlined",
    () => {
      if (currentIndex > 0) {
        currentIndex -= 1;
        renderCurrent();
      }
    },
    tooltip,
  );
  const indexLabel = document.createElement("span");
  indexLabel.dataset.testid = "img-max-index";
  indexLabel.style.cssText =
    "align-self:center;min-width:36px;text-align:center;font-size:12px;font-variant-numeric:tabular-nums;color:var(--app-text-2);";
  const nextBtn = maximizeControlButton(
    "img-max-next",
    "下一张",
    "ChevronRightOutlined",
    () => {
      if (currentIndex < items.length - 1) {
        currentIndex += 1;
        renderCurrent();
      }
    },
    tooltip,
  );
  const clearCropBtn = maximizeControlButton(
    "img-max-clear-crop",
    "重置图片",
    "RotateOutlined",
    () => {
      const item = items[currentIndex];
      if (typeof item.from === "number") actions.onImageReset?.(item.from);
      closeImageMaximize();
    },
    tooltip,
  );

  /** 切换后同步索引文本、两侧按钮禁用态、裁剪按钮挂载（无 crop 不挂载）。 */
  function refreshNavUi(): void {
    if (multi) {
      indexLabel.textContent = `${currentIndex + 1}/${items.length}`;
      prevBtn.disabled = currentIndex <= 0;
      nextBtn.disabled = currentIndex >= items.length - 1;
    }
    const hasCrop = Boolean(items[currentIndex].crop);
    const mounted = clearCropBtn.isConnected;
    if (hasCrop && !mounted) {
      controls.appendChild(clearCropBtn);
    } else if (!hasCrop && mounted) {
      clearCropBtn.remove();
    }
  }

  /**
   * 渲染当前项。裁剪走画布重绘（与编辑态同一区域）；无 src 出文字回退。
   * 切换时整体替换 stage 内容，缩放/平移/旋转重置为该图默认。
   */
  const renderCurrent = (): void => {
    const current = items[currentIndex];
    stage.replaceChildren();
    let nextImg: HTMLImageElement | null = null;
    if (current.src) {
      const img = document.createElement("img");
      img.src = current.src;
      img.alt = current.alt;
      img.draggable = false;
      if (current.crop) {
        // 兜底渲染（加载期间）：object-fit:none 平移到 (l,t)，1:1 不缩放——
        // 区域与编辑态不一致，只作过渡。
        const [l, t, w, h] = current.crop;
        img.style.objectFit = "none";
        img.style.objectPosition = `${-l}px ${-t}px`;
        img.style.width = `${w}px`;
        img.style.height = `${h}px`;
        // 随后用画布按裁剪矩形重绘（双击放大应看到「裁出来的那块」，与编辑态
        // 同一区域），替换 src；画布被污染或来源未解码时保留兜底渲染。
        const target = img;
        const source = new Image();
        source.crossOrigin = "anonymous";
        source.onload = () => {
          if (maximizeImg !== target) return;
          try {
            const cap = 2048;
            const k = Math.min(1, cap / Math.max(w, h));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(w * k));
            canvas.height = Math.max(1, Math.round(h * k));
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(
              source,
              l,
              t,
              w,
              h,
              0,
              0,
              canvas.width,
              canvas.height,
            );
            target.src = canvas.toDataURL("image/png");
            target.style.objectFit = "";
            target.style.objectPosition = "";
            target.style.width = "";
            target.style.height = "";
          } catch {
            /* tainted canvas：保留 1:1 兜底渲染 */
          }
        };
        source.src = current.src;
      }
      stage.appendChild(img);
      nextImg = img;
    } else {
      const fallback = document.createElement("span");
      fallback.textContent = `[图片: ${current.alt}]`;
      stage.appendChild(fallback);
    }
    maximizeImg = nextImg;
    maximizeTransform = { scale: 1, tx: 0, ty: 0, rotation: 0 };
    maximizeApplyTransform();
    refreshZoomUi();
    refreshNavUi();
  };

  const controls = document.createElement("div");
  controls.dataset.testid = "img-max-controls";
  controls.style.cssText =
    "position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:2;padding:6px;border:1px solid var(--app-border);border-radius:var(--app-radius);background:var(--app-surface);box-shadow:var(--app-shadow);";

  // 多图切换（#1564）：仅当列表多于 1 张时出现。索引居中，两侧箭头。
  const nav = document.createElement("div");
  nav.dataset.testid = "img-max-nav";
  nav.style.cssText =
    "display:flex;align-items:center;gap:4px;padding:0 4px;border-right:1px solid var(--app-border);margin-right:4px;";

  controls.appendChild(zoomOutBtn);
  controls.appendChild(zoomInBtn);
  controls.appendChild(scaleLabel);
  if (multi) {
    nav.appendChild(prevBtn);
    nav.appendChild(indexLabel);
    nav.appendChild(nextBtn);
    controls.appendChild(nav);
  }
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
      tooltip,
    ),
  );
  controls.appendChild(
    maximizeControlButton(
      "img-max-download",
      "下载原图",
      "DownloadOutlined",
      () => {
        const item = items[currentIndex];
        if (!item.src) return;
        const a = document.createElement("a");
        a.href = item.src;
        a.download = maximizeDownloadName(item.src, item.alt);
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
      tooltip,
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
        refreshZoomUi();
      },
      tooltip,
    ),
  );
  controls.appendChild(
    maximizeControlButton(
      "img-max-close",
      "关闭预览",
      "CloseOutlined",
      () => {
        closeImageMaximize();
      },
      tooltip,
    ),
  );
  overlay.appendChild(controls);
  maximizeRefreshUi = refreshZoomUi;
  renderCurrent();

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
    refreshZoomUi();
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
    tooltip.destroy();
  };

  maximizeKeyHandler = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeImageMaximize();
      return;
    }
    if (!multi) return;
    if (event.key === "ArrowLeft" && currentIndex > 0) {
      event.stopPropagation();
      currentIndex -= 1;
      renderCurrent();
    } else if (event.key === "ArrowRight" && currentIndex < items.length - 1) {
      event.stopPropagation();
      currentIndex += 1;
      renderCurrent();
    }
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
  maximizeRefreshUi = null;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    if (captionJustCommitted()) return;
    const target = event.target as Node | null;
    if (target instanceof Element) {
      if (target.closest(".cm-image-widget")) return;
      if (target.closest('[data-testid="img-toolbar"]')) return;
      if (target.closest('[data-testid="img-maximize"]')) return;
    }
    deselectImage();
  });
  window.addEventListener("resize", () => {
    bindScrollWatcher();
    scheduleReposition();
  });
}
