/**
 * 表格 widget —— 把 GFM 管道表格渲染成真正的 `<table>`，而 markdown 源码保持
 * 唯一真相源。
 *
 * 编辑如何工作
 * ------------
 * widget 根是 `contenteditable="false"`，把表格从 CM6 的可编辑区里拿出来。
 * 点击单元格会在该单元格里打开一个真正的 `<input>`：表单控件永远不是 CM6
 * 可编辑内容的一部分，不产生其观察者会响应的 DOM 变更，并且有原生焦点、
 * 光标、IME 和撤销。
 *
 * CM6 在 mousedown 捕获阶段重建 widget DOM，所以点击的 event target 在处理器
 * 运行时已被分离。因此编辑器在下一帧打开，按行/列重新查找活动单元格。
 *
 * 输入的文本暂存在按视图的 map 里（这样能跨 widget 重建存活），并在编辑落定
 * 时用**一个**事务写回：blur、Enter/Tab、表格外的 mousedown，或编辑器拆除
 * （模式切换）。flush 绝不在 CM6 update 内派发——它会延到下一个 tick。
 */
import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  ViewPlugin,
  WidgetType,
  type EditorView,
} from "@codemirror/view";
import { defaultCommands, openInsertMenu, releaseInsertMenu } from "../slash";

import { renderIcon } from "../icons";
import {
  parseCellBackground,
  renderCellText,
  sanitizeCellText,
  stripCellBackground,
} from "./cell-text";
import {
  clearCellSelection,
  getCellSelection,
  isCellInSelection,
  setCellSelection,
  subscribeCellSelection,
  type CellRect,
  type CellSelection,
} from "./cell-selection";

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;

/** 布局可测量前（隐藏行 / jsdom）使用的回退几何。 */
const FALLBACK_TABLE_WIDTH = 600;
const FALLBACK_ROW_HEIGHT = 32;
const BOUNDARY_THICKNESS = 6;

/**
 * 指针离行/列边界线多近（px）才显示其插入热点。与阅读端「边界线 8px 内」
 * 契约和 16px 圆点直径一致。#385a：显示是逐边界的，所以进入单元格不再一次
 * 点亮所有热点。
 */
const BOUNDARY_REVEAL_DISTANCE = 8;

/**
 * 尾部（追加）边界距表格边缘向内多远，量到条带中心。16px 圆点有一半保持
 * 可见而不被 wrap 裁剪，指针悬在边缘时仍落在 BOUNDARY_REVEAL_DISTANCE 内
 * （#432）。
 */
const BOUNDARY_EDGE_INSET = 8;

interface CellSpan {
  /** `-1` 表示表头行。 */
  row: number;
  col: number;
  from: number;
  to: number;
  /** 文档选区当前是否落在此单元格内。 */
  active: boolean;
}

interface TableBlock {
  index: number;
  from: number;
  to: number;
  header: string[];
  rows: string[][];
  cells: CellSpan[];
}

// --- 纯解析助手 --------------------------------------------------------------

/**
 * 把单元格手柄的状态写进去：图标、可访问名、data-cell-empty。
 *
 * 图标与文案全表统一：所有非表头单元格手柄都是同一个表格图标，不再按空 /
 * 有内容切换（#739）。图标名与 `block-handle.ts` 的 `BLOCK_ICON_NAME.table`
 * 是同一词汇，两处必须一致；`data-cell-empty` 按 当前内容记录（#108 的
 * 空态标记语义，e2e 断言读取）。
 *
 * updateDOM 每次刷新单元格都会调这里，所以签名保留 text 参数维持空态标记
 * 的重算；图标现为常量，`dataset.icon` 相同即跳过重建。
 */
function applyCellHandleState(handle: HTMLElement, text: string): void {
  const empty = text.trim() === "";
  handle.dataset.cellEmpty = String(empty);
  handle.title = "打开内容菜单";
  // 与 block-handle.ts `BLOCK_ICON_NAME.table` 同词汇（#739 统一后）。
  const iconName = "DataSheetOutlined";
  if (handle.dataset.icon === iconName) return;
  handle.dataset.icon = iconName;
  handle.replaceChildren(renderIcon(iconName));
}

function splitCells(line: string): string[] {
  const parts = line.split("|");
  return parts.slice(1, parts.length - 1).map((cell) => cell.trim());
}

function cellSpans(
  line: string,
  lineStart: number,
  row: number,
  active: CellActivity,
): CellSpan[] {
  const spans: CellSpan[] = [];
  const pipes: number[] = [];
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === "|") pipes.push(i);
  }
  for (let k = 0; k + 1 < pipes.length; k += 1) {
    let start = pipes[k] + 1;
    let end = pipes[k + 1];
    while (start < end && /\s/.test(line[start])) start += 1;
    while (end > start && /\s/.test(line[end - 1])) end -= 1;
    const from = lineStart + start;
    spans.push({
      row,
      col: k,
      from,
      to: lineStart + end,
      active: isActive(active, from, lineStart + end),
    });
  }
  return spans;
}

/** 光标占据的文档范围，用于标记活动单元格。 */
interface CellActivity {
  from: number;
  to: number;
  active: boolean;
}

function isActive(activity: CellActivity, from: number, to: number): boolean {
  if (!activity.active) return false;
  if (activity.from < 0) return false;
  // 折叠光标也算在空单元格内（from === to）。
  return activity.from >= from && activity.from <= to && activity.to >= from;
}

function findTables(
  text: string,
  activity: CellActivity = { from: -1, to: -1, active: false },
): TableBlock[] {
  const lines = text.split("\n");
  const offsets: number[] = [];
  let acc = 0;
  for (const line of lines) {
    offsets.push(acc);
    acc += line.length + 1;
  }

  const tables: TableBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const isTable =
      TABLE_ROW_RE.test(lines[i]) &&
      i + 1 < lines.length &&
      TABLE_SEP_RE.test(lines[i + 1]);
    if (!isTable) {
      i += 1;
      continue;
    }

    let endLine = i + 1;
    while (
      endLine + 1 < lines.length &&
      TABLE_ROW_RE.test(lines[endLine + 1])
    ) {
      endLine += 1;
    }

    const rows: string[][] = [];
    for (let r = i + 2; r <= endLine; r += 1) rows.push(splitCells(lines[r]));

    const cells: CellSpan[] = cellSpans(lines[i], offsets[i], -1, activity);
    for (let r = i + 2; r <= endLine; r += 1) {
      cells.push(...cellSpans(lines[r], offsets[r], r - i - 2, activity));
    }

    tables.push({
      index: tables.length,
      from: offsets[i],
      to: offsets[endLine] + lines[endLine].length,
      header: splitCells(lines[i]),
      rows,
      cells,
    });
    i = endLine + 1;
  }
  return tables;
}

/**
 * 重新解析文档并按序号定位某表格的某个单元格。
 *
 * flush **不能**复用 widget 构建时的偏移：同一批次里更早的写回已经移动了
 * 其后所有位置。查找因此走**当前**文档文本。
 */
