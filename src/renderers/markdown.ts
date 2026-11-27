import { marked } from "marked";
import DOMPurify from "dompurify";
import { mediaKindOf } from "../lib/mediaUrl";
import { FRONTMATTER_RE } from "../lib/frontmatter";
import { highlightCodeBlock } from "./highlight";
import {
  mathBlockExtension,
  mathInlineExtension,
  resetMathStore,
  takeMathHtml,
} from "./math";
import {
  BLOCK_HTML_TAGS,
  SANITIZE_ALLOWED_TAGS,
  isUnknownStructuralTagLine,
} from "../editors/decorations/structuralTagPattern";
import {
  scanImageReference,
  parseImageAttributes,
  findFencedRanges,
  isInsideRange,
  type ImageAttributes,
} from "../editors/decorations/image";
import {
  calloutCssVars,
  highlightCssVars,
  parseCalloutAttrs,
} from "../editors/callout-attrs";
import { resolveCalloutType } from "../editors/callout-types";
import {
  getCalloutEmojiSnapshot,
  type CalloutEmojiSnapshot,
} from "../editors/callout-emoji-overrides";
import { classifyFileEmbed } from "../editors/decorations/fileEmbed";
import { fileTypeOf, iconOfType, colorOfType } from "../lib/fileType";
import { isTauriEnv } from "../utils/tauri";

// ── 块级 HTML 深度闭合（对齐 Obsidian 的 HTML 块行为）────────
// marked 的 html 正则把块级标签一律吞到下一个空行，用户写
// `<div>…</div>` 卡片后再接 markdown 时，后续内容会整段被吞。

const OPEN_BLOCK_HTML_RE = new RegExp(
  `^ {0,3}<(${BLOCK_HTML_TAGS})(?:\\s[^>]*)?>(?=[ \\t]*(?:\\n|$))`,
  "i",
);

// 匹配 <tag …> / </tag> / <tag …/> 完整标签，用于嵌套深度计数。
// 自闭合（<tag/>）与闭标签都让深度减一或归零，开标签深度加一。
const CLOSE_TAG_RE = (tag: string) =>
  new RegExp(`<\\/?${tag}(?:\\s[^>]*?)?\\/?>`, "gi");

/**
 * 允许的标签：markdown 基本集 + 富文本安全子集（支持 md 内嵌 HTML/CSS）。
 * 不放开 script / iframe / form / style 标签与事件属性（DOMPurify 默认拒绝）。
 * style 属性放开后，内嵌 CSS 才能生效；position: fixed 的外逃由
 * .preview-content 的 `contain: layout paint style` 兜住（见 reader.css）。
 */
