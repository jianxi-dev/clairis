/* 块手柄（md-orchestration 1.2，对应 design.md D5/D6 与 spec E-7）。
 *
 * 每个块左侧一个 42×26 药丸：左段是块型图标，右段是拖拽把手；空行退化为单段「+」。
 * hover 由 1.1 的 HoverGate 门控（300ms 显现、150ms 收起，键盘 / 触摸 / 拖拽抑制），
 * 门控只负责切换 `.cm-block-handle-visible`，透明度由 CSS 过渡（D5）。
 *
 * 拖拽：pointerdown 后移动 ≥4px 才算拖动，整块加 `.cm-block-handle-dragging` 高亮；
 * 松手用 `moveBlock` 算出新文档，单次 `dispatch` 整篇替换（选择自动映射，光标不跳）。
 * 纯函数（`blockHandleIcon` / `moveBlock`）不碰 DOM，由单测钉死。
 */
import type { Extension } from "@codemirror/state";
import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import { getBlocks, getBlockAt, type BlockType } from "../block-model";
import { renderIcon, ADD_ICON_NAME } from "../icons";
import {
  openBlockMenu,
  closeBlockMenu,
  isBlockMenuOpen,
  scheduleBlockMenuClose,
} from "./block-menu";
import { openSlashMenuAtCursor } from "../slash";
import {
  HoverGate,
  SHOW_DELAY_MS,
  HIDE_DELAY_MS,
  type PointerKind,
} from "./hover-gate";

// --- 纯函数 ------------------------------------------------------------------

/** 块型 → 手柄图标名（D6 验收锚点）。 */
const BLOCK_ICON_NAME: Record<string, string> = {
  table: "DataSheetOutlined",
  list: "DisorderListOutlined",
  callout: "CalloutOutlined",
  fencedCode: "CodeblockOutlined",
  codeBlock: "CodeblockOutlined",
  image: "ImageOutlined",
};

/**
 * 解析块型对应的手柄图标名。未登记的块型（段落、标题、引用、分割线…）一律
 * 退化为 `DragHandleOutlined`。
 */
export function blockHandleIcon(type: string): string {
  return BLOCK_ICON_NAME[type] ?? "DragHandleOutlined";
}

/** 去掉首尾换行，让块与块之间重新用单个空行相接。 */
function trimNewlines(text: string): string {
  return text.replace(/^\n+/, "").replace(/\n+$/, "");
}

/**
 * 把 `doc.slice(block.from, block.to)` 移动到 `target.from` 之前。
 *
 * - 目标落在被移动块内（含块首）时返回原文，不产生事务。
 * - 块为空 / 文档为空时返回原文。
 * - 移动后块与块之间用单个空行相接（Markdown 文档约定），其余内容逐字保留。
 */
export function moveBlock(
  doc: string,
  block: { from: number; to: number },
  target: { from: number },
): string {
  const from = Math.max(0, Math.min(block.from, doc.length));
  const to = Math.max(from, Math.min(block.to, doc.length));
  if (to <= from) return doc;
  if (target.from >= from && target.from < to) return doc;

  const moved = doc.slice(from, to);
  const rest = doc.slice(0, from) + doc.slice(to);
  // 目标原本在块之后时，切掉块后它的偏移左移了一个块长。
  const shifted = target.from > from ? target.from - (to - from) : target.from;
  const insertAt = Math.max(0, Math.min(shifted, rest.length));

  const before = trimNewlines(rest.slice(0, insertAt));
  const after = trimNewlines(rest.slice(insertAt));
  const body = trimNewlines(moved);
  if (body.length === 0) return doc;

  const parts: string[] = [];
  if (before.length > 0) parts.push(before);
  parts.push(body);
  if (after.length > 0) parts.push(after);
  return parts.join("\n\n");
}

// --- ViewPlugin --------------------------------------------------------------

/** 手柄宽度（px）；用于把药丸摆在块左侧。 */
const HANDLE_WIDTH_PX = 42;
/** 手柄与块之间的水平间距（px）。 */
const HANDLE_GAP_PX = 4;
/** 按下后移动超过这个距离才算拖动，否则视为点击。 */
const DRAG_THRESHOLD_PX = 4;

/** 悬停到手柄后开菜单的意图延迟（对齐 md-bundle 的 120ms）。 */
const MENU_INTENT_DELAY_MS = 120;

interface BlockRange {
  from: number;
  to: number;
  type: BlockType | "";
}

interface HandleEntry {
  el: HTMLDivElement;
  block: BlockRange;
  empty: boolean;
  gate: HoverGate;
  timer: number | null;
  hovered: boolean;
  dragging: boolean;
  startX: number;
  startY: number;
  onMove: (event: PointerEvent) => void;
  onUp: (event: PointerEvent) => void;
  /** 悬停意图延迟定时器：到点才开块菜单。 */
  menuTimer: number | null;
  /**
   * 手柄纵向锚点：跟随指针所在的可视行（对齐 md-bundle 的 showHandleAt）。
   * 长段落/折行时不能锚在 block.from，否则手柄会跑到块顶。
   */
  anchorPos: number | null;
}

