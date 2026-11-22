/* 列表装饰（移植自 md-bundle packages/editor/src/decorations/list.ts）。
 *
 * - 无序列表：`- ` 两态都隐藏，项目符号由 CSS `::before` 画（活跃块里同时显示
 *   原始标记会出现两个符号，#235）。
 * - 有序列表：`1. ` 显示同级连续序号的计算值（源码字面量由 orderedNumberSync
 *   同步成同一数字）；活跃块里以低透明度显示。
 * - 任务列表：标记被替换成可点击复选框，点击把 `[ ]` / `[x]` 写回源码。
 *
 * 引用里的列表（`> - item`）同样识别：标记范围跳过 `> ` 前缀（那部分由
 * quote.ts 隐藏），否则 `> -` 行永远匹配不到行首正则、原样渲染（#382）。
 */
import type { Range } from "@codemirror/state";
import { Decoration, WidgetType, type EditorView } from "@codemirror/view";
import { fencedCodeRanges } from "./code";
import { classifyListLine, computeOrderedNumbers } from "../list-number";

export {
  classifyListLine,
  unorderedListRegex,
  orderedListRegex,
  taskListRegex,
} from "../list-number";
export type { ListLineInfo } from "../list-number";

export const LIST_CLASS = "cm-list";
export const LIST_ORDERED_CLASS = "cm-list-ordered";
export const LIST_DEPTH_1_CLASS = "cm-list-depth-1";
export const LIST_DEPTH_2_CLASS = "cm-list-depth-2";
export const LIST_DEPTH_3_CLASS = "cm-list-depth-3";
export const LIST_DEPTH_4_CLASS = "cm-list-depth-4";
export const LIST_DEPTH_5_CLASS = "cm-list-depth-5";
export const LIST_DEPTH_6_CLASS = "cm-list-depth-6";

/** 深度 0–6 的装饰类表；下标即 depth，0 为空串。 */
const LIST_DEPTH_CLASSES: readonly string[] = [
  "",
  LIST_DEPTH_1_CLASS,
  LIST_DEPTH_2_CLASS,
  LIST_DEPTH_3_CLASS,
  LIST_DEPTH_4_CLASS,
  LIST_DEPTH_5_CLASS,
  LIST_DEPTH_6_CLASS,
];

/** 深度对应的装饰类（0 或越界返回空串）。 */
export function listDepthClass(depth: number): string {
  return LIST_DEPTH_CLASSES[depth] ?? "";
}
export const LIST_MARKER_CLASS = "cm-list-marker";
export const LIST_MARKER_ACTIVE_CLASS = "cm-list-marker-active";
export const TASK_DONE_CLASS = "cm-task-done";
export const TASK_PENDING_CLASS = "cm-task-pending";
export const TASK_CHECKBOX_CLASS = "cm-task-checkbox";
export const BLOCK_ACTIVE_CLASS = "cm-block-active";
export const BLOCK_INACTIVE_CLASS = "cm-block-inactive";

/**
 * 替换 `- [ ] ` / `- [x] ` 标记的可点击复选框。切换时把 `[ ]` / `[x]`
 * 写回源码的方括号偏移处。
 */
class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly bracketFrom: number,
  ) {
    super();
  }

  toDOM(view?: EditorView): HTMLElement {
    const box = document.createElement("span");
    box.className = TASK_CHECKBOX_CLASS;
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(this.checked));
    box.setAttribute("data-testid", "task-checkbox");
    if (this.checked) box.setAttribute("data-checked", "true");
    box.title = this.checked ? "标记为未完成" : "标记为已完成";
    box.addEventListener("mousedown", (event) => {
      if (!view) return;
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        changes: {
          from: this.bracketFrom,
          to: this.bracketFrom + 3,
          insert: this.checked ? "[ ]" : "[x]",
        },
      });
      view.focus();
    });
    return box;
  }

  eq(other: TaskCheckboxWidget): boolean {
    return (
      this.checked === other.checked && this.bracketFrom === other.bracketFrom
    );
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 有序序号 widget：显示计算值，源码字面量被隐藏。
 *
 * 计算值来自 `computeOrderedNumbers`（同级连续段内 1 起），源码字面量由
 * `orderedNumberSync` 同步成同一数字，所以显示、源码与预览三者一致。
 */
class OrderedMarkerWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly active: boolean,
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = this.active
      ? `${LIST_MARKER_CLASS} ${LIST_MARKER_ACTIVE_CLASS}`
      : LIST_MARKER_CLASS;
    span.textContent = this.text;
    return span;
  }

  eq(other: OrderedMarkerWidget): boolean {
    return this.text === other.text && this.active === other.active;
  }
}