const SANITIZE_CONFIG = {
  // DOMPurify 默认只放行 http(s)/mailto/… 等协议，`asset:` 与 `media:` 会被
  // 当成危险 URL 把整个 src 属性剥掉——元素还在、图是空的，表现为「插入后
  // 不显示」。这两个协议是本应用自己的本地读取通道，必须显式放行。
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|asset|media):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ALLOWED_TAGS: SANITIZE_ALLOWED_TAGS,
  ALLOWED_ATTR: [
    "href",
    "src",
    "alt",
    // 编辑态拖拽写下的图片宽度/高度/对齐：渲染时由 span 占位带到 img 上，必须放行
    "data-img-width",
    "data-img-height",
    "data-img-align",
    "data-img-crop",
    "width",
    "title",
    "class",
    "target",
    "type",
    "checked",
    "disabled",
    "style",
    "id",
    "colspan",
    "rowspan",
    "start",
    "value",
    "width",
    "height",
    "open",
    "lang",
    "dir",
    "data-math",
    "data-callout",
    // 内嵌容器：md 卡 / iframe 占位 / 附件卡
    "data-embed-kind",
    "data-embed-path",
    "data-embed-name",
    "data-embed-src",
    "data-embed-title",
    "data-icon",
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ["target", "controls", "preload", "playsinline"],
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

marked.use({
  extensions: [mathBlockExtension, mathInlineExtension],
  tokenizer: {
    html(src: string) {
      // 块级 HTML：独立开标签行 → 深度匹配闭合标签处结束（空行兜底）。
      // marked 默认把块级 HTML 吞到下一个空行（CommonMark），导致
      // `</div>` 后紧跟的 markdown 语法被吞、孤立的 ``` 变成未闭合围栏
      //（Obsidian 用户的 HTML 卡片 + markdown 混排会因此整个错乱）。
      const open = OPEN_BLOCK_HTML_RE.exec(src);
      if (open) {
        const tag = open[1].toLowerCase();
        const re = CLOSE_TAG_RE(tag);
        let depth = 1;
        const i = open[0].length;
        const parts: string[] = [];
        for (const line of src.slice(i).split("\n")) {
          if (parts.length > 0 && /^\s*$/.test(line)) break;
          parts.push(line);
          re.lastIndex = 0;
          let mm: RegExpExecArray | null;
          while ((mm = re.exec(line))) {
            const t = mm[0];
            if (t.startsWith("</")) depth -= 1;
            else if (!t.endsWith("/>")) depth += 1;
          }
          if (depth <= 0) break;
        }
        const raw = src.slice(0, i) + parts.join("\n");
        return { type: "html", block: true, raw, pre: false, text: raw };
      }
      // 其余 HTML（注释 / script/pre/style / 行内标签）走 marked 默认
      const rules = (
        this as unknown as {
          rules: { block: { html: RegExp } };
        }
      ).rules;
      const cap = rules.block.html.exec(src);
      if (cap) {
        return {
          type: "html",
          block: true,
          raw: cap[0],
          pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
          text: cap[0],
        };
      }
      return undefined;
    },
  },
  renderer: {
    code(code: string, language?: string) {
      const lang = (language ?? "").trim().split(/\s+/)[0] || "";
      if (lang.toLowerCase() === "mermaid") {
        // 图源码原样留在 pre 里，客户端再渲染成 SVG（见 renderers/mermaid.ts）
        return `<div class="mermaid-block wide"><pre class="mermaid">${escapeHtml(code)}</pre></div>`;
      }
      const highlighted = highlightCodeBlock(code, lang);
      const inner = highlighted ?? escapeHtml(code);
      const label = lang
        ? `<div class="code-lang">${escapeHtml(lang)}</div>`
        : "";
      const copy = `<button class="code-copy" type="button">复制</button>`;
      return `<div class="code-block wide">${label}${copy}<pre><code>${inner}</code></pre></div>`;
    },
    image(href: string, title: string | null, text: string) {
      const alt = escapeHtml(text ?? "");
      const caption = title
        ? `<figcaption>${escapeHtml(title)}</figcaption>`
        : "";
      // 文档内相对引用要落到文档目录并换成 WebView 能读的协议；
      // 解析不出来（浏览器 / 未保存文档）就保留原 href，至少不伪造一个路径。
      const resolved = activeResolveMedia?.(href) ?? href;
      const src = escapeHtml(resolved);
      const kind = mediaKindOf(href);
      if (kind === "video" || kind === "audio") {
        // `![](clip.mp4)` 在预览里是播放器，不是一张裂图。
        const tag = kind === "video" ? "video" : "audio";
        const preload = kind === "video" ? "auto" : "metadata";
        return `<figure class="wide"><${tag} controls preload="${preload}" src="${src}"></${tag}>${caption}</figure>`;
      }
      // 非图片引用不再退化成裂图：md / pdf / html / 网页 / 附件卡各有形态。
      const embed = classifyFileEmbed(href);
      if (embed === "md") {
        // 内容由调用方（PreviewView）读文件后填充，这里先出可见容器。
        return `<figure class="wide"><div class="preview-embed-md" data-embed-kind="md" data-embed-path="${escapeHtml(href)}" data-embed-name="${alt}"></div>${caption ? `<figcaption>${escapeHtml(title ?? "")}</figcaption>` : ""}</figure>`;
      }
      if (embed === "pdf" || embed === "html" || embed === "web") {
        // iframe 不进 DOMPurify 白名单（「禁止 iframe」既有安全契约），
        // 先出占位 div，postProcess 在 sanitize 之后换成真 iframe。
        const url = resolved && resolved !== href ? resolved : href;
        return `<figure class="wide"><div class="preview-embed-iframe" data-embed-src="${escapeHtml(url)}" data-embed-title="${alt}"></div>${caption}</figure>`;
      }
      if (kind === "file") {
        // zip 等本地附件：图标 + 文件名 + 打开链接，不出 <img>。
        const name = alt || baseNameOfHref(href);
        const type = fileTypeOf(href);
        const open = isTauriEnv()
          ? `<a class="preview-embed-open" href="${escapeHtml(resolved)}" target="_blank" rel="noopener">打开</a>`
          : "";
        return (
          `<figure class="wide"><div class="preview-embed-attachment" data-embed-kind="file" data-embed-path="${escapeHtml(href)}">` +
          `<span class="preview-embed-icon" data-icon="${iconOfType(type)}" style="color:${colorOfType(type)}"></span>` +
          `<span class="preview-embed-name">${escapeHtml(name)}</span>${open}</div>${caption}</figure>`
        );
      }
      return `<figure class="wide"><img src="${src}" alt="${alt}" />${caption}</figure>`;
    },
    table(header: string, body: string) {
      return `<div class="table-wrap wide"><table>\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table></div>`;
    },
  },
});

/** 视频块取首帧：hydrate 后挂 loadedmetadata seek，未播放先显示画面不黑屏（#1518）。 */
export function wireVideoFirstFrames(root: ParentNode): void {
  root.querySelectorAll("video").forEach((node) => {
    const video = node as HTMLVideoElement;
    if (video.dataset.firstFrameWired === "1") return;
    video.dataset.firstFrameWired = "1";
    video.setAttribute("preload", "auto");
    const seek = () => {
      try {
        if (video.currentTime === 0)
          video.currentTime = Math.min(0.1, video.duration || 0.1);
      } catch {
        /* 元数据未就绪时忽略 */
      }
    };
    video.addEventListener("loadedmetadata", seek);
    if (video.readyState >= 1) seek();
  });
}

let checkboxGuardRegistered = false;

function registerCheckboxGuard(): void {
  if (checkboxGuardRegistered) return;
  checkboxGuardRegistered = true;
  // GFM 任务列表通过 input[type=checkbox][disabled] 渲染；其余 input 一律剥离属性
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName !== "INPUT") return;
    const input = node as HTMLInputElement;
    if (input.type !== "checkbox" || !input.disabled) {
      input.removeAttribute("type");
      input.removeAttribute("checked");
      input.removeAttribute("disabled");
    }
  });
}