export function tableCellRange(
  docText: string,
  tableIndex: number,
  row: number,
  col: number,
): { from: number; to: number } | null {
  const table = findTables(docText)[tableIndex];
  if (!table) return null;
  const cell = table.cells.find((c) => c.row === row && c.col === col);
  return cell ? { from: cell.from, to: cell.to } : null;
}

/**
 * 把 `total` px 拆成 `count` 列，宽度最多相差 1px，余数一次一像素地发完。
 * 纯函数——不碰 DOM——所以可单测，也能在 widget 还没测量时顶替布局。
 */
export function evenColumnWidths(count: number, total: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from(
    { length: count },
    (_, i) => base + (i < remainder ? 1 : 0),
  );
}

function buildTableMarkdown(header: string[], rows: string[][]): string {
  const headerLine = `| ${header.join(" | ")} |`;
  const sepLine = `| ${header.map(() => "---").join(" | ")} |`;
  const bodyLines = rows.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, sepLine, ...bodyLines].join("\n");
}

export { renderCellText, sanitizeCellText } from "./cell-text";

/** 把 `mdb-bg-*` span 类映射到 `<td>` 背景类。 */
function cellBackgroundClass(colorClass: string): string {
  return colorClass.replace("mdb-bg-", "cm-table-cell-bg-");
}

/**
 * 表格单元格选区的进行中指针拖拽。
 *
 * 指针一到达另一个单元格 `moved` 就翻真，这正是区分拖拽（保留范围、不开
 * 编辑器）与普通点击（松手时打开编辑器）的依据。
 */
interface CellDragState {
  readonly tableIndex: number;
  readonly anchorRow: number;
  readonly anchorCol: number;
  moved: boolean;
}

const activeCellDrags = new Map<EditorView, CellDragState>();

/**
 * 暂存的单元格文本，按视图再按 `tableIndex:row:col` 存。
 *
 * 存在视图上而不是 widget 里，因为 CM6 在更新时重建 widget DOM——以及 widget
 * 实例；能跨重建存活的暂存不能。
 */
interface PendingCell {
  tableIndex: number;
  row: number;
  col: number;
  text: string;
}

const dirtyCells = new WeakMap<EditorView, Map<string, PendingCell>>();

const externalFlushWired = new WeakSet<EditorView>();

/**
 * 某视图当前渲染的 widget 实例。指针动作是**委托**的（见
 * `installTablePointer`），因为 widget——及其内部每个节点——在 CM6 的 mousedown
 * 处理期间被重建，这会让绑在单个元素上的监听器所依附的节点被分离（#492）。
 */
const liveTableWidgets = new WeakMap<EditorView, TableWidget>();

const tablePointerWired = new WeakSet<EditorView>();

/** 已排队 flush 的视图——避免落定点堆叠定时器。 */
const flushScheduled = new WeakSet<EditorView>();

/** 派发中的视图——让更新期间的重入 flush 成为无操作。 */
const flushingViews = new WeakSet<EditorView>();

/**
 * 把 flush 排到下一个宏任务。
 *
 * CM6 正在 update 时派发是非法的——会抛「Calls to EditorView.update are not
 * allowed while an update is in progress」——而 widget/plugin 的拆除钩子正好在
 * 那里运行。延后让暂存文本在下一个 tick 发出，而不是被 catch 吞掉。
 */
export function scheduleTableFlush(view: EditorView): void {
  if (flushScheduled.has(view)) return;
  flushScheduled.add(view);
  setTimeout(() => {
    flushScheduled.delete(view);
    flushDirtyTables(view);
  }, 0);
}

/**
 * 用一个事务把每个暂存单元格写回文档。
 *
 * 有事务派发时返回 true。可从任何落定点安全调用（没有脏数据时也无操作），
 * 这正是让多个监听器竞争而不重复写入的原因。
 */
export function flushDirtyTables(view: EditorView): boolean {
  const pending = dirtyCells.get(view);
  if (!pending || pending.size === 0 || flushingViews.has(view)) return false;

  const docText = view.state.doc.toString();
  const changes: { from: number; to: number; insert: string }[] = [];
  for (const cell of pending.values()) {
    const range = tableCellRange(docText, cell.tableIndex, cell.row, cell.col);
    if (!range) continue;
    const insert = sanitizeCellText(cell.text);
    if (insert === docText.slice(range.from, range.to)) continue;
    changes.push({ from: range.from, to: range.to, insert });
  }

  if (changes.length === 0) {
    pending.clear();
    return false;
  }

  // CM6 要求升序、不重叠的变更。单元格永不重叠，所以按起点排序就够。
  changes.sort((a, b) => a.from - b.from);
  flushingViews.add(view);
  try {
    view.dispatch({ changes });
  } catch {
    // 只在更新周期内可达：保留暂存文本，等 CM6 空闲后由延后的 flush 重试。
    scheduleTableFlush(view);
    return false;
  } finally {
    flushingViews.delete(view);
  }
  pending.clear();
  return true;
}

function markDirty(
  view: EditorView,
  tableIndex: number,
  row: number,
  col: number,
  text: string,
): void {
  let pending = dirtyCells.get(view);
  if (!pending) {
    pending = new Map<string, PendingCell>();
    dirtyCells.set(view, pending);
  }
  pending.set(`${tableIndex}:${row}:${col}`, { tableIndex, row, col, text });
}

function clearDirty(
  view: EditorView,
  tableIndex: number,
  row: number,
  col: number,
): void {
  dirtyCells.get(view)?.delete(`${tableIndex}:${row}:${col}`);
}

// --- 单元格级写回（合并 / 背景）---------------------------------------------

/** 从解析出的块读取某单元格的原始源码文本（`row === -1` 为表头）。 */
function readCell(block: TableBlock, row: number, col: number): string {
  if (row === -1) return block.header[col] ?? "";
  return block.rows[row]?.[col] ?? "";
}

/**
 * 按存储的选区切换每个活动单元格的 `.cm-table-cell-selected`。在原始拖拽事件
 * 后调用（没有 CM6 事务），让范围立刻高亮；`buildCell`/`updateDOM` 在重建后
 * 重新应用它。
 */
export function paintCellSelection(view: EditorView): void {
  const selection = getCellSelection(view);
  const tables = view.dom.querySelectorAll<HTMLTableElement>("table.cm-table");
  tables.forEach((table, tableIndex) => {
    const cells = table.querySelectorAll<HTMLElement>(
      "th[data-row], td[data-row]",
    );
    cells.forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const selected =
        selection !== null &&
        selection.tableIndex === tableIndex &&
        isCellInSelection(selection, row, col);
      cell.classList.toggle("cm-table-cell-selected", selected);
    });
  });
}

/**
 * 视图选区变化时重绘选区类的 ViewPlugin。与工具条分开，这样即使工具条没挂载
 * 高亮也能工作。
 */
