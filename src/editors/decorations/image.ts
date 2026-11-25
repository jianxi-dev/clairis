/* 图片 / 媒体装饰（移植自 md-bundle packages/editor/src/decorations/image.ts）。
 *
 * `![alt](path)` 按扩展名分三类渲染：
 * - image：解析出 URL 就出 `<img>`，解析不出就出显式占位节点。
 * - video：`<video controls>` 播放器；解析不出同样出占位，**不写原始相对路径**
 *   （相对路径必然 404，只会得到裂图/问号框，#903）。
 * - audio：`<audio controls>` 播放器，与视频同走 media://。
 * - file：附件卡（类型图标 + 文件名 + 大小，点击系统打开）。
 *
 * 点击选中图片（选中态与工具条见 imageToolbar.ts），拖拽改宽与工具条动作
 * 都走注入回调：装饰模块不依赖应用层资源。
 *
 * 围栏代码块与缩进代码块里的图片引用不出 widget。
 */
import type { Range } from "@codemirror/state";
import { Decoration, WidgetType, EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import {
  AUDIO_EXT,
  IMAGE_EXT,
  stripAngleWrappers,
  VIDEO_EXT,
} from "../../lib/mediaUrl";
import { colorOfType, fileTypeOf, iconOfType } from "../../lib/fileType";
import { formatFileSize } from "../../lib/fileSize";
import { isTauriEnv } from "../../utils/tauri";
import { ICONS } from "../../ui/icons";
import {
  getSelectedImageFrom,
  IMAGE_RESIZE_HANDLES,
  markImageWidgetSelected,
  openImageMaximize,
  scheduleImageToolbarReposition,
  selectImage,
  setImageView,
  type ImageHandleSpec,
  type ImageToolbarActions,
} from "./imageToolbar";
import {
  FileEmbedWidget,
  classifyFileEmbed,
  isEmbedSelected,
  scheduleEmbedPanelReposition,
  selectEmbed,
  type FileEmbedResolver,
} from "./fileEmbed";

// --- 类型 --------------------------------------------------------------------

/**
 * 把图片路径解析成 URL / dataUrl 的函数；返回 null 表示解析不出（走文字回退）。
 */
export type ImageResolver = (path: string) => string | null;

/**
 * 图片 widget 的操作回调，全部可选——缺省时对应工具条按钮禁用。
 */
export type ImageCallbacks = ImageToolbarActions;

// --- 媒体分类 ----------------------------------------------------------------

/**
 * `![alt](path)` 的四种渲染形态。与预览渲染器（`src/renderers/markdown.ts`）
 * 的图片规则保持一致，保证编辑态与阅读态对同一扩展名的判断相同。
 */
export type MediaKind = "image" | "video" | "audio" | "file";

/** 去掉 query/hash 后的小写扩展名；没有扩展名时返回空串。 */
function extensionOf(path: string): string {
  const clean = path.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : "";
}

/**
 * 按扩展名分类，与预览渲染器（`src/renderers/markdown.ts`）/
 * 路径解析（`src/lib/mediaUrl.ts`）共用同一份扩展名表：两边判断不一致会让
 * 同一引用在编辑态退化成带边框的文件卡片、在阅读态却是图片/视频
 * （#823：`.heic/.heif` 图片、`.mkv/.avi` 视频）。无扩展名仍按图片处理。
 */
export function classifyMedia(path: string): MediaKind {
  const ext = extensionOf(path);
  if (ext !== "" && VIDEO_EXT.has(ext)) return "video";
  if (ext !== "" && AUDIO_EXT.has(ext)) return "audio";
  if (ext !== "" && !IMAGE_EXT.has(ext)) return "file";
  return "image";
}

// --- 解析失败占位（#903） -----------------------------------------------------

/**
 * 解析失败时挂出**显式占位**：带 testid 的样式化节点 + 原文路径。
 *
 * 取代旧做法（把原始相对路径直接写进 `src`/`href`）——那条路必然 404，
 * 用户只会看到裂图「问号框」，既看不出是哪个文件，也看不出是「读不到」。
 */
const MEDIA_KIND_LABEL: Record<"image" | "video" | "audio", string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
};

function appendUnresolvedPlaceholder(
  container: HTMLElement,
  kind: "image" | "video" | "audio",
  path: string,
): void {
  const placeholder = document.createElement("span");
  placeholder.className = "cm-media-placeholder";
  placeholder.dataset.testid = "media-unresolved";
  placeholder.dataset.mediaKind = kind;
  const label = document.createElement("span");
  label.textContent = `[${MEDIA_KIND_LABEL[kind]}: ${path}]`;
  placeholder.appendChild(label);
  container.appendChild(placeholder);
}

// --- 宽度持久化（#498） -------------------------------------------------------

/** 可接受的 `<!--w=N-->` 宽度范围（px）。 */
export const MIN_IMAGE_WIDTH = 40;
export const MAX_IMAGE_WIDTH = 2000;
/** 高度与宽度共用同一区间。 */
export const MIN_IMAGE_HEIGHT = MIN_IMAGE_WIDTH;
export const MAX_IMAGE_HEIGHT = MAX_IMAGE_WIDTH;
/** 裁剪矩形单边最小值（原图像素）。 */
export const MIN_CROP_SIZE = 8;

function clampWidth(value: number): number {
  return Math.max(MIN_IMAGE_WIDTH, Math.min(value, MAX_IMAGE_WIDTH));
}

function clampHeight(value: number): number {
  return Math.max(MIN_IMAGE_HEIGHT, Math.min(value, MAX_IMAGE_HEIGHT));
}

// 结束符兼容旧数据里的全角破折号 `—>`；前导空白含换行，跨行注释才不泄漏成正文。
const WIDTH_COMMENT_RE = /^[ \t\r\n]*<!--\s*w=(\d+)\s*(?:-->|—>)/;

function cropEquals(
  a: [number, number, number, number] | null,
  b: [number, number, number, number] | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.every((v, i) => v === b[i]);
}

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
 * 图片属性块（Pandoc 风格）：`{width=920 height=600 align=left crop=10,20,300,400}`。
 * 只识别这四个键，未知键静默忽略。
 */
export interface ImageAttributes {
  width: number | null;
  height: number | null;
  align: "left" | "center" | "right" | null;
  crop: [number, number, number, number] | null;
}