// 文档开头的 YAML frontmatter：Obsidian 阅读视图默认隐藏，不参与渲染。
// 剥离后 `---` 不会再被 marked 解析成 hr、`tags:` 解析成标题。
// 正则复用 lib/frontmatter：与面板解析同源，含 BOM 与前导空格容忍（#1277）。

// ── 块对齐围栏 div（shell-editor-batch5 D16）────────────────
// `::: {.align-left|center|right}` … `:::` → `<div class="layout-align-*">`，
// 内部内容仍交给 marked 解析。没有闭合 `:::` 的半截包裹原样留下。

const ALIGN_DIV_OPEN_RE = /^ {0,3}::: {(\.align-(?:left|center|right))}\s*$/;
const ALIGN_DIV_CLOSE_RE = /^ {0,3}:::\s*$/;

function preprocessAlignmentDivs(src: string): string {
  const lines = src.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const open = ALIGN_DIV_OPEN_RE.exec(lines[i]);
    if (!open) {
      result.push(lines[i]);
      i += 1;
      continue;
    }

    let depth = 1;
    let end = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (ALIGN_DIV_OPEN_RE.test(lines[j])) depth += 1;
      else if (ALIGN_DIV_CLOSE_RE.test(lines[j])) {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }

    if (end === -1) {
      result.push(lines[i]);
      i += 1;
      continue;
    }

    result.push(`<div class="layout-${open[1].slice(1)}">`);
    result.push("");
    for (let k = i + 1; k < end; k += 1) result.push(lines[k]);
    result.push("");
    result.push("</div>");
    i = end + 1;
  }

  return result.join("\n");
}

// ── 预览分栏围栏 div（editor-surface-batch17 D5）────────────────
// `::: {.col-N}` / `::: {cols=N}`（N=1..6）… `:::` → `<div class="layout-col-N">`，
// 内部 markdown 递归交给 marked。非 col 围栏与未闭合围栏保持原样、不吞内容。

const COL_DIV_OPEN_RE = /^ {0,3}:::+\s*\{([^}]*)\}\s*$/;
const COL_DIV_CLOSE_RE = /^ {0,3}:::+\s*$/;
const COL_ATTR_RE = /(?:\.col-([1-6])\b)|(?:cols\s*=\s*([1-6])\b)/;

/** 该行是否是 col 分栏开围栏，是则返回栏数，否则 null。 */
function colDivOf(line: string): number | null {
  const open = COL_DIV_OPEN_RE.exec(line);
  if (!open) return null;
  const attr = COL_ATTR_RE.exec(open[1]);
  if (!attr) return null;
  return Number(attr[1] ?? attr[2]);
}

// 分栏 div 用占位符过渡：外层 marked 的 HTML 块分词遇到渲染后内部 HTML 里的
// 空行会提前截断（代码块内含空行会被截坏），占位符让内部 HTML 绕过这一轮分词。
const columnDivPlaceholders = new Map<string, string>();
let columnPlaceholderSeq = 0;

function preprocessColumnDivs(src: string): string {
  const lines = src.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const cols = colDivOf(lines[i]);
    if (cols === null) {
      result.push(lines[i]);
      i += 1;
      continue;
    }

    let depth = 1;
    let end = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (COL_DIV_OPEN_RE.test(lines[j])) depth += 1;
      else if (COL_DIV_CLOSE_RE.test(lines[j])) {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }

    if (end === -1) {
      result.push(lines[i]);
      i += 1;
      continue;
    }

    const inner = lines.slice(i + 1, end).join("\n");
    const innerHtml = marked.parse(preprocessColumnDivs(inner), {
      async: false,
    }) as string;
    columnPlaceholderSeq += 1;
    const placeholder = `<!--biaoyue-col-${columnPlaceholderSeq}-->`;
    columnDivPlaceholders.set(
      placeholder,
      `<div class="layout-col-${cols}">${innerHtml}</div>`,
    );
    result.push(placeholder);
    i = end + 1;
  }

  return result.join("\n");
}