export function tableCellSelectionPainter(): Extension {
  return ViewPlugin.fromClass(
    class {
      private readonly unsubscribe: () => void;

      constructor(private readonly view: EditorView) {
        this.unsubscribe = subscribeCellSelection(view, () =>
          paintCellSelection(view),
        );
      }

      destroy(): void {
        this.unsubscribe();
        activeCellDrags.delete(this.view);
      }
    },
  );
}

/** 该表格的列数（用于 Tab 右移时判断是否换行）。 */
function widgetColumns(view: EditorView, tableIndex: number): number {
  const table = view.dom.querySelectorAll(".cm-table")[tableIndex];
  const firstRow = table?.querySelector("tr");
  return firstRow ? firstRow.querySelectorAll("th, td").length : 0;
}

/**
 * 打开某单元格的行内 `<input>` 编辑器。
 *
 * 模块作用域（不是 widget 闭包），因为点击是在**文档** mouseup 上解析的：
 * widget 可能在 mousedown 捕获期间已重建，所以活动单元格按行/列查找，而不是
 * 通过捕获的 DOM 节点。
 *
 * 编辑器是真正的 `<input>`，不是嵌套 `contenteditable`：表单控件永远不是 CM6
 * 可编辑区的一部分，不产生其观察者会响应的 DOM 变更，并且有原生焦点、光标、
 * IME 和撤销。
 */
function openCellEditor(
  view: EditorView,
  tableIndex: number,
  row: number,
  col: number,
): void {
  flushDirtyTables(view);
  const table = view.dom.querySelectorAll(".cm-table")[tableIndex];
  const host = table?.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (!(host instanceof HTMLElement)) return;
  const existing = host.querySelector(
    ".cm-table-cell-input",
  ) as HTMLInputElement | null;
  if (existing) {
    existing.focus();
    return;
  }
  // 编辑时保留单元格背景：input 显示内部文本，暂存文本用同一个 span 重新包裹，
  // 颜色不会丢。
  const backgroundClass = host.dataset.cellBg ?? null;
  const span = host.querySelector<HTMLElement>(".cm-table-cell-text");
  const initial = span?.dataset.rawText ?? span?.textContent ?? "";
  const input = document.createElement("input");
  input.type = "text";
  // 文本输入的固有宽度来自 `size`（默认 20ch）；在表格 auto 布局里这会变成
  // 该列的 min-content，编辑器一打开列就变宽（#438）。一个字符让它失效——
  // CSS width:100% 随后填满单元格。
  input.size = 1;
  input.className = "cm-table-cell-input";
  input.setAttribute("data-testid", "cm-table-cell-input");
  input.value = initial;
  host.classList.add("cm-table-cell-editing");
  host.insertBefore(input, host.querySelector(".cm-table-cell-handle"));
  input.focus();
  input.setSelectionRange(initial.length, initial.length);

  let composing = false;
  const stage = (): void => {
    const text = backgroundClass
      ? `<span class="${backgroundClass}">${input.value}</span>`
      : input.value;
    markDirty(view, tableIndex, row, col, text);
  };
  const teardown = (): void => {
    input.remove();
    host.classList.remove("cm-table-cell-editing");
  };
  const commit = (): void => {
    // CM6 在指针捕获期间重建 widget，所以 blur 落地时 input 可能已被分离。
    // 暂存文本存在按 table/row/col 的脏 map 里，所以 flush 不能依赖 input
    // 仍在 DOM 中——在这里退出会让编辑一直保持未 flush，直到某个无关的 flush
    // 运行（#433）。
    if (input.isConnected) teardown();
    flushDirtyTables(view);
    clearDirty(view, tableIndex, row, col);
    // 让我们失焦的那次按压在 pointerdown 时 flush，而 input 仍挂着——
    // updateDOM 故意跳过正在编辑的单元格，等 teardown 运行时已没有后续事务
    // 刷新它。在这里把可见单元格与文档同步，显示与源码永不可能不一致（#433）。
    syncCellDom(view, tableIndex, row, col);
  };

  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    stage();
  });
  input.addEventListener("input", () => {
    stage();
    // 行内插入入口：在末尾打 `/` 就打开锚定插入菜单（与块里输 `/` 一致）。
    // 先把 `/` 从输入框里去掉，菜单插入的内容才不会顶着它。
    if (composing) return;
    if (!input.value.endsWith("/")) return;
    input.value = input.value.slice(0, -1);
    stage();
    const widget = liveTableWidgets.get(view);
    if (!widget) return;
    // 不先 commit：openCellMenu 自己会 flush 暂存文本，提前 teardown 会让
    // 输入框在菜单取锚点前消失。
    widget.openCellMenuFor(view, row, col);
  });
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      commit();
      // 右移一格：单元格是网格，Tab 的语义就是「下一个」。越过最后一列时
      // 落到下一行首列；没下一行就停在原地。
      const columns = widgetColumns(view, tableIndex);
      const nextRow = col + 1 >= columns ? row + 1 : row;
      const nextCol = col + 1 >= columns ? 0 : col + 1;
      const exists = view.dom.querySelector(
        `.cm-table td[data-row="${nextRow}"][data-col="${nextCol}"], .cm-table th[data-row="${nextRow}"][data-col="${nextCol}"]`,
      );
      if (exists) openCellEditor(view, tableIndex, nextRow, nextCol);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      clearDirty(view, tableIndex, row, col);
      teardown();
    }
  });
  input.addEventListener("blur", () => {
    if (!composing) commit();
  });
  input.addEventListener("mousedown", (event) => event.stopPropagation());
}

/**
 * 让某单元格的渲染 DOM 重新与文档一致。
 *
 * `updateDOM` 跳过仍挂着 `<input>` 的单元格（它的文本在 input 里直到编辑落定）。
 * 当结束编辑的指针按压先 flush 暂存文本时，由此产生的事务对该单元格被跳过，
 * 之后也没有别的事务——源码前进了，而卡片仍显示编辑前的值（#433）。这里重新
 * 从文档读取该单元格并只重绘那个 span。
 */
function syncCellDom(
  view: EditorView,
  tableIndex: number,
  row: number,
  col: number,
): void {
  const table = view.dom.querySelectorAll(".cm-table")[tableIndex];
  const host = table?.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  const body = host?.querySelector<HTMLElement>(".cm-table-cell-text");
  if (!(body instanceof HTMLElement)) return;
  const range = tableCellRange(view.state.doc.toString(), tableIndex, row, col);
  if (!range) return;
  const raw = view.state.doc.sliceString(range.from, range.to);
  const background = parseCellBackground(raw);
  const displayText = background ? background.inner : raw;
  if ((body.dataset.rawText ?? "") === displayText) return;
  body.dataset.rawText = displayText;
  body.innerHTML = renderCellText(displayText);
}

/**
 * 指针释放时落定每个进行中的单元格拖拽。
 *
 * 从未到达另一个单元格的拖拽是普通点击：编辑器在下一帧打开，等 widget 落定。
 * 确实移动过的拖拽保留选区，什么都不打开。
 */
