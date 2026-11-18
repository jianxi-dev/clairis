/*
 * 行内轻量渲染（search-float-refine / D4）。
 *
 * 搜索结果行的上下文片段与替换模式悬浮全文预览共用本函数，一套渲染契约：
 * 片段按预览态呈现，只保留行内语义 + 少数块级构造的等价形态，不显示源码符号。
 * 不引入 markdown 全量解析——只补搜索预览真正会漏出标记的构造：
 *   **加粗** / *斜体* / `行内代码` / ~~删除线~~ / [链接](url) / ![图片](src)
 *   / [^脚注] / 任务复选框 / 表格。
 *
 * 安全顺序：剥离块级源码符号 → HTML 转义 → 扫描行内语法 token → 顺序拼装。
 * 纯文本段直接插 <mark>（段内无标签，安全）；token 段把命中钳制到内容区间
 * 再插 <mark>，分隔符永不进 mark——避免命中边界落在 ** / ` / * / ~~ 内部时把
 * 分隔符切开导致正则失配、产生非法嵌套或丢高亮。先转义保证 <script> /
 * <img onerror> 不会被激活；命中区间在转义后的坐标空间换算，避免渲染偏移。
 *
 * 块级符号（标题 / 引用 / 列表 / 围栏 / 主题分隔线 / 脚注定义）先行剥离，
 * 命中区间依赖「原文 → 剥离后」映射（标记被剥掉后命中位置左移）；转义再叠加
 * 一层映射。表格与任务复选框在**转义后**处理：此时原始偏移已不再需要，
 * 只需把命中区间按行 / 单元格求交后各自钳制。
 *
 * 边界：命中完全落在被剥离的行首块级符号（# / - / > / 1. / [ ]）内时，显示
 * 文本里本就没有该字符，不产生 <mark>——这是正确行为，不是丢高亮。
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

/** 行首块级源码符号：标题 / 引用 / 列表 / 脚注定义。片段按预览态呈现，不显示这些符号。 */
const BLOCK_MARKER_RE =
  /^(?:…)?(?:#{1,6}\s+|>\s?|(?:[-*+]|\d+[.)])\s+|\[\^[^\]]+\]:\s+)/;

/** 独占一行的围栏代码块分隔符（``` / ~~~，可带语言信息）。 */
const FENCE_LINE_RE = /^\s{0,3}(?:`{3,}|~{3,})/;

/** 独占一行的主题分隔线（--- / *** / ___，可含空格）。 */
const THEMATIC_BREAK_RE =
  /^\s{0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;

/** 表格行：最多 3 空格缩进后以 `|` 开头（GFM 表格行形态）。 */
const TABLE_ROW_RE = /^ {0,3}\|/;

/** 表格对齐行单元格：`:--` / `:-:` / `--:` 等。 */
const TABLE_DELIM_CELL_RE = /^:?-+:?$/;

/** 任务列表复选框：`[ ]` / `[x]` / `[X]` + 空白。 */
const TASK_CHECKBOX_RE = /^\[[ xX]\][ \t]+/;

/**
 * 行内语法：图片优先（吞掉 `![`），再链接，再删除线，再行内代码，再粗体 / 斜体，
 * 最后脚注引用。组号即下方 scanInlineTokens 的判定顺序。
 */
const INLINE_RE =
  /!\[([^\]\n]*)\]\(([^)\n]*)\)|\[([^\]\n]*)\]\(([^)\n]*\))|(~~([^~\n]+)~~)|(`([^`\n]+)`)|(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*)|(\[\^([^\]\n]+)\])/g;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

interface RenderRange {
  from: number;
  to: number;
}

/**
 * 剥离行首块级源码符号，并给出「原文偏移 → 剥离后偏移」映射。
 * 命中区间换算依赖该映射（标题符号被剥掉后命中位置左移）。
 * `fenceLines` 记录哪些输出行是围栏分隔符（已整行丢弃），供渲染期识别代码块、
 * 避免把代码块内的竖线行误判成表格。
 */
function stripBlockMarkers(text: string): {
  text: string;
  map: number[];
  fenceLines: Set<number>;
} {
  const map: number[] = new Array(text.length + 1);
  const fenceLines = new Set<number>();
  let out = "";
  let orig = 0;
  const lines = text.split("\n");
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    // 围栏分隔符 / 主题分隔线整行丢弃（预览态不显示块级符号），换行位保留以维持偏移映射连续。
    if (FENCE_LINE_RE.test(line)) {
      fenceLines.add(li);
      for (let k = 0; k <= line.length; k++) map[orig + k] = out.length;
      orig += line.length;
      if (li < lines.length - 1) {
        out += "\n";
        orig += 1;
      }
      continue;
    }
    if (THEMATIC_BREAK_RE.test(line)) {
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
  return { text: out, map, fenceLines };
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
  tag: "b" | "i" | "code" | "del" | "link" | "img" | "sup";
}

/** 在转义后 html 上扫描行内语法 token，按出现顺序返回，互不重叠。 */
function scanInlineTokens(html: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(html)) !== null) {
    const start = match.index;
    const full = match[0];
    let tag: InlineToken["tag"];
    let content: string;
    let openLen: number;
    if (match[1] !== undefined) {
      tag = "img";
      content = match[1];
      openLen = 2; // ![ …
    } else if (match[3] !== undefined) {
      tag = "link";
      content = match[3];
      openLen = 1; // [
    } else if (match[6] !== undefined) {
      tag = "del";
      content = match[6];
      openLen = 2; // ~~
    } else if (match[8] !== undefined) {
      tag = "code";
      content = match[8];
      openLen = 1; // `
    } else if (match[10] !== undefined) {
      tag = "b";
      content = match[10];
      openLen = 2; // **
    } else if (match[11] !== undefined) {
      tag = "i";
      content = match[11];
      openLen = 1; // *
    } else {
      tag = "sup";
      content = match[13];
      openLen = 2; // [^
    }
    const contentStart = start + openLen;
    tokens.push({
      start,
      contentStart,
      contentEnd: contentStart + content.length,
      end: start + full.length,
      tag,
    });
  }
  return tokens;
}

/** 命中区间与 [from, to) 求交；无重叠返回 undefined。 */
function intersect(
  hit: RenderRange | undefined,
  from: number,
  to: number,
): RenderRange | undefined {
  if (!hit) return undefined;
  const f = Math.max(hit.from, from);
  const t = Math.min(hit.to, to);
  return t > f ? { from: f, to: t } : undefined;
}

/** 纯文本段：段内无标签，命中直接包裹 <mark>。 */
function renderPlainSegment(
  segment: string,
  segmentStart: number,
  hit?: RenderRange,
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

/** 把命中区间钳制进 token 内容区间，内容重叠非空才插 <mark>。 */
function markContent(
  content: string,
  tokenStart: number,
  tokenEnd: number,
  hit?: RenderRange,
): string {
  const inner = intersect(hit, tokenStart, tokenEnd);
  if (!inner) return content;
  const localFrom = inner.from - tokenStart;
  const localTo = inner.to - tokenStart;
  return (
    content.slice(0, localFrom) +
    "<mark>" +
    content.slice(localFrom, localTo) +
    "</mark>" +
    content.slice(localTo)
  );
}

/** 渲染一个 token；链接 / 图片递归处理内容，脚注与强调类为简单语义标签。 */
function renderToken(
  html: string,
  token: InlineToken,
  hit?: RenderRange,
): string {
  const content = html.slice(token.contentStart, token.contentEnd);
  if (token.tag === "link" || token.tag === "img") {
    const inner = intersect(hit, token.contentStart, token.contentEnd);
    const local = inner
      ? {
          from: inner.from - token.contentStart,
          to: inner.to - token.contentStart,
        }
      : undefined;
    const body =
      token.tag === "img"
        ? content.trim().length > 0
          ? content
          : "图片"
        : content;
    const cls = token.tag === "img" ? "sf-media" : "sf-link";
    return `<span class="${cls}">${renderInlineSlice(body, local)}</span>`;
  }
  if (token.tag === "sup") {
    return `<sup class="sf-footnote">${markContent(content, token.contentStart, token.contentEnd, hit)}</sup>`;
  }
  const inner = markContent(content, token.contentStart, token.contentEnd, hit);
  return `<${token.tag}>${inner}</${token.tag}>`;
}

/** 对一段（已转义、单行）html 做行内语法渲染并施加命中。 */
function renderInlineSlice(html: string, hit?: RenderRange): string {
  const tokens = scanInlineTokens(html);
  let out = "";
  let cursor = 0;
  for (const token of tokens) {
    out += renderPlainSegment(html.slice(cursor, token.start), cursor, hit);
    out += renderToken(html, token, hit);
    cursor = token.end;
  }
  out += renderPlainSegment(html.slice(cursor), cursor, hit);
  return out;
}

/**
 * 渲染一行：行首任务复选框 `[ ]` / `[x]` 剥成预览态小方框，命中区间同步左移。
 * 行内语法仍走 renderInlineSlice。
 */
function renderLine(html: string, hit?: RenderRange): string {
  const task = TASK_CHECKBOX_RE.exec(html);
  if (!task) return renderInlineSlice(html, hit);
  const len = task[0].length;
  const checked = task[0][1].toLowerCase() === "x";
  let restHit: RenderRange | undefined;
  if (hit) {
    const f = Math.max(hit.from, len);
    const t = Math.max(hit.to, len);
    restHit = t > f ? { from: f - len, to: t - len } : undefined;
  }
  const box = `<span class="sf-task" aria-hidden="true"><span class="sf-check${
    checked ? " on" : ""
  }"></span></span>`;
  return box + renderInlineSlice(html.slice(len), restHit);
}

interface TableCell {
  text: string;
  start: number;
  end: number;
}

interface TableRow {
  cells: TableCell[];
  delimiter: boolean;
}

/** 解析一行 GFM 表格行；非表格行返回 null。单元格偏移为转义后全局坐标。 */
function parseTableRow(line: string, lineStart: number): TableRow | null {
  const lead = TABLE_ROW_RE.exec(line);
  if (!lead) return null;
  const cells: TableCell[] = [];
  let inCode = false;
  let cellStart = lineStart + lead[0].length;
  for (let i = lead[0].length; i < line.length; i++) {
    const ch = line[i];
    if (ch === "`") inCode = !inCode;
    else if (ch === "|" && !inCode) {
      cells.push({
        text: line.slice(cellStart - lineStart, i),
        start: cellStart,
        end: lineStart + i,
      });
      cellStart = lineStart + i + 1;
    }
  }
  const tail = line.slice(cellStart - lineStart);
  const trailingPipe = /\|[ \t]*$/.test(line);
  if (!(trailingPipe && tail.trim() === "")) {
    cells.push({ text: tail, start: cellStart, end: lineStart + line.length });
  }
  while (cells.length > 1 && cells[0].text.trim() === "") cells.shift();
  while (cells.length > 1 && cells[cells.length - 1].text.trim() === "") {
    cells.pop();
  }
  const delimiter =
    cells.length > 0 &&
    cells.every((c) => TABLE_DELIM_CELL_RE.test(c.text.trim()));
  return { cells, delimiter };
}

/** 单元格内容（去首尾空白）+ 命中钳制后渲染。 */
function renderCell(cell: TableCell, hit?: RenderRange): string {
  const raw = cell.text;
  const lead = raw.length - raw.trimStart().length;
  const trail = raw.length - raw.trimEnd().length;
  const from = cell.start + lead;
  const to = cell.end - trail;
  const inner = raw.slice(lead, raw.length - trail);
  const cellHit = intersect(hit, from, to);
  const local = cellHit
    ? { from: cellHit.from - from, to: cellHit.to - from }
    : undefined;
  return renderInlineSlice(inner, local);
}

/** 连续表格行合成一张表：对齐行丢弃；仅当对齐行是第 2 行时首行为表头。 */
function renderTable(rows: TableRow[], hit?: RenderRange): string {
  const delimIndex = rows.findIndex((row) => row.delimiter);
  const headRows = delimIndex === 1 ? [rows[0]] : [];
  const bodyRows = rows.filter(
    (_, index) => !rows[index].delimiter && !(delimIndex === 1 && index === 0),
  );
  let out = "<table>";
  if (headRows.length > 0) {
    out += "<thead><tr>";
    for (const cell of headRows[0].cells) {
      out += `<th>${renderCell(cell, hit)}</th>`;
    }
    out += "</tr></thead>";
  }
  if (bodyRows.length > 0) {
    out += "<tbody>";
    for (const row of bodyRows) {
      out += "<tr>";
      for (const cell of row.cells) {
        out += `<td>${renderCell(cell, hit)}</td>`;
      }
      out += "</tr>";
    }
    out += "</tbody>";
  }
  out += "</table>";
  return out;
}

/**
 * 逐行渲染：连续表格行合并成一张表；围栏内的竖线行不按表格处理。
 * 命中区间按行求交后下传（行内再按 token / 单元格细分）。
 */
function renderBlock(
  html: string,
  fenceLines: Set<number>,
  hit?: RenderRange,
): string {
  const lines: { text: string; start: number }[] = [];
  let start = 0;
  while (start <= html.length) {
    const nl = html.indexOf("\n", start);
    const end = nl === -1 ? html.length : nl;
    lines.push({ text: html.slice(start, end), start });
    if (nl === -1) break;
    start = nl + 1;
  }

  let out = "";
  let inFence = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const lineHit = intersect(hit, line.start, line.start + line.text.length);
    const localHit = lineHit
      ? { from: lineHit.from - line.start, to: lineHit.to - line.start }
      : undefined;
    const isFence = fenceLines.has(i);
    if (!inFence && !isFence && TABLE_ROW_RE.test(line.text)) {
      const rows: TableRow[] = [];
      while (i < lines.length) {
        const row = parseTableRow(lines[i].text, lines[i].start);
        if (!row) break;
        rows.push(row);
        i++;
      }
      out += renderTable(rows, hit);
    } else {
      out += renderLine(line.text, localHit);
      i++;
    }
    if (isFence) inFence = !inFence;
    if (i < lines.length) out += "\n";
  }
  return out;
}

/**
 * 行内轻量渲染：将片段文本按行内 Markdown 语法渲染为 HTML。
 *
 * 覆盖行内语法（**加粗**、*斜体*、`行内代码`、~~删除线~~、链接、图片、脚注引用）
 * 与表格 / 任务复选框；标题等块级源码符号按普通文本处理（剥离行首标记，不渲染
 * 为块级元素）。命中区间 [from, to) 包裹 `<mark>`，命中高亮保留。输出恒为合法
 * 嵌套的 b / i / code / del / sup / mark 组合与 span / table 结构。
 */
export function renderInlineWithHit(text: string, hit?: InlineHit): string {
  const stripped = stripBlockMarkers(text);
  const escaped = escapeHtml(stripped.text);

  let hitRange: RenderRange | undefined;
  if (hit) {
    const rawFrom = clamp(hit.from, 0, text.length);
    const rawTo = clamp(hit.to, rawFrom, text.length);
    if (rawTo > rawFrom) {
      const from = escaped.map[stripped.map[rawFrom]];
      const to = escaped.map[stripped.map[rawTo]];
      if (to > from) hitRange = { from, to };
    }
  }

  return renderBlock(escaped.html, stripped.fenceLines, hitRange);
}
