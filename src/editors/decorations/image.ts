/* 图片 / 媒体装饰（移植自 md-bundle packages/editor/src/decorations/image.ts）。
 *
 * `![alt](path)` 按扩展名分三类渲染：
 * - image：解析出 URL 就出 `<img>`，解析不出就退化成 `[图片: path]` 文字。
 * - video：`<video controls>` 播放器。
 * - file：文件链接卡片。
 *
 * 悬停操作（替换 / 删除 / 定位）与拖拽改宽都走注入回调：装饰模块不依赖
 * 应用层资源，回调缺省时按钮照常渲染但点击是空操作。
 *
 * 围栏代码块与缩进代码块里的图片引用不出 widget。
 */
import type { Range } from "@codemirror/state";
import { Decoration, WidgetType, EditorView } from "@codemirror/view";
import { stripAngleWrappers } from "../../lib/mediaUrl";

// --- 类型 --------------------------------------------------------------------

/**
 * 把图片路径解析成 URL / dataUrl 的函数；返回 null 表示解析不出（走文字回退）。
 */
export type ImageResolver = (path: string) => string | null;

/**
 * 图片 widget 的悬停操作回调，全部可选——缺省时编辑器不抛错。
 */
export interface ImageCallbacks {
  onImageReplace?: (path: string) => void;
  /** 持久化拖拽宽度；`from` 是图片 markdown 的起点。 */
  onImageResize?: (from: number, width: number) => void;
  onImageDelete?: (path: string) => void;
  onImageLocate?: (path: string) => void;
}

// --- 媒体分类 ----------------------------------------------------------------

/**
 * `![alt](path)` 的三种渲染形态。与预览渲染器（`src/renderers/markdown.ts`）
 * 的图片规则保持一致，保证编辑态与阅读态对同一扩展名的判断相同。
 */
export type MediaKind = "image" | "video" | "file";

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogv", "mov", "m4v"]);
const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "avif",
  "bmp",
  "ico",
]);

/** 去掉 query/hash 后的小写扩展名；没有扩展名时返回空串。 */
function extensionOf(path: string): string {
  const clean = path.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : "";
}

/**
 * 按扩展名分类：无扩展名或图片扩展名算图片，已知视频扩展名算视频，
 * 其余算文件。
 */
export function classifyMedia(path: string): MediaKind {
  const ext = extensionOf(path);
  if (ext !== "" && VIDEO_EXTENSIONS.has(ext)) return "video";
  if (ext !== "" && !IMAGE_EXTENSIONS.has(ext)) return "file";
  return "image";
}

// --- 宽度持久化（#498） -------------------------------------------------------

/** 可接受的 `<!--w=N-->` 宽度范围（px）。 */
export const MIN_IMAGE_WIDTH = 40;
export const MAX_IMAGE_WIDTH = 2000;

const WIDTH_COMMENT_RE = /^[ \t]*<!--\s*w=(\d+)\s*-->/;

/** 宽度注释的结束位置（含注释本身），没有则 null。编辑态要把它藏起来。 */
export function imageWidthCommentEnd(
  text: string,
  after: number,
): number | null {
  const match = WIDTH_COMMENT_RE.exec(text.slice(after, after + 64));
  if (!match) return null;
  return after + match[0].length;
}

/** 图片 markdown 之后紧跟的宽度注释，没有则 null。 */
export function parseImageWidth(text: string, after: number): number | null {
  const match = WIDTH_COMMENT_RE.exec(text.slice(after, after + 64));
  if (!match) return null;
  const width = Number(match[1]);
  if (
    !Number.isFinite(width) ||
    width < MIN_IMAGE_WIDTH ||
    width > MAX_IMAGE_WIDTH
  )
    return null;
  return width;
}

/**
 * 写入（或改写）起点在 `from` 的图片的宽度注释，宽度夹到可接受区间。
 */
export function applyImageWidth(
  view: EditorView,
  from: number,
  width: number,
): boolean {
  const clamp = Math.round(
    Math.max(MIN_IMAGE_WIDTH, Math.min(width, MAX_IMAGE_WIDTH)),
  );
  const rest = view.state.doc.sliceString(
    from,
    Math.min(from + 400, view.state.doc.length),
  );
  const image = /^!\[[^\]]*\]\([^)]+\)/.exec(rest);
  if (!image) return false;
  const imageEnd = from + image[0].length;
  const tail = rest.slice(image[0].length);
  const existing = /^[ \t]*<!--\s*w=\d+\s*-->/.exec(tail);
  const insert = `<!--w=${clamp}-->`;
  if (existing) {
    view.dispatch({
      changes: { from: imageEnd, to: imageEnd + existing[0].length, insert },
    });
    return true;
  }
  view.dispatch({ changes: { from: imageEnd, to: imageEnd, insert } });
  return true;
}