if (typeof document !== "undefined") {
  document.addEventListener("mouseup", () => {
    for (const [view, drag] of [...activeCellDrags]) {
      activeCellDrags.delete(view);
      if (drag.moved) continue;
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() =>
          openCellEditor(view, drag.tableIndex, drag.anchorRow, drag.anchorCol),
        );
      } else {
        openCellEditor(view, drag.tableIndex, drag.anchorRow, drag.anchorCol);
      }
    }
  });
}

// --- Widget ------------------------------------------------------------------

/**
 * 一次捕获阶段的 `mousedown` 处理编辑器根上的每个表格指针入口：单元格把手、
 * 边界气泡的插入/删除按钮。
 *
 * `composedPath()` 是事件派发时取的快照，所以即使 CM6 在同一次按压中重建
 * （并分离）了 widget，target 仍然可读（#492）。
 */
function installTablePointer(view: EditorView): void {
  if (tablePointerWired.has(view)) return;
  tablePointerWired.add(view);

  view.dom.addEventListener(
    "mousedown",
    (event) => {
      const widget = liveTableWidgets.get(view);
      if (!widget) return;
      const path = event.composedPath();
      const pick = (selector: string): HTMLElement | undefined =>
        path.find(
          (node): node is HTMLElement =>
            node instanceof HTMLElement && node.matches?.(selector) === true,
        );

      const cellHandle = pick(".cm-table-cell-handle");
      const boundaryButton = pick(
        ".cm-table-boundary-delete, .cm-table-boundary-insert",
      );
      if (!cellHandle && !boundaryButton) return;

      event.preventDefault();
      event.stopPropagation();

      if (boundaryButton) {
        const boundary = pick(".cm-table-boundary");
        const kind = boundary?.dataset.type === "col" ? "col" : "row";
        const index = Number(
          (kind === "col" ? boundary?.dataset.col : boundary?.dataset.row) ??
            "-1",
        );
        if (!Number.isFinite(index) || index < 0) return;
        const isDelete = boundaryButton.classList.contains(
          "cm-table-boundary-delete",
        );
        if (kind === "col") {
          if (isDelete) widget.deleteColumnFor(view, index);
          else widget.addColumnFor(view, index);
        } else {
          if (isDelete) widget.deleteRowFor(view, index);
          else widget.addRowFor(view, index);
        }
        return;
      }

      const cell = pick("td[data-row], th[data-row]");
      const row = Number(cell?.dataset.row ?? "-1");
      const col = Number(cell?.dataset.col ?? "-1");
      if (cellHandle) widget.openCellMenuFor(view, row, col);
    },
    true,
  );
}

class TableWidget extends WidgetType {
  header: string[];
  rows: string[][];
  cells: CellSpan[];
  from: number;
  to: number;
  readonly tableIndex: number;
  private view: EditorView | null = null;

  constructor(block: TableBlock) {
    super();
    this.header = block.header;
    this.rows = block.rows;
    this.cells = block.cells;
    this.from = block.from;
    this.to = block.to;
    this.tableIndex = block.index;
  }

  /** 从**当前**文档重读表格——flush 后偏移会移动。 */
  private currentBlock(view: EditorView): TableBlock | null {
    return findTables(view.state.doc.toString())[this.tableIndex] ?? null;
  }

  private cellText(row: number, col: number): string {
    if (row === -1) return this.header[col] ?? "";
    return this.rows[row]?.[col] ?? "";
  }

  private rewrite(
    view: EditorView,
    block: TableBlock,
    header: string[],
    rows: string[][],
  ): void {
    view.dispatch({
      changes: {
        from: block.from,
        to: block.to,
        insert: buildTableMarkdown(header, rows),
      },
    });
  }

  private addColumn(view: EditorView, at: number): void {
    flushDirtyTables(view);
    const block = this.currentBlock(view);
    if (!block) return;
    const header = [...block.header];
    header.splice(at, 0, "");
    const rows = block.rows.map((row) => {
      const next = [...row];
      next.splice(at, 0, "");
      return next;
    });
    this.rewrite(view, block, header, rows);
    view.focus();
  }

  private addRow(view: EditorView, at: number): void {
    flushDirtyTables(view);
    const block = this.currentBlock(view);
    if (!block) return;
    const rows = block.rows.map((row) => [...row]);
    rows.splice(at, 0, new Array(block.header.length).fill(""));
    this.rewrite(view, block, [...block.header], rows);
    view.focus();
  }

  /**
   * 删除一个正文行（#469）。最后一行被替换成空行，让 markdown 表格保持结构
   * 合法。
   */
  private deleteRow(view: EditorView, at: number): void {
    flushDirtyTables(view);
    const block = this.currentBlock(view);
    if (!block || block.rows.length === 0) return;
    const rows = block.rows.map((row) => [...row]);
    if (at < 0 || at >= rows.length) return;
    rows.splice(at, 1);
    if (rows.length === 0) rows.push(new Array(block.header.length).fill(""));
    this.rewrite(view, block, [...block.header], rows);
    view.focus();
  }

  /**
   * 删除一列（#469）。拒绝删除最后一列：GFM 表格至少要有一列，静默产出
   * `| |` 行会毁掉这个块。
   */
  private deleteColumn(view: EditorView, at: number): void {
    flushDirtyTables(view);
    const block = this.currentBlock(view);
    if (!block || block.header.length <= 1) return;
    if (at < 0 || at >= block.header.length) return;
    const header = [...block.header];
    header.splice(at, 1);
    const rows = block.rows.map((row) => {
      const next = [...row];
      next.splice(at, 1);
      return next;
    });
    this.rewrite(view, block, header, rows);
    view.focus();
  }

  /** 在单元格上打开锚定的 INSERT 菜单，锚到该单元格的范围。 */
  /**
   * 委托指针处理器的入口（#492）。
   *
   * 单元格把手打开与锚点圆点和 `/` **同一个**插入菜单——一套菜单词汇、一条
   * 定位路径——而不是把已填充的单元格路由到块菜单，后者的位置由 gutter 把手
   * 拥有，且在 widget 按压中重建时没有稳定锚点。
   */
  openCellMenuFor(view: EditorView, row: number, col: number): void {
    if (row < 0 || col < 0) return;
    this.openCellMenu(view, row, col);
    // 委托的按压取消了默认焦点变化，所以把焦点还给编辑器——否则 Escape
    // 无法收起面板（#492）。
    view.focus();
  }

  deleteRowFor(view: EditorView, index: number): void {
    this.deleteRow(view, index);
  }

  deleteColumnFor(view: EditorView, index: number): void {
    this.deleteColumn(view, index);
  }

  addRowFor(view: EditorView, index: number): void {
    this.addRow(view, index);
  }

  addColumnFor(view: EditorView, index: number): void {
    this.addColumn(view, index);
  }

