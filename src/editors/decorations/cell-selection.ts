/**
 * 视图级表格单元格选区状态（#328 / change editor-fidelity 7.1）。
 *
 * 表格 widget 的 DOM 会被 CM6 在 mousedown 捕获阶段重建（见 `table.ts` 头部）。
 * 存在 widget 实例上的选区会在每次重建时丢失。因此它按 `EditorView` 存在
 * WeakMap 里——视图作用域，不是 widget 作用域——并在单元格 DOM（重）建时
 * 重新应用。
 *
 * 一个极小的按视图 pub/sub 让「对选区有反应的消费者」保持同步，而不派发 CM6
 * 事务：拖拽处理器在原生 DOM 事件上改这个状态，然后 `emit()` 通知 painter
 * 和单元格工具条重新读取。这是刻意不派发事务的——拖拽中派发会重建指针正在
 * 拖过的 widget。
 *
 * 选区是矩形：`anchor` 是指针按下处，`head` 是它当前所在的单元格。行用 `-1`
 * 表示表头行，与 `table.ts` 的 `CellSpan` 约定一致。
 */
import type { EditorView } from "@codemirror/view";

/** 矩形单元格选区的 anchor + head。 */
export interface CellSelection {
  /** 表格在文档中的序号（来自 `findTables`）。 */
  readonly tableIndex: number;
  readonly anchorRow: number;
  readonly anchorCol: number;
  readonly headRow: number;
  readonly headCol: number;
  /**
   * 用户是刻意选中这段范围（shift-click 或拖拽），而不只是把光标放进单元格
   * 的普通点击（#455）时为 true。
   */
  readonly explicit?: boolean;
}

/** 选区的归一化包围矩形（各边都含端点）。 */
export interface CellRect {
  readonly minRow: number;
  readonly maxRow: number;
  readonly minCol: number;
  readonly maxCol: number;
}

const selections = new WeakMap<EditorView, CellSelection>();
const listeners = new WeakMap<EditorView, Set<() => void>>();

function sameSelection(a: CellSelection, b: CellSelection): boolean {
  return (
    a.tableIndex === b.tableIndex &&
    a.anchorRow === b.anchorRow &&
    a.anchorCol === b.anchorCol &&
    a.headRow === b.headRow &&
    a.headCol === b.headCol
  );
}

/** 视图当前的单元格选区，没有则返回 null。 */
export function getCellSelection(view: EditorView): CellSelection | null {
  return selections.get(view) ?? null;
}

/** 替换选区并通知订阅者（值相同时无操作）。 */
export function setCellSelection(
  view: EditorView,
  selection: CellSelection,
): void {
  const previous = selections.get(view);
  if (previous && sameSelection(previous, selection)) return;
  selections.set(view, selection);
  emit(view);
}

/** 丢弃选区并通知订阅者（已经为空时无操作）。 */
export function clearCellSelection(view: EditorView): void {
  if (!selections.has(view)) return;
  selections.delete(view);
  emit(view);
}

/** 订阅某视图的选区变化；返回取消订阅函数。 */
export function subscribeCellSelection(
  view: EditorView,
  cb: () => void,
): () => void {
  let set = listeners.get(view);
  if (!set) {
    set = new Set();
    listeners.set(view, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(view);
  };
}

function emit(view: EditorView): void {
  const set = listeners.get(view);
  if (!set) return;
  // 快照，避免某个订阅者在 emit 中退订导致同级被跳过。
  for (const cb of [...set]) cb();
}

/** 把选区归一化成含端点的包围矩形。 */
export function cellRect(selection: CellSelection): CellRect {
  return {
    minRow: Math.min(selection.anchorRow, selection.headRow),
    maxRow: Math.max(selection.anchorRow, selection.headRow),
    minCol: Math.min(selection.anchorCol, selection.headCol),
    maxCol: Math.max(selection.anchorCol, selection.headCol),
  };
}

/** 选区覆盖的单元格数量（单个单元格为 1）。 */
export function cellSelectionCount(selection: CellSelection): number {
  const rect = cellRect(selection);
  return (rect.maxRow - rect.minRow + 1) * (rect.maxCol - rect.minCol + 1);
}

/** 某 (row, col) 单元格是否属于选区矩形。 */
export function isCellInSelection(
  selection: CellSelection,
  row: number,
  col: number,
): boolean {
  const rect = cellRect(selection);
  return (
    row >= rect.minRow &&
    row <= rect.maxRow &&
    col >= rect.minCol &&
    col <= rect.maxCol
  );
}
