import { marked } from "marked";
import DOMPurify from "dompurify";
import { mediaKindOf } from "../lib/mediaUrl";
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
        return `<figure class="wide"><${tag} controls preload="metadata" src="${src}"></${tag}>${caption}</figure>`;
      }
      return `<figure class="wide"><img src="${src}" alt="${alt}" />${caption}</figure>`;
    },
    table(header: string, body: string) {
      return `<div class="table-wrap wide"><table>\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table></div>`;
    },
  },
});

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
// \uFEFF? 容忍 BOM 前缀（Obsidian 文件常带）。
const FRONTMATTER_RE = /^\uFEFF?---\s*\n[\s\S]*?\n---\s*(?:\n|$)/;

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

export interface RenderMarkdownOptions {
  /** 把文档内相对引用解析成可加载 URL；返回 null 走原始 href。 */
  resolveMedia?: (href: string) => string | null;
}

const LEGACY_WIDTH_COMMENT_RE = /^([ \t]*\n)?[ \t]*<!--\s*w=(\d+)\s*-->/;

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

  registerCheckboxGuard();
  resetMathStore();

  // `![x](a.png){width=635}` 与旧 `![x](a.png)<!--w=635-->`：属性块/注释是给
  // 编辑态持久化用的，直接在正文里渲染出来会变成一行可见文本。这里先换成带
  // data 属性的 span，等 DOM 建好再取到图片上。
  const stripped = content.replace(FRONTMATTER_RE, "");
  const withWidths = preprocessImageAttributes(stripped);
  const body = preprocessAlignmentDivs(stripStructuralTagLines(withWidths));
  const raw = marked.parse(body, { async: false }) as string;
  const clean = DOMPurify.sanitize(raw, SANITIZE_CONFIG);
  const result = postProcess(clean);
  activeResolveMedia = null;
  return result;
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
        if (hasCrop) {
          // 裁剪显示与编辑态同一套 CSS 技法：盒=裁剪矩形，object-fit:none
          // 平移内容。width/height 缩放属性不参与（矩形就是显示尺寸）。
          const [l, t, w, h] = crop;
          style.push(
            `object-fit:none`,
            `object-position:${-l}px ${-t}px`,
            `width:${w}px`,
            `height:${h}px`,
          );
        } else {
          if (hasWidth) img.setAttribute("width", String(width));
          if (hasHeight) img.setAttribute("height", String(height));
          if (hasWidth || hasHeight) {
            // 预览样式给 img 定了 `height: auto`，表现属性会被 CSS 压掉，
            // 显式高度必须走内联样式才生效。
            style.push("max-width:100%");
            if (hasWidth) style.push(`width:${width}px`);
            style.push(hasHeight ? `height:${height}px` : "height:auto");
          }
        }
        if (align === "left" || align === "center" || align === "right") {
          // 预览里 img 是 `display:block; margin-inline:auto`，对 figure 设
          // text-align 不改变位置，对齐只能落在图片自己的外边距上。
          if (align === "left")
            style.push("margin-left:0", "margin-right:auto");
          if (align === "right")
            style.push("margin-left:auto", "margin-right:0");
          if (align === "center") style.push("margin-inline:auto");
          const target = img.closest("figure") ?? img.parentElement;
          target?.setAttribute("style", `text-align:${align}`);
        }
        if (style.length > 0) img.setAttribute("style", style.join(";"));
      }
      marker.remove();
    });
}

/** sanitize 之后的一趟 DOM 处理：Callout → 图片属性 → 公式回填 → 链接 → 中西文间距 */
function postProcess(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  convertCallouts(doc);
  applyImageAttributes(doc);
  prepareDarkColors(doc);
  fillMath(doc);
  doc.querySelectorAll("a").forEach((a) => {
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
const CALLOUT_HEAD = /^\[!\s*([^\]\r\n]+?)\s*\]([+-]?)/;

const CALLOUT_LABELS: Record<string, string> = {
  note: "注释",
  info: "信息",
  abstract: "摘要",
  summary: "总结",
  tip: "提示",
  hint: "提示",
  important: "重要",
  success: "成功",
  check: "完成",
  warning: "警告",
  caution: "注意",
  attention: "注意",
  danger: "危险",
  error: "错误",
  failure: "失败",
  bug: "问题",
  question: "疑问",
  help: "帮助",
  faq: "问答",
  example: "示例",
  quote: "引用",
  cite: "引述",
};

function convertCallouts(doc: Document): void {
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
    const fold = m[2];
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

    const label = CALLOUT_LABELS[type] ?? type;
    const title = titleHtml || label;

    const el = doc.createElement(fold ? "details" : "div");
    el.className = "callout";
    el.setAttribute("data-callout", type);
    if (fold === "+") el.setAttribute("open", "");

    const titleEl = doc.createElement(fold ? "summary" : "div");
    if (!fold) titleEl.className = "callout-title";
    titleEl.innerHTML = title;
    el.appendChild(titleEl);

    if (bodyHtml) {
      const wrap = doc.createElement("div");
      wrap.innerHTML = bodyHtml;
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