function pointerKind(type: string): PointerKind {
  return type === "mouse" ? "mouse" : type === "pen" ? "pen" : "touch";
}

class BlockHandlePlugin {
  private handles: HandleEntry[] = [];
  private frame: number | null = null;

  constructor(private readonly view: EditorView) {
    if (
      view.dom.style.position === "static" ||
      view.dom.style.position === ""
    ) {
      view.dom.style.position = "relative";
    }
    view.contentDOM.addEventListener("keydown", this.onKeyDown);
    view.contentDOM.addEventListener("keyup", this.onKeyUp);
    // 块级 hover：指针在正文或手柄上都要能召唤手柄（只挂手柄自身会不可发现）。
    view.dom.addEventListener("pointermove", this.onDomPointerMove);
    view.dom.addEventListener("pointerleave", this.onDomPointerLeave);
    view.scrollDOM.addEventListener("scroll", this.onScroll, { passive: true });
    this.build();
    // 首次 build 发生在 view 尚未测量时，coordsAtPos 会返回 null；下一帧再定位。
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.reposition();
    });
  }

  update(update: ViewUpdate): void {
    if (update.docChanged) {
      this.build();
      return;
    }
    if (update.geometryChanged || update.viewportChanged) this.reposition();
  }

  private readonly onScroll = (): void => {
    this.reposition();
  };

  /** 重算所有手柄位置（不重建 DOM）。 */
  private reposition(): void {
    for (const handle of this.handles) {
      this.position(handle.el, handle.anchorPos ?? handle.block.from);
    }
  }

  destroy(): void {
    this.view.contentDOM.removeEventListener("keydown", this.onKeyDown);
    this.view.contentDOM.removeEventListener("keyup", this.onKeyUp);
    this.view.dom.removeEventListener("pointermove", this.onDomPointerMove);
    this.view.dom.removeEventListener("pointerleave", this.onDomPointerLeave);
    this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.clearHandles();
  }

  // --- 块级 hover 召唤 -------------------------------------------------------

  /**
   * 指针在正文里移动时，激活「指针所在块」的手柄。
   *
   * 只挂手柄自身的 pointerenter 会让手柄不可发现（手柄默认 opacity 0，
   * 用户根本不知道该往哪指）；这里用 `posAtCoords` 找到块，指针移到手柄上
   * 时再按 `data-block-from` 命中同一块，避免「正文 → 手柄」的离开闪烁。
   */
  private readonly onDomPointerMove = (event: PointerEvent): void => {
    const kind = pointerKind(event.pointerType);
    const target = event.target as Element | null;
    const overHandle = target?.closest?.(
      ".cm-block-handle",
    ) as HTMLElement | null;
    let activeFrom: number | null = overHandle
      ? Number(overHandle.dataset.blockFrom)
      : null;
    if (activeFrom === null) {
      const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos !== null) {
        // 空行「+」也要能被召唤：它的范围退化为于点（from === to）。
        const hit = this.handles.find(
          (handle) => pos >= handle.block.from && pos <= handle.block.to,
        );
        if (hit) {
          activeFrom = hit.block.from;
          hit.anchorPos = Math.min(Math.max(pos, hit.block.from), hit.block.to);
        }
      }
    }
    for (const handle of this.handles) {
      const inside = activeFrom !== null && handle.block.from === activeFrom;
      if (inside && !handle.hovered) {
        handle.hovered = true;
        handle.gate.enter(kind, Date.now());
        this.arm(handle);
      } else if (!inside && handle.hovered) {
        handle.hovered = false;
        handle.gate.leave(kind, Date.now());
        this.arm(handle);
      }
    }
  };

  private readonly onDomPointerLeave = (): void => {
    for (const handle of this.handles) {
      if (!handle.hovered) continue;
      handle.hovered = false;
      handle.gate.leave("mouse", Date.now());
      this.arm(handle);
    }
  };

  // --- 键盘抑制（D5：输入中一律隐藏） ---------------------------------------

  private readonly onKeyDown = (): void => {
    this.hideAll();
  };

  private readonly onKeyUp = (): void => {
    for (const handle of this.handles) handle.gate.suppress(false);
  };

  private hideAll(): void {
    for (const handle of this.handles) {
      if (handle.timer !== null) {
        clearTimeout(handle.timer);
        handle.timer = null;
      }
      handle.gate.suppress(true);
      handle.gate.cancel();
      handle.el.classList.remove("cm-block-handle-visible");
    }
  }

  // --- 构建 / 定位 ----------------------------------------------------------

  private build(): void {
    this.clearHandles();
    const doc = this.view.state.doc;
    const blocks = getBlocks(this.view.state);
    const covered = (pos: number): boolean =>
      blocks.some((block) => pos >= block.from && pos < block.to);

    for (const block of blocks) {
      this.addHandle(
        { from: block.from, to: block.to, type: block.type },
        false,
      );
    }
    // 空行退化为单段「+」：不被任何块覆盖的空行才是插入入口。
    for (let n = 1; n <= doc.lines; n++) {
      const line = doc.line(n);
      if (line.text.trim() !== "") continue;
      if (covered(line.from)) continue;
      this.addHandle({ from: line.from, to: line.to, type: "" }, true);
    }
  }

  private clearHandles(): void {
    for (const handle of this.handles) {
      if (handle.timer !== null) clearTimeout(handle.timer);
      handle.el.remove();
    }
    this.handles = [];
  }

  private addHandle(block: BlockRange, empty: boolean): void {
    const el = document.createElement("div");
    el.className = "cm-block-handle";
    el.classList.add("mdb-block-handle");
    el.setAttribute("data-testid", "block-handle");
    el.dataset.blockFrom = String(block.from);
    el.dataset.blockTo = String(block.to);
    if (empty) el.dataset.empty = "true";

    const entry: HandleEntry = {
      el,
      block,
      empty,
      gate: new HoverGate(),
      timer: null,
      hovered: false,
      dragging: false,
      startX: 0,
      startY: 0,
      onMove: () => {},
      onUp: () => {},
      menuTimer: null,
      anchorPos: null,
    };

    if (empty) {
      const add = document.createElement("span");
      add.className = "cm-block-handle-add";
      add.setAttribute("aria-label", "在下方添加");
      add.appendChild(renderIcon(ADD_ICON_NAME));
      el.appendChild(add);
    } else {
      const icon = document.createElement("span");
      icon.className = "cm-block-handle-icon";
      icon.appendChild(renderIcon(blockHandleIcon(block.type)));
      el.appendChild(icon);

      const grip = document.createElement("span");
      grip.className = "cm-block-handle-grip";
      grip.appendChild(renderIcon("DragOutlined"));
      el.appendChild(grip);
    }

    // 滑入即显示（D2 规则 1）＋意图延迟（对齐 md-bundle 的 120ms 缓冲）：
    // 指针停住才开菜单，擦过手柄不再把 236px 面板糊到正文上。
    el.addEventListener("pointerenter", () => {
      if (entry.dragging || !entry.gate.isOpen()) return;
      if (entry.menuTimer !== null) window.clearTimeout(entry.menuTimer);
      entry.menuTimer = window.setTimeout(() => {
        entry.menuTimer = null;
        if (entry.dragging) return;
        if (isBlockMenuOpen(this.view)) return;
        openBlockMenu(this.view, block, entry.anchorPos ?? block.from);
      }, MENU_INTENT_DELAY_MS);
    });
    el.addEventListener("pointerleave", () => {
      if (entry.menuTimer !== null) {
        window.clearTimeout(entry.menuTimer);
        entry.menuTimer = null;
      }
      if (entry.dragging) return;
      scheduleBlockMenuClose(this.view);
    });

    if (empty) {
      el.addEventListener("pointerdown", (event) =>
        this.onAddPointerDown(event, entry),
      );
    } else {
      entry.onMove = (event) => this.onDragMove(event, entry);
      entry.onUp = (event) => this.onDragEnd(event, entry);
      el.addEventListener("pointerdown", (event) =>
        this.onDragPointerDown(event, entry),
      );
    }

    this.position(el, block.from);
    this.view.dom.appendChild(el);
    this.handles.push(entry);
  }

  /**
   * 药丸绝对定位在块左侧。
   *
   * 先用 DOM 行元素拿几何（浏览器里比 `coordsAtPos` 稳：可见容器刚显示时
   * CM6 的高度图可能还没测量，`coordsAtPos` 会把所有位置算成同一行），
   * 拿不到再退回 `coordsAtPos`，最后退回 `documentTop`。
   */
  private position(el: HTMLElement, pos: number): void {
    const base = this.view.dom.getBoundingClientRect();
    let top = 0;
    let left = 0;

    const lineRect = this.lineRectAt(pos);
    if (lineRect) {
      top = lineRect.top - base.top;
      left = lineRect.left - base.left;
    } else {
      try {
        const coords = this.view.coordsAtPos(pos);
        if (coords) {
          top = coords.top - base.top;
          left = coords.left - base.left;
        }
      } catch {
        // 未测量：保持 0，由下一次 reposition 修正。
      }
    }

    el.style.top = `${Math.max(0, Math.round(top))}px`;
    el.style.left = `${Math.max(0, Math.round(left - HANDLE_WIDTH_PX - HANDLE_GAP_PX))}px`;
  }

  /** 位置所在行的几何矩形；DOM 里找不到时返回 null。 */
  private lineRectAt(pos: number): DOMRect | null {
    try {
      const found = this.view.domAtPos(pos);
      let node: Node | null = found.node;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const element = node as Element | null;
      const line = element?.closest?.(".cm-line") as HTMLElement | null;
      return line ? line.getBoundingClientRect() : null;
    } catch {
      return null;
    }
  }

  // --- hover 门控 -----------------------------------------------------------

  /** 到点后问门控要 show / hide，只切换可见类（透明度交给 CSS）。 */
  private arm(entry: HandleEntry): void {
    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    const delay = entry.gate.isOpen() ? HIDE_DELAY_MS : SHOW_DELAY_MS;
    entry.timer = window.setTimeout(() => {
      entry.timer = null;
      const result = entry.gate.tick(Date.now());
      if (result === "show") {
        entry.el.classList.add("cm-block-handle-visible");
      } else if (result === "hide") {
        entry.el.classList.remove("cm-block-handle-visible");
      }
    }, delay + 1);
  }

  // --- 拖拽 -----------------------------------------------------------------

  private onDragPointerDown(event: PointerEvent, entry: HandleEntry): void {
    if (event.button !== 0) return;
    event.preventDefault();
    entry.gate.suppress(true);
    closeBlockMenu(this.view);
    entry.dragging = false;
    entry.startX = event.clientX;
    entry.startY = event.clientY;
    try {
      entry.el.setPointerCapture(event.pointerId);
    } catch {
      // 某些环境不支持指针捕获：监听仍挂在元素上。
    }
    entry.el.addEventListener("pointermove", entry.onMove);
    entry.el.addEventListener("pointerup", entry.onUp);
    entry.el.addEventListener("pointercancel", entry.onUp);
  }

  private onDragMove(event: PointerEvent, entry: HandleEntry): void {
    if (entry.dragging) return;
    const dx = event.clientX - entry.startX;
    const dy = event.clientY - entry.startY;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    entry.dragging = true;
    entry.el.classList.add("cm-block-handle-dragging");
    this.highlightBlock(entry.block, true);
  }

  private onDragEnd(event: PointerEvent, entry: HandleEntry): void {
    entry.el.removeEventListener("pointermove", entry.onMove);
    entry.el.removeEventListener("pointerup", entry.onUp);
    entry.el.removeEventListener("pointercancel", entry.onUp);
    if (entry.el.hasPointerCapture(event.pointerId)) {
      try {
        entry.el.releasePointerCapture(event.pointerId);
      } catch {
        // 忽略：指针已释放。
      }
    }
    entry.gate.suppress(false);

    if (!entry.dragging) {
      // 移动不足阈值：视为点击，不重排。
      entry.dragging = false;
      return;
    }
    entry.dragging = false;
    entry.el.classList.remove("cm-block-handle-dragging");
    this.highlightBlock(entry.block, false);

    let pos: number | null = null;
    try {
      pos = this.view.posAtCoords({
        x: event.clientX,
        y: event.clientY,
      });
    } catch {
      pos = null;
    }
    if (pos === null) return;

    const blocks = getBlocks(this.view.state);
    const targetBlock = getBlockAt(pos, blocks);
    const target = { from: targetBlock ? targetBlock.from : pos };
    const doc = this.view.state.doc.toString();
    const next = moveBlock(doc, entry.block, target);
    if (next === doc) return;
    // 单事务整篇替换：选择随变更自动映射，滚动位置不跳。
    this.view.dispatch({
      changes: { from: 0, to: doc.length, insert: next },
    });
  }

  /** 拖拽期间给被移动块的每一行加高亮类。 */
  private highlightBlock(block: BlockRange, on: boolean): void {
    const lines = this.view.dom.querySelectorAll(".cm-line");
    lines.forEach((lineEl) => {
      let pos: number | null = null;
      try {
        pos = this.view.posAtDOM(lineEl);
      } catch {
        pos = null;
      }
      if (pos !== null && pos >= block.from && pos < block.to) {
        lineEl.classList.toggle("cm-block-handle-dragging", on);
      }
    });
  }

  // --- 空行「+」 ------------------------------------------------------------

  private onAddPointerDown(event: PointerEvent, entry: HandleEntry): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    // 把光标放到空行起点，菜单随即在该处打开（slash.ts 用光标定位）。
    this.view.dispatch({ selection: { anchor: entry.block.from } });
    this.view.focus();
    openSlashMenuAtCursor(this.view);
  }
}

/**
 * 块手柄扩展：药丸 + 空行「+」+ 拖拽重排。
 *
 * ```ts
 * blockHandle()
 * ```
 */
export function blockHandle(): Extension {
  return ViewPlugin.fromClass(BlockHandlePlugin);
}