// 结构标签行清理（#255）：
// 独占一行的未知 HTML 标签会触发 CommonMark type-7 HTML 块，从这行起
// 一直吞到下一个空行——后面的 `## 标题`、表格行全被当成 HTML 原文，
// 表现为标题样式丢失、表格不渲染。这些标签是文档的结构标记
//（`<objective>` / `</essential_principles>` 等），预览里不该出现，
// 直接删行即可。
const FENCE_LINE_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*(.*)$/;

/**
 * 删掉独占一行的未知结构标签（开 / 闭 / 自闭合）。
 *
 * 行内标签（`正文 <u>下划线</u>`）不匹配——正则要求整行只有标签；
 * 围栏代码块内的行是代码内容，跳过。
 */
function stripStructuralTagLines(content: string): string {
  const lines = content.split("\n");
  const kept: string[] = [];
  let fence: { char: string; len: number } | null = null;

  for (const line of lines) {
    const fenceMatch = FENCE_LINE_RE.exec(line);
    if (fence) {
      kept.push(line);
      if (
        fenceMatch &&
        fenceMatch[2][0] === fence.char &&
        fenceMatch[2].length >= fence.len &&
        fenceMatch[3].trim() === ""
      ) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      fence = { char: fenceMatch[2][0], len: fenceMatch[2].length };
      kept.push(line);
      continue;
    }
    if (isUnknownStructuralTagLine(line)) continue;
    kept.push(line);
  }

  return kept.join("\n");
}

/**
 * 当前这次渲染使用的媒体解析器。
 *
 * marked 的 renderer 在模块作用域注册，没法按调用传参；沿用 `resetMathStore`
 * 的做法，渲染前设一次、渲染后清掉。并发渲染（多个预览面板）会互相覆盖——
 * 两个面板的文档目录不同，但同一时刻只有一个 `renderMarkdown` 在跑（同步）。
 */
let activeResolveMedia: ((href: string) => string | null) | null = null;

/**
 * 当前这次渲染使用的 callout emoji 覆盖快照（会话内，来自编辑态发布）。
 *
 * 与 `activeResolveMedia` 同策略：模块作用域、渲染前设、渲染后清。预览与
 * 编辑在同一文档上共享一份快照，换文档时签名不匹配自动回落类型默认。
 */
let activeCalloutEmoji: CalloutEmojiSnapshot = [];

export interface RenderMarkdownOptions {
  /** 把文档内相对引用解析成可加载 URL；返回 null 走原始 href。 */
  resolveMedia?: (href: string) => string | null;
}

const LEGACY_WIDTH_COMMENT_RE = /^([ \t]*\n)?[ \t]*<!--\s*w=(\d+)\s*(?:-->|—>)/;

function legacyWidthComment(
  text: string,
  after: number,
): { end: number; width: number } | null {
  const match = LEGACY_WIDTH_COMMENT_RE.exec(text.slice(after, after + 64));
  if (!match) return null;
  const width = Number(match[2]);
  if (!Number.isFinite(width)) return null;
  return { end: after + match[0].length, width };
}

function imageAttributesCarrier(attrs: ImageAttributes): string {
  const parts: string[] = [];
  if (attrs.width !== null) parts.push(`data-img-width="${attrs.width}"`);
  if (attrs.height !== null) parts.push(`data-img-height="${attrs.height}"`);
  if (attrs.align !== null) parts.push(`data-img-align="${attrs.align}"`);
  if (attrs.crop !== null)
    parts.push(`data-img-crop="${attrs.crop.join(",")}"`);
  return parts.length > 0 ? `<span ${parts.join(" ")}></span>` : "";
}

/**
 * 把图片属性块（以及旧宽度注释）换成隐藏的 data span。括号感知：路径里的
 * `(1)` 不会被误判成引用结尾；代码块里的引用保持原样。
 */
function preprocessImageAttributes(content: string): string {
  const codeRanges = findFencedRanges(content);
  let result = "";
  let pos = 0;
  while (pos < content.length) {
    const idx = content.indexOf("![", pos);
    if (idx < 0) {
      result += content.slice(pos);
      break;
    }
    const ref = scanImageReference(content, idx);
    if (!ref) {
      result += content.slice(pos, idx + 2);
      pos = idx + 2;
      continue;
    }
    if (isInsideRange(idx, codeRanges)) {
      result += content.slice(pos, ref.end);
      pos = ref.end;
      continue;
    }
    result += content.slice(pos, ref.end);
    const attrs =
      ref.attrText !== null
        ? parseImageAttributes(ref.attrText)
        : { width: null, height: null, align: null, crop: null };
    let cursor = ref.end;
    if (ref.attrStart !== null && ref.attrEnd !== null) {
      result += imageAttributesCarrier(attrs);
      cursor = ref.attrEnd;
    }
    const legacy = legacyWidthComment(content, cursor);
    if (legacy && attrs.width === null) {
      result += `<span data-img-width="${legacy.width}"></span>`;
    }
    if (legacy) cursor = legacy.end;
    pos = cursor;
  }
  return result;
}

