/* 分割线装饰（移植自 md-bundle packages/editor/src/decorations/hr.ts）。
 *
 * 语义揭示两态：
 * - 非活跃块：`---` / `***` / `___` 整行渲染成一条水平线，原始标记被替换掉。
 * - 活跃块：不出装饰，原始源码可见可编辑。
 *
 * 用行装饰 + 行内替换（不是 block widget）：行本身保持可编辑，光标能进得去。
 */
import type { Range } from "@codemirror/state";
import { Decoration, WidgetType } from "@codemirror/view";
import { fencedCodeRanges } from "./code";

export const HR_CLASS = "cm-thematic-break";

/**
 * 分割线语法（CommonMark §4.1）：最多 3 个前导空格，随后是三个及以上**同一种**
 * 字符（`-` / `*` / `_`），每个字符后可跟空格或制表符。要求同字符，所以 `-*-`
 * 不算；允许 `----` / `- - -` 这类固定三字符模式漏掉的形式。必须独占一行。
 */
export const hrRegex =
  /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;

/** 替换掉分割线标记、但让行保持可编辑的空 widget。 */
class EmptyWidget extends WidgetType {
  eq(other: EmptyWidget): boolean {
    return other instanceof EmptyWidget;
  }

  toDOM(): HTMLElement {
    return document.createElement("span");
  }

  ignoreEvent(): boolean {
    return false;
  }
}

const emptyWidget = new EmptyWidget();

/**
 * 为整篇文档生成分割线装饰。
 *
 * @param text 全文。
 * @param activeFrom 活跃块起点（无活跃块时为 -1）。
 * @param activeTo 活跃块终点（无活跃块时为 -1）。
 */
export function createHrDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const fences = fencedCodeRanges(text);
  const inFence = (pos: number): boolean =>
    fences.some((range) => pos >= range.from && pos <= range.to);
  const lines = text.split("\n");

  let pos = 0;
  for (const line of lines) {
    if (!inFence(pos) && hrRegex.test(line)) {
      const lineStart = pos;
      const lineEnd = pos + line.length;
      const isActive =
        activeFrom >= 0 && lineStart >= activeFrom && lineEnd <= activeTo;

      if (!isActive) {
        // 非活跃：行装饰画水平线，替换装饰藏掉原始标记。
        decorations.push(Decoration.line({ class: HR_CLASS }).range(lineStart));
        decorations.push(
          Decoration.replace({ widget: emptyWidget }).range(lineStart, lineEnd),
        );
      }
      // 活跃块：不出装饰，原始源码可见。
    }
    pos += line.length + 1; // +1 是换行符
  }

  return decorations;
}