/** 全部缺省的属性。 */
export const EMPTY_IMAGE_ATTRIBUTES: ImageAttributes = {
  width: null,
  height: null,
  align: null,
  crop: null,
};

function stripOptionalQuotes(value: string): string {
  if (
    value.length >= 2 &&
    (value[0] === '"' || value[0] === "'") &&
    value[value.length - 1] === value[0]
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** 解析属性块内容（不含大括号）。 */
export function parseImageAttributes(text: string): ImageAttributes {
  const attrs: ImageAttributes = { ...EMPTY_IMAGE_ATTRIBUTES };
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    const eq = token.indexOf("=");
    if (eq < 0) continue;
    const key = token.slice(0, eq).trim().toLowerCase();
    const value = stripOptionalQuotes(token.slice(eq + 1).trim());
    if (key === "width" || key === "height") {
      const num = Number(value);
      if (Number.isInteger(num) && num > 0) {
        if (key === "width") attrs.width = num;
        else attrs.height = num;
      }
    } else if (key === "align") {
      if (value === "left" || value === "center" || value === "right") {
        attrs.align = value;
      }
    } else if (key === "crop") {
      const parts = value.split(",").map((p) => Number(p.trim()));
      if (parts.length === 4 && parts.every((p) => Number.isInteger(p))) {
        attrs.crop = parts as [number, number, number, number];
      }
    }
  }
  return attrs;
}

/** 把属性序列化成 `{...}`；全缺省时返回空串。 */
export function serializeImageAttributes(attrs: ImageAttributes): string {
  const parts: string[] = [];
  if (attrs.width !== null) parts.push(`width=${attrs.width}`);
  if (attrs.height !== null) parts.push(`height=${attrs.height}`);
  if (attrs.align !== null) parts.push(`align=${attrs.align}`);
  if (attrs.crop !== null) parts.push(`crop=${attrs.crop.join(",")}`);
  return parts.length > 0 ? `{${parts.join(" ")}}` : "";
}

/** 扫描到的图片引用（含可选属性块）。 */
export interface ImageReference {
  /** `!` 的文档偏移。 */
  start: number;
  alt: string;
  /** 去掉尖括号壳的路径。 */
  path: string;
  /** 目标原文（含尖括号壳）。 */
  target: string;
  title: string | null;
  /** 标题原文的区间（含引号），没有标题时为 null。 */
  titleStart: number | null;
  titleEnd: number | null;
  /** `![]()` 结束偏移（不含属性块）。 */
  end: number;
  /** 属性块内容（不含大括号），没有则 null。 */
  attrText: string | null;
  attrStart: number | null;
  attrEnd: number | null;
}

function isSpaceChar(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

/**
 * 从 `start` 扫描一个图片引用。括号 / 尖括号感知：
 * - `![a](<path with spaces (1).png>)`
 * - `![a](assets/image%20(1).png)`
 * - `![a](src "title"){width=920}`
 * 目标在匹配的 `)` 处结束，属性块紧跟在 `)` 后。
 */
export function scanImageReference(
  text: string,
  start: number,
): ImageReference | null {
  const n = text.length;
  let i = start;
  if (text[i] !== "!" || text[i + 1] !== "[") return null;
  i += 2;

  // alt：允许嵌套方括号与反斜杠转义。
  const altStart = i;
  let bracketDepth = 0;
  while (i < n) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "[") {
      bracketDepth += 1;
      i += 1;
      continue;
    }
    if (ch === "]") {
      if (bracketDepth === 0) break;
      bracketDepth -= 1;
      i += 1;
      continue;
    }
    i += 1;
  }
  if (i >= n) return null;
  const alt = text.slice(altStart, i);
  i += 1;
  if (text[i] !== "(") return null;
  i += 1;
  while (i < n && isSpaceChar(text[i])) i += 1;

  let target = "";
  if (text[i] === "<") {
    const close = text.indexOf(">", i + 1);
    if (close < 0) return null;
    target = text.slice(i + 1, close);
    i = close + 1;
  } else {
    const targetStart = i;
    let parenDepth = 0;
    while (i < n) {
      const ch = text[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "(") {
        parenDepth += 1;
        i += 1;
        continue;
      }
      if (ch === ")") {
        if (parenDepth === 0) break;
        parenDepth -= 1;
        i += 1;
        continue;
      }
      if (parenDepth === 0 && isSpaceChar(ch)) break;
      i += 1;
    }
    target = text.slice(targetStart, i);
  }
  if (target === "") return null;

  // 可选标题：`"..."` / `'...'` / `(...)`。
  let title: string | null = null;
  let titleStart: number | null = null;
  let titleEnd: number | null = null;
  let j = i;
  while (j < n && isSpaceChar(text[j])) j += 1;
  if (text[j] === '"' || text[j] === "'") {
    const quote = text[j];
    let k = j + 1;
    let t = "";
    while (k < n && text[k] !== quote) {
      if (text[k] === "\\") {
        t += text[k + 1] ?? "";
        k += 2;
        continue;
      }
      t += text[k];
      k += 1;
    }
    if (k >= n) return null;
    title = t;
    titleStart = j;
    titleEnd = k + 1;
    i = k + 1;
  } else if (text[j] === "(") {
    let k = j + 1;
    let depth = 1;
    let t = "";
    while (k < n) {
      const ch = text[k];
      if (ch === "\\") {
        t += text[k + 1] ?? "";
        k += 2;
        continue;
      }
      if (ch === "(") {
        depth += 1;
        t += ch;
        k += 1;
        continue;
      }
      if (ch === ")") {
        depth -= 1;
        k += 1;
        if (depth === 0) break;
        t += ch;
        continue;
      }
      t += ch;
      k += 1;
    }
    if (depth !== 0) return null;
    title = t;
    titleStart = j;
    titleEnd = k;
    i = k;
  }
  while (i < n && isSpaceChar(text[i])) i += 1;
  if (text[i] !== ")") return null;
  i += 1;
  const end = i;

  let attrText: string | null = null;
  let attrStart: number | null = null;
  let attrEnd: number | null = null;
  if (text[i] === "{") {
    let depth = 0;
    let k = i;
    let closed = false;
    while (k < n) {
      const ch = text[k];
      if (ch === "\\") {
        k += 2;
        continue;
      }
      if (ch === "{") {
        depth += 1;
        k += 1;
        continue;
      }
      if (ch === "}") {
        depth -= 1;
        k += 1;
        if (depth === 0) {
          closed = true;
          break;
        }
        continue;
      }
      k += 1;
    }
    if (closed) {
      attrText = text.slice(i + 1, k - 1);
      attrStart = i;
      attrEnd = k;
      i = k;
    }
  }

  return {
    start,
    alt,
    path: stripAngleWrappers(target),
    target,
    title,
    titleStart,
    titleEnd,
    end,
    attrText,
    attrStart,
    attrEnd,
  };
}