export function renderMarkdown(
  content: string,
  options: RenderMarkdownOptions = {},
): string {
  if (!content) return "";

  activeResolveMedia = options.resolveMedia ?? null;
  activeCalloutEmoji = getCalloutEmojiSnapshot(content);

  try {
    registerCheckboxGuard();
    resetMathStore();

    // `![x](a.png){width=635}` 与旧 `![x](a.png)<!--w=635-->`：属性块/注释是给
    // 编辑态持久化用的，直接在正文里渲染出来会变成一行可见文本。这里先换成带
    // data 属性的 span，等 DOM 建好再取到图片上。
    const stripped = content.replace(FRONTMATTER_RE, "");
    const withWidths = preprocessImageAttributes(stripped);
    columnDivPlaceholders.clear();
    columnPlaceholderSeq = 0;
    const body = preprocessColumnDivs(
      preprocessAlignmentDivs(stripStructuralTagLines(withWidths)),
    );
    let raw = marked.parse(body, { async: false }) as string;
    // 从最外层占位符开始替换：外层 HTML 里嵌着内层占位符，顺序不能颠倒。
    for (const [placeholder, html] of [...columnDivPlaceholders].reverse()) {
      raw = raw.split(placeholder).join(html);
    }
    const clean = DOMPurify.sanitize(raw, SANITIZE_CONFIG);
    return postProcess(clean);
  } finally {
    // 抛错也要收口模块状态，否则下一次渲染会读到上一次的媒体解析器/emoji 快照。
    activeResolveMedia = null;
    activeCalloutEmoji = [];
  }
}

/**
 * 把 data span 上的宽度/高度/对齐落到前一张图上，并清掉占位节点。
 *
 * 值来自编辑态写下的属性块 / 旧宽度注释；预览必须尊重同一个值，否则一份
 * 文档在两种模式下排版不一致。
 */
function applyImageAttributes(doc: Document): void {
  doc
    .querySelectorAll(
      "[data-img-width], [data-img-height], [data-img-align], [data-img-crop]",
    )
    .forEach((marker) => {
      const width = Number(marker.getAttribute("data-img-width"));
      const height = Number(marker.getAttribute("data-img-height"));
      const align = marker.getAttribute("data-img-align");
      const hasWidth = Number.isFinite(width) && width > 0;
      const hasHeight = Number.isFinite(height) && height > 0;
      const cropRaw = marker.getAttribute("data-img-crop");
      const crop =
        cropRaw !== null
          ? cropRaw.split(",").map((value) => Number(value))
          : null;
      const hasCrop =
        crop !== null &&
        crop.length === 4 &&
        crop.every((value) => Number.isFinite(value) && value >= 0);
      let node = marker.previousElementSibling;
      if (!node) node = marker.parentElement;
      const img = node?.querySelector?.("img") ?? null;
      if (img) {
        const style: string[] = [];
        // 裁剪显示与编辑态同一套几何：盒 = 可见显示尺寸（声明 width/height，
        // 声明比可能与裁剪矩形自然比不同），内图取自然尺寸再逐轴缩放 + 平移，
        // 溢出裁掉。预览曾经用 object-fit:none + object-position 直接 1:1 偏移，
        // 不缩放，看到的区域与编辑态调整后的不同（#1453 复测）。
        let cropWrap: HTMLElement | null = null;
        if (hasCrop) {
          const [l, t, w, h] = crop;
          const boxW = hasWidth ? width : w;
          const boxH = hasHeight ? height : (boxW * h) / w;
          const doc = img.ownerDocument;
          const sx = boxW / w;
          const sy = boxH / h;
          cropWrap = doc.createElement("span");
          cropWrap.className = "preview-img-crop";
          cropWrap.setAttribute(
            "style",
            "display:block;position:relative;overflow:hidden;" +
              `width:${boxW}px;max-width:100%;height:${boxH}px;` +
              "margin-inline:auto;" +
              "border-radius:var(--media-radius);" +
              "box-shadow:0 1px 3px rgba(31, 26, 20, 0.08);",
          );
          style.push(
            "position:absolute",
            "left:0",
            "top:0",
            "max-width:none",
            "width:auto",
            "height:auto",
            "object-fit:none",
            `transform:translate(${-l * sx}px,${-t * sy}px) scale(${sx},${sy})`,
            "transform-origin:0 0",
            "border-radius:0",
            "box-shadow:none",
            "margin:0",
          );
          img.parentElement?.insertBefore(cropWrap, img);
          cropWrap.appendChild(img);
        } else {
          if (hasWidth) img.setAttribute("width", String(width));
          if (hasHeight) img.setAttribute("height", String(height));
          if (hasWidth || hasHeight) {
            // 预览样式给 img 定了 `height: auto`，表现属性会被 CSS 压掉，
            // 显式高度必须走内联样式才生效。宽高同给时锁 aspect-ratio，
            // 否则 max-width 只夹宽度、高度不变，容器变窄就拉歪（#823）。
            style.push("max-width:100%");
            if (hasWidth) style.push(`width:${width}px`);
            if (hasWidth && hasHeight)
              style.push(`aspect-ratio:${width} / ${height}`);
            style.push(
              hasHeight && !hasWidth ? `height:${height}px` : "height:auto",
            );
          }
        }
        if (align === "left" || align === "center" || align === "right") {
          // 预览里 img 是 `display:block; margin-inline:auto`，对 figure 设
          // text-align 不改变位置，对齐只能落在图片自己的外边距上；裁剪态
          // 外盒才是占位元素（img 已绝对定位进盒内），对齐落在外盒上。
          if (cropWrap) {
            cropWrap.style.marginLeft =
              align === "right" ? "auto" : align === "center" ? "auto" : "0";
            cropWrap.style.marginRight =
              align === "left" ? "auto" : align === "center" ? "auto" : "0";
          } else {
            if (align === "left")
              style.push("margin-left:0", "margin-right:auto");
            if (align === "right")
              style.push("margin-left:auto", "margin-right:0");
            if (align === "center") style.push("margin-inline:auto");
          }
          const target = img.closest("figure") ?? img.parentElement;
          target?.setAttribute("style", `text-align:${align}`);
        }
        if (style.length > 0) img.setAttribute("style", style.join(";"));
      } else {
        // 非图片引用（#1415 起的 md / iframe / 附件卡）：没有 img，对齐落在
        // 容器的父级 text-align 上（附件卡是 inline-flex）。md/iframe 是整宽
        // 块，text-align 无副作用。
        const card =
          node?.querySelector?.(
            ".preview-embed-md, .preview-embed-iframe, .preview-embed-attachment",
          ) ??
          (node?.matches?.(
            ".preview-embed-md, .preview-embed-iframe, .preview-embed-attachment",
          )
            ? node
            : null);
        if (
          card &&
          (align === "left" || align === "center" || align === "right")
        ) {
          const host = card.parentElement ?? card;
          host.setAttribute("style", `text-align:${align}`);
        }
      }
      marker.remove();
    });
}

