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
import { IMAGE_RESIZE_HANDLES } from "./imageToolbar";
import {
  applyImageSize,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
  MIN_IMAGE_HEIGHT,
  MIN_IMAGE_WIDTH,
} from "./image";
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

/** 可内嵌的文件类型；`web` 是外部链接页面。 */
export type FileEmbedKind = "pdf" | "md" | "html" | "web";

/**
 * 宿主注入的解析结果：
 * - `url`：能直接放进 iframe `src` 的地址（asset / http / data）。
 * - `filePath`：本地绝对路径，pdf / md 读取内容用；web 为 null。
 */
export interface FileEmbedResolution {
  url: string | null;
  filePath: string | null;
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

// --- 选中态 ------------------------------------------------------------------

/** 当前选中的内嵌 widget 文档偏移；null 表示未选中。 */
let selectedEmbedFrom: number | null = null;

const SELECTABLE_EMBED = ".cm-embed-widget";

function markEmbedSelected(el: HTMLElement, isSelected: boolean): void {
  el.dataset.selected = isSelected ? "true" : "false";
  el.querySelectorAll(".cm-image-handle").forEach((handle) => handle.remove());
  if (!isSelected) return;
  for (const { handle, cursor } of IMAGE_RESIZE_HANDLES) {
    const span = document.createElement("span");
    span.className = "cm-image-handle";
    span.dataset.handle = handle;
    span.style.cursor = cursor;
    span.title = "拖动调整内嵌大小";
    el.appendChild(span);
  }
}

function selectEmbed(from: number): void {
  selectedEmbedFrom = from;
  document.querySelectorAll<HTMLElement>(SELECTABLE_EMBED).forEach((el) => {
    const elFrom =
      el.dataset.embedFrom !== undefined ? Number(el.dataset.embedFrom) : null;
    markEmbedSelected(el, elFrom !== null && elFrom === selectedEmbedFrom);
  });
}

function clearEmbedSelection(): void {
  selectedEmbedFrom = null;
  document.querySelectorAll<HTMLElement>(SELECTABLE_EMBED).forEach((el) => {
    markEmbedSelected(el, false);
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const target = event.target as Node | null;
    if (target instanceof Element && target.closest(".cm-embed-widget")) return;
    clearEmbedSelection();
  });
}

// --- 尺寸 --------------------------------------------------------------------

function clampWidth(value: number): number {
  return Math.max(MIN_IMAGE_WIDTH, Math.min(value, MAX_IMAGE_WIDTH));
}

function clampHeight(value: number): number {
  return Math.max(MIN_IMAGE_HEIGHT, Math.min(value, MAX_IMAGE_HEIGHT));
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
  });
}

/** md：读文件内容 → 复用预览渲染管线 → 排版 HTML。 */
function renderMarkdownBody(body: HTMLElement, filePath: string | null): void {
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

  eq(other: FileEmbedWidget): boolean {
    return (
      other._kind === this._kind &&
      other._alt === this._alt &&
      other._path === this._path &&
      other._resolution?.url === this._resolution?.url &&
      other._resolution?.filePath === this._resolution?.filePath &&
      other._from === this._from &&
      other._align === this._align &&
      other._width === this._width &&
      other._height === this._height &&
      other._title === this._title
    );
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
    } else {
      this.fitDefaultHeight(frame);
    }
    container.appendChild(frame);

    const body = document.createElement("div");
    body.className = "cm-embed-body";
    frame.appendChild(body);
    this.renderBody(body);

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

    return container;
  }

  private renderBody(body: HTMLElement): void {
    const title = this._title ?? this._alt;
    if (this._kind === "pdf") {
      renderPdfBody(body, this._resolution?.filePath ?? null, title);
      return;
    }
    if (this._kind === "md") {
      renderMarkdownBody(body, this._resolution?.filePath ?? null);
      return;
    }
    if (this._kind === "html") {
      renderIframeBody(
        body,
        this._resolution,
        title,
        "无法加载内嵌 HTML：文档未保存或路径无法解析",
      );
      return;
    }
    renderIframeBody(
      body,
      this._resolution,
      title,
      "无法加载内嵌网页：链接无法解析",
    );
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
