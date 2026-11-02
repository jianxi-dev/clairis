/* 链接装饰（移植自 md-bundle packages/editor/src/decorations/link.ts）。
 *
 * 语义揭示两态：
 * - 非活跃块：`[` 与 `](url)` 被替换掉，只留链接文字并加 `.cm-link` 样式。
 * - 活跃块：原始源码可见，链接文字仍带样式（附 `cm-block-active`）。
 *
 * 围栏代码块、缩进代码块、高亮块、表格、分栏、mermaid 块里的 `[...](...)`
 * 一律跳过——那些块由各自的装饰负责，链接装饰插进去会重叠。
 */
import type { Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";

export const LINK_CLASS = "cm-link";
export const BLOCK_ACTIVE_CLASS = "cm-block-active";

/**
 * 匹配 `[text](url)`，排除图片（以 `!` 开头）。
 */
export const linkRegex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;

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
        // 闭栏行本身也算围栏区间
        ranges.push([fenceStart, lineStart + line.length]);
        inFence = false;
        fenceStart = -1;
      }
    }
  }

  // 未闭合围栏：其后整篇都算围栏
  if (inFence) {
    ranges.push([fenceStart, text.length]);
  }

  // 缩进代码块（4 空格或制表符）
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
 * 找出高亮块区间（整块，含所有 `>` 行）。返回 `[from, to]` 偏移数组。
 */
function findCalloutRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split("\n");
  const CALLOUT_OPEN_RE = /^>\s*\[!([A-Za-z]+)\]([+-]?)\s*(.*)$/;
  const CALLOUT_LINE_RE = /^>\s?(.*)$/;

  let i = 0;
  while (i < lines.length) {
    const openMatch = CALLOUT_OPEN_RE.exec(lines[i]);
    if (openMatch) {
      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1;
      }

      let j = i + 1;
      while (j < lines.length) {
        const lineMatch = CALLOUT_LINE_RE.exec(lines[j]);
        if (lineMatch && lines[j].startsWith(">")) {
          j++;
        } else {
          break;
        }
      }

      let to = from;
      for (let k = i; k < j; k++) {
        to += lines[k].length;
        if (k < j - 1) to += 1;
      }

      ranges.push([from, to]);
      i = j;
    } else {
      i++;
    }
  }

  return ranges;
}

/**
 * 找出表格块区间（与 table.ts 同口径）。返回 `[from, to]` 偏移数组。
 */
function findTableRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split("\n");
  const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;

  let i = 0;
  while (i < lines.length) {
    if (TABLE_ROW_RE.test(lines[i])) {
      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1;
      }

      let j = i;
      while (j < lines.length && TABLE_ROW_RE.test(lines[j])) {
        j++;
      }

      let to = from;
      for (let k = i; k < j; k++) {
        to += lines[k].length;
        if (k < j - 1) to += 1;
      }

      ranges.push([from, to]);
      i = j;
    } else {
      i++;
    }
  }

  return ranges;
}

/**
 * 找出分栏块区间（`::: {.col-N}` … `:::`）。返回 `[from, to]` 偏移数组。
 */
function findColumnRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split("\n");
  const OPEN_RE = /^ {0,3}:::\s*\{([^}]*)\}\s*$/;
  const CLOSE_RE = /^ {0,3}:::\s*$/;
  const COL_RE = /\.col-([1-5])/;

  let i = 0;
  while (i < lines.length) {
    const open = OPEN_RE.exec(lines[i]);
    const colMatch = open ? COL_RE.exec(open[1]) : null;
    if (open && colMatch) {
      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1;
      }

      let j = i + 1;
      let depth = 1;
      while (j < lines.length) {
        if (OPEN_RE.test(lines[j])) depth += 1;
        else if (CLOSE_RE.test(lines[j])) {
          depth -= 1;
          if (depth === 0) break;
        }
        j++;
      }

      if (j < lines.length) {
        let to = from;
        for (let k = i; k <= j; k++) {
          to += lines[k].length;
          if (k < j) to += 1;
        }
        ranges.push([from, to]);
        i = j + 1;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return ranges;
}

/**
 * 找出 mermaid 块区间（```mermaid … ```）。返回 `[from, to]` 偏移数组。
 */
function findMermaidRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split("\n");
  const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\n]*)$/;
  const FENCE_CLOSE_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*$/;

  let i = 0;
  while (i < lines.length) {
    const open = FENCE_OPEN_RE.exec(lines[i]);
    const language = open ? open[3].trim().split(/\s+/)[0] : "";
    if (open && language === "mermaid") {
      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1;
      }

      const fenceChar = open[2][0];
      const fenceLen = open[2].length;

      let close = -1;
      for (let j = i + 1; j < lines.length; j++) {
        const candidate = FENCE_CLOSE_RE.exec(lines[j]);
        if (
          candidate &&
          candidate[2][0] === fenceChar &&
          candidate[2].length >= fenceLen
        ) {
          close = j;
          break;
        }
      }

      if (close !== -1) {
        let to = from;
        for (let k = i; k <= close; k++) {
          to += lines[k].length;
          if (k < close) to += 1;
        }
        ranges.push([from, to]);
        i = close + 1;
      } else {
        // 未闭合围栏：其后整篇都算 mermaid
        let to = from;
        for (let k = i; k < lines.length; k++) {
          to += lines[k].length;
          if (k < lines.length - 1) to += 1;
        }
        ranges.push([from, to]);
        break;
      }
    } else {
      i++;
    }
  }

  return ranges;
}

/**
 * 为整篇文档生成链接装饰。
 *
 * @param text 全文。
 * @param activeFrom 活跃块起点（无活跃块时为 -1）。
 * @param activeTo 活跃块终点（无活跃块时为 -1）。
 */
export function createLinkDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  // 需要跳过的区间：围栏/缩进代码、高亮块、表格、分栏、mermaid。
  const allExcludedRanges: Array<[number, number]> = [
    ...findFencedRanges(text),
    ...findCalloutRanges(text),
    ...findTableRanges(text),
    ...findColumnRanges(text),
    ...findMermaidRanges(text),
  ];

  linkRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(text)) !== null) {
    const matchStart = match.index;

    if (isInsideRange(matchStart, allExcludedRanges)) continue;

    const linkText = match[1];
    const from = matchStart;
    const to = matchStart + match[0].length;

    // match[0] = `[text](url)`，match[1] = text
    const openBracketLen = 1; // '['
    const textStart = from + openBracketLen;
    const textEnd = from + openBracketLen + linkText.length;

    const isActive = activeFrom >= 0 && from >= activeFrom && to <= activeTo;

    if (isActive) {
      // 活跃块：原始源码可见，链接文字仍带样式
      decorations.push(
        Decoration.mark({ class: `${LINK_CLASS} ${BLOCK_ACTIVE_CLASS}` }).range(
          textStart,
          textEnd,
        ),
      );
    } else {
      // 非活跃块：藏掉 `[` 与 `](url)`，只留链接文字
      decorations.push(Decoration.replace({}).range(from, textStart));
      decorations.push(Decoration.replace({}).range(textEnd, to));
      decorations.push(
        Decoration.mark({ class: LINK_CLASS }).range(textStart, textEnd),
      );
    }
  }

  return decorations;
}