/** 取引用路径末段作显示名；URL 去掉 query/hash。 */
function baseNameOfHref(href: string): string {
  const clean = href.split(/[?#]/)[0];
  const slash = clean.lastIndexOf("/");
  return slash >= 0 ? clean.slice(slash + 1) : clean;
}

/**
 * 把 iframe 占位 div 换成真 iframe（sanitize 之后，故不进 DOMPurify 白名单）。
 * sandbox 与 fileEmbed 的 iframe 同口径：脚本 / 同源 / 弹窗。
 */
function hydrateEmbedIframes(doc: Document): void {
  doc
    .querySelectorAll<HTMLElement>(".preview-embed-iframe[data-embed-src]")
    .forEach((el) => {
      const src = el.dataset.embedSrc;
      if (!src) return;
      const iframe = doc.createElement("iframe");
      iframe.className = "preview-embed-iframe wide";
      iframe.setAttribute("src", src);
      iframe.setAttribute("title", el.dataset.embedTitle || "内嵌页面");
      iframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-popups",
      );
      iframe.setAttribute("loading", "lazy");
      el.replaceWith(iframe);
    });
}

/** sanitize 之后的一趟 DOM 处理：Callout → 图片属性 → 公式回填 → 链接 → 中西文间距 */
function postProcess(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  convertCallouts(doc);
  applyImageAttributes(doc);
  prepareDarkColors(doc);
  fillMath(doc);
  hydrateEmbedIframes(doc);
  doc.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (
      href !== "" &&
      !href.startsWith("http") &&
      !href.startsWith("#") &&
      !href.startsWith("mailto:")
    ) {
      // 本地文档链接：交给预览态做「点击打开 / ⌘+悬停浮窗」（B3.2）。
      a.setAttribute("data-local-doc", href);
    }
    if (!a.getAttribute("target")) a.setAttribute("target", "_blank");
  });
  // ponytail: 超长文档跳过间距处理——遍历全部文本节点的成本不值得
  if ((doc.body.textContent ?? "").length < 200_000) {
    addCjkSpacing(doc);
  }
  return doc.body.innerHTML;
}

// ── Callout ────────────────────────────────────────────
// 类型名对齐 Obsidian：允许字母数字与 -_/.; 等符号，且 [! 后、
// ] 前可带空白（如 [!TL;DR]、[! TL]、[!NOTE ]），大小写不敏感。
const CALLOUT_HEAD = /^\[!\s*([^\]\r\n]+?)\s*\]([+-]?)(\{[^}]*\})?/;