// --- 图片 widget -------------------------------------------------------------

/**
 * 把图片引用渲染成 `<img>`（解析出 URL 时）或 `[图片: path]` 文字回退。
 * 鼠标悬停时浮出替换 / 删除 / 定位按钮。
 */
class ImageWidget extends WidgetType {
  private readonly _alt: string;
  private readonly _path: string;
  private readonly _src: string | null;
  private readonly _callbacks: ImageCallbacks;
  private readonly _width: number | null;
  /** `!` 的文档偏移——拖拽改宽写注释时用。 */
  private readonly _from: number;

  constructor(
    alt: string,
    path: string,
    src: string | null,
    callbacks: ImageCallbacks,
    width: number | null = null,
    from = 0,
  ) {
    super();
    this._alt = alt;
    this._path = path;
    this._src = src;
    this._callbacks = callbacks;
    this._width = width;
    this._from = from;
  }

  eq(other: ImageWidget): boolean {
    return (
      other._alt === this._alt &&
      other._path === this._path &&
      other._src === this._src &&
      other._width === this._width &&
      other._from === this._from
    );
  }

  toDOM(): HTMLElement {
    const container = document.createElement("span");
    container.className = "cm-image-widget";
    container.style.display = "inline-block";
    container.style.position = "relative";
    container.style.maxWidth = "100%";
    container.style.verticalAlign = "middle";
    // 圆角裁在 <img> 自己的像素上（clip-path），容器不设圆角：容器
    // overflow:hidden + border-radius 会把子元素裁在深色画布上，产生深色
    // 角晕。容器只铺一层主题底色，让透明 PNG 的圆角透出纸面而不是画布。
    container.style.backgroundColor = "var(--app-surface)";

    if (this._src) {
      // 按原始尺寸渲染，容器 maxWidth 兜住超宽；不设 max-height，
      // 否则粘贴/拖入的图片会缩得很小。
      const img = document.createElement("img");
      img.src = this._src;
      img.alt = this._alt;
      img.style.maxWidth = "100%";
      img.style.display = "block";
      if (this._width !== null) {
        img.style.width = `${this._width}px`;
        img.setAttribute("data-width", String(this._width));
      }
      img.style.clipPath = "inset(0 round 4px)";
      container.appendChild(img);
    } else {
      // 解析不出的图片：文字回退
      const fallback = document.createElement("span");
      fallback.className = "cm-image-fallback";
      fallback.textContent = `[图片: ${this._path}]`;
      container.appendChild(fallback);
    }

    // 悬停工具条：压在图片顶部内侧，鼠标从图片移到工具条不会离开容器。
    const toolbar = document.createElement("span");
    toolbar.className = "cm-image-toolbar";
    toolbar.style.display = "none";
    toolbar.style.position = "absolute";
    toolbar.style.top = "4px";
    toolbar.style.left = "4px";
    toolbar.style.borderRadius = "4px";
    toolbar.style.padding = "2px 4px";
    toolbar.style.fontSize = "12px";
    toolbar.style.whiteSpace = "nowrap";
    toolbar.style.zIndex = "10";
    toolbar.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";

    const replaceBtn = document.createElement("button");
    replaceBtn.dataset.testid = "img-hover-replace";
    replaceBtn.textContent = "替换";
    replaceBtn.style.marginRight = "4px";
    replaceBtn.style.cursor = "pointer";
    replaceBtn.style.color = "inherit";
    replaceBtn.style.background = "transparent";
    replaceBtn.style.border = "none";
    replaceBtn.style.padding = "0";
    replaceBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._callbacks.onImageReplace?.(this._path);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.dataset.testid = "img-hover-delete";
    deleteBtn.textContent = "删除";
    deleteBtn.style.marginRight = "4px";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.color = "inherit";
    deleteBtn.style.background = "transparent";
    deleteBtn.style.border = "none";
    deleteBtn.style.padding = "0";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._callbacks.onImageDelete?.(this._path);
    });

    const locateBtn = document.createElement("button");
    locateBtn.dataset.testid = "img-hover-locate";
    locateBtn.textContent = "定位";
    locateBtn.style.cursor = "pointer";
    locateBtn.style.color = "inherit";
    locateBtn.style.background = "transparent";
    locateBtn.style.border = "none";
    locateBtn.style.padding = "0";
    locateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._callbacks.onImageLocate?.(this._path);
    });

    // 拖拽把手：松手后把宽度持久化成尾随的 `<!--w=N-->` 注释（#498）。
    if (this._src) {
      const handle = document.createElement("span");
      handle.className = "cm-image-resize";
      handle.setAttribute("data-testid", "cm-image-resize");
      handle.setAttribute("role", "slider");
      handle.setAttribute("aria-label", "调整图片宽度");
      handle.title = "拖动调整宽度";
      container.appendChild(handle);

      handle.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const img = container.querySelector("img");
        if (!img) return;
        const startX = event.clientX;
        const startWidth = img.getBoundingClientRect().width;
        const maxAllowed = container.getBoundingClientRect().width;
        const onMove = (move: MouseEvent): void => {
          const next = Math.max(
            MIN_IMAGE_WIDTH,
            Math.min(startWidth + (move.clientX - startX), maxAllowed),
          );
          img.style.width = `${Math.round(next)}px`;
        };
        const onUp = (up: MouseEvent): void => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          const raw = Math.round(startWidth + (up.clientX - startX));
          const clamped = Math.max(
            MIN_IMAGE_WIDTH,
            Math.min(raw, MAX_IMAGE_WIDTH),
          );
          if (this._callbacks.onImageResize) {
            this._callbacks.onImageResize(this._from, clamped);
            return;
          }
          // 宿主没注入回调：直接写文档；view 从 widget 自己的 DOM 反查，
          // 装饰构建因此不需要持有 view 引用。
          const view = EditorView.findFromDOM(container);
          if (view) applyImageWidth(view, this._from, clamped);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    }

    toolbar.appendChild(replaceBtn);
    toolbar.appendChild(deleteBtn);
    toolbar.appendChild(locateBtn);
    container.appendChild(toolbar);

    // 悬停显隐。mouseleave 检查 relatedTarget：移到工具条（或其子元素）上
    // 不算离开。
    container.addEventListener("mouseenter", () => {
      toolbar.style.display = "block";
    });
    container.addEventListener("mouseleave", (e) => {
      const related = e.relatedTarget as Node | null;
      if (related && container.contains(related)) return;
      toolbar.style.display = "none";
    });

    return container;
  }

  /**
   * 让编辑器忽略落在工具条上的事件，按钮才能收到真实点击：CM6 的 mousedown
   * 处理器会 preventDefault 它接管的事件，连带取消按钮的 click。
   */
  ignoreEvent(event: Event): boolean {
    const target = event.target as Node | null;
    return (
      target instanceof Element && target.closest(".cm-image-toolbar") !== null
    );
  }
}

