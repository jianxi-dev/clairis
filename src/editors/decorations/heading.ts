import { type Range } from "@codemirror/state";
import { Decoration, WidgetType } from "@codemirror/view";

export const headingRegex = /^(#{1,6})\s+(.*)$/gm;

export const HEADING_CLASS = "cm-heading";

class HeadingWidget extends WidgetType {
  constructor(readonly level: string) {
    super();
  }

  eq(other: HeadingWidget): boolean {
    return other.level === this.level;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-heading-marker";
    span.textContent = `[H${this.level.length}]`;
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export function createHeadingDecorations(text: string): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  headingRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(text)) !== null) {
    const level = match[1];
    // Replace only the "# " prefix, preserving the heading text
    const from = match.index;
    const to = from + level.length + 1; // "#" + space

    decorations.push(
      Decoration.replace({
        widget: new HeadingWidget(level),
        inclusive: false,
      }).range(from, to),
    );

    // Apply heading class to the text portion
    const textFrom = to;
    const textTo = from + match[0].length;
    decorations.push(
      Decoration.mark({ class: HEADING_CLASS }).range(textFrom, textTo),
    );
  }

  return decorations;
}