/**
 * 把文本节点里的 `\n` 换成 `<br>`（纯高亮 / 标注正文多行不再合并成一段）。
 *
 * marked 默认不开 breaks，软换行输出的是换行符；预览若折叠成空格，连续 `>`
 * 行会排成一段话。规则：对第 i>0 段，若 `i < parts.length-1 || parts[i] !== ""`
 * 先插 `<br>`，再在 part 非空时插入文本节点——即只在段间插 `<br>`，段首/段尾
 * 的多余换行不产生空行。纯空白文本节点不动；PRE/CODE/SCRIPT/STYLE/TEXTAREA
 * 子树整体跳过。
 */
function insertSoftBreaks(root: Node): void {
  const doc = root.ownerDocument ?? (root as Document);
  if (!doc) return;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const parent = text.parentElement;
    if (!parent || parent.closest("pre, code, script, style, textarea")) {
      continue;
    }
    const value = text.nodeValue ?? "";
    if (!value.includes("\n")) continue;
    if (text.textContent?.trim() === "") continue;
    targets.push(text);
  }

  for (const text of targets) {
    const parts = (text.nodeValue ?? "").split("\n");
    const frag = doc.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i > 0 && (i < parts.length - 1 || part !== "")) {
        frag.appendChild(doc.createElement("br"));
      }
      if (part !== "") frag.appendChild(doc.createTextNode(part));
    });
    text.replaceWith(frag);
  }
}

function convertCallouts(doc: Document): void {
  // 每个「合法类型」的引用块式 callout 占一个序号（与编辑态 `findCalloutBlocks`
  // 的顺序一致），这样 emoji 覆盖快照才能对上位次。非法类型既不渲染成卡片、
  // 也不占序号——编辑态 `findCalloutBlocks` 同样跳过它，两边同源。
  let calloutIndex = 0;
  doc.querySelectorAll("blockquote").forEach((bq) => {
    const first = bq.firstElementChild;
    if (!first) return;
    // 首子元素在 childNodes 里的下标不一定是 0（前后可能有空白文本节点），
    // 正文必须从它之后开始取，否则整段会被再拼一次
    const children = Array.from(bq.childNodes);
    const after = children.slice(children.indexOf(first) + 1);

    const m = CALLOUT_HEAD.exec(first.innerHTML);
    if (!m) return;

    const type = m[1].toLowerCase();
    const resolved = resolveCalloutType(type);
    // 非法类型（[!FOO]）：既不渲染成卡片、也不占序号，原 blockquote 保持不动
    // （未 replaceWith）——与编辑态 findCalloutBlocks 的跳过同源。
    if (!resolved) return;
    const fold = m[2];
    const attrs = parseCalloutAttrs(m[3] ?? "");
    const rest = first.innerHTML.slice(m[0].length);

    // 首行是标题（到第一个 <br> 或换行符为止），其余是正文
    // marked 默认不开 breaks，软换行输出的是换行符而非 <br>
    const sep = /<br\s*\/?>|\n/.exec(rest);
    const at = sep ? sep.index : -1;
    const titleHtml = (at >= 0 ? rest.slice(0, at) : rest).trim();
    let bodyHtml = sep ? rest.slice(sep.index + sep[0].length) : "";

    after.forEach((n) => {
      bodyHtml += (n as Element).outerHTML ?? n.textContent ?? "";
    });

    const index = calloutIndex;
    calloutIndex += 1;

    const isMark = type === "highlight";
    // 纯高亮无标题栏，折叠标记不生效（与编辑态一致）：即便写了 [!highlight]-/
    // + 也渲染成普通 div，不出 details/summary。
    const el = doc.createElement(fold && !isMark ? "details" : "div");
    el.className = isMark ? "callout callout-mark" : "callout";
    el.setAttribute("data-callout", type);
    if (fold === "+") el.setAttribute("open", "");
    const vars = isMark ? highlightCssVars(attrs) : calloutCssVars(attrs);
    if (vars.bg) el.style.setProperty("--callout-bg", vars.bg);
    if (vars.border) el.style.setProperty("--callout-border", vars.border);
    if (vars.text) el.style.setProperty("--callout-text", vars.text);

    if (isMark) {
      // 纯高亮：无标题行、四边 1px 细边，emoji 内联在正文首行前（豆包同款）。
      // 覆盖快照按位次取，缺省回落类型默认 emoji（highlight 恒有 icon）。
      const emoji = activeCalloutEmoji[index] ?? resolved.icon;
      el.setAttribute("data-callout-emoji", emoji);
      const iconEl = doc.createElement("span");
      iconEl.className = "callout-mark-icon";
      iconEl.textContent = emoji;
      el.appendChild(iconEl);

      const body = doc.createElement("div");
      body.className = "callout-mark-body";
      if (bodyHtml) {
        const wrap = doc.createElement("div");
        wrap.innerHTML = bodyHtml;
        while (wrap.firstChild) body.appendChild(wrap.firstChild);
      }
      insertSoftBreaks(body);
      el.appendChild(body);
      bq.replaceWith(el);
      return;
    }

    const titleEl = doc.createElement(fold ? "summary" : "div");
    if (!fold) titleEl.className = "callout-title";
    // 空标题不补默认名：标注块的图标由 .callout-title::before 的 per-type
    // glyph 提供，标题槽留空即可（纯高亮不建标题槽）。
    titleEl.innerHTML = titleHtml;
    el.appendChild(titleEl);

    if (bodyHtml) {
      const wrap = doc.createElement("div");
      wrap.innerHTML = bodyHtml;
      insertSoftBreaks(wrap);
      while (wrap.firstChild) el.appendChild(wrap.firstChild);
    }

    bq.replaceWith(el);
  });
}