/**
 * 写入（或改写）起点在 `from` 的图片的属性块。已存在的旧 `<!--w=N-->`
 * 注释会被移除（惰性迁移），绝不把内容插进路径里。
 */
export function writeImageAttributes(
  view: EditorView,
  from: number,
  attrs: ImageAttributes,
): boolean {
  const text = view.state.doc.toString();
  const ref = scanImageReference(text, from);
  if (!ref) return false;
  const serialized = serializeImageAttributes(attrs);
  const afterAttrs = ref.attrEnd ?? ref.end;
  const commentEnd = imageWidthCommentEnd(text, afterAttrs);
  const changes: Array<{ from: number; to: number; insert: string }> = [];
  if (ref.attrStart !== null && ref.attrEnd !== null) {
    changes.push({ from: ref.attrStart, to: ref.attrEnd, insert: serialized });
    if (commentEnd !== null) {
      changes.push({ from: ref.attrEnd, to: commentEnd, insert: "" });
    }
  } else {
    const to = commentEnd ?? ref.end;
    if (serialized !== "" || to > ref.end) {
      changes.push({ from: ref.end, to, insert: serialized });
    }
  }
  if (changes.length > 0) view.dispatch({ changes });
  return true;
}

/**
 * 写入（或改写）起点在 `from` 的图片的宽高；null 表示该维不变。
 * 保留已有的 align / crop / title；writeImageAttributes 内部只 dispatch 一次。
 */
export function applyImageSize(
  view: EditorView,
  from: number,
  width: number | null,
  height: number | null,
): boolean {
  const text = view.state.doc.toString();
  const ref = scanImageReference(text, from);
  if (!ref) return false;
  const attrs: ImageAttributes =
    ref.attrText !== null
      ? parseImageAttributes(ref.attrText)
      : { ...EMPTY_IMAGE_ATTRIBUTES };
  if (attrs.width === null) {
    const legacy = parseImageWidth(text, ref.end);
    if (legacy !== null) attrs.width = legacy;
  }
  if (width !== null) attrs.width = Math.round(clampWidth(width));
  if (height !== null) attrs.height = Math.round(clampHeight(height));
  return writeImageAttributes(view, from, attrs);
}

/** 只改宽度的便捷包装（保留旧导出）。 */
export function applyImageWidth(
  view: EditorView,
  from: number,
  width: number,
): boolean {
  return applyImageSize(view, from, width, null);
}

