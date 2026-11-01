/* 标题装饰（移植自 md-bundle packages/editor/src/decorations/heading.ts）。
 *
 * 语义揭示两态：
 * - 非活跃块（光标不在块内）：`# ` 标记保留在 DOM 里但透明度 0，只看到标题文字。
 * - 活跃块（光标在块内）：标记以低透明度显示，用户看得到结构但不用读原始语法。
 *
 * 用 mark 而非 replace：原始 `# ` 留在 DOM 中才能继续编辑（改级别、退格）。
 */
import type { Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";

export const headingRegex = /^(#{1,6})\s+(.*)$/gm;

export const HEADING_CLASS = "cm-heading";
export const HEADING_MARKER_CLASS = "cm-heading-marker";
export const HEADING_MARKER_ACTIVE_CLASS = "cm-heading-marker-active";
export const BLOCK_ACTIVE_CLASS = "cm-block-active";
export const BLOCK_INACTIVE_CLASS = "cm-block-inactive";

/**
 * 为整篇文档生成标题装饰。
 *
 * @param text 全文。
 * @param activeFrom 活跃块起点（无活跃块时为 -1）。
 * @param activeTo 活跃块终点（无活跃块时为 -1）。
 */
export function createHeadingDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  headingRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(text)) !== null) {
    const level = match[1];
    // 标记范围只有 `# ` 前缀，标题正文从其后开始。
    const from = match.index;
    const to = from + level.length + 1; // "#" + 空格
    const content = match[2];

    const isActive = activeFrom >= 0 && from >= activeFrom && to <= activeTo;

    const markerClass = isActive
      ? `${HEADING_MARKER_CLASS} ${HEADING_MARKER_ACTIVE_CLASS}`
      : HEADING_MARKER_CLASS;
    decorations.push(Decoration.mark({ class: markerClass }).range(from, to));

    // 空标题（`# ` 后还没有文字，正是斜杠菜单插入 `# ` 的瞬间）的正文范围
    // 宽度为 0，CM6 拒绝空 mark 装饰——这里必须跳过，否则整篇装饰构建抛错。
    if (content.length > 0) {
      const markClass = isActive
        ? `${HEADING_CLASS} cm-h${level.length} ${BLOCK_ACTIVE_CLASS}`
        : `${HEADING_CLASS} cm-h${level.length} ${BLOCK_INACTIVE_CLASS}`;
      decorations.push(
        Decoration.mark({ class: markClass }).range(to, to + content.length),
      );
    }
  }

  return decorations;
}
