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
import { StateEffect, type Range } from "@codemirror/state";
import {
  getSlashCommands,
  isSlashMenuOpen,
  openContextMenu,
  releaseInsertMenu,
  slashMenuApply,
  slashMenuClose,
  slashMenuSelectNext,
  slashMenuSelectPrev,
  updateSlashMenuQuery,
  type SlashCommand,
} from "../slash";
import { renderIcon } from "../icons";
import { renderBlockDom } from "./block-dom";

const OPEN_RE = /^ {0,3}:::\s*\{([^}]*)\}\s*$/;
const CLOSE_RE = /^ {0,3}:::\s*$/;
const COL_RE = /\.col-([1-5])/;
const COLS_ATTR_RE = /(?:^|\s)cols:([0-9]+(?:,[0-9]+)*)(?=[\s}]|$)/;

const MIN_COLUMN_PERCENT = 10;

export interface ColumnBlock {
  /** 整个围栏 div 的范围，含标记。 */
  from: number;
  to: number;
  /** 首行围栏的范围，用于改写 `cols:`。 */
  openFrom: number;
  openTo: number;
  /** 首行围栏原文（`::: {.col-N cols:…}`）——内容匹配的锚点。 */
  openText: string;
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
 * 已打开的就地编辑器 → 以「+」手柄的非查询模式打开菜单的回调。
 *
 * 手柄点击时若该栏编辑器已开着，直接复用它的菜单入口，避免开第二个 textarea。
 */
const columnMenuOpeners = new WeakMap<HTMLElement, () => void>();

/** 源码里缺失的单元格（围栏内没有对应段落）。 */
function missingCell(block: ColumnBlock): {
  from: number;
  to: number;
  text: string;
} {
  return { from: block.openTo, to: block.openTo, text: "" };
}

/** 一个就地编辑器的斜杠菜单状态与宿主回调（按 textarea 存放）。 */
interface ColumnMenuEntry {
  mode: "slash" | "handle" | null;
  slashPos: number;
  close: () => void;
  cancel: () => void;
  write: (text: string) => void;
}

const columnMenus = new WeakMap<HTMLTextAreaElement, ColumnMenuEntry>();

/** 光标前最后一个 `/` 的下标 + 1（查询锚点）；没有 `/` 时退回光标位。 */
function slashAnchor(area: HTMLTextAreaElement): number {
  const caret = area.selectionStart ?? area.value.length;
  const idx = area.value.lastIndexOf("/", caret);
  return idx >= 0 ? idx + 1 : caret;
}

/**
 * 打开分栏就地编辑器的统一斜杠菜单（#742）。
 *
 * `slashMode` 为 true 时是查询模式：`/` 保留在 textarea 内作查询锚点，选中替换
 * `[slashPos - 1, caret]`，取消回滚 `/query`。为 false 时是「+」手柄的非查询
 * 模式：无 `/`，选中在光标处零宽插入，取消无副作用。两种模式都只写回 textarea，
 * 落文档仍由 Enter/blur 的 commit 路径完成（源码唯一真相源）。
 */
export function openColumnContextMenu(
  view: EditorView,
  area: HTMLTextAreaElement,
  commands: SlashCommand[],
  slashMode: boolean,
): void {
  const entry = columnMenus.get(area);
  if (!entry) return;
  entry.mode = slashMode ? "slash" : "handle";
  entry.slashPos = slashMode ? slashAnchor(area) : -1;
  const rect = area.getBoundingClientRect();
  openContextMenu(view, commands, {
    anchorRect: () => {
      const r = area.isConnected ? area.getBoundingClientRect() : rect;
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
      };
    },
    applyText: entry.write,
    cancel: entry.cancel,
  });
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
  key: ColumnContentKey,
  openHandleMenu = false,
): void {
  const existing = host.querySelector<HTMLTextAreaElement>(".cm-column-editor");
  if (existing) {
    existing.focus();
    if (openHandleMenu) columnMenuOpeners.get(host)?.();
    return;
  }
  const area = document.createElement("textarea");
  area.className = "cm-column-editor";
  area.setAttribute("data-testid", "cm-column-editor");
  area.value = initial;
  area.rows = 1;
  // 就地编辑器与栏正文同占一格：不摘掉静态文本会重复显示同一段文字（A-4.1）。
  // 快照子节点而不是 textContent——栏正文现在是块级渲染结果，文本还原会让
  // Esc 取消后标题 / 列表退回源码格式。
  const restoreNodes = Array.from(host.childNodes);
  host.replaceChildren();
  host.appendChild(area);
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);

  const slotKey = slotKeyOf(key, index);
  openColumnEditors.set(slotKey, { view, area, index });
  const currentHost = (): HTMLElement => area.parentElement ?? host;

  let composing = false;
  let closed = false;

  const closeEditor = (refresh: boolean): void => {
    if (closed) return;
    closed = true;
    const live = currentHost();
    area.remove();
    live.replaceChildren(...restoreNodes);
    live.removeAttribute("data-editing");
    columnMenuOpeners.delete(live);
    columnMenuOpeners.delete(host);
    columnMenus.delete(area);
    if (openColumnEditors.get(slotKey)?.area === area) {
      openColumnEditors.delete(slotKey);
    }
    if (refresh && !columnsRebuildFrozen()) refreshColumns(view);
  };
  // 匹配失败兜底：把 textarea 文本按块级渲染回填宿主（不丢字、不退纯文本），
  // 不强制刷新——刷新会用文档内容盖掉刚回填的文本。
  const restoreFallback = (): void => {
    if (closed) return;
    closed = true;
    const text = area.value;
    const live = currentHost();
    live.replaceChildren(renderBlockDom(text));
    area.remove();
    live.removeAttribute("data-editing");
    columnMenuOpeners.delete(live);
    columnMenuOpeners.delete(host);
    columnMenus.delete(area);
    if (openColumnEditors.get(slotKey)?.area === area) {
      openColumnEditors.delete(slotKey);
    }
    showColumnToast("未能定位分栏，已把文本保留在该栏");
    view.focus();
  };
  const commit = (): void => {
    if (closed || !area.isConnected) return;
    const value = area.value.trim();
    const docText = view.state.doc.toString();
    const block = findColumnBlockByContent(docText, key, blockFrom);
    if (!block) {
      restoreFallback();
      return;
    }
    closeEditor(false);
    const cells = Array.from({ length: block.count }, (_, i) =>
      (block.cells[i]?.text ?? "").trim(),
    );
    cells[index] = value;
    const next = rebuildColumns(docText, block, cells);
    if (next === null) return;
    view.dispatch({
      changes: { from: block.from, to: block.to, insert: next },
    });
    if (block.from !== blockFrom) {
      showColumnToast("分栏位置已变化，内容已保留");
    }
    view.focus();
  };
  const entry: ColumnMenuEntry = {
    mode: null,
    slashPos: -1,
    close: (): void => {
      entry.mode = null;
      entry.slashPos = -1;
      releaseInsertMenu(view, "context");
    },
    cancel: (): void => {
      if (entry.mode === "slash" && entry.slashPos >= 0 && area.isConnected) {
        const end = Math.max(
          entry.slashPos,
          area.selectionStart ?? area.value.length,
        );
        area.value =
          area.value.slice(0, entry.slashPos - 1) + area.value.slice(end);
        area.setSelectionRange(entry.slashPos - 1, entry.slashPos - 1);
      }
      entry.close();
    },
    write: (text: string): void => {
      if (!area.isConnected) {
        entry.close();
        return;
      }
      if (entry.mode === "slash" && entry.slashPos >= 0) {
        const end = Math.max(
          entry.slashPos,
          area.selectionStart ?? area.value.length,
        );
        area.value =
          area.value.slice(0, entry.slashPos - 1) +
          text +
          area.value.slice(end);
        const caret = entry.slashPos - 1 + text.length;
        area.setSelectionRange(caret, caret);
      } else {
        const caret = area.selectionStart ?? area.value.length;
        area.value =
          area.value.slice(0, caret) + text + area.value.slice(caret);
        const next = caret + text.length;
        area.setSelectionRange(next, next);
      }
      entry.close();
    },
  };
  columnMenus.set(area, entry);
  columnMenuOpeners.set(host, () => {
    openColumnContextMenu(view, area, getSlashCommands(), false);
  });

  area.addEventListener("compositionstart", () => {
    composing = true;
  });
  area.addEventListener("compositionend", () => {
    composing = false;
  });
  area.addEventListener("keydown", (event) => {
    event.stopPropagation();
    // 菜单开着：键盘驱动菜单（焦点在 textarea，CM6 keymap 不可达，#741）。
    if (entry.mode !== null && isSlashMenuOpen(view)) {
      if (event.key === "Enter") {
        event.preventDefault();
        slashMenuApply(view);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        slashMenuSelectNext(view);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        slashMenuSelectPrev(view);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        slashMenuClose(view);
        return;
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditor(true);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit();
    }
  });
  area.addEventListener("blur", () => {
    if (composing || blurSuppressed) return;
    // 菜单还开着就失焦（Alt-Tab 等）：先取消回滚，绝不让 `/query` 进文档。
    if (entry.mode !== null && isSlashMenuOpen(view)) slashMenuClose(view);
    commit();
  });
  area.addEventListener("input", () => {
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
    if (composing) return;
    if (entry.mode === "slash") {
      // 触发符被删 = 查询锚点失效，直接关菜单（无残留可回滚）。
      if (entry.slashPos < 0 || area.value[entry.slashPos - 1] !== "/") {
        entry.close();
        return;
      }
      // 光标退到触发符之前也算放弃查询。
      const caret = area.selectionStart ?? area.value.length;
      if (caret < entry.slashPos) {
        entry.close();
        return;
      }
      updateSlashMenuQuery(view, area.value.slice(entry.slashPos, caret));
      return;
    }
    if (entry.mode === "handle") return;
    // 与单元格同款：末尾 `/` 就地打开查询菜单。
    if (!area.value.endsWith("/")) return;
    openColumnContextMenu(view, area, getSlashCommands(), true);
  });
  area.addEventListener("mousedown", (event) => event.stopPropagation());
  if (openHandleMenu) {
    openColumnContextMenu(view, area, getSlashCommands(), false);
  }
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
      openText: lines[i],
      count: Number(colMatch[1]),
      widths,
      cells: splitCells(inner, contentFrom),
    });
    i = j + 1;
  }
  return blocks;
}

