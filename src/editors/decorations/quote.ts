/* 引用装饰（移植自 md-bundle packages/editor/src/decorations/quote.ts）。
 *
 * - 非活跃块：`> ` 被替换掉，只留左侧竖线与底色。
 * - 活跃块：左侧竖线 + 低透明度的 `> ` 前缀，提示这是引用块。
 */
import type { Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { resolveCalloutType } from "../callout-types";

export const quoteRegex = /^>\s?/m;

/**
 * 高亮块起始行（`> [!NOTE]` 之类）。高亮块自带卡片外观，若再套引用底色就会
 * 出现「卡片外套一条灰带」，所以整块跳过引用装饰。非法类型（`[!FOO]`）不算
 * 高亮块——它本来就该回落到普通引用。
 */
const calloutStartRegex = /^>\s*\[!([^\]]+)\]/;

function isCalloutStart(line: string): boolean {
  const match = calloutStartRegex.exec(line);
  if (!match) return false;
  return (
    resolveCalloutType(match[1].trim().replace(/[-+]$/, "").toLowerCase()) !==
    null
  );
}

export const QUOTE_CLASS = "cm-quote";
export const QUOTE_MARKER_ACTIVE_CLASS = "cm-quote-marker-active";
export const BLOCK_ACTIVE_CLASS = "cm-block-active";
export const BLOCK_INACTIVE_CLASS = "cm-block-inactive";

/**
 * 为整篇文档生成引用装饰。
 *
 * @param text 全文。
 * @param activeFrom 活跃块起点（无活跃块时为 -1）。
 * @param activeTo 活跃块终点（无活跃块时为 -1）。
 */
export function createQuoteDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const lines = text.split("\n");

  let pos = 0;
  let inCallout = false;
  for (const line of lines) {
    if (!line.startsWith(">")) inCallout = false;
    else if (isCalloutStart(line)) inCallout = true;

    const match = inCallout ? null : line.match(quoteRegex);
    if (match) {
      const lineStart = pos;
      const lineEnd = pos + line.length;
      const isActive =
        activeFrom >= 0 && lineStart >= activeFrom && lineEnd <= activeTo;

      // 行级样式（左侧竖线、灰底）
      const lineClass = `${QUOTE_CLASS} ${isActive ? BLOCK_ACTIVE_CLASS : BLOCK_INACTIVE_CLASS}`;
      decorations.push(Decoration.line({ class: lineClass }).range(pos));

      // 活跃块里以低透明度显示 `> ` 前缀；非活跃块直接替换掉。
      const markerLen = match[0].length;
      if (isActive) {
        decorations.push(
          Decoration.mark({ class: QUOTE_MARKER_ACTIVE_CLASS }).range(
            pos,
            pos + markerLen,
          ),
        );
      } else {
        decorations.push(Decoration.replace({}).range(pos, pos + markerLen));
      }
    }
    pos += line.length + 1;
  }

  return decorations;
}
