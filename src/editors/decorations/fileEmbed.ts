/* 插入文件内嵌渲染（editor-surface-batch19 D10 / B5a，#850）。
 *
 * `![name](file.pdf|file.md|file.html|https://…)` 这类引用不再退化成文件名 /
 * 链接卡片，而是在正文里内嵌**真实内容**：
 * - pdf：读字节后交给 iframe（WKWebView / Chromium 自带 PDF 查看器）。
 * - md：读文件内容，复用预览渲染管线 `renderMarkdown` 渲染成排版 HTML。
 * - html：asset URL 直载 iframe（与 `HtmlPreview` live 模式同机制）。
 * - web：外部链接直接 iframe。
 *
 * 默认高度约一屏（取 `.cm-content` 可视高与视口高的较小值）；选中后出 8 个
 * 把手，拖拽改高宽并写回同一 `{width=… height=…}` 属性语法（与图片共用
 * `applyImageSize`）；内容区 `overflow:auto`，可滚动。
 *
 * 装饰层不依赖应用层资源：路径 → URL / 绝对路径的解析由宿主通过
 * `resolveEmbed` 注入（见 `EditorDecorationsOptions`）。
 */
import { EditorView, WidgetType } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { renderIcon } from "../icons";
import { IMAGE_RESIZE_HANDLES } from "./imageToolbar";
import {
  applyImageSize,
  EMPTY_IMAGE_ATTRIBUTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
  MIN_IMAGE_HEIGHT,
  MIN_IMAGE_WIDTH,
  parseImageAttributes,
  scanImageReference,
  writeImageAttributes,
} from "./image";
import { appendFileTypeIcon } from "./image";
import {
  AUDIO_EXT,
  IMAGE_EXT,
  VIDEO_EXT,
  isExternalHref,
  resolveDocMediaHref,
  stripAngleWrappers,
} from "../../lib/mediaUrl";
import { renderMarkdown } from "../../renderers/markdown";
import { loadPdfBytes } from "../../utils/pdfSource";
import { isTauriEnv } from "../../utils/tauri";
import { resolveScrollTarget } from "../../utils/scrollPosition";
import { useStore } from "../../stores/index";
import {
  PREVIEW_DEFAULT_H,
  PREVIEW_DEFAULT_W,
  PREVIEW_LEAVE_CLOSE_MS,
  anchorFromGrid,
  clampPreviewSize,
  shouldScheduleLeaveClose,
  type Box,
} from "../../lib/previewAnchor";

/** 可内嵌的文件类型；`web` 是外部链接页面。 */
export type FileEmbedKind = "pdf" | "md" | "html" | "web";

/** preview 态内容高度上限（px）；embed 态不设上限（走属性高度 / 默认一屏）。 */
export const PREVIEW_HEIGHT = 320;

/**
 * 宿主注入的解析结果：
 * - `url`：能直接放进 iframe `src` 的地址（asset / http / data）。
 * - `filePath`：本地绝对路径，pdf / md 读取内容用；web 为 null。
 */
export interface FileEmbedResolution {
  url: string | null;
  filePath: string | null;
  /** 宿主文档绝对路径；滚动定格按文档级 view-state 键控需要它。 */
  docPath?: string | null;
}

/** 路径解析器；返回 null 表示当前环境读不了该文件（退回占位）。 */
export type FileEmbedResolver = (path: string) => FileEmbedResolution | null;

// --- 分类 --------------------------------------------------------------------

/** 去掉 query/hash 后的小写扩展名；没有扩展名时返回空串。 */
function extensionOf(path: string): string {
  const clean = path.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : "";
}

const HTTP_URL = /^https?:\/\//i;
const MARKDOWN_EXT = new Set(["md", "markdown", "mdx"]);
const HTML_EXT = new Set(["html", "htm"]);

/**
 * 判断一个媒体引用是否要内嵌渲染。
 *
 * - 外部 http(s)：扩展名是图片 / 视频 / 音频时仍交给既有媒体渲染（远程图 /
 *   远程视频），其余按内嵌网页处理。
 * - 本地 pdf / md / html：内嵌。
 * - 其余（含 zip 等）：返回 null，保持既有文件链接卡片。
 */
export function classifyFileEmbed(path: string): FileEmbedKind | null {
  const clean = stripAngleWrappers(path);
  if (HTTP_URL.test(clean)) {
    const ext = extensionOf(clean);
    if (
      ext !== "" &&
      (IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext))
    ) {
      return null;
    }
    return "web";
  }
  // 非 http(s) 的外部链接（data: / ftp: / #anchor）不劫持，保持既有行为。
  if (isExternalHref(clean)) return null;
  const ext = extensionOf(clean);
  if (ext === "pdf") return "pdf";
  if (MARKDOWN_EXT.has(ext)) return "md";
  if (HTML_EXT.has(ext)) return "html";
  return null;
}

// --- 三态（D10 / B5c → editor-refine-batch2 D3）------------------------------