/**
 * 分栏块的内容键：文档位移后定位目标栏的稳定指纹。
 *
 * 不用 `from` 偏移（会随编辑漂移），用首行围栏原文 + 列数 + 各栏内容。首行
 * 已含 `cols:` 属性串，因此属性串歧义时内容仍能区分同属性的两个分栏块。
 */
export interface ColumnContentKey {
  readonly openLine: string;
  readonly count: number;
  readonly cells: readonly string[];
}

/** 取一个分栏块的内容键。 */
export function columnContentKey(block: ColumnBlock): ColumnContentKey {
  return {
    openLine: block.openText,
    count: block.count,
    cells: block.cells.map((cell) => cell.text.trim()),
  };
}

function contentKeyEquals(a: ColumnContentKey, b: ColumnContentKey): boolean {
  return (
    a.openLine === b.openLine &&
    a.count === b.count &&
    a.cells.length === b.cells.length &&
    a.cells.every((cell, i) => cell === b.cells[i])
  );
}

/**
 * 按内容键在文档里定位分栏块。
 *
 * 命中多个（同文重复块）时取 `from` 离 `nearFrom` 最近者；零命中返回 null，
 * 由调用方走兜底（回填宿主 + toast），绝不静默丢字。
 */
export function findColumnBlockByContent(
  docText: string,
  key: ColumnContentKey,
  nearFrom: number,
): ColumnBlock | null {
  const matches = parseColumns(docText).filter((block) =>
    contentKeyEquals(columnContentKey(block), key),
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, block) =>
    Math.abs(block.from - nearFrom) < Math.abs(best.from - nearFrom)
      ? block
      : best,
  );
}

