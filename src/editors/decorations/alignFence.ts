/* 块对齐围栏装饰（ui-polish-batch15 / issue #668）。
 *
 * 块对齐把 `::: {.align-left|center|right}` … `:::` 写进源码，预览按围栏渲染。
 * 编辑态用 `Decoration.replace` 把围栏两行整行隐藏（含换行），源码态不装配本装饰，
 * 预览不受影响。
 *
 * 配对策略（逐行扫描状态机）：
 * - 起始行 / 结束行分别用与预览渲染器（`markdown.ts` 的 ALIGN_DIV_*_RE）一致的
 *   形状识别，避免「编辑态藏了、预览没渲染」的错配。
 * - 用栈配对：遇到起始行压栈，遇到结束行弹栈成对；嵌套按内层先成对处理。
 * - 配对失败（缺结束行 / 多余的结束行）不隐藏，避免吞掉正常内容。
 * - 围栏代码块与缩进代码块内的 `:::` 是代码内容，跳过（复用 findFencedRanges）。
 *
 * 隐藏范围：起始行「文本 + 行尾换行」，结束行「前导换行 + 文本」。这样整行消失，
 * 同时保留块外原有的空行与段落分隔，不会把相邻两块正文粘成一行。空块（起始行
 * 紧邻结束行）两段重叠，合并成一段整体隐藏。
 */
import type { Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { findFencedRanges, isInsideRange } from "./image";

/** 起始行：`::: {.align-left|center|right}`，允许前导空白与行尾空白。 */
const ALIGN_OPEN_RE = /^ {0,3}::: {(\.align-(?:left|center|right))}\s*$/;

/** 结束行：单独一行的 `:::`。 */
const ALIGN_CLOSE_RE = /^ {0,3}:::\s*$/;

/** 一个已配对的围栏（行内容范围，不含换行）。 */
interface AlignFence {
  openStart: number;
  openEnd: number;
  closeStart: number;
  closeEnd: number;
}

/**
 * 逐行扫描，配对起始行与结束行。
 *
 * 栈里只存起始行；遇到结束行就弹栈成对。扫描结束后栈里剩余的起始行视为未闭合，
 * 不产出装饰。
 */
function findAlignFences(docText: string): AlignFence[] {
  const fences: AlignFence[] = [];
  const stack: Array<{ start: number; end: number }> = [];
  const fencedRanges = findFencedRanges(docText);

  let offset = 0;
  for (const line of docText.split("\n")) {
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset = lineEnd + 1;

    // 代码块内的 `:::` 是代码内容，不是围栏标记。
    if (isInsideRange(lineStart, fencedRanges)) continue;

    if (ALIGN_OPEN_RE.test(line)) {
      stack.push({ start: lineStart, end: lineEnd });
      continue;
    }
    if (ALIGN_CLOSE_RE.test(line)) {
      const open = stack.pop();
      if (!open) continue; // 多余的结束行：保守不隐藏
      fences.push({
        openStart: open.start,
        openEnd: open.end,
        closeStart: lineStart,
        closeEnd: lineEnd,
      });
    }
  }

  return fences;
}

/**
 * 为全文所有已配对的块对齐围栏生成隐藏装饰。
 *
 * @param docText 全文。
 */
export function createAlignFenceDecorations(
  docText: string,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  for (const fence of findAlignFences(docText)) {
    // 起始行：文本 + 行尾换行（已配对说明其后必有内容，换行一定存在）。
    const openFrom = fence.openStart;
    const openTo = fence.openEnd + 1;
    // 结束行：前导换行 + 文本（保留其行尾换行，作为与后文的分隔）。
    const closeFrom = fence.closeStart - 1;
    const closeTo = fence.closeEnd;

    if (closeFrom < openTo) {
      // 空块（起始行紧邻结束行）：两段重叠，合并成一段整体隐藏。
      decorations.push(Decoration.replace({}).range(openFrom, closeTo));
      continue;
    }
    decorations.push(Decoration.replace({}).range(openFrom, openTo));
    decorations.push(Decoration.replace({}).range(closeFrom, closeTo));
  }

  return decorations;
}