  private openCellMenu(view: EditorView, row: number, col: number): void {
    flushDirtyTables(view);
    const block = this.currentBlock(view);
    const cell = block?.cells.find((c) => c.row === row && c.col === col);
    if (!cell) return;
    // 零宽锚点：菜单在单元格起点插入，锚范围是单元格正文，所以关闭菜单绝不会
    // 吃掉单元格文本。GFM 单元格只有一行：块级命令（任务列表、高亮块、分割线、
    // 嵌套表格、分栏、围栏代码）会被净化成单行并静默无操作，读起来像「勾了
    // 菜单项，什么也没发生」（#470）。
    // 锚到单元格里实际画出的把手，让面板总开在它旁边，而不是 `coordsAtPos`
    // 恰好落下的位置（#492）。表头不渲染手柄（#739），这里只查 td。
    const handleRect = view.dom
      .querySelector<HTMLElement>(
        `td[data-row="${row}"][data-col="${col}"] .cm-table-cell-handle`,
      )
      ?.getBoundingClientRect();
    const anchorRect =
      handleRect && handleRect.width > 0
        ? {
            left: handleRect.left,
            right: handleRect.right,
            top: handleRect.top,
            bottom: handleRect.bottom,
          }
        : undefined;
    openInsertMenu(
      view,
      cell.from,
      defaultCommands,
      { from: cell.from, to: cell.to },
      "anchor",
      anchorRect,
    );
  }