/** 引号壳里的转义：只处理反斜杠与双引号（写入恒用双引号壳）。 */
function escapeImageTitle(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * 写回起点在 `from` 的图片的标题（`![alt](path "title")` 的引号部分）。
 * 空串移除标题；已有标题原样替换引号段；无标题时插在 `)` 前。
 * 宽高等属性块不动。
 */
export function writeImageTitle(
  view: EditorView,
  from: number,
  title: string,
): boolean {
  const text = view.state.doc.toString();
  const ref = scanImageReference(text, from);
  if (!ref) return false;
  const value = title.trim();
  const changes: Array<{ from: number; to: number; insert: string }> = [];
  if (ref.titleStart !== null && ref.titleEnd !== null) {
    if (value === ref.title) return true;
    if (value === "") {
      let start = ref.titleStart;
      while (
        start > ref.start &&
        (text[start - 1] === " " || text[start - 1] === "\t")
      ) {
        start -= 1;
      }
      changes.push({ from: start, to: ref.titleEnd, insert: "" });
    } else {
      changes.push({
        from: ref.titleStart,
        to: ref.titleEnd,
        insert: `"${escapeImageTitle(value)}"`,
      });
    }
  } else {
    if (value === "") return true;
    changes.push({
      from: ref.end - 1,
      to: ref.end - 1,
      insert: ` "${escapeImageTitle(value)}"`,
    });
  }
  if (changes.length > 0) view.dispatch({ changes });
  return true;
}

/**
 * 按把手语义算目标尺寸。角把手用两轴中位移比例较大的一轴定缩放，另一轴按
 * 原始宽高比推导；高度触界时从高度反推宽度，尽量保持比例。
 */
function computeResize(
  spec: ImageHandleSpec,
  startW: number,
  startH: number,
  ratio: number,
  dx: number,
  dy: number,
): { width: number; height: number } {
  if (spec.width && spec.height) {
    const scaleX = (startW + spec.signX * dx) / startW;
    const scaleY = (startH + spec.signY * dy) / startH;
    const scale = Math.max(scaleX, scaleY);
    let width = clampWidth(startW * scale);
    const height = clampHeight(width / ratio);
    if (height === MIN_IMAGE_HEIGHT || height === MAX_IMAGE_HEIGHT) {
      width = clampWidth(height * ratio);
    }
    return { width, height };
  }
  if (spec.width) {
    return { width: clampWidth(startW + spec.signX * dx), height: startH };
  }
  return { width: startW, height: clampHeight(startH + spec.signY * dy) };
}

// --- 图片 widget -------------------------------------------------------------

/**
 * 裁剪显示尺寸缓存：键 = src|crop。无 width 锚点的裁剪图在 toDOM 时拿不到
 * naturalWidth（img 尚未解码），没有缓存就只能先渲染无尺寸窗口等 rAF 测量——
 * 那个过渡帧会让 CM6 的 scroll anchoring 把高度差补偿进 scrollTop（#1437）。
 * 首次测量 / 进入裁剪后写入缓存，重建时同步套用，布局零过渡。
 */
export const cropDisplayCache = new Map<
  string,
  { width: number; height: number }
>();

export function cropDisplayKey(
  src: string | null,
  crop: readonly [number, number, number, number],
): string {
  return `${src ?? ""}|${crop.join(",")}`;
}

/**
 * 点图片 / 进出裁剪时的视口护栏：把滚动位置钉回交互前的值。
 * 图片是就地编辑对象，点它不该改变视口；CM6 的选区同步与全局滚动补偿都会
 * 在这一帧把文档整体滚一下。
 */
function pinWidgetScroll(el: HTMLElement): void {
  const scroller = el.closest(".cm-scroller") as HTMLElement | null;
  if (!scroller) return;
  const top = scroller.scrollTop;
  const pin = (): void => {
    if (!scroller.isConnected) return;
    if (Math.abs(scroller.scrollTop - top) < 0.5) return;
    scroller.scrollTop = top;
  };
  requestAnimationFrame(() => {
    pin();
    requestAnimationFrame(pin);
  });
}

/**
 * 把图片引用渲染成 `<img>`（解析出 URL 时）或 `[图片: path]` 文字回退。
 * 点击选中（工具条见 imageToolbar.ts），双击放大。
 */
class ImageWidget extends WidgetType {
  private readonly _alt: string;
  private readonly _path: string;
  private readonly _src: string | null;
  private readonly _callbacks: ImageCallbacks;
  private readonly _width: number | null;
  private readonly _height: number | null;
  private readonly _title: string | null;
  private readonly _crop: [number, number, number, number] | null;
  private readonly _align: "left" | "center" | "right" | null;
  /** `!` 的文档偏移——选中态、工具条动作、拖拽改宽都以它为准。 */
  private readonly _from: number;

  constructor(
    alt: string,
    path: string,
    src: string | null,
    callbacks: ImageCallbacks,
    width: number | null = null,
    from = 0,
    height: number | null = null,
    title: string | null = null,
    crop: [number, number, number, number] | null = null,
    align: "left" | "center" | "right" | null = null,
  ) {
    super();
    this._alt = alt;
    this._path = path;
    this._src = src;
    this._callbacks = callbacks;
    this._width = width;
    this._from = from;
    this._height = height;
    this._title = title;
    this._crop = crop;
    this._align = align;
  }

  /**
   * 比较内容 + 文档偏移。
   *
   * CM6 的复用是两段式：`compare()`（= `eq`）为真时**整块复用、不调
   * `updateDOM`**；只有 `eq` 为假才走 `updateDOM`。偏移若被排除在 `eq`
   * 之外，上方编辑导致漂移后 DOM 会被直接复用、`data-image-from` 永远停在
   * 旧值——点击选中/裁剪会指到别的行（#1456 复测）。纳入 `_from` 后，漂移
   * 命中 `updateDOM` 分支：只刷新 dataset，不重建 DOM（#1320 的抖动由
   * `updateDOM` 的实现保证不重建，而不是靠 `eq` 放过偏移）。
   */
  eq(other: ImageWidget): boolean {
    return (
      other._from === this._from &&
      other._alt === this._alt &&
      other._path === this._path &&
      other._src === this._src &&
      other._width === this._width &&
      other._height === this._height &&
      other._title === this._title &&
      other._align === this._align &&
      cropEquals(other._crop, this._crop)
    );
  }

  /**
   * 偏移漂移（在上方编辑）时复用同一 DOM，只刷新锚点数据集与选中态。
   *
   * CM6 的 `findWidget` 二论：`eq` 为真且旧 DOM 仍挂在本装饰范围时走这里。
   * 内容真变了（`eq` 假）才返回 false 让 CM6 重建。
   */
  updateDOM(dom: HTMLElement, _view: EditorView, from: ImageWidget): boolean {
    if (
      from._alt !== this._alt ||
      from._path !== this._path ||
      from._src !== this._src ||
      from._width !== this._width ||
      from._height !== this._height ||
      from._title !== this._title ||
      from._align !== this._align ||
      !cropEquals(from._crop, this._crop)
    ) {
      return false;
    }
    dom.dataset.imageFrom = String(this._from);
    dom.dataset.imageTitle = this._title ?? "";
    // 选中态按新偏移重套：把手 / 角点 / 描述行都要跟上新位置。
    markImageWidgetSelected(dom, getSelectedImageFrom() === this._from);
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    setImageView(view);
    const container = document.createElement("span");
    container.className = "cm-image-widget";
    container.dataset.imageFrom = String(this._from);
    container.dataset.imageTitle = this._title ?? "";
    // 对齐：容器保持 inline-block（block 化会让其后置的 CM6 widgetBuffer
    // 自成一条 28.9px 行盒，图下多出空行），左/中/右由行级 text-align 落位
    // （editor.css 的 :has 规则）。属性缺省按居中渲染，不写回 markdown。
    const align = this._align ?? "center";
    container.dataset.align = align;
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
      let mounted: HTMLElement = img;
      // 圆角承载元素：默认 img；无 width 裁剪路径下 img 被 transform: scale
      // 缩放，圆角得放在显示域的窗口上，否则有效半径 = token × scale。
      let roundHost: HTMLElement = img;
      if (this._crop) {
        // 裁剪显示（#1349 / E-44）：外盒 = 可见裁剪显示尺寸，内图取裁剪矩形
        // 自然尺寸再用 transform 整图缩放。width 属性是「可见裁剪宽」，直接
        // 给出 scale；缺失时量整图当前显示宽度再换算（旧文档兼容）。
        const [l, t, w, h] = this._crop;
        const win = document.createElement("span");
        win.className = "image-crop-window";
        win.style.overflow = "hidden";
        win.style.display = "block";
        win.style.position = "relative";
        win.style.maxWidth = "100%";
        img.style.position = "absolute";
        img.style.left = "0px";
        img.style.top = "0px";
        img.style.maxWidth = "none";
        img.style.objectFit = "none";
        img.style.objectPosition = `${-l}px ${-t}px`;
        img.style.width = `${w}px`;
        img.style.height = `${h}px`;
        img.style.transformOrigin = "0 0";
        win.appendChild(img);

        const applyCropScale = (sx: number, sy: number): void => {
          if (!(sx > 0) || !(sy > 0)) return;
          img.style.transform = `scale(${sx}, ${sy})`;
          img.style.visibility = "visible";
        };

        const key = cropDisplayKey(this._src, this._crop);
        const recordCropDisplay = (width: number, height: number): void => {
          cropDisplayCache.set(key, { width, height });
        };

        if (this._width !== null && this._width > 0) {
          // width/height 是可见裁剪显示尺寸（声明值可能非等比拉伸）：
          // 窗口尺寸由它们直接给出，逐轴缩放同步应用——首帧度量时布局就是最终值。
          const sx = this._width / w;
          const sy = this._height !== null ? this._height / h : sx;
          win.style.width = `${this._width}px`;
          win.style.height = `${this._height !== null ? this._height : (this._width * h) / w}px`;
          applyCropScale(sx, sy);
        } else {
          const cached = cropDisplayCache.get(key);
          if (cached) {
            // 重建（确认 / 装饰重建）：同步套用上次显示尺寸，无过渡帧。
            win.style.width = `${cached.width}px`;
            win.style.height = `${cached.height}px`;
            applyCropScale(cached.width / w, cached.height / h);
          } else {
            // 首次渲染且图片未解码：先隐藏内容，等 rAF 用整图显示宽求 scale，
            // 量完即写缓存；此后同一 crop 的重建都走上面的同步分支。
            img.style.visibility = "hidden";
            const measureCropScale = (): void => {
              if (!img.isConnected || img.naturalWidth <= 0) return;
              const prevDisplay = win.style.display;
              const prev = {
                width: img.style.width,
                height: img.style.height,
                transform: img.style.transform,
                maxWidth: img.style.maxWidth,
                position: img.style.position,
                objectFit: img.style.objectFit,
                objectPosition: img.style.objectPosition,
                visibility: img.style.visibility,
              };
              win.style.display = "contents";
              img.style.width = "";
              img.style.height = "";
              img.style.transform = "";
              img.style.maxWidth = "100%";
              img.style.position = "";
              img.style.objectFit = "";
              img.style.objectPosition = "";
              const fullW = img.getBoundingClientRect().width;
              win.style.display = prevDisplay;
              img.style.width = prev.width;
              img.style.height = prev.height;
              img.style.transform = prev.transform;
              img.style.maxWidth = prev.maxWidth;
              img.style.position = prev.position;
              img.style.objectFit = prev.objectFit;
              img.style.objectPosition = prev.objectPosition;
              img.style.visibility = prev.visibility;
              const uniform = fullW / img.naturalWidth;
              if (!(uniform > 0)) return;
              const winWidth = w * uniform;
              const winHeight = h * uniform;
              win.style.width = `${winWidth}px`;
              win.style.height = `${winHeight}px`;
              applyCropScale(uniform, uniform);
              recordCropDisplay(winWidth, winHeight);
            };
            requestAnimationFrame(measureCropScale);
            img.addEventListener("load", measureCropScale);
          }
        }
        mounted = win;
        roundHost = win;
      } else {
        if (this._width !== null) {
          img.style.width = `${this._width}px`;
          img.setAttribute("data-width", String(this._width));
        }
        if (this._width !== null && this._height !== null) {
          // 宽高同给：锁死比例，max-width 夹住宽度时高度跟随缩放（#823）。
          img.style.aspectRatio = `${this._width} / ${this._height}`;
          img.style.height = "auto";
          img.setAttribute("data-height", String(this._height));
        } else if (this._height !== null) {
          img.style.height = `${this._height}px`;
          img.setAttribute("data-height", String(this._height));
        }
      }
      // 圆角取 --media-radius：与视频块（editor.css / reader.css）同一 token，
      // 预览态与编辑态不会对各自为政（#906 B8）。无 width 裁剪路径下 img 被
      // scale 缩放，圆角必须落在显示域承载（wrapper）上，否则被同倍缩小。
      const CLIP_ROUNDED = "inset(0 round var(--media-radius))";
      if (roundHost === img) {
        img.style.clipPath = CLIP_ROUNDED;
      } else {
        img.style.clipPath = "none";
        roundHost.style.clipPath = CLIP_ROUNDED;
      }
      container.appendChild(mounted);
    } else {
      appendUnresolvedPlaceholder(container, "image", this._path);
    }

    // 选中态按文档偏移套用：装饰重建后新 widget 也会拿到同一偏移。
    markImageWidgetSelected(container, getSelectedImageFrom() === this._from);

    // 图片 widget 上的 mousedown 不再下传编辑器：否则浏览器会设置文本光标，
    // CM6 再把光标滚进视口——真机表现为点击/拖动图片时整篇跳动
    // （日志：1686 → 1168，docHeight 不变，光标 788 → 901）。
    // 输入类元素（题注输入框）例外，它们需要正常的聚焦与光标。
    container.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
    });

    container.addEventListener("click", () => {
      const view = EditorView.findFromDOM(container);
      if (view) setImageView(view);
      // 偏移必须从 DOM 现读：widget 内容未变时 CM6 会复用同一份 DOM
      // （updateDOM 只刷新 dataset），闭包里的 this._from 会随上方编辑漂移，
      // 选中/裁剪会指到别的行（#1456 复测「第二张图点裁剪没反应」）。
      const liveFrom = Number(container.dataset.imageFrom);
      selectImage(
        Number.isFinite(liveFrom) ? liveFrom : this._from,
        this._path,
        this._alt,
      );
      // 点图片不移动视口：选中图片会让编辑器的光标落到该行行首，CM6 顺手
      // 把光标滚进视口，整篇文档跳一屏（#1453 复测「第一次裁剪跳到顶部」）。
      pinWidgetScroll(container);
    });
    container.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      openImageMaximize(this._src, this._alt, this._crop);
    });

    // 8 个缩放把手由 markImageWidgetSelected 按选中态增删；容器级委托让
    // 选中态变化重建把手后监听仍有效。
    if (this._src) {
      container.addEventListener("mousedown", (event) => {
        const target = event.target;
        const handle =
          target instanceof Element
            ? (target.closest("[data-handle]") as HTMLElement | null)
            : null;
        if (!handle) return;
        event.preventDefault();
        event.stopPropagation();
        this.beginResize(event, handle, container);
      });
    }

    // 新 widget 挂载后工具条要按新 DOM 重新定位。
    scheduleImageToolbarReposition();

    return container;
  }

  private beginResize(
    event: MouseEvent,
    handleEl: HTMLElement,
    container: HTMLElement,
  ): void {
    const img = container.querySelector("img");
    if (!img) return;
    const spec = IMAGE_RESIZE_HANDLES.find(
      (candidate) => candidate.handle === handleEl.dataset.handle,
    );
    if (!spec) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startW = img.getBoundingClientRect().width;
    const startH = img.getBoundingClientRect().height;
    if ((spec.width && startW <= 0) || (spec.height && startH <= 0)) return;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    // 图片未加载完时 naturalWidth/Height 为 0，退回渲染尺寸求比例。
    const ratio =
      naturalW > 0 && naturalH > 0
        ? naturalW / naturalH
        : startW > 0 && startH > 0
          ? startW / startH
          : 1;
    // 预览偏移加在 container 外边距上：margin box 尺寸不变，右/下边缘钉住，
    // 文档流不位移；松手即弃，绝不写进属性块。
    const startMarginLeft =
      parseFloat(window.getComputedStyle(container).marginLeft) || 0;
    const startMarginTop =
      parseFloat(window.getComputedStyle(container).marginTop) || 0;
    const originalWidth = img.style.width;
    const originalHeight = img.style.height;
    const originalMarginLeft = container.style.marginLeft;
    const originalMarginTop = container.style.marginTop;

    const resetPreview = (): void => {
      img.style.width = originalWidth;
      img.style.height = originalHeight;
      container.style.marginLeft = originalMarginLeft;
      container.style.marginTop = originalMarginTop;
    };

    const onMove = (move: MouseEvent): void => {
      const { width, height } = computeResize(
        spec,
        startW,
        startH,
        ratio,
        move.clientX - startX,
        move.clientY - startY,
      );
      if (spec.width) {
        img.style.width = `${Math.round(width)}px`;
        if (spec.offsetX) {
          container.style.marginLeft = `${startMarginLeft + startW - width}px`;
        }
      }
      if (spec.height) {
        img.style.height = `${Math.round(height)}px`;
        if (spec.offsetY) {
          container.style.marginTop = `${startMarginTop + startH - height}px`;
        }
      }
    };

    const onUp = (up: MouseEvent): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const dx = up.clientX - startX;
      const dy = up.clientY - startY;
      resetPreview();
      // 小于 3px 视为点击而非拖拽，不写文档。
      if (Math.hypot(dx, dy) < 3) return;
      const { width, height } = computeResize(
        spec,
        startW,
        startH,
        ratio,
        dx,
        dy,
      );
      const view = EditorView.findFromDOM(container);
      if (!view) return;
      // 同点击选中：写回位置用 DOM 上的实时偏移，避免复用 DOM 时写到旧位置。
      const liveFrom = Number(container.dataset.imageFrom);
      applyImageSize(
        view,
        Number.isFinite(liveFrom) ? liveFrom : this._from,
        spec.width ? Math.round(width) : null,
        spec.height ? Math.round(height) : null,
      );
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
}