/** 取引用路径的末段作显示名；URL 去掉 query/hash，纯锚点回退整串。 */
function baseNameOf(path: string): string {
  const clean = stripAngleWrappers(path).split(/[?#]/)[0];
  const slash = clean.lastIndexOf("/");
  const name = slash >= 0 ? clean.slice(slash + 1) : clean;
  return name || path;
}

/**
 * 三态：`card` 只显头部 / `preview` 头部 + 限高内容 / `embed` 全尺寸内容。
 * 取代旧的 `name | content` 两态。
 */
export type EmbedCardState = "card" | "preview" | "embed";

/** 旧两态值 → 三态：`name`（只显文件名）→ `card`；`content`（显内容）→ `embed`。 */
export function migrateLegacyEmbedState(value: string): EmbedCardState {
  if (value === "name") return "card";
  if (value === "content") return "embed";
  return "embed";
}

/**
 * 三态是会话态：键 = `文档路径\u0000内嵌路径`，与滚动定格同构。widget 重建
 * （编辑触发重算装饰）后仍按键恢复。
 */
const embedNameStates = new Map<string, EmbedCardState>();

function nameStateKey(
  docPath: string | null | undefined,
  path: string,
): string {
  return `${docPath ?? ""}\u0000${path}`;
}

function readEmbedState(
  docPath: string | null | undefined,
  path: string,
): EmbedCardState {
  return (
    embedNameStates.get(nameStateKey(docPath, path)) ?? "embed"
  );
}

function writeEmbedState(
  docPath: string | null | undefined,
  path: string,
  state: EmbedCardState,
): void {
  embedNameStates.set(nameStateKey(docPath, path), state);
}

/**
 * 描述副标题取值：`_alt` → `_title` → 文件类型描述。按 D3 的回落链恒有值，
 * 调用方总会渲染副标题。纯函数，单测覆盖各分支。
 */
export function embedDescriptionOf(
  kind: FileEmbedKind,
  alt: string,
  title: string | null,
): string {
  const cleanAlt = alt.trim();
  if (cleanAlt) return cleanAlt;
  const cleanTitle = title?.trim() ?? "";
  if (cleanTitle) return cleanTitle;
  if (kind === "pdf") return "PDF 文档";
  if (kind === "md") return "Markdown 文档";
  if (kind === "html") return "HTML 页面";
  return "网页";
}

/** 最近一次指针坐标：名称态离窗关闭要判断指针是否已滑入悬浮窗。 */
const lastPointer = { x: 0, y: 0 };
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (event) => {
      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
    },
    { passive: true },
  );
}

