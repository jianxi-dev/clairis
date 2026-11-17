/*
 * 行内轻量渲染（search-float-refine / D4）。
 *
 * 搜索结果行的上下文片段只需行内语义：**加粗**、*斜体*、`行内代码`。
 * 不引入 markdown 全量解析——片段用整块渲染会带入块级语义与不必要开销。
 *
 * 安全顺序：剥离块级源码符号 → HTML 转义 → 扫描行内语法 token → 顺序拼装。
 * 纯文本段直接插 <mark>（段内无标签，安全）；token 段把命中钳制到内容区间
 * 再插 <mark>，分隔符永不进 mark——避免命中边界落在 ** / ` / * 内部时把
 * 分隔符切开导致正则失配、产生非法嵌套或丢高亮。先转义保证 <script> /
 * <img onerror> 不会被激活；命中区间在转义后的坐标空间换算，避免渲染偏移。
 *
 * 边界：命中完全落在被剥离的行首块级符号（# / - / > / 1. ）内时，显示文本里
 * 本就没有该字符，不产生 <mark>——这是正确行为，不是丢高亮。
 */

export interface InlineHit {
  /** 命中区间起点（字符偏移，相对输入文本）。 */
  from: number;
  /** 命中区间终点（不含）。 */
  to: number;
}

/** 私有区字符：正常文档不会出现；转义阶段实体化，避免与原文碰撞。 */
const HIT_OPEN = "\uE000";
const HIT_CLOSE = "\uE001";

/** 行首块级源码符号：标题 / 引用 / 列表。片段按预览态呈现，不显示这些符号。 */
const BLOCK_MARKER_RE = /^(?:…)?(?:#{1,6}\s+|>\s?|(?:[-*+]|\d+[.)])\s+)/;

/** 独占一行的围栏代码块分隔符（``` / ~~~，可带语言信息）。 */
const FENCE_LINE_RE = /^\s{0,3}(?:`{3,}|~{3,})/;

/** 独占一行的主题分隔线（--- / *** / ___，可含空格）。 */
const THEMATIC_BREAK_RE =
  /^\s{0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;

/** 行内语法：代码优先（吞掉内部的 * / `），再粗体，再斜体。 */
const INLINE_RE = /`([^`]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * 剥离行首块级源码符号，并给出「原文偏移 → 剥离后偏移」映射。
 * 命中区间换算依赖该映射（标题符号被剥掉后命中位置左移）。
 */
function stripBlockMarkers(text: string): { text: string; map: number[] } {
  const map: number[] = new Array(text.length + 1);
  let out = "";
  let orig = 0;
  const lines = text.split("\n");
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    // 围栏分隔符 / 主题分隔线整行丢弃（预览态不显示块级符号），换行位保留以维持偏移映射连续。
    if (FENCE_LINE_RE.test(line) || THEMATIC_BREAK_RE.test(line)) {
      for (let k = 0; k <= line.length; k++) map[orig + k] = out.length;
      orig += line.length;
      if (li < lines.length - 1) {
        out += "\n";
        orig += 1;
      }
      continue;
    }
    const matched = BLOCK_MARKER_RE.exec(line)?.[0].length ?? 0;
    const contentStart = out.length;
    for (let k = 0; k <= line.length; k++) {
      map[orig + k] = k < matched ? contentStart : contentStart + (k - matched);
    }
    out += line.slice(matched);
    orig += line.length;
    if (li < lines.length - 1) {
      out += "\n";
      orig += 1;
    }
  }
  map[text.length] = out.length;
  return { text: out, map };
}

/**
 * HTML 转义，并给出「剥离后偏移 → 转义后偏移」映射。
 * 私有区字符在此实体化，避免与原文碰撞。
 */
function escapeHtml(text: string): { html: string; map: number[] } {
  const map: number[] = new Array(text.length + 1);
  let out = "";
  for (let i = 0; i < text.length; i++) {
    map[i] = out.length;
    const ch = text[i];
    if (ch === "&") out += "&amp;";
    else if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else if (ch === HIT_OPEN) out += "&#xE000;";
    else if (ch === HIT_CLOSE) out += "&#xE001;";
    else out += ch;
  }
  map[text.length] = out.length;
  return { html: out, map };
}