// --- 媒体 widget（视频 / 文件） -----------------------------------------------

/** 当前选中的媒体 widget 文档偏移；null 表示未选中。 */
let selectedMediaFrom: number | null = null;

/**
 * 媒体 widget 的选中态：描边 + 8 个缩放把手（与图片共用 `IMAGE_RESIZE_HANDLES`）。
 * 不复用图片工具条的选中态：那会连带弹出图片工具条，视频不需要。
 */
function markMediaWidgetSelected(el: HTMLElement, isSelected: boolean): void {
  el.dataset.selected = isSelected ? "true" : "false";
  el.querySelectorAll(".cm-image-handle").forEach((handle) => handle.remove());
  if (!isSelected) return;
  for (const { handle, cursor } of IMAGE_RESIZE_HANDLES) {
    const span = document.createElement("span");
    span.className = "cm-image-handle";
    span.dataset.handle = handle;
    span.style.cursor = cursor;
    span.title = "拖动调整视频大小";
    el.appendChild(span);
  }
}

/** 视频容器（文件卡片不可缩放，不参与选中）。 */
const SELECTABLE_MEDIA = '.cm-media-widget[data-media-kind="video"]';

function selectMedia(from: number): void {
  selectedMediaFrom = from;
  document.querySelectorAll<HTMLElement>(SELECTABLE_MEDIA).forEach((el) => {
    const elFrom =
      el.dataset.mediaFrom !== undefined ? Number(el.dataset.mediaFrom) : null;
    markMediaWidgetSelected(
      el,
      elFrom !== null && elFrom === selectedMediaFrom,
    );
  });
}