// --- 就地编辑器打开期间的 widget 冻结 ----------------------------------------

/** 关闭编辑器后强制重建分栏 widget，清掉冻结期的旧 DOM。 */
export const columnsRefresh = StateEffect.define<void>();

interface OpenColumnEditor {
  view: EditorView;
  area: HTMLTextAreaElement;
  index: number;
}

/**
 * 打开中的就地编辑器，按「首行围栏 + 列数 + 栏序号」登记。
 *
 * 位移引发的 widget 重建会造出新 host，按这个槽位键把原 textarea 挪回去，
 * 输入框因此不丢、窗口始终唯一。条目按视图归属，避免串扰其他编辑器实例。
 */
const openColumnEditors = new Map<string, OpenColumnEditor>();

function slotKeyOf(key: ColumnContentKey, index: number): string {
  return `${key.openLine}\u0000${key.count}\u0000${index}`;
}

function pruneOpenEditors(): void {
  for (const [slotKey, entry] of openColumnEditors) {
    if (!entry.area.isConnected) openColumnEditors.delete(slotKey);
  }
}

export function columnsRebuildFrozen(): boolean {
  pruneOpenEditors();
  return openColumnEditors.size > 0;
}

/**
 * 文档在编辑器打开期间位移时，CM6 会重建 / 移动 widget DOM，持有焦点的
 * textarea 被动态 blur。标记这次 blur 为「非用户离开」，下一帧把焦点还回
 * 重挂后的输入框。
 */