function rectToBox(rect: DOMRect | undefined): Box | null {
  if (!rect) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

// --- 选中态 ------------------------------------------------------------------

/** 当前选中的内嵌 widget 文档偏移；null 表示未选中。 */
let selectedEmbedFrom: number | null = null;

/** docx 等附件卡走 MediaWidget，选择态与内嵌 widget 共用同一偏移键。 */
const SELECTABLE_EMBED =
  ".cm-embed-widget, .cm-media-widget[data-media-kind='file']";

function markEmbedSelected(el: HTMLElement, isSelected: boolean): void {
  el.dataset.selected = isSelected ? "true" : "false";
  el.querySelectorAll(".cm-image-handle").forEach((handle) => handle.remove());
  if (!isSelected) return;
  // 附件卡尺寸走样式面板，不出缩放把手（卡片本身很小，把手会盖住内容）。
  if (el.classList.contains("cm-media-widget")) return;
  for (const { handle, cursor } of IMAGE_RESIZE_HANDLES) {
    const span = document.createElement("span");
    span.className = "cm-image-handle";
    span.dataset.handle = handle;
    span.style.cursor = cursor;
    span.title = "拖动调整内嵌大小";
    el.appendChild(span);
  }
}

export function selectEmbed(from: number): void {
  selectedEmbedFrom = from;
  document.querySelectorAll<HTMLElement>(SELECTABLE_EMBED).forEach((el) => {
    const raw = el.dataset.embedFrom ?? el.dataset.mediaFrom;
    const elFrom = raw !== undefined ? Number(raw) : null;
    markEmbedSelected(el, elFrom !== null && elFrom === selectedEmbedFrom);
  });
  const selected = selectedEmbedEl();
  const kind = selected?.dataset.embedKind;
  if (kind === "md" || selected?.classList.contains("cm-media-widget")) {
    ensureEmbedPanel();
    scheduleEmbedPanelReposition();
  }
}

function clearEmbedSelection(): void {
  selectedEmbedFrom = null;
  document.querySelectorAll<HTMLElement>(SELECTABLE_EMBED).forEach((el) => {
    markEmbedSelected(el, false);
  });
  removeEmbedPanel();
}

export function isEmbedSelected(from: number): boolean {
  return selectedEmbedFrom === from;
}

// --- 样式面板（md / docx）----------------------------------------------------

type EmbedAlign = "left" | "center" | "right";

let embedPanelEl: HTMLElement | null = null;
let embedRepositionFrame: number | null = null;

function selectedEmbedEl(): HTMLElement | null {
  if (selectedEmbedFrom === null) return null;
  return (
    document.querySelector<HTMLElement>(
      `.cm-embed-widget[data-embed-from="${selectedEmbedFrom}"]`,
    ) ??
    document.querySelector<HTMLElement>(
      `.cm-media-widget[data-media-from="${selectedEmbedFrom}"]`,
    )
  );
}

function ensureEmbedPanel(): HTMLElement {
  if (embedPanelEl) return embedPanelEl;
  const panel = document.createElement("div");
  panel.className = "cm-embed-panel";
  panel.dataset.testid = "embed-panel";

  const expand = document.createElement("button");
  expand.type = "button";
  expand.dataset.testid = "embed-panel-expand";
  expand.title = "展开全屏";
  expand.setAttribute("aria-label", "展开全屏");
  expand.appendChild(renderIcon("ExpandOutlined"));
  expand.addEventListener("click", () => openSelectedEmbedExternally());
  panel.appendChild(expand);

  const sepExpand = document.createElement("span");
  sepExpand.className = "cm-embed-panel-sep";
  panel.appendChild(sepExpand);

  const aligns: ReadonlyArray<{
    key: EmbedAlign;
    icon: string;
    label: string;
  }> = [
    { key: "left", icon: "AlignLeftOutlined", label: "左对齐" },
    { key: "center", icon: "AlignCenterOutlined", label: "居中" },
    { key: "right", icon: "AlignRightOutlined", label: "右对齐" },
  ];
  for (const item of aligns) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.testid = `embed-panel-align-${item.key}`;
    btn.title = item.label;
    btn.setAttribute("aria-label", item.label);
    btn.appendChild(renderIcon(item.icon));
    btn.addEventListener("click", () => alignSelectedEmbed(item.key));
    panel.appendChild(btn);
  }

  const sep = document.createElement("span");
  sep.className = "cm-embed-panel-sep";
  panel.appendChild(sep);

  const modes: ReadonlyArray<{
    key: EmbedCardState;
    label: string;
    icon: string;
  }> = [
    { key: "card", label: "文本视图", icon: "ListOutlined" },
    { key: "preview", label: "卡片视图", icon: "CheckBoxOutlineBlankOutlined" },
    { key: "embed", label: "预览视图", icon: "ImageOutlined" },
  ];
  for (const item of modes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.testid = `embed-panel-state-${item.key}`;
    btn.title = item.label;
    btn.setAttribute("aria-label", item.label);
    btn.appendChild(renderIcon(item.icon));
    btn.addEventListener("click", () => setEmbedCardState(item.key));
    panel.appendChild(btn);
  }

  document.body.appendChild(panel);
  embedPanelEl = panel;
  updateEmbedPanelAlign();
  updateEmbedPanelState();
  return panel;
}

/** 工具条「展开全屏」：复用既有系统打开路径（open_file_external）。 */
function openSelectedEmbedExternally(): void {
  const el = selectedEmbedEl();
  const filePath = el?.dataset.embedPath ?? null;
  if (!filePath) return;
  void invoke("open_file_external", { path: filePath }).catch(() => {});
}

function removeEmbedPanel(): void {
  embedPanelEl?.remove();
  embedPanelEl = null;
}

function updateEmbedPanelAlign(): void {
  if (!embedPanelEl) return;
  const el = selectedEmbedEl();
  const align = (el?.dataset.align as EmbedAlign | undefined) ?? "center";
  for (const key of ["left", "center", "right"] as const) {
    const btn = embedPanelEl.querySelector<HTMLButtonElement>(
      `[data-testid="embed-panel-align-${key}"]`,
    );
    btn?.setAttribute("aria-pressed", key === align ? "true" : "false");
  }
  updateEmbedPanelState();
}

function updateEmbedPanelState(): void {
  if (!embedPanelEl) return;
  const el = selectedEmbedEl();
  const state = (el?.dataset.embedState as EmbedCardState | undefined) ?? "embed";
  for (const key of ["card", "preview", "embed"] as const) {
    const btn = embedPanelEl.querySelector<HTMLButtonElement>(
      `[data-testid="embed-panel-state-${key}"]`,
    );
    btn?.setAttribute("aria-pressed", key === state ? "true" : "false");
  }
}

/** 工具条三态切换：写会话态 + 就地套用到选中 widget（不重建，保留滚动定格）。 */
function setEmbedCardState(state: EmbedCardState): void {
  const el = selectedEmbedEl();
  if (!el) return;
  const path = el.dataset.embedPath;
  if (path) writeEmbedState(el.dataset.embedDocPath || null, path, state);
  el.dataset.embedState = state;
  applyCardStateToDOM(el, state);
  updateEmbedPanelState();
}

/**
 * 三态到 DOM 的纯映射：card 隐藏 body、preview 限高、embed 全尺寸。
 * 高度只在非 card 态落内联值，避免 card 态残留高度影响头部布局。
 */
