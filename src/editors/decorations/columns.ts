/* 分栏布局 widget（移植自 md-bundle packages/editor/src/decorations/columns.ts）。
 *
 * 把 Pandoc 围栏 div `::: {.col-N}` 渲染成编辑态真实的多栏布局，对齐预览的
 * `.layout-col-N`。
 *
 * 模型参照参考产品：分栏是显式容器，每栏持有自己的内容块，栏宽是加总为 100 的
 * 百分比。整个围栏 div（含 `:::` 标记）被一个 widget 替换，所以原始标记在布局
 * 渲染时不显示。
 *
 * 相邻栏之间有一个可拖拽的 gutter：悬停显示 `col-resize` 光标并高亮该线；拖拽把
 * 宽度写回源码，作为首行围栏上的 `cols:` 百分比属性。
 */
import { Decoration, WidgetType, type EditorView } from "@codemirror/view";
import type { Range } from "@codemirror/state";

const OPEN_RE = /^ {0,3}:::\s*\{([^}]*)\}\s*$/;
const CLOSE_RE = /^ {0,3}:::\s*$/;
const COL_RE = /\.col-([1-5])/;
const COLS_ATTR_RE = /(?:^|\s)cols:([0-9]+(?:,[0-9]+)*)(?=[\s}]|$)/;

const MIN_COLUMN_PERCENT = 10;

interface ColumnBlock {
  /** 整个围栏 div 的范围，含标记。 */
  from: number;
  to: number;
  /** 首行围栏的范围，用于改写 `cols:`。 */
  openFrom: number;
  openTo: number;
  count: number;
  /** 百分比宽度；源码没声明时为 null（等分）。 */
  widths: number[] | null;
  /** 围栏内每个顶层块，按源码顺序。 */
  cells: { from: number; to: number; text: string }[];
}

/**
 * 从补齐后的单元格列表重建分栏块。
 *
 * GFM/Pandoc 围栏 div 没有放空栏的槽位：`splitCells` 只返回含非空白的内容块，
 * 所以空栏在源码里根本不存在。因此编辑空栏必须用补齐后的列表重写围栏 div（空
 * 单元格变成 `:::` 标记之间的空段）。
 *
 * 重写保持首/尾围栏行逐字节不变，只动内部段。
 */
function rebuildColumns(
  docText: string,
  block: ColumnBlock,
  cells: string[],
): string | null {
  const text = docText.slice(block.from, block.to);
  const lines = text.split("\n");
  if (lines.length < 2) return null;
  const openLine = lines[0];
  const closeLine = lines[lines.length - 1];
  // 嵌套围栏：拒绝而不是篡改我们没建模的结构。
  if (
    lines.slice(1, -1).some((line) => OPEN_RE.test(line) || CLOSE_RE.test(line))
  )
    return null;
  const padded = Array.from({ length: block.count }, (_, i) =>
    (cells[i] ?? "").replace(/\n{3,}/g, "\n\n"),
  );
  return [openLine, "", padded.join("\n\n"), "", closeLine].join("\n");
}

/**
 * 栏内就地编辑器（#450）。
 *
 * widget 替换了整个围栏 div，所以把 CM6 光标「放进某一栏」是不可能的：widget
 * 内的任何坐标都映射回块首行。栏正文里一个真实 `<textarea>` 是在用户点击处输入
 * 的唯一办法；落定时通过重建围栏 div 写回。
 */
function openColumnEditor(
  view: EditorView,
  blockFrom: number,
  index: number,
  host: HTMLElement,
  initial: string,
): void {
  const existing = host.querySelector<HTMLTextAreaElement>(".cm-column-editor");
  if (existing) {
    existing.focus();
    return;
  }
  const area = document.createElement("textarea");
  area.className = "cm-column-editor";
  area.setAttribute("data-testid", "cm-column-editor");
  area.value = initial;
  area.rows = 1;
  host.appendChild(area);
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);

  let composing = false;
  const teardown = (): void => {
    area.remove();
    host.removeAttribute("data-editing");
  };
  const commit = (): void => {
    if (!area.isConnected) return;
    const value = area.value.trim();
    teardown();
    const docText = view.state.doc.toString();
    const block = parseColumns(docText).find((b) => b.from === blockFrom);
    if (!block) return;
    const cells = Array.from({ length: block.count }, (_, i) =>
      (block.cells[i]?.text ?? "").trim(),
    );
    cells[index] = value;
    const next = rebuildColumns(docText, block, cells);
    if (next === null) return;
    view.dispatch({
      changes: { from: block.from, to: block.to, insert: next },
    });
    view.focus();
  };

  area.addEventListener("compositionstart", () => {
    composing = true;
  });
  area.addEventListener("compositionend", () => {
    composing = false;
  });
  area.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      teardown();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit();
    }
  });
  area.addEventListener("blur", () => {
    if (!composing) commit();
  });
  area.addEventListener("input", () => {
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
  });
  area.addEventListener("mousedown", (event) => event.stopPropagation());
}

