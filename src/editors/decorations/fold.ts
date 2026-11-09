/* 标题折叠（MD 编辑态，shell-editor-batch5 标题折叠需求）。
 *
 * 为「有下级内容」的 ATX 标题渲染可点击三角，点击折叠/展开该标题到下一个
 * 同级或更高级标题之间的全部内容。
 *
 * 状态：`foldState`（StateField<Set<number>>）保存被折叠标题的 1-based 行号，
 * `toggleFold`（StateEffect<number>）切换某行。行号而非偏移是有意的——折叠态
 * 在文档变更后按行号重新校验（prune），实现简单且够用。
 *
 * 装饰：三角是 WidgetType（点击派生 toggleFold），折叠范围用无 widget 的
 * `Decoration.replace` 隐藏。二者并入主装饰字段，由 `EditorView.decorations.from(field)`
 * 提供——静态源，允许跨行替换（ViewPlugin 的函数源不允许）。
 */
import type { EditorState, Range, Transaction } from "@codemirror/state";
import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { getBlocks } from "../block-model";

export const FOLD_TOGGLE_CLASS = "cm-fold-toggle";
export const FOLD_TOGGLE_FOLDED_CLASS = "cm-fold-toggle-folded";
export const FOLD_TOGGLE_ICON_CLASS = "cm-fold-toggle-icon";

const ATX_LINE_RE = /^\s{0,3}#{1,6}(\s|$)/;

/** 切换某行标题的折叠态。 */
export const toggleFold = StateEffect.define<number>();

/** 被折叠标题的 1-based 行号集合。 */
export const foldState = StateField.define<Set<number>>({
  create: () => new Set<number>(),
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(toggleFold)) {
        next = new Set(next);
        if (next.has(effect.value)) next.delete(effect.value);
        else next.add(effect.value);
      }
    }
    if (tr.docChanged) {
      next = isFullDocumentReplacement(tr)
        ? new Set<number>()
        : pruneFolded(next, tr.state);
    }
    return next;
  },
});

/**
 * 整篇替换（切页签、打开文件）后旧行号全部失效，折叠态必须清空；否则新文档
 * 里同一行号的标题会被误折叠。
 */
function isFullDocumentReplacement(tr: Transaction): boolean {
  let full = false;
  tr.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    if (
      fromA === 0 &&
      toA === tr.startState.doc.length &&
      fromB === 0 &&
      toB === tr.state.doc.length
    ) {
      full = true;
    }
  });
  return full;
}

function isAtxHeadingLine(state: EditorState, lineNum: number): boolean {
  if (lineNum < 1 || lineNum > state.doc.lines) return false;
  return ATX_LINE_RE.test(state.doc.line(lineNum).text);
}

/** 文档变更后剔除已不再是 ATX 标题的行号，避免旧行号误伤新标题。 */
function pruneFolded(folded: Set<number>, state: EditorState): Set<number> {
  if (folded.size === 0) return folded;
  let changed = false;
  const pruned = new Set<number>();
  for (const lineNum of folded) {
    if (isAtxHeadingLine(state, lineNum)) pruned.add(lineNum);
    else changed = true;
  }
  return changed ? pruned : folded;
}

interface FoldSection {
  readonly headingLine: number;
  readonly from: number;
  readonly to: number;
}

/**
 * 计算每个「有下级内容」的 ATX 标题的折叠范围。
 *
 * 章节边界：标题行末到下一个同级或更高级标题的行首（或文末）。中间内容非空白
 * 才算「有下级」——只有空行不算，不渲染三角。
 */
export function computeFoldSections(state: EditorState): FoldSection[] {
  const doc = state.doc;
  const headings = getBlocks(state).filter((block) => block.type === "heading");
  const sections: FoldSection[] = [];

  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i];
    const level = heading.level ?? 1;
    const headingLine = doc.lineAt(heading.from);
    if (!ATX_LINE_RE.test(headingLine.text)) continue;

    let sectionEnd = doc.length;
    for (let j = i + 1; j < headings.length; j += 1) {
      if ((headings[j].level ?? 1) <= level) {
        sectionEnd = headings[j].from;
        break;
      }
    }

    // 保留标题行末的换行符：替换范围从下一行行首开始。否则相邻标题各自折叠时，
    // 行尾换行被一起 replace 掉，多个标题会被 CodeMirror 渲染成同一行。
    const from = headingLine.to + 1;
    if (from >= sectionEnd) continue;
    if (doc.sliceString(from, sectionEnd).trim().length === 0) continue;

    sections.push({ headingLine: headingLine.number, from, to: sectionEnd });
  }

  return sections;
}

class FoldToggleWidget extends WidgetType {
  constructor(
    private readonly line: number,
    private readonly folded: boolean,
  ) {
    super();
  }

  eq(other: FoldToggleWidget): boolean {
    return other.line === this.line && other.folded === this.folded;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement("span");
    el.className = this.folded
      ? `${FOLD_TOGGLE_CLASS} ${FOLD_TOGGLE_FOLDED_CLASS}`
      : FOLD_TOGGLE_CLASS;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", this.folded ? "展开" : "折叠");
    el.setAttribute("data-fold-line", String(this.line));
    el.setAttribute("data-folded", this.folded ? "true" : "false");

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 20 20");
    icon.setAttribute("width", "20");
    icon.setAttribute("height", "20");
    icon.setAttribute("aria-hidden", "true");
    icon.classList.add(FOLD_TOGGLE_ICON_CLASS);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M7 4 L14.5 10 L7 16 Z");
    path.setAttribute("fill", "currentColor");
    icon.appendChild(path);
    el.appendChild(icon);

    el.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    el.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      // IME 组合中不折叠：组合文本会改文档，折叠行号会失效。
      if (view.composing) return;
      view.dispatch({ effects: toggleFold.of(this.line) });
    });
    return el;
  }
}

/**
 * 按当前折叠态生成折叠装饰：三角 widget + 折叠范围隐藏。
 *
 * @param state 当前编辑器状态。
 * @param folded 被折叠标题的行号集合。
 */
export function createFoldDecorations(
  state: EditorState,
  folded: Set<number>,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  for (const section of computeFoldSections(state)) {
    const isFolded = folded.has(section.headingLine);
    decorations.push(
      Decoration.widget({
        widget: new FoldToggleWidget(section.headingLine, isFolded),
        side: -1,
      }).range(state.doc.line(section.headingLine).from),
    );
    if (isFolded) {
      decorations.push(Decoration.replace({}).range(section.from, section.to));
    }
  }
  return decorations;
}