/** 行内语法 token 在转义后 html 中的位置（坐标均为 html 字符偏移）。 */
interface InlineToken {
  /** token 起点（含 opening 分隔符）。 */
  start: number;
  /** 内容起点（opening 分隔符之后）。 */
  contentStart: number;
  /** 内容终点（closing 分隔符之前）。 */
  contentEnd: number;
  /** token 终点（不含）。 */
  end: number;
  tag: "b" | "i" | "code";
}

/** 在转义后 html 上扫描行内语法 token，按出现顺序返回，互不重叠。 */
function scanInlineTokens(html: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(html)) !== null) {
    const start = match.index;
    const full = match[0];
    const code: string | undefined = match[1];
    const bold: string | undefined = match[2];
    const italic: string | undefined = match[3];
    // code / italic 用单字符分隔符，bold 用 **。
    const openLen = code !== undefined || italic !== undefined ? 1 : 2;
    const tag: InlineToken["tag"] =
      code !== undefined ? "code" : bold !== undefined ? "b" : "i";
    tokens.push({
      start,
      contentStart: start + openLen,
      contentEnd: start + full.length - openLen,
      end: start + full.length,
      tag,
    });
  }
  return tokens;
}

/** 纯文本段：段内无标签，命中直接包裹 <mark>。 */
function renderPlainSegment(
  segment: string,
  segmentStart: number,
  hit?: { from: number; to: number },
): string {
  if (!hit) return segment;
  const from = Math.max(hit.from, segmentStart);
  const to = Math.min(hit.to, segmentStart + segment.length);
  if (to <= from) return segment;
  const localFrom = from - segmentStart;
  const localTo = to - segmentStart;
  return (
    segment.slice(0, localFrom) +
    "<mark>" +
    segment.slice(localFrom, localTo) +
    "</mark>" +
    segment.slice(localTo)
  );
}

/** token 段：命中钳制到内容区间（分隔符之外），内容重叠非空才插 <mark>。 */
function renderTokenSegment(
  html: string,
  token: InlineToken,
  hit?: { from: number; to: number },
): string {
  const content = html.slice(token.contentStart, token.contentEnd);
  let inner = content;
  if (hit) {
    const from = Math.max(hit.from, token.contentStart);
    const to = Math.min(hit.to, token.contentEnd);
    if (to > from) {
      const localFrom = from - token.contentStart;
      const localTo = to - token.contentStart;
      inner =
        content.slice(0, localFrom) +
        "<mark>" +
        content.slice(localFrom, localTo) +
        "</mark>" +
        content.slice(localTo);
    }
  }
  return `<${token.tag}>${inner}</${token.tag}>`;
}

/**
 * 行内轻量渲染：将片段文本按行内 Markdown 语法渲染为 HTML。
 *
 * 只处理行内语法（**加粗**、*斜体*、`行内代码`）；标题等块级源码符号
 * 按普通文本处理（剥离行首标记，不渲染为块级元素）。命中区间 [from, to)
 * 包裹 `<mark>`，命中高亮保留。输出恒为合法嵌套的 b / i / code / mark 组合。
 */
export function renderInlineWithHit(text: string, hit?: InlineHit): string {
  const stripped = stripBlockMarkers(text);
  const escaped = escapeHtml(stripped.text);

  let hitRange: { from: number; to: number } | undefined;
  if (hit) {
    const rawFrom = clamp(hit.from, 0, text.length);
    const rawTo = clamp(hit.to, rawFrom, text.length);
    if (rawTo > rawFrom) {
      const from = escaped.map[stripped.map[rawFrom]];
      const to = escaped.map[stripped.map[rawTo]];
      if (to > from) hitRange = { from, to };
    }
  }

  const tokens = scanInlineTokens(escaped.html);
  let out = "";
  let cursor = 0;
  for (const token of tokens) {
    out += renderPlainSegment(
      escaped.html.slice(cursor, token.start),
      cursor,
      hitRange,
    );
    out += renderTokenSegment(escaped.html, token, hitRange);
    cursor = token.end;
  }
  out += renderPlainSegment(escaped.html.slice(cursor), cursor, hitRange);
  return out;
}