// --- 媒体 widget（视频 / 文件） -----------------------------------------------

/**
 * 非图片媒体的 widget：视频引用渲染成 `<video controls preload="metadata">`，
 * 其余渲染成文件链接卡片。`kind` 参与 `eq()`，路径改动让引用在视频与文件之间
 * 切换时 CM6 会重建 widget。
 */
class MediaWidget extends WidgetType {
  constructor(
    private readonly _kind: "video" | "file",
    private readonly _alt: string,
    private readonly _path: string,
    private readonly _src: string | null,
  ) {
    super();
  }

  eq(other: MediaWidget): boolean {
    return (
      other._kind === this._kind &&
      other._alt === this._alt &&
      other._path === this._path &&
      other._src === this._src
    );
  }

  toDOM(): HTMLElement {
    const container = document.createElement("span");
    container.className = "cm-media-widget";
    container.classList.add(`cm-media-${this._kind}`);
    container.style.display = "inline-block";
    container.style.maxWidth = "100%";
    container.style.verticalAlign = "middle";
    container.style.backgroundColor = "var(--app-surface)";

    if (this._kind === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.preload = "metadata";
      // 用 setAttribute（不是 .src）：属性 getter 会按文档 base URL 解析，
      // 让渲染出的属性与源码路径不一致。
      video.setAttribute("src", this._src ?? this._path);
      video.style.maxWidth = "100%";
      video.style.display = "block";
      container.appendChild(video);
    } else {
      const link = document.createElement("a");
      link.setAttribute("href", this._path);
      link.textContent = this._alt !== "" ? this._alt : this._path;
      container.appendChild(link);
    }

    return container;
  }

