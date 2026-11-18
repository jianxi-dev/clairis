/*
 * 结果行摘要展示层文本化（#1115 / search-replace-refine D1）。
 *
 * 只作用于摘要渲染：表格块按行拼接单元格文字，管道符与对齐行在展示时剥离；
 * 返回「原下标 → 清洗后下标」映射，命中区间经映射后仍落在同一段文字上。
 * 不动搜索索引、命中计算与替换语义；普通段落块不进入清洗。
 */

/** 表格行：最多 3 空格缩进后以 `|` 开头（GFM 形态）。 */
const TABLE_ROW_RE = /^ {0,3}\|/;

/** 对齐行：`:--` / `:-:` / `--:` 等单元格用 `|` 连接。 */
const TABLE_DELIMITER_ROW_RE =
  /^ {0,3}\|?(?:[ \t]*:?-+:?[ \t]*\|)+(?:[ \t]*:?-+:?[ \t]*)\|?[ \t]*$/;

export interface PlainSnippet {
  text: string;
  /** 原字符串每个下标（含末尾）在清洗后字符串中的位置。 */
  map: number[];
}

/** 块内存在「表头行 + 紧邻对齐行」即判定为 Markdown 表格。 */
export function isMarkdownTable(text: string): boolean {
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    if (!TABLE_DELIMITER_ROW_RE.test(lines[i])) continue;
    if (!TABLE_ROW_RE.test(lines[i - 1]) && !lines[i - 1].includes("|")) {
      continue;
    }
    return true;
  }
  return false;
}

interface ConvertedLine {
  text: string;
  /** 行内原下标 → 清洗后行内下标。 */
  localMap: number[];
  /** 整行丢弃（对齐行等结构行），连换行一并去掉。 */
  drop: boolean;
}

/** 竖线是否被奇数个反斜杠转义。 */
function isEscaped(line: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && line[i] === "\\"; i--) backslashes++;
  return backslashes % 2 === 1;
}

function convertTableRowLine(line: string): ConvertedLine {
  const localMap = new Array<number>(line.length).fill(0);
  if (TABLE_DELIMITER_ROW_RE.test(line)) {
    return { text: "", localMap, drop: true };
  }
  if (!line.includes("|")) {
    for (let i = 0; i < line.length; i++) localMap[i] = i;
    return { text: line, localMap, drop: false };
  }

  // 竖线切段：反引号内与转义的 \| 不作分隔符。
  const cuts: number[] = [];
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "`") inCode = !inCode;
    else if (ch === "|" && !inCode && !isEscaped(line, i)) cuts.push(i);
  }

  const ranges: { start: number; end: number }[] = [];
  let segmentStart = 0;
  for (const cut of cuts) {
    ranges.push({ start: segmentStart, end: cut });
    segmentStart = cut + 1;
  }
  ranges.push({ start: segmentStart, end: line.length });

  const trimmed = ranges.map((range) => {
    const raw = line.slice(range.start, range.end);
    const lead = raw.length - raw.trimStart().length;
    const trail = raw.length - raw.trimEnd().length;
    return { start: range.start + lead, end: range.end - trail };
  });
  let first = 0;
  while (first < trimmed.length && trimmed[first].start >= trimmed[first].end) {
    first++;
  }
  let last = trimmed.length - 1;
  while (last >= first && trimmed[last].start >= trimmed[last].end) last--;
  if (first > last) return { text: "", localMap, drop: true };

  const kept: boolean[] = new Array(line.length).fill(false);
  const pieces: string[] = [];
  let outOffset = 0;
  for (let i = first; i <= last; i++) {
    const { start, end } = trimmed[i];
    if (pieces.length > 0) {
      pieces.push(" ");
      outOffset += 1;
    }
    for (let k = start; k < end; k++) {
      kept[k] = true;
      localMap[k] = outOffset + (k - start);
    }
    outOffset += end - start;
    pieces.push(line.slice(start, end));
  }
  // 被剥掉的字符归到上一保留字符的末尾：独占结束边界落在填充空白上时收回，
  // 命中区间不因插入的分隔空格而多圈一个字符。
  let firstKeptOut = outOffset;
  for (let k = 0; k < line.length; k++) {
    if (kept[k]) {
      firstKeptOut = localMap[k];
      break;
    }
  }
  let lastEnd = firstKeptOut;
  for (let k = 0; k < line.length; k++) {
    if (kept[k]) lastEnd = localMap[k] + 1;
    else localMap[k] = lastEnd;
  }
  return { text: pieces.join(""), localMap, drop: false };
}

/**
 * 表格块摘要文本化：逐行拼接单元格文字，去掉管道符与对齐行。
 * `map` 供命中区间换算——清洗删字符后高亮仍落在原文同一段文字上。
 */
export function plainTableSnippet(text: string): PlainSnippet {
  const map = new Array<number>(text.length + 1);
  let out = "";
  let i = 0;
  while (i < text.length) {
    const newline = text.indexOf("\n", i);
    const hasNewline = newline !== -1;
    const lineEnd = hasNewline ? newline : text.length;
    const converted = convertTableRowLine(text.slice(i, lineEnd));
    for (let k = 0; k < lineEnd - i; k++) {
      map[i + k] = out.length + converted.localMap[k];
    }
    out += converted.text;
    if (hasNewline) {
      map[lineEnd] = out.length;
      if (!converted.drop) {
        out += "\n";
        map[lineEnd + 1] = out.length;
      }
      i = lineEnd + 1;
    } else {
      i = lineEnd;
    }
  }
  map[text.length] = out.length;
  return { text: out, map };
}