function clearMediaSelection(): void {
  selectedMediaFrom = null;
  document.querySelectorAll<HTMLElement>(SELECTABLE_MEDIA).forEach((el) => {
    markMediaWidgetSelected(el, false);
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const target = event.target as Node | null;
    if (target instanceof Element && target.closest(".cm-media-widget")) return;
    clearMediaSelection();
  });
}

// --- 附件卡 -------------------------------------------------------------------

const SVG_NS = "http://www.w3.org/2000/svg";

/** 用 `ui/icons` 的类型图标渲染 SVG，颜色走 `--type-*`（与 `Icon` 组件同源）。 */
export function appendFileTypeIcon(host: HTMLElement, path: string): void {
  const kind = fileTypeOf(path);
  const def = ICONS[iconOfType(kind)];
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("data-icon", kind);
  svg.setAttribute("aria-hidden", "true");
  svg.style.width = "18px";
  svg.style.height = "18px";
  svg.style.flexShrink = "0";
  svg.style.display = "block";
  svg.style.color = colorOfType(kind);
  const parts = def.parts ?? [{ d: def.d, s: def.s, dash: def.dash }];
  for (const part of parts) {
    if (part.s) {
      const stroke = document.createElementNS(SVG_NS, "path");
      stroke.setAttribute("d", part.s);
      stroke.setAttribute("fill", "none");
      stroke.setAttribute("stroke", "currentColor");
      stroke.setAttribute("stroke-width", "1.7");
      stroke.setAttribute("stroke-linecap", "round");
      stroke.setAttribute("stroke-linejoin", "round");
      if (part.dash) stroke.setAttribute("stroke-dasharray", part.dash);
      svg.appendChild(stroke);
    }
    if (part.d) {
      const fill = document.createElementNS(SVG_NS, "path");
      fill.setAttribute("d", part.d);
      svg.appendChild(fill);
    }
  }
  host.appendChild(svg);
}