let blurSuppressed = false;

export function noteColumnDocChanged(): void {
  if (!columnsRebuildFrozen()) return;
  blurSuppressed = true;
  requestAnimationFrame(() => {
    blurSuppressed = false;
    const area =
      document.querySelector<HTMLTextAreaElement>(".cm-column-editor");
    area?.focus();
  });
}

/** 强制重建分栏 widget（编辑器关闭后调用）。 */
export function refreshColumns(view: EditorView): void {
  view.dispatch({ effects: columnsRefresh.of(undefined) });
}

const COLUMN_TOAST_CLASS = "column-commit-toast";

/**
 * 可见提示：同一时刻只保留一条，避免成功/兜底连续触发时堆叠。
 */
function showColumnToast(message: string): void {
  document
    .querySelectorAll(`.${COLUMN_TOAST_CLASS}`)
    .forEach((el) => el.remove());
  const el = document.createElement("div");
  el.className = COLUMN_TOAST_CLASS;
  el.setAttribute("role", "status");
  el.textContent = message;
  el.style.cssText =
    "position:fixed;left:50%;bottom:32px;transform:translateX(-50%);" +
    "z-index:2000;padding:8px 14px;border-radius:8px;pointer-events:none;" +
    "background:var(--app-surface);color:var(--app-text);" +
    "border:1px solid var(--app-border);" +
    "box-shadow:0 4px 16px rgba(0,0,0,0.18);font-size:13px;";
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 2600);
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
  private view: EditorView | null = null;

  constructor(
    /** 分栏块序号——文档位移时保持稳定的键。 */
    readonly index: number,
    readonly block: ColumnBlock,
  ) {
    super();
  }

  eq(other: ColumnsWidget): boolean {
    // 编辑器打开期间冻结本 widget 的销毁/重建：保留持有 textarea 的旧 DOM，
    // 否则位移引发的重建会摘掉输入框（双活 / 丢字）。
    if (columnsRebuildFrozen()) return true;
    return (
      this.block.count === other.block.count &&
      this.block.openText === other.block.openText &&
      JSON.stringify(resolveWidths(this.block)) ===
        JSON.stringify(resolveWidths(other.block)) &&
      JSON.stringify(this.block.cells.map((c) => c.text)) ===
        JSON.stringify(other.block.cells.map((c) => c.text))
    );
  }

  toDOM(view?: EditorView): HTMLElement {
    this.view = view ?? null;
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
      const cell = this.block.cells[index] ?? missingCell(this.block);
      container.appendChild(
        this.buildColumn(
          view,
          cell,
          index,
          widths[index] ?? 100 / this.block.count,
        ),
      );
    }

    container.appendChild(this.buildAddHandle(view, container));
    return container;
  }

  /**
   * 容器「+」新增手柄（A-4.5 / D7）：贴内容区左缘外侧、纵向居中，与单元格手柄
   * 同款形态。悬停容器才显示；滑入即保持可见并打开选择菜单，移出「手柄 ∪ 菜单」
   * 后菜单消失（A-4.3）；点击同样打开该栏就地编辑器与非查询模式菜单。
   * 就地编辑器随滑入 / 点击打开后保持到提交或 Esc（与点击路径一致），不在移出时拆。
   */
  private buildAddHandle(
    view: EditorView | undefined,
    container: HTMLElement,
  ): HTMLElement {
    const handle = document.createElement("div");
    handle.className = "cm-columns-add-handle";
    handle.setAttribute("data-testid", "cm-columns-add-handle");
    handle.title = "新增内容";
    handle.replaceChildren(renderIcon("AddOutlined"));
    if (!view) return handle;

    /** 指针离开手柄 / 菜单后的宽限：够指针跨过缝隙落进菜单，又不显得拖沓。 */
    const CLOSE_DELAY_MS = 120;
    let activeCol = 0;
    let closeTimer: number | null = null;
    /** 指针是否正压在本栏「+」上：此时容器若因开编辑器重建 hover 而补发
     *  mouseenter，不得把把手重置回第 0 栏（A-4.3 的把手定位稳定性）。 */
    let handleHover = false;

    const cancelClose = (): void => {
      if (closeTimer !== null) {
        window.clearTimeout(closeTimer);
        closeTimer = null;
      }
    };
    const scheduleClose = (): void => {
      cancelClose();
      closeTimer = window.setTimeout(() => {
        closeTimer = null;
        // 编辑器已拆（Esc / 提交）时它的菜单也已消失：残留定时器不得关掉之后
        // 在别处新开的菜单。
        if (!container.querySelector(".cm-column-editor")) return;
        slashMenuClose(view);
      }, CLOSE_DELAY_MS);
    };

    const openAt = (index: number): void => {
      const body = container.querySelector<HTMLElement>(
        `.cm-column[data-col="${index}"] .cm-column-body`,
      );
      if (!body) return;
      const cell = this.block.cells[index] ?? missingCell(this.block);
      body.dataset.editing = "true";
      openColumnEditor(
        view,
        this.block.from,
        index,
        body,
        cell.text,
        columnContentKey(this.block),
        true,
      );
      // 菜单挂在 view.dom 上、不是 .cm-columns 的后代：指针移进去不能算离开手柄（A-4.3）。
      const menu = view.dom.querySelector<HTMLElement>(".mdb-slash-menu");
      menu?.addEventListener("pointerenter", cancelClose);
      menu?.addEventListener("pointerleave", scheduleClose);
    };

    // 把手贴悬停栏正文左缘外侧：水平方向缩进容器内，避开块手柄（其右缘在容器
    // 左边框外 4px）；垂直方向对齐该栏正文中心。
    const position = (index: number): void => {
      activeCol = index;
      const body = container.querySelector<HTMLElement>(
        `.cm-column[data-col="${index}"] .cm-column-body`,
      );
      if (!body) return;
      const containerRect = container.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const style = window.getComputedStyle(container);
      const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
      const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
      handle.style.left = `${
        bodyRect.left - containerRect.left - borderLeft - 16
      }px`;
      handle.style.top = `${
        bodyRect.top - containerRect.top - borderTop + bodyRect.height / 2
      }px`;
    };
    container.addEventListener(
      "mousemove",
      (event) => {
        const target = event.target as HTMLElement | null;
        // 只有栏正文能改 activeCol：手柄与栏间 gutter 都不属于任何栏，命中它们时
        // 保持当前栏，否则把手会跳回第 0 栏、从指针下消失（A-4.3 根因）。
        const body = target?.closest(".cm-column-body") as HTMLElement | null;
        const col = body?.closest(".cm-column") as HTMLElement | null;
        if (!col) return;
        const index = Number(col.dataset.col);
        if (Number.isFinite(index)) position(index);
      },
      { passive: true },
    );
    container.addEventListener(
      "mouseenter",
      () => {
        if (!handleHover) position(0);
      },
      { passive: true },
    );
    container.addEventListener("pointerleave", scheduleClose);

    handle.addEventListener("pointerenter", () => {
      handleHover = true;
      cancelClose();
      if (isSlashMenuOpen(view)) return;
      openAt(activeCol);
    });
    handle.addEventListener("pointerleave", () => {
      handleHover = false;
      scheduleClose();
    });
    handle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelClose();
      if (isSlashMenuOpen(view)) return;
      openAt(activeCol);
    });
    return handle;
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
    body.replaceChildren(renderBlockDom(cell.text));
    if (!cell.text) body.dataset.placeholder = "输入内容…";
    // 位移重建出的新 host：把原输入框挪回来，保证窗口唯一且不丢输入。
    const open =
      view &&
      openColumnEditors.get(slotKeyOf(columnContentKey(this.block), index));
    if (open && open.view === view) {
      body.replaceChildren(open.area);
      body.dataset.editing = "true";
      if (view) {
        columnMenuOpeners.set(body, () => {
          openColumnContextMenu(view, open.area, getSlashCommands(), false);
        });
      }
    }
    // 按下就打开本栏的就地编辑器（#450）。改为选中源码范围会把光标放到块首行，
    // 输入就落到栏外。
    if (view) {
      const blockFrom = this.block.from;
      body.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        body.dataset.editing = "true";
        openColumnEditor(
          view,
          blockFrom,
          index,
          body,
          cell.text,
          columnContentKey(this.block),
        );
      });
    }
    col.appendChild(body);

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

  /**
   * widget 消失（分栏被删、模式切换拆除视图）时丢掉它拥有的上下文菜单，避免
   * 孤儿面板浮在别的视图上。
   */
  destroy(): void {
    if (!this.view) return;
    releaseInsertMenu(this.view, "context");
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