  toDOM(view?: EditorView): HTMLElement {
    this.view = view ?? null;
    const wrap = document.createElement("div");
    wrap.className = "cm-table-wrap";
    // 把表格拿出 CM6 的可编辑区：没有这个，浏览器会在点击单元格间隙时把原生
    // 光标放进外层 contenteditable，按键会落进 CM6 丢弃的 DOM。
    wrap.setAttribute("contenteditable", "false");

    const table = document.createElement("table");
    table.className = "cm-table";
    table.setAttribute("data-testid", "cm-table");

    // ── 表头行 ────────────────────────────────────────────────────────────
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    this.header.forEach((text, col) => {
      headRow.appendChild(this.buildCell(view ?? null, "th", -1, col, text));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // ── 正文行 ─────────────────────────────────────────────────────────────
    const tbody = document.createElement("tbody");
    this.rows.forEach((row, r) => {
      const tr = document.createElement("tr");
      row.forEach((text, col) => {
        tr.appendChild(this.buildCell(view ?? null, "td", r, col, text));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrap.appendChild(table);

    const boundaries = document.createElement("div");
    boundaries.className = "cm-table-boundaries";
    wrap.appendChild(boundaries);

    if (view) {
      liveTableWidgets.set(view, this);
      installTablePointer(view);
      this.wireExternalFlush(view);
      // 显示是逐边界的：离指针最近的热点出现，其余保持隐藏，离开 widget 清空
      // （#385a）。
      this.wireBoundaryReveal(wrap, boundaries);
      // 布局在 toDOM 里同步不可用，所以下一帧测量。node 环境单测可能没有 rAF。
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() =>
          this.renderBoundaries(boundaries, wrap, table, view),
        );
      } else {
        this.renderBoundaries(boundaries, wrap, table, view);
      }
    }

    return wrap;
  }

  /** 构建一个 `th`/`td`，带文本 span 与插入把手。 */
  private buildCell(
    view: EditorView | null,
    tag: "th" | "td",
    row: number,
    col: number,
    text: string,
  ): HTMLElement {
    const el = document.createElement(tag);
    el.dataset.row = String(row);
    el.dataset.col = String(col);
    if (this.cells.some((c) => c.active && c.row === row && c.col === col)) {
      el.classList.add("cm-table-cell-active");
    }

    // 整个文本是 `mdb-bg-*` span 的单元格把单元格本身上色，只显示内部文本——
    // span 标记永远不进 DOM。
    const background = parseCellBackground(text);
    if (background) {
      el.dataset.cellBg = background.colorClass;
      el.classList.add(cellBackgroundClass(background.colorClass));
    }

    const body = document.createElement("span");
    body.className = "cm-table-cell-text";
    body.setAttribute("data-testid", "cm-table-cell-text");
    body.dataset.row = String(row);
    body.dataset.col = String(col);
    const displayText = background ? background.inner : text;
    body.dataset.rawText = displayText;
    body.innerHTML = renderCellText(displayText);
    el.appendChild(body);

    const selection = view ? getCellSelection(view) : null;
    if (
      selection &&
      selection.tableIndex === this.tableIndex &&
      isCellInSelection(selection, row, col)
    ) {
      el.classList.add("cm-table-cell-selected");
    }

    // 表头单元格不渲染手柄（#739）：手柄是内容菜单入口，表头没有可转换的内容块。
    let handle: HTMLElement | null = null;
    if (row >= 0) {
      handle = document.createElement("div");
      // `.cm-table-cell-handle` 是接线/外部点击守卫（`slash.ts`）；`.mdb-table-cell-handle`
      // 是公开一致性锚点（R-TABLE-04）。两者指同一个节点。
      handle.className = "cm-table-cell-handle";
      handle.classList.add("mdb-table-cell-handle");
      handle.setAttribute("data-testid", "cm-table-cell-handle");
      handle.dataset.row = String(row);
      handle.dataset.col = String(col);
      applyCellHandleState(handle, text);
      el.appendChild(handle);
    }

    if (view) this.wireCell(view, el, handle, row, col);
    return el;
  }

  /**
   * 让活动的 `<table>` 形状匹配当前 header/rows，而不重建已存在的单元格
   * （#385c）。插入路径过去在维度变化时返回假 `eq`，于是 CM6 把整个 widget
   * 扔掉重建——每个单元格、每个把手监听器，外加一遍全新的边界遍历——只为
   * 一行/一列的差异。新单元格被构建并接线；多余单元格被丢弃；存活的单元格
   * 保留监听器并由 `updateDOM` 刷新。
   */
  private reconcileStructure(table: HTMLTableElement, view: EditorView): void {
    const headRow = table.tHead?.rows[0];
    if (headRow) {
      while (headRow.cells.length > this.header.length) headRow.deleteCell(-1);
      for (let col = 0; col < this.header.length; col += 1) {
        if (!headRow.cells[col]) {
          headRow.appendChild(
            this.buildCell(view, "th", -1, col, this.header[col] ?? ""),
          );
        }
      }
    }

    const tbody = table.tBodies[0];
    if (tbody) {
      while (tbody.rows.length > this.rows.length) tbody.deleteRow(-1);
      for (let r = 0; r < this.rows.length; r += 1) {
        let tr = tbody.rows[r];
        if (!tr) tr = tbody.insertRow(-1);
        while (tr.cells.length > this.header.length) tr.deleteCell(-1);
        for (let col = 0; col < this.header.length; col += 1) {
          if (!tr.cells[col]) {
            tr.appendChild(
              this.buildCell(view, "td", r, col, this.rows[r]?.[col] ?? ""),
            );
          }
        }
      }
    }
  }

  /**
   * 接线一个单元格：指针选区（点击 = 编辑，拖拽/shift = 范围）加插入把手。
   *
   * 编辑器本身由 `openCellEditor` 在文档 mouseup 上构建；这里只跟踪选区矩形，
   * 因为拖拽不能打开编辑器。选区存在视图级状态（`cell-selection.ts`），所以
   * 它能跨 mousedown 捕获期间发生的 widget 重建存活。
   */
  private wireCell(
    view: EditorView,
    cellEl: HTMLElement,
    handle: HTMLElement | null,
    row: number,
    col: number,
  ): void {
    const tableIndex = this.tableIndex;

    cellEl.addEventListener("mousedown", (event) => {
      if (
        (event.target as HTMLElement | null)?.closest(".cm-table-cell-handle")
      )
        return;
      event.preventDefault();
      event.stopPropagation();

      // 立刻提交任何仍开在另一个单元格上的编辑器。本次按压的编辑器在 mouseup
      // 打开（这样拖拽可以改为选择），在那之前旧 input 会保持焦点并吞掉第一个
      // 按键。
      view.dom.querySelector<HTMLInputElement>(".cm-table-cell-input")?.blur();

      const existing = getCellSelection(view);
      if (event.shiftKey && existing && existing.tableIndex === tableIndex) {
        // Shift-click 把当前 anchor 延伸到这个单元格；不开编辑器。
        setCellSelection(view, {
          ...existing,
          headRow: row,
          headCol: col,
          explicit: true,
        });
        return;
      }

      // 记录 anchor。`moved` 在指针第一次移到另一个单元格时翻真，这正是松手时
      // 区分拖拽（保留范围）与点击（打开编辑器）的依据。
      activeCellDrags.set(view, {
        tableIndex,
        anchorRow: row,
        anchorCol: col,
        moved: false,
      });
      const selection: CellSelection = {
        tableIndex,
        anchorRow: row,
        anchorCol: col,
        headRow: row,
        headCol: col,
      };
      setCellSelection(view, selection);
    });

    cellEl.addEventListener("mouseenter", () => {
      const drag = activeCellDrags.get(view);
      if (!drag || drag.tableIndex !== tableIndex) return;
      if (row === drag.anchorRow && col === drag.anchorCol) return;
      drag.moved = true;
      setCellSelection(view, {
        tableIndex,
        anchorRow: drag.anchorRow,
        anchorCol: drag.anchorCol,
        headRow: row,
        headCol: col,
        explicit: true,
      });
    });

    // 把手：按压打开，悬停只标记入口。仅进入就打开会在指针只是擦过把手时触发
    // 插入菜单（#385b）——最后一列最糟，它的把手贴在 wrap 边缘。
    if (handle) {
      handle.addEventListener("mouseenter", () => {
        handle.classList.add("cm-table-cell-handle-active");
      });
      handle.addEventListener("mouseleave", () => {
        handle.classList.remove("cm-table-cell-handle-active");
      });
    }
    // 按压本身由 `installTablePointer` 里的委托监听器处理（#492）——这里的逐节点
    // 监听器在它可能触发时已经失效，因为 CM6 在 mousedown 期间重建了这个 widget。
  }

  /**
   * 指针按压落在所有单元格之外时落定暂存单元格。捕获阶段，这样即使单元格自己
   * 的监听器阻止了传播它仍会触发。
   */
  private wireExternalFlush(view: EditorView): void {
    if (externalFlushWired.has(view)) return;
    externalFlushWired.add(view);
    view.dom.addEventListener(
      "mousedown",
      (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest?.(".cm-table-wrap")) return;
        if (target?.closest?.(".mdb-slash-menu")) return;
        // 单元格工具条在 wrap 外；在它上面的按压必须保住单元格选区，供它即将
        // 执行的动作使用。
        flushDirtyTables(view);
        clearCellSelection(view);
      },
      true,
    );
  }

  /**
   * 只显示指针靠近的那条边界的插入热点（#385a）。过去的 gate 一进入单元格就
   * 点亮每个热点；期望的行为是只有悬停的行/列线。
   *
   * 列边界的 x 与行边界的 y 已经作为内联偏移在元素上，所以 mousemove 只需一次
   * 容器 rect 读取，而不是每个边界一次布局读取。工作合并进一帧。
   */
  private wireBoundaryReveal(wrap: HTMLElement, boundaries: HTMLElement): void {
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const clear = (): void => {
      for (const hotspot of boundaries.querySelectorAll(
        ".cm-table-hotspot-revealed",
      )) {
        hotspot.classList.remove("cm-table-hotspot-revealed");
      }
    };

    const update = (): void => {
      frame = 0;
      const rect = boundaries.getBoundingClientRect();
      const x = pointerX - rect.left;
      const y = pointerY - rect.top;
      const half = BOUNDARY_THICKNESS / 2;
      let nearCol: HTMLElement | null = null;
      let nearRow: HTMLElement | null = null;
      let colDist = BOUNDARY_REVEAL_DISTANCE;
      let rowDist = BOUNDARY_REVEAL_DISTANCE;

      for (const boundary of boundaries.querySelectorAll<HTMLElement>(
        ".cm-table-boundary",
      )) {
        const hotspot =
          boundary.querySelector<HTMLElement>(".cm-table-hotspot");
        if (!hotspot) continue;
        if (boundary.dataset.type === "col") {
          const dist = Math.abs(x - (parseFloat(boundary.style.left) + half));
          if (dist <= colDist) {
            colDist = dist;
            nearCol = hotspot;
          }
        } else {
          const dist = Math.abs(y - (parseFloat(boundary.style.top) + half));
          if (dist <= rowDist) {
            rowDist = dist;
            nearRow = hotspot;
          }
        }
      }

      // 一个已显示的热点拥有一个**坐在边界线之外**的气泡；当指针在该气泡上时
      // 热点必须保持显示，否则气泡会在它能被点击前消失（#483）。一旦指针离开
      // 气泡（例如移到另一条边界），就释放它，让「只显示最近边界」的契约仍然
      // 成立（#385a）。
      const activeHotspot = boundaries.querySelector<HTMLElement>(
        ".cm-table-hotspot-active",
      );
      let activeKeepsReveal = false;
      if (activeHotspot) {
        const bubble = activeHotspot.querySelector<HTMLElement>(
          ".cm-table-hotspot-bubble",
        );
        const br = bubble?.getBoundingClientRect();
        activeKeepsReveal =
          !!br &&
          pointerX >= br.left &&
          pointerX <= br.right &&
          pointerY >= br.top &&
          pointerY <= br.bottom;
        if (
          !activeKeepsReveal &&
          activeHotspot !== nearCol &&
          activeHotspot !== nearRow
        ) {
          activeHotspot.classList.remove("cm-table-hotspot-active");
        }
      }
      for (const hotspot of boundaries.querySelectorAll<HTMLElement>(
        ".cm-table-hotspot",
      )) {
        hotspot.classList.toggle(
          "cm-table-hotspot-revealed",
          hotspot === nearCol ||
            hotspot === nearRow ||
            (hotspot === activeHotspot && activeKeepsReveal),
        );
      }
    };

    wrap.addEventListener("mousemove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (frame) return;
      if (typeof requestAnimationFrame === "function")
        frame = requestAnimationFrame(update);
      else update();
    });
    wrap.addEventListener("mouseleave", () => {
      if (frame && typeof cancelAnimationFrame === "function")
        cancelAnimationFrame(frame);
      frame = 0;
      clear();
    });
  }

  /**
   * 在测量后的表格上构建插入边界层。
   *
   * 一个 `.cm-table-boundary` 条带精确坐在每条边界上：每条内部列边界一条竖条，
   * 每个正文行顶边一条横条（F-03 几何）。条带本身 `pointer-events: none`，
   * 所以 6px 层永远不会吞掉一次指向单元格内部的点击；只有里面的小热点圆点
   * 接收指针，且只在指针靠近该边界时（F-04 / R-TABLE-03，#385a 起逐边界）。
   * 每个热点在自己的序号前插入：`data-col` → addColumn(index)，`data-row` →
   * addRow(index)。
   *
   * 表格还没布局时回退到 `evenColumnWidths`，这样 jsdom 里这层仍带正确的序号
   * 几何。
   */
  private renderBoundaries(
    container: HTMLElement,
    wrap: HTMLElement,
    table: HTMLTableElement,
    view: EditorView,
  ): void {
    if (!container.isConnected && wrap.isConnected) return;
    container.textContent = "";

    const wrapRect = wrap.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const measured = tableRect.width > 0 && tableRect.height > 0;
    const originX = measured ? tableRect.left - wrapRect.left : 0;
    const originY = measured ? tableRect.top - wrapRect.top : 0;
    const totalWidth = measured ? tableRect.width : FALLBACK_TABLE_WIDTH;
    const totalHeight = measured
      ? tableRect.height
      : FALLBACK_ROW_HEIGHT * (this.rows.length + 1);

    const addBoundary = (
      kind: "col" | "row",
      index: number,
      left: number,
      top: number,
      width: number,
      height: number,
      edge = false,
    ): void => {
      const boundary = document.createElement("div");
      boundary.className = `cm-table-boundary cm-table-boundary-${kind}`;
      boundary.setAttribute("data-testid", "cm-table-boundary");
      boundary.dataset.type = kind;
      if (kind === "col") boundary.dataset.col = String(index);
      else boundary.dataset.row = String(index);
      boundary.style.position = "absolute";
      boundary.style.left = `${left}px`;
      boundary.style.top = `${top}px`;
      boundary.style.width = `${width}px`;
      boundary.style.height = `${height}px`;
      boundary.style.pointerEvents = "none";
      boundary.style.zIndex = "5";

      // 沿边界的一条 2px 线，悬停时显示（这是「边界高亮线」——绝不是整行/列的
      // 背景填充）。
      const line = document.createElement("div");
      line.className = "cm-table-boundary-line";
      boundary.appendChild(line);

      const hotspot = document.createElement("div");
      hotspot.className = `cm-table-hotspot cm-table-hotspot-${kind}${edge ? " cm-table-hotspot-edge" : ""}`;
      hotspot.setAttribute("data-testid", "cm-table-hotspot");
      hotspot.dataset.type = kind;
      if (kind === "col") hotspot.dataset.col = String(index);
      else hotspot.dataset.row = String(index);
      hotspot.title = kind === "col" ? "插入列" : "插入行";

      const dot = document.createElement("span");
      dot.className = "cm-table-hotspot-dot";
      dot.textContent = "＋";
      hotspot.appendChild(dot);

      const bubble = document.createElement("span");
      bubble.className = "cm-table-hotspot-bubble";

      const insertBtn = document.createElement("button");
      insertBtn.type = "button";
      insertBtn.className = "cm-table-boundary-insert";
      insertBtn.setAttribute("data-testid", "cm-table-boundary-insert");
      insertBtn.textContent = kind === "col" ? "＋ 插入列" : "＋ 插入行";
      // 按压是委托的（installTablePointer）；按钮只为处理器从事件路径读取语义。
      bubble.appendChild(insertBtn);

      // #469：删除在同一气泡里。表格至少要有一列，所以单列情形不提供列变体。
      if (kind === "row" || this.header.length > 1) {
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "cm-table-boundary-delete";
        deleteBtn.setAttribute("data-testid", "cm-table-boundary-delete");
        deleteBtn.textContent = kind === "col" ? "－ 删除列" : "－ 删除行";

        bubble.appendChild(deleteBtn);
      }
      bubble.addEventListener("mouseenter", () => {
        insideBubble = true;
        activate();
      });
      bubble.addEventListener("mouseleave", () => {
        insideBubble = false;
        scheduleDeactivate();
      });
      hotspot.appendChild(bubble);

      // 气泡坐在热点盒之外，所以指针从圆点移到「＋/－」会离开热点，过去会在
      // 它能被点击前就收起气泡。两个区域现在共享一个 hover 引用计数，外加
      // 一段短暂的跨越宽限期（#482 后续）。
      let insideHotspot = false;
      let insideBubble = false;
      let hideTimer: number | null = null;
      const activate = (): void => {
        if (hideTimer !== null) {
          window.clearTimeout(hideTimer);
          hideTimer = null;
        }
        boundary.classList.add("cm-table-boundary-active");
        hotspot.classList.add("cm-table-hotspot-active");
        boundary.style.pointerEvents = "auto";
      };
      const scheduleDeactivate = (): void => {
        if (hideTimer !== null) window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => {
          hideTimer = null;
          if (insideHotspot || insideBubble) return;
          boundary.classList.remove("cm-table-boundary-active");
          hotspot.classList.remove("cm-table-hotspot-active");
          boundary.style.pointerEvents = "none";
        }, 140);
      };
      hotspot.addEventListener("mouseenter", () => {
        insideHotspot = true;
        activate();
      });
      hotspot.addEventListener("mouseleave", () => {
        insideHotspot = false;
        scheduleDeactivate();
      });
      hotspot.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (kind === "col") this.addColumn(view, index);
        else this.addRow(view, index);
      });
      boundary.appendChild(hotspot);
      container.appendChild(boundary);
    };