/**
 * 非图片媒体的 widget：视频/音频引用渲染成 `<video>/<audio controls>`，
 * 其余渲染成附件卡。`kind` 参与 `eq()`，路径改动让引用在几种形态间切换时
 * CM6 会重建 widget。
 *
 * 视频容器读 `align` / `width`（与图片同一属性语法）：默认 2/3 宽、居中，
 * 选中后出 8 个把手，拖拽只改宽度（高度按视频比例）。
 */
class MediaWidget extends WidgetType {
  constructor(
    private readonly _kind: "video" | "audio" | "file",
    private readonly _alt: string,
    private readonly _path: string,
    private readonly _src: string | null,
    private readonly _from: number = 0,
    private readonly _align: "left" | "center" | "right" | null = null,
    private readonly _width: number | null = null,
    private readonly _filePath: string | null = null,
  ) {
    super();
  }

  /**
   * 只比较业务内容，不比较 `_from`：偏移漂移由 `updateDOM` 就地刷新锚点，
   * 否则上方键入会让每个媒体 widget 重建（#1320）。
   */
  eq(other: MediaWidget): boolean {
    return (
      other._kind === this._kind &&
      other._alt === this._alt &&
      other._path === this._path &&
      other._src === this._src &&
      other._align === this._align &&
      other._width === this._width
    );
  }

  updateDOM(dom: HTMLElement, _view: EditorView, from: MediaWidget): boolean {
    if (
      from._kind !== this._kind ||
      from._alt !== this._alt ||
      from._path !== this._path ||
      from._src !== this._src ||
      from._align !== this._align ||
      from._width !== this._width
    ) {
      return false;
    }
    dom.dataset.mediaFrom = String(this._from);
    if (this._kind === "video") {
      dom.dataset.align = this._align ?? "center";
      markMediaWidgetSelected(dom, selectedMediaFrom === this._from);
    } else if (this._kind === "file") {
      dom.dataset.align = this._align ?? "left";
      dom.dataset.selected = isEmbedSelected(this._from) ? "true" : "false";
    }
    return true;
  }

  toDOM(): HTMLElement {
    const container = document.createElement("span");
    container.className = "cm-media-widget";
    container.classList.add(`cm-media-${this._kind}`);
    container.dataset.mediaKind = this._kind;
    container.style.maxWidth = "100%";
    container.style.verticalAlign = "middle";
    container.style.backgroundColor = "var(--app-surface)";
    const isVideo = this._kind === "video";
    const isAudio = this._kind === "audio";
    // 附件卡的盒模型交给 `.cm-media-file`（inline-flex），行内联块会盖掉它。
    if (this._kind !== "file") container.style.display = "inline-block";
    if (isVideo) {
      // 与图片一致：容器保持 inline-block，左/中/右由行级 text-align 落位。
      container.dataset.mediaFrom = String(this._from);
      container.dataset.align = this._align ?? "center";
      container.style.position = "relative";
      if (this._width !== null) {
        container.style.width = `${this._width}px`;
        container.dataset.width = String(this._width);
      }
    } else if (this._kind === "file") {
      // docx 等附件卡：默认左对齐，位置 / 宽度走样式面板（见 fileEmbed）。
      container.dataset.mediaFrom = String(this._from);
      container.dataset.align = this._align ?? "left";
      if (this._width !== null) {
        container.style.width = `${this._width}px`;
        container.dataset.width = String(this._width);
      }
    }

    if (isVideo || isAudio) {
      if (this._src === null) {
        appendUnresolvedPlaceholder(container, this._kind, this._path);
        return container;
      }
      const media =
        this._kind === "video"
          ? document.createElement("video")
          : document.createElement("audio");
      media.controls = true;
      media.preload = "metadata";
      // 用 setAttribute（不是 .src）：属性 getter 会按文档 base URL 解析，
      // 让渲染出的属性与源码路径不一致。
      media.setAttribute("src", this._src);
      media.style.width = "100%";
      media.style.display = "block";
      container.appendChild(media);
      if (isAudio) container.style.width = "100%";
    } else {
      this.renderAttachmentCard(container);
    }

    if (this._kind === "file") {
      container.dataset.selected = isEmbedSelected(this._from)
        ? "true"
        : "false";
      container.addEventListener("click", () => {
        selectEmbed(this._from);
      });
      scheduleEmbedPanelReposition();
      return container;
    }

    if (!isVideo) return container;

    markMediaWidgetSelected(container, selectedMediaFrom === this._from);

    container.addEventListener("click", () => {
      selectMedia(this._from);
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
      this.beginResize(event, handle, container);
    });

    return container;
  }