function applyCardStateToDOM(el: HTMLElement, state: EmbedCardState): void {
  const body = el.querySelector<HTMLElement>(".cm-embed-body");
  const frame = el.querySelector<HTMLElement>(".cm-embed-frame");
  const name = el.querySelector<HTMLElement>(".cm-embed-name");
  if (name) name.style.display = state === "embed" ? "none" : "";
  if (!body || !frame) return;
  if (state === "card") {
    body.style.display = "none";
    frame.style.height = "auto";
    return;
  }
  body.style.display = "";
  const height = el.dataset.height;
  if (height) {
    frame.style.height = `${height}px`;
  } else if (state === "preview") {
    frame.style.height = `${PREVIEW_HEIGHT}px`;
  } else {
    frame.style.height = "";
  }
}

function alignSelectedEmbed(align: EmbedAlign): void {
  const from = selectedEmbedFrom;
  const el = from === null ? null : selectedEmbedEl();
  const view = el ? EditorView.findFromDOM(el) : null;
  if (from === null || !view) return;
  const ref = scanImageReference(view.state.doc.toString(), from);
  if (!ref) return;
  const attrs =
    ref.attrText !== null
      ? parseImageAttributes(ref.attrText)
      : { ...EMPTY_IMAGE_ATTRIBUTES };
  // 内嵌 / 附件卡的默认对齐是 left（`MediaWidget` / `FileEmbedWidget` 的
  // `?? "left"`），center 必须显式写回：写成 null 会被序列化成空属性块，
  // 装饰重建后 data-align 回落 left，面板「居中」看起来没生效（#1411）。
  attrs.align = align;
  writeImageAttributes(view, from, attrs);
}

function positionEmbedPanel(): void {
  if (!embedPanelEl) return;
  const el = selectedEmbedEl();
  if (!el) {
    embedPanelEl.style.display = "none";
    return;
  }
  const rect = el.getBoundingClientRect();
  if (
    rect.bottom < 0 ||
    rect.top > window.innerHeight ||
    rect.right < 0 ||
    rect.left > window.innerWidth
  ) {
    embedPanelEl.style.display = "none";
    return;
  }
  embedPanelEl.style.display = "";
  const panelRect = embedPanelEl.getBoundingClientRect();
  const margin = 8;
  const centerX = rect.left + rect.width / 2;
  const anchorY = rect.top - margin;
  const halfW = panelRect.width / 2;
  const left = Math.min(
    Math.max(margin + halfW, centerX),
    window.innerWidth - margin - halfW,
  );
  const top = Math.min(
    Math.max(margin + panelRect.height, anchorY),
    window.innerHeight - margin,
  );
  embedPanelEl.style.left = `${left}px`;
  embedPanelEl.style.top = `${top}px`;
  updateEmbedPanelAlign();
}

export function scheduleEmbedPanelReposition(): void {
  if (embedRepositionFrame !== null) return;
  if (typeof requestAnimationFrame === "function") {
    embedRepositionFrame = requestAnimationFrame(() => {
      embedRepositionFrame = null;
      positionEmbedPanel();
    });
  } else {
    positionEmbedPanel();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const target = event.target as Node | null;
    if (target instanceof Element) {
      if (target.closest(".cm-embed-widget")) return;
      if (target.closest(".cm-media-widget")) return;
      if (target.closest('[data-testid="embed-panel"]')) return;
    }
    clearEmbedSelection();
  });
  document.addEventListener("scroll", scheduleEmbedPanelReposition, true);
  window.addEventListener("resize", scheduleEmbedPanelReposition);
}

// --- 尺寸 --------------------------------------------------------------------

function clampWidth(value: number): number {
  return Math.max(MIN_IMAGE_WIDTH, Math.min(value, MAX_IMAGE_WIDTH));
}

function clampHeight(value: number): number {
  return Math.max(MIN_IMAGE_HEIGHT, Math.min(value, MAX_IMAGE_HEIGHT));
}

// --- 滚动定格（D10 / B5b）----------------------------------------------------

/**
 * 内嵌内容的滚动面。md 由外层容器自己滚；pdf / html / 网页是 iframe 内部滚，
 * 只有同源（本地 asset / blob）才读得到 scrollTop，跨域 iframe 拿不到。
 */
interface EmbedScrollSurface {
  read(): { scrollPos: number; contentHeight: number } | null;
  metrics(): { scrollHeight: number; clientHeight: number };
  write(scrollPos: number): void;
  onScroll(listener: () => void): () => void;
  onPointerLeave(listener: () => void): () => void;
}

function domScrollSurface(el: HTMLElement): EmbedScrollSurface {
  return {
    read: () => ({ scrollPos: el.scrollTop, contentHeight: el.scrollHeight }),
    metrics: () => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }),
    write: (scrollPos) => {
      el.scrollTop = scrollPos;
    },
    onScroll: (listener) => {
      el.addEventListener("scroll", listener, { passive: true });
      return () => el.removeEventListener("scroll", listener);
    },
    onPointerLeave: (listener) => {
      el.addEventListener("pointerleave", listener);
      return () => el.removeEventListener("pointerleave", listener);
    },
  };
}

