/* 列表装饰（移植自 md-bundle packages/editor/src/decorations/list.ts）。
 *
 * - 无序列表：`- ` 两态都隐藏，项目符号由 CSS `::before` 画（活跃块里同时显示
 *   原始标记会出现两个符号，#235）。
 * - 有序列表：`1. ` 是语义内容，永不替换；活跃块里以低透明度显示。
 * - 任务列表：标记被替换成可点击复选框，点击把 `[ ]` / `[x]` 写回源码。
 *
 * 引用里的列表（`> - item`）同样识别：标记范围跳过 `> ` 前缀（那部分由
 * quote.ts 隐藏），否则 `> -` 行永远匹配不到行首正则、原样渲染（#382）。
 */
import type { Range } from "@codemirror/state";
import { Decoration, WidgetType, type EditorView } from "@codemirror/view";

const blockquotePrefixRegex = /^(?:>[ \t]?)+/;
export const unorderedListRegex = /^[-*+]\s/;
export const orderedListRegex = /^\d+\.\s/;
export const taskListRegex = /^- \[([ xX])\]\s/;

export const LIST_CLASS = "cm-list";
export const LIST_ORDERED_CLASS = "cm-list-ordered";
export const LIST_MARKER_CLASS = "cm-list-marker";
export const LIST_MARKER_ACTIVE_CLASS = "cm-list-marker-active";
export const TASK_DONE_CLASS = "cm-task-done";
export const TASK_PENDING_CLASS = "cm-task-pending";
export const TASK_CHECKBOX_CLASS = "cm-task-checkbox";
export const BLOCK_ACTIVE_CLASS = "cm-block-active";
export const BLOCK_INACTIVE_CLASS = "cm-block-inactive";

/** 一行的列表种类，以及标记占用的偏移。 */
export interface ListLineInfo {
  kind: "task" | "unordered" | "ordered" | "plain";
  /** 行首引用前缀（`> `）长度，没有则为 0。 */
  prefixLen: number;
  /** 前缀之后的标记长度（`- `、`1. `、`- [x] `），普通行为 0。 */
  markerLen: number;
  /** 任务行：复选框是否勾选。 */
  checked: boolean;
}

/**
 * 把一行源码归类为列表项，容忍引用前缀。
 *
 * 装饰与高亮块正文渲染共用这一份规则，引用里（或高亮块 widget 里）的列表
 * 因此与顶层列表行为一致，不会各自漂移。
 */
export function classifyListLine(line: string): ListLineInfo {
  const prefixLen = line.match(blockquotePrefixRegex)?.[0].length ?? 0;
  const body = line.slice(prefixLen);

  const task = taskListRegex.exec(body);
  if (task) {
    return {
      kind: "task",
      prefixLen,
      markerLen: task[0].length,
      checked: task[1].toLowerCase() === "x",
    };
  }
  const unordered = unorderedListRegex.exec(body);
  if (unordered) {
    return {
      kind: "unordered",
      prefixLen,
      markerLen: unordered[0].length,
      checked: false,
    };
  }
  const ordered = orderedListRegex.exec(body);
  if (ordered) {
    return {
      kind: "ordered",
      prefixLen,
      markerLen: ordered[0].length,
      checked: false,
    };
  }
  return { kind: "plain", prefixLen, markerLen: 0, checked: false };
}

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
  const lines = text.split("\n");

  let pos = 0;
  for (const line of lines) {
    const lineLen = line.length + 1; // +1 为 \n
    const lineStart = pos;
    const lineEnd = pos + line.length;
    const isActive =
      activeFrom >= 0 && lineStart >= activeFrom && lineEnd <= activeTo;
    const blockClass = isActive ? BLOCK_ACTIVE_CLASS : BLOCK_INACTIVE_CLASS;
    const info = classifyListLine(line);
    const markerFrom = pos + info.prefixLen;

    if (info.kind === "task" && info.markerLen > 0) {
      const bracketFrom = markerFrom + line.slice(info.prefixLen).indexOf("[");
      const lineClasses = `${LIST_CLASS} ${info.checked ? TASK_DONE_CLASS : TASK_PENDING_CLASS} ${blockClass}`;
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
        Decoration.line({ class: `${LIST_CLASS} ${blockClass}` }).range(pos),
      );
    } else if (info.kind === "ordered" && info.markerLen > 0) {
      const markerClass = isActive
        ? `${LIST_MARKER_CLASS} ${LIST_MARKER_ACTIVE_CLASS}`
        : LIST_MARKER_CLASS;
      decorations.push(
        Decoration.mark({ class: markerClass }).range(
          markerFrom,
          markerFrom + info.markerLen,
        ),
      );
      decorations.push(
        Decoration.line({
          class: `${LIST_CLASS} ${LIST_ORDERED_CLASS} ${blockClass}`,
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
export function createContentLineElement(line: string): HTMLElement {
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
    marker.textContent = body.slice(0, info.markerLen);
    el.appendChild(marker);
  }
  el.appendChild(document.createTextNode(body.slice(info.markerLen)));
  return el;
}