    const half = BOUNDARY_THICKNESS / 2;
    const fallbackWidths = evenColumnWidths(this.header.length, totalWidth);
    const head = table.rows[0];

    // 在创建任何节点前批量读完所有布局：交错两者会每个边界强制一次重排，
    // 让插入卡顿（#385c）。
    const colX: (number | null)[] = [];
    if (measured && head) {
      for (let col = 1; col < this.header.length; col += 1) {
        const cell = head.cells[col];
        colX.push(
          cell ? cell.getBoundingClientRect().left - tableRect.left : null,
        );
      }
    }
    const rowY: (number | null)[] = [];
    if (measured) {
      for (let r = 0; r < this.rows.length; r += 1) {
        const tr = table.rows[r + 1];
        rowY.push(tr ? tr.getBoundingClientRect().top - tableRect.top : null);
      }
    }

    // ── 列边界：仅内部（两列之间）──────────────────────────────────────────
    // 从 col 1 开始让热点留在表格内，所以它的圆点和气泡永不被 wrap 边缘裁剪
    //（§7.4「两列之间」）。
    for (let col = 1; col < this.header.length; col += 1) {
      const fallbackLeft = fallbackWidths
        .slice(0, col)
        .reduce((a, b) => a + b, 0);
      // 合并或未渲染的单元格没有 rect；把边界留在均分位置，而不是塌到前沿。
      const x = colX[col - 1] ?? fallbackLeft;
      addBoundary(
        "col",
        col,
        originX + x - half,
        originY,
        BOUNDARY_THICKNESS,
        totalHeight,
      );
    }