/** `count` 栏的等分百分比（余数均匀摊）。 */
function equalWidths(count: number): number[] {
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from(
    { length: count },
    (_, i) => base + (i < remainder ? 1 : 0),
  );
}

/** 要渲染的宽度：声明了合法 `cols:` 就用它，否则等分。 */
function resolveWidths(block: ColumnBlock): number[] {
  if (block.widths && block.widths.length === block.count) return block.widths;
  return equalWidths(block.count);
}

/** 把内部内容按顶层块（空行分隔）切分。 */
function splitCells(
  text: string,
  contentFrom: number,
): { from: number; to: number; text: string }[] {
  const cells: { from: number; to: number; text: string }[] = [];
  const re = /\S[^\n]*(?:\n(?!\s*\n)[^\n]*)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    cells.push({
      from: contentFrom + m.index,
      to: contentFrom + m.index + m[0].length,
      text: m[0],
    });
  }
  return cells;
}

function parseColumns(docText: string): ColumnBlock[] {
  const lines = docText.split("\n");
  const offsets: number[] = [];
  let acc = 0;
  for (const line of lines) {
    offsets.push(acc);
    acc += line.length + 1;
  }

  const blocks: ColumnBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = OPEN_RE.exec(lines[i]);
    const colMatch = open ? COL_RE.exec(open[1]) : null;
    if (!open || !colMatch) {
      i += 1;
      continue;
    }
    let j = i + 1;
    let depth = 1;
    while (j < lines.length) {
      if (OPEN_RE.test(lines[j])) depth += 1;
      else if (CLOSE_RE.test(lines[j])) {
        depth -= 1;
        if (depth === 0) break;
      }
      j += 1;
    }
    if (j >= lines.length) {
      i += 1;
      continue;
    }

    const contentFrom = offsets[i] + lines[i].length + 1;
    const inner = lines.slice(i + 1, j).join("\n");
    const colsMatch = COLS_ATTR_RE.exec(open[1]);
    const widths = colsMatch ? colsMatch[1].split(",").map(Number) : null;

    blocks.push({
      from: offsets[i],
      to: offsets[j] + lines[j].length,
      openFrom: offsets[i],
      openTo: offsets[i] + lines[i].length,
      count: Number(colMatch[1]),
      widths,
      cells: splitCells(inner, contentFrom),
    });
    i = j + 1;
  }
  return blocks;
}

/** 改写围栏 div 首行上的 `cols:` 属性。 */
function withColsAttr(openLine: string, widths: number[]): string {
  const attr = `cols:${widths.join(",")}`;
  if (COLS_ATTR_RE.test(openLine)) {
    // COLS_ATTR_RE 的匹配含前导分隔符；丢掉它会把属性粘到前一个 token 上
    // （`{.col-2cols:40,60}`）。
    return openLine.replace(COLS_ATTR_RE, (match) => {
      const sep = /\s/.test(match[0]) ? match[0] : "";
      return `${sep}${attr}`;
    });
  }
  return openLine.replace(/\}\s*$/, ` ${attr}}`);
}

class ColumnsWidget extends WidgetType {
  constructor(
    /** 分栏块序号——文档位移时保持稳定的键。 */
    readonly index: number,
    readonly block: ColumnBlock,
  ) {
    super();
  }

  eq(other: ColumnsWidget): boolean {
    return (
      this.index === other.index &&
      this.block.count === other.block.count &&
      JSON.stringify(resolveWidths(this.block)) ===
        JSON.stringify(resolveWidths(other.block)) &&
      JSON.stringify(this.block.cells.map((c) => c.text)) ===
        JSON.stringify(other.block.cells.map((c) => c.text))
    );
  }