/**
 * 为整篇文档生成列表装饰。
 *
 * @param text 全文。
 * @param activeFrom 活跃块起点（无活跃块时为 -1）。
 * @param activeTo 活跃块终点（无活跃块时为 -1）。
 */
export function createListDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const fences = fencedCodeRanges(text);
  const inFence = (pos: number): boolean =>
    fences.some((range) => pos >= range.from && pos <= range.to);
  const lines = text.split("\n");
  const orderedNumbers = new Map(
    computeOrderedNumbers(lines, inFence).map((entry) => [
      entry.lineStart,
      entry.number,
    ]),
  );

  let pos = 0;
  for (const line of lines) {
    const lineLen = line.length + 1; // +1 为 \n
    const lineStart = pos;
    const lineEnd = pos + line.length;
    const isActive =
      activeFrom >= 0 && lineStart >= activeFrom && lineEnd <= activeTo;
    const blockClass = isActive ? BLOCK_ACTIVE_CLASS : BLOCK_INACTIVE_CLASS;
    const info = inFence(lineStart) ? null : classifyListLine(line);
    if (!info) {
      pos += lineLen;
      continue;
    }
    const markerFrom = pos + info.prefixLen + info.indentLen;
    const depthClass = listDepthClass(info.depth);

    if (info.kind === "task" && info.markerLen > 0) {
      const bracketFrom =
        markerFrom + line.slice(info.prefixLen + info.indentLen).indexOf("[");
      const lineClasses = `${LIST_CLASS} ${info.checked ? TASK_DONE_CLASS : TASK_PENDING_CLASS} ${depthClass} ${blockClass}`;
      decorations.push(
        Decoration.replace({
          widget: new TaskCheckboxWidget(info.checked, bracketFrom),
        }).range(markerFrom, markerFrom + info.markerLen),
      );
      decorations.push(Decoration.line({ class: lineClasses }).range(pos));
    } else if (info.kind === "unordered" && info.markerLen > 0) {
      decorations.push(
        Decoration.replace({}).range(markerFrom, markerFrom + info.markerLen),
      );
      decorations.push(
        Decoration.line({
          class: `${LIST_CLASS} ${depthClass} ${blockClass}`,
        }).range(pos),
      );
    } else if (info.kind === "ordered" && info.markerLen > 0) {
      const number = orderedNumbers.get(lineStart) ?? 1;
      decorations.push(
        Decoration.replace({
          widget: new OrderedMarkerWidget(`${number}. `, isActive),
        }).range(markerFrom, markerFrom + info.markerLen),
      );
      decorations.push(
        Decoration.line({
          class: `${LIST_CLASS} ${LIST_ORDERED_CLASS} ${depthClass} ${blockClass}`,
        }).range(pos),
      );
    }

    pos += lineLen;
  }

  return decorations;
}

/**
 * 构建高亮块正文一行的展示 DOM。
 *
 * 高亮块正文由 widget 渲染，不是可编辑的 CM6 文本，装饰范围永远到不了它。
 * 这里是上面列表装饰语言的 DOM 孪生：列表行带同样的 `cm-line cm-list` /
 * `cm-list-ordered` / `cm-list-marker` / 任务类，所以高亮块里的列表与独立
 * 成行的列表读起来一致（#382）。
 */
export function createContentLineElement(
  line: string,
  orderedNumber?: number,
): HTMLElement {
  const el = document.createElement("div");
  el.className = "cm-callout-line";
  const info = classifyListLine(line);

  if (info.kind === "plain") {
    el.textContent = line;
    return el;
  }

  const body = line.slice(info.prefixLen);
  el.classList.add("cm-line", LIST_CLASS);
  if (info.kind === "ordered") el.classList.add(LIST_ORDERED_CLASS);
  if (info.kind === "task") {
    el.classList.add(info.checked ? TASK_DONE_CLASS : TASK_PENDING_CLASS);
    const box = document.createElement("span");
    box.className = TASK_CHECKBOX_CLASS;
    box.setAttribute("aria-hidden", "true");
    if (info.checked) box.setAttribute("data-checked", "true");
    el.appendChild(box);
  }
  if (info.kind === "ordered") {
    const marker = document.createElement("span");
    marker.className = LIST_MARKER_CLASS;
    marker.textContent =
      orderedNumber === undefined
        ? body.slice(0, info.markerLen)
        : `${orderedNumber}. `;
    el.appendChild(marker);
  }
  el.appendChild(document.createTextNode(body.slice(info.markerLen)));
  return el;
}
