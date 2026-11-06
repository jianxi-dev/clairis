import { Decoration } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import { fencedCodeRanges } from "./code";
import { isUnknownStructuralTagLine } from "./structuralTagPattern";

/**
 * 隐藏独占一行的未知结构标签（`<objective>`、`<essential_principles>` 等）。
 *
 * 预览渲染会在解析前删掉这些行；语义编辑态用 replace 装饰保持一致，
 * 源码模式不装配装饰，仍可看到原始标签。
 *
 * 围栏代码块内的同名行是代码内容，跳过——否则编辑态会把代码行抹成空行。
 */
export function createStructuralTagDecorations(
  docText: string,
): Range<Decoration>[] {
  const ranges: Range<Decoration>[] = [];
  const fences = fencedCodeRanges(docText);
  const inFence = (pos: number): boolean =>
    fences.some((range) => pos >= range.from && pos <= range.to);

  let offset = 0;
  for (const line of docText.split("\n")) {
    if (
      line.length > 0 &&
      !inFence(offset) &&
      isUnknownStructuralTagLine(line)
    ) {
      ranges.push(Decoration.replace({}).range(offset, offset + line.length));
    }
    offset += line.length + 1;
  }
  return ranges;
}