  /**
   * 播放器与链接保留原生行为（点击必须落到控件上）；点卡片空白处交回 CM6
   * 放光标。CM6 只在 `ignoreEvent` 返回 false 时把事件当编辑器自己的。
   */
  ignoreEvent(event: Event): boolean {
    const target = event.target as Node | null;
    return target instanceof Element && target.closest("video, a") !== null;
  }
}

// --- 装饰构建 ----------------------------------------------------------------

/**
 * 匹配 `![alt](path)`，排除代码块里的引用。
 */
export const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

/**
 * 找出围栏代码块（``` 或 ~~~ 界定）与缩进代码块的行区间。
 * 返回 `[start, end)` 偏移数组。
 */
function findFencedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split("\n");
  let inFence = false;
  let fenceStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = i === 0 ? 0 : lines.slice(0, i).join("\n").length + 1;

    if (/^\s*```/.test(line)) {
      if (!inFence) {
        inFence = true;
        fenceStart = lineStart;
      } else {
        ranges.push([fenceStart, lineStart + line.length]);
        inFence = false;
        fenceStart = -1;
      }
    }
  }

  if (inFence) {
    ranges.push([fenceStart, text.length]);
  }

  let indentedStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = i === 0 ? 0 : lines.slice(0, i).join("\n").length + 1;
    const isIndented = /^\s{4}|\t/.test(line);

    if (isIndented && indentedStart === -1) {
      indentedStart = lineStart;
    } else if (!isIndented && indentedStart !== -1) {
      ranges.push([indentedStart, lineStart]);
      indentedStart = -1;
    }
  }
  if (indentedStart !== -1) {
    ranges.push([indentedStart, text.length]);
  }

  return ranges;
}

/** 位置是否落在任一区间内。 */
function isInsideRange(pos: number, ranges: Array<[number, number]>): boolean {
  for (const [start, end] of ranges) {
    if (pos >= start && pos < end) return true;
  }
  return false;
}

/**
 * 为全文所有图片引用生成装饰。
 *
 * @param docText 全文。
 * @param resolve 图片路径解析器（缺省恒返回 null → 文字回退）。
 * @param callbacks 悬停操作回调（可选）。
 */
export function createImageDecorations(
  docText: string,
  resolve?: ImageResolver,
  callbacks?: ImageCallbacks,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const resolveFn = resolve ?? (() => null);
  const callbacksFn = callbacks ?? {};

  const fencedRanges = findFencedRanges(docText);

  imageRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = imageRegex.exec(docText)) !== null) {
    const matchStart = match.index;

    if (isInsideRange(matchStart, fencedRanges)) continue;

    const alt = match[1];
    // 含空格/括号的目标在 markdown 里写成 `<...>`，取出来先把壳拆掉，
    // 否则扩展名判断会把这个 `>` 算进去（#103 后续）。
    const path = stripAngleWrappers(match[2]);
    const kind = classifyMedia(path);
    const from = matchStart;
    const to = matchStart + match[0].length;

    if (kind === "image") {
      // 图片路径解析（行为不变：null → 文字回退）。
      const src = resolveFn(path);
      decorations.push(
        Decoration.replace({
          widget: new ImageWidget(
            alt,
            path,
            src,
            callbacksFn,
            parseImageWidth(docText, to),
            from,
          ),
          inclusive: false,
        }).range(from, to),
      );
      // 宽度注释是持久化用的，不该在正文里露出来。
      const commentEnd = imageWidthCommentEnd(docText, to);
      if (commentEnd !== null) {
        decorations.push(
          Decoration.replace({ inclusive: false }).range(to, commentEnd),
        );
      }
      continue;
    }

    // 视频复用图片解析器；解析不出时回退到原始路径，播放器仍有 src。
    const src = kind === "video" ? (resolveFn(path) ?? path) : null;
    decorations.push(
      Decoration.replace({
        widget: new MediaWidget(kind, alt, path, src),
        inclusive: false,
      }).range(from, to),
    );
  }

  return decorations;
}