function iframeScrollSurface(
  iframe: HTMLIFrameElement,
): EmbedScrollSurface | null {
  try {
    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!win || !doc) return null;
    const scroller = doc.scrollingElement ?? doc.documentElement;
    return {
      read: () => ({
        scrollPos: scroller.scrollTop,
        contentHeight: scroller.scrollHeight,
      }),
      metrics: () => ({
        scrollHeight: scroller.scrollHeight,
        clientHeight: iframe.clientHeight,
      }),
      write: (scrollPos) => win.scrollTo(0, scrollPos),
      onScroll: (listener) => {
        win.addEventListener("scroll", listener, { passive: true });
        return () => win.removeEventListener("scroll", listener);
      },
      onPointerLeave: (listener) => {
        doc.addEventListener("pointerleave", listener, true);
        return () => doc.removeEventListener("pointerleave", listener, true);
      },
    };
  } catch {
    return null;
  }
}

/** 单个内嵌 widget 的定格生命周期：指针移出即写回，内容就绪时恢复。 */
class EmbedScrollFreeze {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flush: (() => void) | null = null;
  private cleanups: Array<() => void> = [];

  constructor(
    private readonly key: string,
    private readonly surface: EmbedScrollSurface,
    private readonly leaveTarget: HTMLElement,
  ) {}

  attach(): void {
    const capture = (): void => {
      const pos = this.surface.read();
      if (!pos || pos.contentHeight <= 0) return;
      useStore
        .getState()
        .setEmbedScrollPos(this.key, pos.scrollPos, pos.contentHeight);
    };
    const restore = (): void => {
      const record = useStore.getState().embedScrollPositions[this.key];
      const metrics = this.surface.metrics();
      const target = resolveScrollTarget(
        record,
        metrics.scrollHeight,
        metrics.clientHeight,
      );
      if (target !== null && target > 0) this.surface.write(target);
    };

    this.leaveTarget.addEventListener("pointerleave", capture);
    this.cleanups.push(() =>
      this.leaveTarget.removeEventListener("pointerleave", capture),
    );
    this.cleanups.push(this.surface.onPointerLeave(capture));
    this.flush = capture;
    this.cleanups.push(
      this.surface.onScroll(() => {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(capture, 400);
      }),
    );

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(restore);
    } else {
      restore();
    }
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    // 去抖未落定的最后一次滚动在关停前补写，避免快速关页签丢定格。
    this.flush?.();
    this.flush = null;
    for (const off of this.cleanups) off();
    this.cleanups = [];
  }
}

// --- 内容渲染 ----------------------------------------------------------------

function appendFallback(body: HTMLElement, message: string): void {
  const el = document.createElement("div");
  el.className = "cm-embed-fallback";
  el.textContent = message;
  body.appendChild(el);
}