    // ── 行边界：每个正文行的顶边 ───────────────────────────────────────────
    for (let r = 0; r < this.rows.length; r += 1) {
      const y = rowY[r] ?? ((r + 1) / (this.rows.length + 1)) * totalHeight;
      addBoundary(
        "row",
        r,
        originX,
        originY + y - half,
        totalWidth,
        BOUNDARY_THICKNESS,
      );
    }

    // ── 尾部边界：在末尾追加（#432）────────────────────────────────────────
    // 上面的循环只覆盖内部位置，而两个 add* 助手都是**在**其序号前 splice——
    // 所以「在末尾加一行/一列」这个真实写作里最常见的表格动作没有入口。这两条
    // 带给出入口：index === length 会 splice 到末尾。它们坐在 BOUNDARY_EDGE_INSET
    // 以内，圆点不会被 wrap 裁剪。
    if (this.header.length > 0) {
      const trailingX = originX + totalWidth - BOUNDARY_EDGE_INSET - half;
      addBoundary(
        "col",
        this.header.length,
        trailingX,
        originY,
        BOUNDARY_THICKNESS,
        totalHeight,
        true,
      );
    }
    const trailingY = originY + totalHeight - BOUNDARY_EDGE_INSET - half;
    addBoundary(
      "row",
      this.rows.length,
      originX,
      trailingY,
      totalWidth,
      BOUNDARY_THICKNESS,
      true,
    );
  }

  /**
   * 采纳新状态，同时**保留**现有 DOM。
   *
   * 在 `eq` 里改 `this` 是 CM6 在保留我们 DOM 的同时把新状态交给我们的唯一
   * 地方。内容或维度变化返回 false 会走 `updateDOM`，它就地协调结构（#385c），
   * 而不是丢弃并重建每个单元格；只有不同的表格序号才强制重画，因为 DOM 是
   * 表格专属的。
   */
  eq(other: WidgetType): boolean {
    if (!(other instanceof TableWidget)) return false;
    if (this.tableIndex !== other.tableIndex) return false;
    if (this.header.length !== other.header.length) return false;
    if (this.rows.length !== other.rows.length) return false;
    if (JSON.stringify(this.header) !== JSON.stringify(other.header))
      return false;
    if (JSON.stringify(this.rows) !== JSON.stringify(other.rows)) return false;
    this.header = other.header;
    this.rows = other.rows;
    this.cells = other.cells;
    this.from = other.from;
    this.to = other.to;
    return true;
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    this.view = view;
    // 重建可能在这个单元格 input 的 blur 落地前替换掉这个 widget；暂存文本必须
    // 仍到达文档，所以每次更新都是落定点（#433）。
    scheduleTableFlush(view);
    const wrap = dom as HTMLElement;
    const table = wrap.querySelector<HTMLTableElement>("table.cm-table");
    const boundaries = wrap.querySelector<HTMLElement>(".cm-table-boundaries");
    if (!table || !boundaries) return false;

    // 在刷新文本前先把 DOM 增/缩到新维度：单元格按 data-row/data-col 寻址，
    // 所以复用的单元格不需要重建。
    this.reconcileStructure(table, view);

    const selection = getCellSelection(view);
    // 跳过正在编辑的单元格：它的文本在 input 里直到编辑落定，所以在这里从文档
    // 刷新会覆盖它。
    for (const cell of this.cells) {
      const body = wrap.querySelector<HTMLElement>(
        `.cm-table-cell-text[data-row="${cell.row}"][data-col="${cell.col}"]`,
      );
      if (!body) continue;
      const cellEl = body.parentElement;
      if (cellEl && !cellEl.querySelector(".cm-table-cell-input")) {
        const raw = this.cellText(cell.row, cell.col);
        const background = parseCellBackground(raw);
        const displayText = background ? background.inner : raw;
        const previousRaw = body.dataset.rawText ?? "";
        if (previousRaw !== displayText) {
          body.dataset.rawText = displayText;
          body.innerHTML = renderCellText(displayText);
        }
        // 手柄图标跟着内容走：空 <-> 有内容 两态都要立刻切（#108）。
        const cellHandle = cellEl?.querySelector<HTMLElement>(
          ".cm-table-cell-handle",
        );
        if (cellHandle) applyCellHandleState(cellHandle, displayText);
        if (background) {
          cellEl.dataset.cellBg = background.colorClass;
          cellEl.classList.add(cellBackgroundClass(background.colorClass));
        } else {
          delete cellEl.dataset.cellBg;
          for (const cls of [...cellEl.classList]) {
            if (cls.startsWith("cm-table-cell-bg-"))
              cellEl.classList.remove(cls);
          }
        }
      }
      if (cellEl) {
        cellEl.classList.toggle("cm-table-cell-active", cell.active);
        const selected =
          selection !== null &&
          selection.tableIndex === this.tableIndex &&
          isCellInSelection(selection, cell.row, cell.col);
        cellEl.classList.toggle("cm-table-cell-selected", selected);
      }
    }

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() =>
        this.renderBoundaries(boundaries, wrap, table, view),
      );
    } else {
      this.renderBoundaries(boundaries, wrap, table, view);
    }
    return true;
  }

  /**
   * widget 消失了（表格被删，或编辑器因模式切换被拆除）。丢掉它拥有的任何锚定
   * 菜单，而不是让孤儿面板浮在另一个视图上。
   */
  destroy(): void {
    if (!this.view) return;
    // widget 正在消失（表格被删，或视图拆除）。flush 任何暂存单元格，让编辑
    // 永不因重建而丢失（#433）。
    scheduleTableFlush(this.view);
    releaseInsertMenu(this.view, "anchor");
    // 拆除运行在 CM6 update 内，所以同步 flush 会抛并丢失暂存文本。改为延后
    // （没有暂存时是 no-op）。
    scheduleTableFlush(this.view);
  }

  /**
   * 让 CM6 自己的处理器进不了 widget DOM。这与默认一致，这里显式说明，让单元格
   * 依赖的隔离不是无声的。
   */
  ignoreEvent(): boolean {
    return true;
  }
}

// --- 装饰工厂 ----------------------------------------------------------------

export function createTableDecorations(
  docText: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const activity: CellActivity = {
    from: activeFrom,
    to: activeTo,
    active: activeFrom >= 0,
  };

  for (const table of findTables(docText, activity)) {
    decorations.push(
      Decoration.replace({ widget: new TableWidget(table) }).range(
        table.from,
        table.to,
      ),
    );
  }

  return decorations;
}
