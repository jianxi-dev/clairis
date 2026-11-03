/* 加粗 / 斜体 / 删除线 / 下划线装饰（移植自 md-bundle
 * packages/editor/src/decorations/boldItalic.ts）。
 *
 * 行内标记（`**` `*` `~~` `<u>`）在两种状态下都隐藏：行内语法没有块结构可言，
 * 揭示它只会让正文在光标进出时跳动。`**text` 这类未闭合的标记按「边打边渲染」
 * 处理——隐藏开头标记、内容照常加粗，闭合后再补齐。
 *
 * 原始 HTML 透传 span（`mdb-font-*` / `mdb-color-*` / `mdb-bg-*`）同样隐藏标签、
 * 只留样式类，三种族共用一条实现，避免各自漂移。
 */
import type { Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { fencedCodeRanges } from "./code";

export const boldRegex = /\*\*(.+?)\*\*/g;
export const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|_(.+?)_/g;
export const strikeRegex = /~~(.+?)~~/g;
export const underlineRegex = /<u>([^<]+?)<\/u>/g;

// span 内容里可能再嵌一层 `<u>…</u>`；旧的 `[^<]+?` 会直接拒绝，导致整段
// span 匹配失败、标签原样漏出（#467）。
const spanBody = "(?:[^<]|<u>[^<]+?<\\/u>)+?";
export const fontRegex = new RegExp(
  `<span class="mdb-font-(serif|mono|sans)">(${spanBody})<\\/span>`,
  "g",
);
export const colorRegex = new RegExp(
  `<span class="mdb-color-(red|orange|yellow|green|cyan|blue|purple|gray)">(${spanBody})<\\/span>`,
  "g",
);
export const bgRegex = new RegExp(
  `<span class="mdb-bg-(darkred|darkgreen|red|orange|yellow|green|cyan|blue|purple|gray|brown|olive|navy|indigo|slate)">(${spanBody})<\\/span>`,
  "g",
);

export const BOLD_CLASS = "cm-strong";
export const ITALIC_CLASS = "cm-em";
export const STRIKE_CLASS = "cm-strikethrough";
export const UNDERLINE_CLASS = "cm-underline";

/** 带原始 HTML 透传 span 的类族（字体 / 文字色 / 背景色）。 */
type SpanFamily = "mdb-font" | "mdb-color" | "mdb-bg";

/**
 * 装饰 `mdb-{family}-{variant}` 透传 span：隐藏两侧标签，内容打上对应
 * `cm-*` 类。字体 / 文字色 / 背景色三族共用（#278）。
 */
function decorateSpanFamily(
  text: string,
  regex: RegExp,
  family: SpanFamily,
  decorations: Range<Decoration>[],
): void {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const openTag = `<span class="${family}-${match[1]}">`;
    const closeTag = "</span>";
    const openLen = openTag.length;
    const closeLen = closeTag.length;
    const markClass = `cm-${family.slice("mdb-".length)}-${match[1]}`;

    const contentFrom = from + openLen;
    const contentTo = to - closeLen;
    decorations.push(Decoration.replace({}).range(from, contentFrom));
    decorations.push(
      Decoration.mark({ class: markClass }).range(contentFrom, contentTo),
    );
    decorations.push(Decoration.replace({}).range(contentTo, to));

    // span 内嵌的 `<u>…</u>`：隐藏标签并加下划线，让颜色与下划线叠加（#467）。
    const inner = text.slice(contentFrom, contentTo);
    const nestedUnderline = /<u>([^<]+?)<\/u>/g;
    let nested: RegExpExecArray | null;
    while ((nested = nestedUnderline.exec(inner)) !== null) {
      const innerFrom = contentFrom + nested.index;
      const innerTo = innerFrom + nested[0].length;
      const innerTextFrom = innerFrom + "<u>".length;
      const innerTextTo = innerTo - "</u>".length;
      decorations.push(Decoration.replace({}).range(innerFrom, innerTextFrom));
      decorations.push(
        Decoration.mark({ class: UNDERLINE_CLASS }).range(
          innerTextFrom,
          innerTextTo,
        ),
      );
      decorations.push(Decoration.replace({}).range(innerTextTo, innerTo));
    }
  }
}

// --- 未闭合标记检测（边打边渲染） --------------------------------------------

/**
 * 检测未闭合的加粗标记（有 `**` 开头、没有闭合）。返回开头 `**` 的位置
 * 与内容范围。
 */
export function findIncompleteBold(
  text: string,
): { openPos: number; contentFrom: number; contentTo: number } | null {
  const incompleteBoldRegex = /\*\*([^\n*]+?)(?:\*\*|$)/g;
  incompleteBoldRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = incompleteBoldRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const isComplete = match[0].endsWith("**") && match[0].length > 4;
    if (!isComplete) {
      return { openPos: from, contentFrom: from + 2, contentTo: to };
    }
  }
  return null;
}

/**
 * 检测未闭合的斜体标记（有 `*` 开头、没有闭合，且不是 `**` 的一部分）。
 */