// ── 内嵌 HTML 的深色适配 ───────────────────────────────
// 内联 style 写死的颜色盖不住，这里把能安全映射的颜色换成 `var(--dc-N, 原色)`，
// --dc-N 的深色取值由 takeDarkVars() 交给调用方注入。
const DARK_COLOR_PROPS = ["color", "background-color", "border-color"];
let darkVars = new Map<string, string>();

/** 取走本次渲染产出的深色变量表（--dc-N → 深色值） */
export function takeDarkVars(): Record<string, string> {
  return Object.fromEntries(darkVars);
}

function prepareDarkColors(doc: Document): void {
  darkVars = new Map();
  let n = 0;
  doc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    for (const prop of DARK_COLOR_PROPS) {
      const hex = hexOf(el.style.getPropertyValue(prop));
      if (!hex) continue;
      const mapped = mapColorForDark(hex, prop);
      if (!mapped || mapped === hex) continue;
      const name = `dc-${(n += 1)}`;
      darkVars.set(name, mapped);
      el.style.setProperty(prop, `var(--${name}, ${hex})`);
    }
  });
}

function hexOf(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v || v === "transparent" || v === "inherit" || v === "currentcolor")
    return null;
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short)
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const rgb =
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,]+([\d.]+))?/.exec(
      v,
    );
  if (!rgb) return null;
  // 半透明色保持原样：它的叠加效果依赖底下背景，转成实心深色会破坏设计
  if (rgb[4] !== undefined && Number(rgb[4]) < 1) return null;
  return (
    "#" +
    [1, 2, 3]
      .map((i) => Math.round(Number(rgb[i])).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** 浅底 → 深底，深字 → 浅字；深色模式下本就合适的颜色不动 */
function mapColorForDark(hex: string, prop: string): string | null {
  const [h, s, l] = hexToHsl(hex);
  const isText = prop === "color";
  const target = isText
    ? l < 0.5
      ? Math.max(l, 0.72)
      : null
    : l > 0.5
      ? Math.min(l * 0.3, 0.24)
      : null;
  if (target === null) return null;
  return hslToHex(h, isText ? Math.min(s, 0.45) : Math.min(s, 0.3), target);
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    "#" +
    seg
      .map((v) =>
        Math.round((v + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

// ── 公式回填 ───────────────────────────────────────────
function fillMath(doc: Document): void {
  doc.querySelectorAll("span[data-math]").forEach((node) => {
    const id = Number(node.getAttribute("data-math"));
    const html = Number.isFinite(id) ? takeMathHtml(id) : undefined;
    if (!html) {
      node.remove();
      return;
    }
    // katex 自身已做转义；此处在 sanitize 之后插入，故不经过白名单
    const tpl = doc.createElement("template");
    tpl.innerHTML = html;
    node.replaceWith(tpl.content);
  });
}

// ── 中西文间距 ─────────────────────────────────────────
const CJK_RANGE = "\\u2e80-\\u9fff\\u3000-\\u303f\\uff00-\\uffef";
const CJK_LATIN = new RegExp(
  `([${CJK_RANGE}])([A-Za-z0-9])|([A-Za-z0-9])([${CJK_RANGE}])`,
  "g",
);
const SPACING_SKIP = "pre, code, .katex, style, script";

function addCjkSpacing(doc: Document): void {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const parent = text.parentElement;
    if (!parent || parent.closest(SPACING_SKIP)) continue;
    if (!text.nodeValue || text.nodeValue.length < 2) continue;
    targets.push(text);
  }

  targets.forEach((text) => {
    const src = text.nodeValue ?? "";
    const frag = doc.createDocumentFragment();
    let last = 0;

    for (const m of src.matchAll(CJK_LATIN)) {
      const at = m.index ?? 0;
      if (at > last) frag.appendChild(doc.createTextNode(src.slice(last, at)));
      frag.appendChild(doc.createTextNode(m[1] ?? m[3]));
      const pad = doc.createElement("span");
      pad.className = "cjk-pad";
      frag.appendChild(pad);
      frag.appendChild(doc.createTextNode(m[2] ?? m[4]));
      last = at + m[0].length;
    }
    if (last === 0) return;
    if (last < src.length)
      frag.appendChild(doc.createTextNode(src.slice(last)));
    text.replaceWith(frag);
  });
}