  toDOM(view?: EditorView): HTMLElement {
    const widths = resolveWidths(this.block);
    const container = document.createElement("div");
    container.className = "cm-columns";
    container.classList.add(`cm-columns-${this.block.count}`);
    container.setAttribute("data-testid", "cm-columns");
    container.style.display = "flex";
    container.style.alignItems = "stretch";

    // 即使块为空也渲染 `count` 栏：刚插入的 `::: {.col-N}` 还没有单元格，
    // 零子元素容器不可见。缺失的单元格变成空占位，锚在首行围栏，这样点某栏
    // 仍能选到合理的源码范围。
    for (let index = 0; index < this.block.count; index++) {
      if (index > 0) {
        container.appendChild(this.buildGutter(view, index, widths));
      }
      const cell = this.block.cells[index] ?? {
        from: this.block.openTo,
        to: this.block.openTo,
        text: "",
      };
      container.appendChild(
        this.buildColumn(
          view,
          cell,
          index,
          widths[index] ?? 100 / this.block.count,
        ),
      );
    }

    return container;
  }

  private buildColumn(
    view: EditorView | undefined,
    cell: { from: number; to: number; text: string },
    index: number,
    percent: number,
  ): HTMLElement {
    const col = document.createElement("div");
    col.className = "cm-column";
    col.dataset.col = String(index);
    col.style.flex = `0 0 calc(${percent}% - 8px)`;
    col.style.minWidth = "0";

    const body = document.createElement("div");
    body.className = "cm-column-body";
    body.textContent = cell.text;
    if (!cell.text) body.dataset.placeholder = "输入内容…";
    // 按下就打开本栏的就地编辑器（#450）。改为选中源码范围会把光标放到块首行，
    // 输入就落到栏外。
    if (view) {
      const blockFrom = this.block.from;
      body.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        body.dataset.editing = "true";
        openColumnEditor(view, blockFrom, index, body, cell.text);
      });
    }
    col.appendChild(body);

    const handle = document.createElement("div");
    handle.className = "cm-column-handle";
    handle.setAttribute("data-testid", "column-block-handle");
    handle.dataset.col = String(index);
    handle.title = "选中此栏";
    if (view) {
      handle.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        view.dispatch({ selection: { anchor: cell.from, head: cell.to } });
        view.focus();
      });
    }
    col.appendChild(handle);

    return col;
  }

  /** 栏间 gutter：悬停高亮该线，拖拽调宽（#327）。 */
  private buildGutter(
    view: EditorView | undefined,
    index: number,
    widths: number[],
  ): HTMLElement {
    const gutter = document.createElement("div");
    gutter.className = "cm-column-gutter";
    gutter.setAttribute("data-testid", "column-gutter");
    gutter.dataset.index = String(index);

    const line = document.createElement("div");
    line.className = "cm-column-gutter-line";
    gutter.appendChild(line);

    if (!view) return gutter;

    const startDrag = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      const rect = view.dom.getBoundingClientRect();
      const total = rect.width;
      const startX = event.clientX;
      const left = widths[index - 1];
      const right = widths[index];
      const sum = left + right;

      const onMove = (move: MouseEvent): void => {
        const delta = ((move.clientX - startX) / total) * 100;
        const nextLeft = Math.min(
          Math.max(left + delta, MIN_COLUMN_PERCENT),
          sum - MIN_COLUMN_PERCENT,
        );
        widths[index - 1] = Math.round(nextLeft);
        widths[index] = Math.round(sum - nextLeft);
        // 实时视觉：拖拽时调整相邻两栏。
        const cols = gutter.parentElement?.querySelectorAll(".cm-column");
        if (cols) {
          (cols[index - 1] as HTMLElement).style.flex =
            `0 0 calc(${widths[index - 1]}% - 8px)`;
          (cols[index] as HTMLElement).style.flex =
            `0 0 calc(${widths[index]}% - 8px)`;
        }
      };
      const onUp = (): void => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        this.writeWidths(view, widths);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

    gutter.addEventListener("mousedown", startDrag);
    return gutter;
  }

  private writeWidths(view: EditorView, widths: number[]): void {
    const current = parseColumns(view.state.doc.toString())[this.index];
    // 防止序号漂移（拖拽中途增/删分栏）：写错围栏比丢掉 resize 更糟。
    if (!current || current.count !== this.block.count) return;
    const openLine = view.state.doc.sliceString(
      current.openFrom,
      current.openTo,
    );
    const next = withColsAttr(openLine, widths);
    if (next === openLine) return;
    view.dispatch({
      changes: { from: current.openFrom, to: current.openTo, insert: next },
    });
  }
}

/**
 * 装饰工厂：把每个分栏围栏 div 替换成布局 widget。
 */
export function createColumnsDecorations(docText: string): Range<Decoration>[] {
  return parseColumns(docText).map((block, index) =>
    Decoration.replace({
      widget: new ColumnsWidget(index, block),
      block: true,
    }).range(block.from, block.to),
  );
}