export function findIncompleteItalic(
  text: string,
): { openPos: number; contentFrom: number; contentTo: number } | null {
  const incompleteItalicRegex = /(?<!\*)\*(?!\*)([^\n*]+?)(?:\*(?!\*)|$)/g;
  incompleteItalicRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = incompleteItalicRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    const isComplete =
      match[0].endsWith("*") && !match[0].endsWith("**") && match[0].length > 2;
    if (!isComplete) {
      return { openPos: from, contentFrom: from + 1, contentTo: to };
    }
  }
  return null;
}

/**
 * 为整篇文档生成行内装饰。
 *
 * 行内标记与活跃块无关，所以 `activeFrom` / `activeTo` 只保留签名一致：
 * 上游同样忽略它们。
 *
 * @param text 全文。
 * @param activeFrom 活跃块起点（无活跃块时为 -1）。
 * @param activeTo 活跃块终点（无活跃块时为 -1）。
 */
export function createBoldItalicDecorations(
  text: string,
  _activeFrom: number = -1,
  _activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  // 围栏代码块里的 `**` / `~~` / `<u>` 是代码内容，不能当行内语法渲染。
  const fences = fencedCodeRanges(text);
  const inFence = (pos: number): boolean =>
    fences.some((range) => pos >= range.from && pos <= range.to);

  // 加粗：**text** → 隐藏 **，正文加粗
  boldRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    if (inFence(match.index)) continue;
    const from = match.index;
    const to = from + match[0].length;
    const delimLen = 2;

    decorations.push(Decoration.replace({}).range(from, from + delimLen));
    decorations.push(
      Decoration.mark({ class: BOLD_CLASS }).range(
        from + delimLen,
        to - delimLen,
      ),
    );
    decorations.push(Decoration.replace({}).range(to - delimLen, to));
  }

  // 斜体：*text* 或 _text_ → 隐藏分隔符，正文斜体
  italicRegex.lastIndex = 0;
  while ((match = italicRegex.exec(text)) !== null) {
    if (inFence(match.index)) continue;
    const from = match.index;
    const to = from + match[0].length;
    const delimLen = 1;

    decorations.push(Decoration.replace({}).range(from, from + delimLen));
    decorations.push(
      Decoration.mark({ class: ITALIC_CLASS }).range(
        from + delimLen,
        to - delimLen,
      ),
    );
    decorations.push(Decoration.replace({}).range(to - delimLen, to));
  }

  // 删除线：~~text~~ → 隐藏 ~~，正文加删除线（#260）
  strikeRegex.lastIndex = 0;
  while ((match = strikeRegex.exec(text)) !== null) {
    if (inFence(match.index)) continue;
    const from = match.index;
    const to = from + match[0].length;
    const delimLen = 2;
    decorations.push(Decoration.replace({}).range(from, from + delimLen));
    decorations.push(
      Decoration.mark({ class: STRIKE_CLASS }).range(
        from + delimLen,
        to - delimLen,
      ),
    );
    decorations.push(Decoration.replace({}).range(to - delimLen, to));
  }

  // 下划线：<u>text</u> → 隐藏原始标签，正文加下划线（#260）
  underlineRegex.lastIndex = 0;
  while ((match = underlineRegex.exec(text)) !== null) {
    if (inFence(match.index)) continue;
    const from = match.index;
    const to = from + match[0].length;
    const openLen = "<u>".length;
    const closeLen = "</u>".length;
    decorations.push(Decoration.replace({}).range(from, from + openLen));
    decorations.push(
      Decoration.mark({ class: UNDERLINE_CLASS }).range(
        from + openLen,
        to - closeLen,
      ),
    );
    decorations.push(Decoration.replace({}).range(to - closeLen, to));
  }

  // 原始 HTML 透传 span：字体 / 文字色 / 背景色
  decorateSpanFamily(text, fontRegex, "mdb-font", decorations);
  decorateSpanFamily(text, colorRegex, "mdb-color", decorations);
  decorateSpanFamily(text, bgRegex, "mdb-bg", decorations);

  // 边打边渲染：未闭合标记
  const incompleteBold = findIncompleteBold(text);
  if (incompleteBold) {
    decorations.push(
      Decoration.replace({}).range(
        incompleteBold.openPos,
        incompleteBold.openPos + 2,
      ),
    );
    decorations.push(
      Decoration.mark({ class: BOLD_CLASS }).range(
        incompleteBold.contentFrom,
        incompleteBold.contentTo,
      ),
    );
  }

  const incompleteItalic = findIncompleteItalic(text);
  if (incompleteItalic) {
    decorations.push(
      Decoration.replace({}).range(
        incompleteItalic.openPos,
        incompleteItalic.openPos + 1,
      ),
    );
    decorations.push(
      Decoration.mark({ class: ITALIC_CLASS }).range(
        incompleteItalic.contentFrom,
        incompleteItalic.contentTo,
      ),
    );
  }

  return decorations;
}