  private displayName(): string {
    const clean = this._path.split(/[?#]/)[0];
    const slash = clean.lastIndexOf("/");
    return (slash >= 0 ? clean.slice(slash + 1) : clean) || this._alt;
  }

  private renderAttachmentCard(container: HTMLElement): void {
    container.dataset.testid = "media-attachment";
    container.title = this._alt !== "" ? this._alt : this._path;
    container.style.cursor = "pointer";
    container.style.gap = "0.5em";

    const icon = document.createElement("span");
    icon.style.display = "inline-flex";
    icon.style.flexShrink = "0";
    appendFileTypeIcon(icon, this._path);

    const meta = document.createElement("span");
    meta.style.display = "flex";
    meta.style.flexDirection = "column";
    meta.style.minWidth = "0";
    meta.style.gap = "1px";
    const name = document.createElement("span");
    name.dataset.testid = "media-attachment-name";
    name.style.overflow = "hidden";
    name.style.textOverflow = "ellipsis";
    name.style.whiteSpace = "nowrap";
    name.style.maxWidth = "100%";
    name.textContent = this.displayName();
    const size = document.createElement("span");
    size.dataset.testid = "media-attachment-size";
    size.style.color = "var(--app-text-3)";
    size.style.fontSize = "12px";
    meta.appendChild(name);
    meta.appendChild(size);

    container.appendChild(icon);
    container.appendChild(meta);

    container.addEventListener("click", () => {
      if (!this._filePath) return;
      void invoke("open_file_external", { path: this._filePath }).catch(
        () => {},
      );
    });

    if (!this._filePath || !isTauriEnv()) return;
    invoke<{ size?: number }>("get_file_info", { path: this._filePath })
      .then((info) => {
        if (!size.isConnected) return;
        size.textContent =
          typeof info?.size === "number" ? formatFileSize(info.size) : "";
      })
      .catch(() => {
        if (size.isConnected) size.textContent = "";
      });
  }

  /** 拖拽只改宽度：高度由视频比例自动跟随，写回同一 `{width=…}` 属性语法。 */
  private beginResize(
    event: MouseEvent,
    handleEl: HTMLElement,
    container: HTMLElement,
  ): void {
    const spec = IMAGE_RESIZE_HANDLES.find(
      (candidate) => candidate.handle === handleEl.dataset.handle,
    );
    if (!spec) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = container.getBoundingClientRect().width;
    const startH = container.getBoundingClientRect().height;
    if (startW <= 0) return;
    // 上下边把手没有水平位移语义，按纵向位移换算宽度，保持只改宽度。
    const ratio = startH > 0 ? startW / startH : 16 / 9;
    const widthAt = (dx: number, dy: number): number =>
      spec.width
        ? clampWidth(startW + spec.signX * dx)
        : clampWidth(startH > 0 ? (startH + spec.signY * dy) * ratio : startW);
    const originalWidth = container.style.width;

    const onMove = (move: MouseEvent): void => {
      const width = widthAt(move.clientX - startX, move.clientY - startY);
      container.style.width = `${Math.round(width)}px`;
    };

    const onUp = (up: MouseEvent): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const dx = up.clientX - startX;
      const dy = up.clientY - startY;
      container.style.width = originalWidth;
      // 小于 3px 视为点击而非拖拽，不写文档。
      if (Math.hypot(dx, dy) < 3) return;
      const width = widthAt(dx, dy);
      const view = EditorView.findFromDOM(container);
      if (!view) return;
      applyImageSize(view, this._from, Math.round(width), null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  /**
   * 播放器保留原生行为（点击必须落到控件上）；点卡片空白处交回 CM6 放光标。
   * CM6 只在 `ignoreEvent` 返回 false 时把事件当编辑器自己的。
   */
  ignoreEvent(event: Event): boolean {
    const target = event.target as Node | null;
    return (
      target instanceof Element && target.closest("video, audio, a") !== null
    );
  }
}

// --- 装饰构建 ----------------------------------------------------------------

/**
 * 找出围栏代码块（``` 或 ~~~ 界定）与缩进代码块的行区间。
 * 返回 `[start, end)` 偏移数组。
 *
 * `exemptIndentedMedia`：编辑态传 true——整行以媒体引用开头时不当缩进代码，
 * 否则附件引用行首加空格会整块退化成源码（E-50）。预览态不传，保持既有语义。
 */
export function findFencedRanges(
  text: string,
  exemptIndentedMedia = false,
): Array<[number, number]> {
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
    const isIndented =
      /^\s{4}|\t/.test(line) &&
      !(exemptIndentedMedia && /^[ \t]*!\[/.test(line));

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
export function isInsideRange(
  pos: number,
  ranges: Array<[number, number]>,
): boolean {
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
  resolveEmbed?: FileEmbedResolver,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const resolveFn = resolve ?? (() => null);
  const callbacksFn = callbacks ?? {};

  const fencedRanges = findFencedRanges(docText, true);

  let pos = 0;
  while (pos < docText.length) {
    const idx = docText.indexOf("![", pos);
    if (idx < 0) break;
    const ref = scanImageReference(docText, idx);
    if (!ref) {
      pos = idx + 2;
      continue;
    }
    pos = ref.attrEnd ?? ref.end;
    if (isInsideRange(idx, fencedRanges)) continue;

    const alt = ref.alt;
    const path = ref.path;
    const embedKind = classifyFileEmbed(path);
    const kind = classifyMedia(path);
    const from = ref.start;
    const to = ref.end;
    const attrs =
      ref.attrText !== null
        ? parseImageAttributes(ref.attrText)
        : { ...EMPTY_IMAGE_ATTRIBUTES };

    if (embedKind) {
      // 插入文件内嵌（D10 / B5a）：pdf / md / html / 网页渲染真实内容。
      decorations.push(
        Decoration.replace({
          widget: new FileEmbedWidget(
            embedKind,
            alt,
            path,
            resolveEmbed?.(path) ?? null,
            from,
            attrs.align,
            attrs.width,
            attrs.height,
            ref.title,
          ),
          inclusive: false,
        }).range(from, to),
      );
    } else if (kind === "image") {
      // 图片路径解析（行为不变：null → 文字回退）。
      const src = resolveFn(path);
      const width = attrs.width ?? parseImageWidth(docText, to);
      decorations.push(
        Decoration.replace({
          widget: new ImageWidget(
            alt,
            path,
            src,
            callbacksFn,
            width,
            from,
            attrs.height,
            ref.title,
            attrs.crop,
            attrs.align,
          ),
          inclusive: false,
        }).range(from, to),
      );
    } else {
      // 视频/音频复用图片解析器；解析不出就是 null，由 MediaWidget 出显式占位。
      // 附件卡要拿绝对路径做系统打开与文件大小，复用内嵌解析器的 filePath。
      const src = kind === "video" || kind === "audio" ? resolveFn(path) : null;
      const filePath =
        kind === "file" ? (resolveEmbed?.(path)?.filePath ?? null) : null;
      decorations.push(
        Decoration.replace({
          widget: new MediaWidget(
            kind,
            alt,
            path,
            src,
            from,
            attrs.align,
            attrs.width,
            filePath,
          ),
          inclusive: false,
        }).range(from, to),
      );
    }

    // 属性块与旧宽度注释都是持久化用的，不该在正文里露出来。
    if (ref.attrStart !== null && ref.attrEnd !== null) {
      decorations.push(
        Decoration.replace({ inclusive: false }).range(
          ref.attrStart,
          ref.attrEnd,
        ),
      );
    }
    const afterAttrs = ref.attrEnd ?? to;
    const commentEnd = imageWidthCommentEnd(docText, afterAttrs);
    if (commentEnd !== null) {
      decorations.push(
        Decoration.replace({ inclusive: false }).range(afterAttrs, commentEnd),
      );
    }
  }

  return decorations;
}