/** pdf：读字节 → Blob URL → iframe。字节来自文件本身，不是文件名。 */
function renderPdfBody(
  body: HTMLElement,
  filePath: string | null,
  title: string,
  onReady?: () => void,
): void {
  if (!filePath) {
    appendFallback(body, "无法读取 PDF：文档未保存或路径无法解析");
    return;
  }
  const loading = document.createElement("div");
  loading.className = "cm-embed-loading";
  loading.textContent = "正在加载 PDF…";
  body.appendChild(loading);

  void loadPdfBytes(filePath).then((result) => {
    if (!body.isConnected) return;
    if (!result.ok) {
      loading.className = "cm-embed-fallback";
      loading.textContent = result.error;
      return;
    }
    const blob = new Blob([result.bytes.slice()], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.className = "cm-embed-iframe";
    iframe.setAttribute("src", url);
    iframe.setAttribute("title", title || "内嵌 PDF");
    body.replaceChild(iframe, loading);
    onReady?.();
  });
}

/** md：读文件内容 → 复用预览渲染管线 → 排版 HTML。 */
function renderMarkdownBody(
  body: HTMLElement,
  filePath: string | null,
  onReady?: () => void,
): void {
  if (!filePath) {
    appendFallback(body, "无法读取内嵌 Markdown：文档未保存或路径无法解析");
    return;
  }
  const loading = document.createElement("div");
  loading.className = "cm-embed-loading";
  loading.textContent = "正在加载内嵌 Markdown…";
  body.appendChild(loading);

  if (!isTauriEnv()) {
    loading.className = "cm-embed-fallback";
    loading.textContent = "无法读取内嵌 Markdown：需在 Tauri 桌面环境中运行";
    return;
  }
  invoke<{ content: string }>("open_file_direct", { path: filePath })
    .then((res) => {
      if (!body.isConnected) return;
      const host = document.createElement("div");
      host.className = "cm-embed-md";
      // 复用阅读排版（reader.css 的 .preview-content 规则）。
      host.classList.add("preview-content");
      host.innerHTML = renderMarkdown(res.content, {
        resolveMedia: (href) => resolveDocMediaHref(href, filePath),
      });
      body.replaceChild(host, loading);
      onReady?.();
    })
    .catch(() => {
      if (!body.isConnected) return;
      loading.className = "cm-embed-fallback";
      loading.textContent = "无法读取内嵌 Markdown";
    });
}

/** html / web：iframe 直载。 */
function renderIframeBody(
  body: HTMLElement,
  resolution: FileEmbedResolution | null,
  title: string,
  fallbackMessage: string,
  onReady?: () => void,
): void {
  const url = resolution?.url ?? null;
  if (!url) {
    appendFallback(body, fallbackMessage);
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.className = "cm-embed-iframe";
  iframe.setAttribute("src", url);
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups",
  );
  iframe.setAttribute("title", title || "内嵌页面");
  iframe.setAttribute("loading", "lazy");
  body.appendChild(iframe);
  onReady?.();
}

// --- widget ------------------------------------------------------------------

/**
 * 内嵌文件 widget。`eq` 覆盖类型 / 路径 / 解析结果 / 尺寸，路径或尺寸变化
 * 才重建；异步加载的内容只改 DOM，不触发重建。
 */
export class FileEmbedWidget extends WidgetType {
  constructor(
    private readonly _kind: FileEmbedKind,
    private readonly _alt: string,
    private readonly _path: string,
    private readonly _resolution: FileEmbedResolution | null,
    private readonly _from: number = 0,
    private readonly _align: "left" | "center" | "right" | null = null,
    private readonly _width: number | null = null,
    private readonly _height: number | null = null,
    private readonly _title: string | null = null,
  ) {
    super();
  }

  private freeze: EmbedScrollFreeze | null = null;
  private namePreviewTimer: ReturnType<typeof setTimeout> | null = null;
  private namePreviewId: string | null = null;
  private clampObserver: ResizeObserver | null = null;

  /**
   * 只比较业务内容，不比较 `_from`：上方键入会让偏移漂移，放进 `eq` 会令
   * 下游每个内嵌 widget 重建（iframe / pdf 重载，#1320）。偏移由 `updateDOM`
   * 就地刷新锚点。
   */
  eq(other: FileEmbedWidget): boolean {
    return (
      other._kind === this._kind &&
      other._alt === this._alt &&
      other._path === this._path &&
      other._resolution?.url === this._resolution?.url &&
      other._resolution?.filePath === this._resolution?.filePath &&
      other._resolution?.docPath === this._resolution?.docPath &&
      other._align === this._align &&
      other._width === this._width &&
      other._height === this._height &&
      other._title === this._title
    );
  }

  updateDOM(dom: HTMLElement, _view: EditorView, from: FileEmbedWidget): boolean {
    if (
      from._kind !== this._kind ||
      from._alt !== this._alt ||
      from._path !== this._path ||
      from._resolution?.url !== this._resolution?.url ||
      from._resolution?.filePath !== this._resolution?.filePath ||
      from._resolution?.docPath !== this._resolution?.docPath ||
      from._align !== this._align ||
      from._width !== this._width ||
      from._height !== this._height ||
      from._title !== this._title
    ) {
      return false;
    }
    dom.dataset.embedFrom = String(this._from);
    dom.dataset.embedPath = this._path;
    if (this._resolution?.docPath) {
      dom.dataset.embedDocPath = this._resolution.docPath;
    }
    const state = readEmbedState(this._resolution?.docPath, this._path);
    dom.dataset.embedState = state;
    applyCardStateToDOM(dom, state);
    markEmbedSelected(dom, selectedEmbedFrom === this._from);
    return true;
  }

  toDOM(): HTMLElement {
    const container = document.createElement("span");
    container.className = "cm-embed-widget";
    container.dataset.embedKind = this._kind;
    container.dataset.embedFrom = String(this._from);
    const align = this._align ?? "center";
    container.dataset.align = align;
    container.style.display = "inline-block";
    container.style.position = "relative";
    container.style.maxWidth = "100%";
    container.style.verticalAlign = "middle";
    const mdAuto = this._kind === "md" && this._height === null;
    if (mdAuto) container.dataset.mdAuto = "true";
    if (this._width !== null) {
      container.style.width = `${this._width}px`;
      container.dataset.width = String(this._width);
    }

    const frame = document.createElement("div");
    frame.className = "cm-embed-frame";
    if (this._width !== null) frame.style.width = `${this._width}px`;
    if (this._height !== null) {
      frame.style.height = `${this._height}px`;
      container.dataset.height = String(this._height);
    } else if (!mdAuto) {
      this.fitDefaultHeight(frame);
    }
    container.appendChild(frame);

    const body = document.createElement("div");
    body.className = "cm-embed-body";
    frame.appendChild(body);
    this.renderBody(body, frame);

    const name = document.createElement("div");
    name.className = "cm-embed-name";
    appendFileTypeIcon(name, this._path);
    const meta = document.createElement("span");
    meta.className = "cm-embed-name-meta";
    const nameText = document.createElement("span");
    nameText.className = "cm-embed-name-text";
    nameText.textContent = this.displayName();
    meta.appendChild(nameText);
    const description = embedDescriptionOf(this._kind, this._alt, this._title);
    const desc = document.createElement("span");
    desc.className = "cm-embed-name-desc";
    desc.textContent = description;
    meta.appendChild(desc);
    name.appendChild(meta);
    frame.appendChild(name);

    container.dataset.embedPath = this._path;
    if (this._resolution?.docPath) {
      container.dataset.embedDocPath = this._resolution.docPath;
    }

    const state = readEmbedState(this._resolution?.docPath, this._path);
    this.applyNameState(container, frame, name, state);

    name.addEventListener("pointerenter", () => {
      if (container.dataset.embedState !== "card") return;
      this.openNamePreview(name);
    });
    name.addEventListener("pointerleave", () => {
      if (container.dataset.embedState !== "card") return;
      this.scheduleNamePreviewClose(name);
    });
    name.addEventListener("click", (event) => {
      event.stopPropagation();
      if (container.dataset.embedState !== "card") {
        // 预览态：第一次点击只选中（出工具条），选中后再点文件名才打开。
        if (selectedEmbedFrom !== this._from) {
          selectEmbed(this._from);
          return;
        }
      }
      this.openInNewTab();
    });

    markEmbedSelected(container, selectedEmbedFrom === this._from);

    container.addEventListener("click", () => {
      selectEmbed(this._from);
    });
    container.addEventListener("mousedown", (event) => {
      const target = event.target;
      const handle =
        target instanceof Element
          ? (target.closest("[data-handle]") as HTMLElement | null)
          : null;
      if (!handle) return;
      event.preventDefault();
      event.stopPropagation();
      this.beginResize(event, handle, container, frame);
    });

    scheduleEmbedPanelReposition();
    return container;
  }

  private renderBody(body: HTMLElement, frame: HTMLElement): void {
    const onReady = () => {
      this.attachScrollFreeze(body, frame);
      this.syncClampState(body);
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          if (body.isConnected) this.syncClampState(body);
        });
      }
    };
    const title = this._title ?? this._alt;
    if (this._kind === "pdf") {
      renderPdfBody(body, this._resolution?.filePath ?? null, title, onReady);
      return;
    }
    if (this._kind === "md") {
      renderMarkdownBody(body, this._resolution?.filePath ?? null, onReady);
      return;
    }
    if (this._kind === "html") {
      renderIframeBody(
        body,
        this._resolution,
        title,
        "无法加载内嵌 HTML：文档未保存或路径无法解析",
        onReady,
      );
      return;
    }
    renderIframeBody(
      body,
      this._resolution,
      title,
      "无法加载内嵌网页：链接无法解析",
      onReady,
    );
  }

  private displayName(): string {
    return baseNameOf(this._path) || this._alt || this._title || "文件";
  }

  private applyNameState(
    container: HTMLElement,
    frame: HTMLElement,
    name: HTMLElement,
    state: EmbedCardState,
  ): void {
    container.dataset.embedState = state;
    applyCardStateToDOM(container, state);
    if (state !== "embed") return;
    if (this._height !== null) {
      frame.style.height = `${this._height}px`;
    } else if (this._kind !== "md") {
      this.fitDefaultHeight(frame);
    }
  }

  private openNamePreview(nameEl: HTMLElement): void {
    this.clearNamePreviewTimer();
    const filePath = this._resolution?.filePath ?? null;
    if (!filePath) return;
    const st = useStore.getState();
    if (!st.previewSettings.enabled) return;
    const rect = nameEl.getBoundingClientRect();
    const size = clampPreviewSize({
      w: PREVIEW_DEFAULT_W,
      h: PREVIEW_DEFAULT_H,
    });
    const anchor = anchorFromGrid({
      cardRightX: rect.right,
      cardTopY: rect.top,
      size,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    st.openPreview({
      path: filePath,
      title: this.displayName(),
      x: anchor.x,
      y: anchor.y,
      w: size.w,
      h: size.h,
      flippedX: anchor.flipped.x,
      flippedY: anchor.flipped.y,
      source: "tab",
    });
    this.namePreviewId = useStore.getState().preview?.id ?? null;
  }

  private scheduleNamePreviewClose(nameEl: HTMLElement): void {
    this.clearNamePreviewTimer();
    this.namePreviewTimer = setTimeout(() => {
      this.namePreviewTimer = null;
      const st = useStore.getState();
      const p = st.preview;
      if (!p || p.id !== this.namePreviewId || p.pinned) return;
      const previewEl = document.querySelector(
        '[data-testid="floating-preview"]',
      );
      const shouldClose = shouldScheduleLeaveClose({
        pointer: { ...lastPointer },
        previewBox: rectToBox(previewEl?.getBoundingClientRect()),
        railBox: rectToBox(nameEl.getBoundingClientRect()),
        pinned: p.pinned,
        interacting: false,
      });
      if (shouldClose) st.closePreview(p.id);
    }, PREVIEW_LEAVE_CLOSE_MS);
  }

  private clearNamePreviewTimer(): void {
    if (this.namePreviewTimer) clearTimeout(this.namePreviewTimer);
    this.namePreviewTimer = null;
  }

  private openInNewTab(): void {
    const filePath = this._resolution?.filePath ?? null;
    if (!filePath || !isTauriEnv()) return;
    this.closeNamePreview();
    invoke<{ content: string; path: string }>("open_file_direct", {
      path: filePath,
    })
      .then((res) => {
        useStore.getState().openFile(res.path, res.content);
      })
      .catch(() => {});
  }

  private closeNamePreview(): void {
    this.clearNamePreviewTimer();
    const st = useStore.getState();
    const p = st.preview;
    if (p && p.id === this.namePreviewId) st.closePreview(p.id);
    this.namePreviewId = null;
  }

  /**
   * 接滚动定格。iframe 要等 `load` 之后才拿得到内部文档；跨域 / 插件文档
   * （如 PDF 查看器）拿不到就静默跳过，定格不生效。
   */
  private attachScrollFreeze(body: HTMLElement, frame: HTMLElement): void {
    const docPath = this._resolution?.docPath ?? null;
    if (!docPath) return;
    const key = nameStateKey(docPath, this._path);
    const iframe = body.querySelector("iframe");
    if (iframe) {
      const bind = (): void => {
        const surface = iframeScrollSurface(iframe);
        if (!surface) return;
        this.freeze = new EmbedScrollFreeze(key, surface, frame);
        this.freeze.attach();
      };
      // load 可能已在附加监听前完成（缓存 / blob），否则定格静默不生效。
      const doc = iframe.contentDocument;
      if (doc && doc.readyState === "complete") bind();
      else iframe.addEventListener("load", bind, { once: true });
      return;
    }
    this.freeze = new EmbedScrollFreeze(key, domScrollSurface(body), frame);
    this.freeze.attach();
  }

  destroy(): void {
    this.freeze?.destroy();
    this.freeze = null;
    this.clampObserver?.disconnect();
    this.clampObserver = null;
  }

  /** md 自适应高度：内容超出可视面时给 body 加底缘渐隐（mask）。 */
  private syncClampState(body: HTMLElement): void {
    if (this._kind !== "md" || this._height !== null) return;
    const widget = body.closest<HTMLElement>(".cm-embed-widget");
    if (!widget) return;
    const clamped = body.scrollHeight > body.clientHeight + 1;
    widget.dataset.clamped = clamped ? "true" : "false";
    if (this.clampObserver === null && typeof ResizeObserver !== "undefined") {
      this.clampObserver = new ResizeObserver(() => this.syncClampState(body));
      this.clampObserver.observe(body);
    }
  }

  /** 默认高度约一屏：取编辑器可视高与视口高的较小值（不小于 240px）。 */
  private fitDefaultHeight(frame: HTMLElement): void {
    const apply = (): void => {
      const content = frame.closest(".cm-content") as HTMLElement | null;
      const containerH = content ? content.clientHeight : window.innerHeight;
      const h = Math.max(
        240,
        Math.min(window.innerHeight, containerH || window.innerHeight),
      );
      frame.style.height = `${Math.round(h)}px`;
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(apply);
    } else {
      apply();
    }
  }

  /** 8 个把手：边把手改单轴，角把手改两轴；写回 `{width=… height=…}`。 */
  private beginResize(
    event: MouseEvent,
    handleEl: HTMLElement,
    container: HTMLElement,
    frame: HTMLElement,
  ): void {
    const spec = IMAGE_RESIZE_HANDLES.find(
      (candidate) => candidate.handle === handleEl.dataset.handle,
    );
    if (!spec) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = frame.getBoundingClientRect().width;
    const startH = frame.getBoundingClientRect().height;
    if (startW <= 0 || startH <= 0) return;
    const originalWidth = frame.style.width;
    const originalHeight = frame.style.height;

    const sizeAt = (
      dx: number,
      dy: number,
    ): { width: number; height: number } => ({
      width: spec.width ? clampWidth(startW + spec.signX * dx) : startW,
      height: spec.height ? clampHeight(startH + spec.signY * dy) : startH,
    });

    const onMove = (move: MouseEvent): void => {
      const { width, height } = sizeAt(
        move.clientX - startX,
        move.clientY - startY,
      );
      frame.style.width = `${Math.round(width)}px`;
      frame.style.height = `${Math.round(height)}px`;
    };

    const onUp = (up: MouseEvent): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const dx = up.clientX - startX;
      const dy = up.clientY - startY;
      frame.style.width = originalWidth;
      frame.style.height = originalHeight;
      // 小于 3px 视为点击而非拖拽，不写文档。
      if (Math.hypot(dx, dy) < 3) return;
      const { width, height } = sizeAt(dx, dy);
      const view = EditorView.findFromDOM(container);
      if (!view) return;
      applyImageSize(view, this._from, Math.round(width), Math.round(height));
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  /**
   * 内容区自己处理滚动与触摸，别让 CM6 把 wheel 抢去滚整篇文档；点击仍交回
   * CM6（容器 click 选中、出把手）。
   */
  ignoreEvent(event: Event): boolean {
    const target = event.target as Node | null;
    if (!(target instanceof Element)) return false;
    if (target.closest("iframe")) return true;
    if (!target.closest(".cm-embed-body")) return false;
    return (
      event.type === "wheel" ||
      event.type === "touchstart" ||
      event.type === "touchmove" ||
      event.type === "scroll"
    );
  }
}
