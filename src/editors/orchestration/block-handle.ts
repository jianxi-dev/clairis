/* 块手柄（md-orchestration 1.2，对应 design.md D5/D6 与 spec E-7）。
 *
 * 每个块左侧一个 42×26 药丸：左段是块型图标，右段是拖拽把手；空行退化为单段「+」。
 * hover 由 1.1 的 HoverGate 门控（300ms 显现、150ms 收起，键盘 / 触摸 / 拖拽抑制），
 * 门控只负责切换 `.cm-block-handle-visible`，透明度由 CSS 过渡（D5）。
 * 召唤区收窄到 `.cm-content` 左缘 25%（手柄自身豁免），滑入手柄 60ms 开菜单（D5）。
 *
 * 拖拽：pointerdown 后移动 ≥4px 才算拖动，整块加 `.cm-block-handle-dragging` 高亮；
 * 松手用 `moveBlock` 算出新文档，单次 `dispatch` 整篇替换（选择自动映射，光标不跳）。
 * 纯函数（`blockHandleIcon` / `moveBlock`）不碰 DOM，由单测钉死。
 */
import type { EditorState, Extension } from "@codemirror/state";
import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import {
  getBlocks,
  getBlockAt,
  type Block,
  type BlockType,
} from "../block-model";
import { renderIcon, ADD_ICON_NAME } from "../icons";
import {
  openBlockMenu,
  closeBlockMenu,
  dismissBlockFlyouts,
  isBlockMenuOpen,
  scheduleBlockMenuClose,
  cancelPendingClose,
} from "./block-menu";
import {
  defaultCommands,
  openInsertMenu,
  openSlashMenuAtCursor,
} from "../slash";
import {
  HoverGate,
  SHOW_DELAY_MS,
  HIDE_DELAY_MS,
  type PointerKind,
} from "./hover-gate";
import { classifyMedia, scanImageReference } from "../decorations/image";

// --- 纯函数 ------------------------------------------------------------------

/** 块型 → 手柄图标名（D6 验收锚点）。 */
const BLOCK_ICON_NAME: Record<string, string> = {
  table: "DataSheetOutlined",
  list: "DisorderListOutlined",
  task: "TodoOutlined",
  callout: "CalloutOutlined",
  blockquote: "ReferenceOutlined",
  paragraph: "FormatParagraphOutlined",
  thematicBreak: "DividerOutlined",
  fencedCode: "CodeblockOutlined",
  codeBlock: "CodeblockOutlined",
  image: "ImageOutlined",
};

const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "ogg",
  "oga",
  "m4a",
  "aac",
  "flac",
  "opus",
]);

/** 首行图片引用的扩展名 → 手柄图标名（D13）。 */
function imageMediaIcon(firstLine: string): string {
  const start = firstLine.indexOf("![");
  if (start < 0) return "ImageOutlined";
  const ref = scanImageReference(firstLine, start);
  if (!ref) return "ImageOutlined";
  if (classifyMedia(ref.path) === "video") return "VideoOutlined";
  const ext = ref.path.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(ext) ? "AudioOutlined" : "ImageOutlined";
}

/**
 * 解析块型对应的手柄图标名。
 *
 * `heading` 与 `list` 只说得出大类，具体是哪一级标题、有序还是无序要看首行：
 * 全退化成同一个拖拽把手，用户面前就是一排「文本行图标」（#104）。
 * 图片块再按首行引用的扩展名区分视频 / 音频 / 图片（D13）。
 * 拿不到首行时退化为 `DragHandleOutlined`，不猜。
 */
export function blockHandleIcon(type: string, firstLine = ""): string {
  if (type === "heading") {
    const level = /^(#{1,6})\s/.exec(firstLine)?.[1].length;
    return level ? `H${level}Outlined` : "DragHandleOutlined";
  }
  if (type === "list") {
    return /^\s*\d+\./.test(firstLine)
      ? "OrderListOutlined"
      : "DisorderListOutlined";
  }
  if (type === "image") return imageMediaIcon(firstLine);
  return BLOCK_ICON_NAME[type] ?? "DragHandleOutlined";
}

/** 取块首行文本：标题级别与有序/无序只能从内容判定。 */
function firstLineOf(state: EditorState, from: number, to: number): string {
  const text = state.doc.sliceString(from, Math.min(to, state.doc.length));
  return text.split("\n")[0] ?? "";
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

/** 悬停到手柄后开菜单的意图延迟（design D5：滑入 60ms 出菜单）。 */
const MENU_INTENT_DELAY_MS = 60;

/** 指针离开「+」到菜单收起之间的宽限：够指针跨过缝隙落进菜单，又不显得拖沓。 */
const ADD_MENU_CLOSE_DELAY_MS = 120;

const addMenuCloseTimers = new WeakMap<EditorView, number>();

function cancelAddMenuClose(view: EditorView): void {
  const timer = addMenuCloseTimers.get(view);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    addMenuCloseTimers.delete(view);
  }
}

function scheduleAddMenuClose(view: EditorView): void {
  cancelAddMenuClose(view);
  addMenuCloseTimers.set(
    view,
    window.setTimeout(() => {
      addMenuCloseTimers.delete(view);
      closeBlockMenu(view);
    }, ADD_MENU_CLOSE_DELAY_MS),
  );
}

/** 块手柄召唤区占 `.cm-content` 左缘宽度的比例（design D5：左侧 25%）。 */
export const SUMMON_ZONE_RATIO = 0.25;

/**
 * 指针是否落在 `.cm-content` 左缘 25% 召唤区内。
 *
 * 纯几何判定，便于单测；`rect` 取 `.cm-content` 的边界矩形（含 padding），
 * 与 design D5「左侧 25%」同口径。
 */
export function isInSummonZone(
  clientX: number,
  rect: { left: number; width: number },
): boolean {
  return clientX <= rect.left + rect.width * SUMMON_ZONE_RATIO;
}

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
  pointerId: number;
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
  private indicator: HTMLDivElement | null = null;

  constructor(private readonly view: EditorView) {
    if (
      view.dom.style.position === "static" ||
      view.dom.style.position === ""
    ) {
      view.dom.style.position = "relative";
    }
    view.contentDOM.addEventListener("keydown", this.onKeyDown);
    view.contentDOM.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("keydown", this.onDocumentKeyDown, true);
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
    dismissBlockFlyouts(this.view);
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
    document.removeEventListener("keydown", this.onDocumentKeyDown, true);
    this.view.dom.removeEventListener("pointermove", this.onDomPointerMove);
    this.view.dom.removeEventListener("pointerleave", this.onDomPointerLeave);
    this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
    this.setSummonZone(false);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.clearHandles();
  }

  private setSummonZone(on: boolean): void {
    this.view.contentDOM.classList.toggle("cm-summon-zone", on);
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
    // 菜单打开期间不改召唤对象（D2 不 retarget）：指针在菜单或别的块上滑动时，
    // 不能给「菜单后面的内容」再冒出手柄。
    if (isBlockMenuOpen(this.view) && !overHandle) return;
    // 标题折叠三角与块手柄共用同一召唤区（.cm-content 左缘 25%）。
    const contentRect = this.view.contentDOM.getBoundingClientRect();
    this.setSummonZone(isInSummonZone(event.clientX, contentRect));
    // 补漏：keyup 有时落在编辑器外（菜单抢焦点），抑制标志会永久卡住，
    // 指针一动就解除，手柄不至于「忽然召唤不出来」。
    for (const handle of this.handles) handle.gate.suppress(false);
    let activeFrom: number | null = overHandle
      ? Number(overHandle.dataset.blockFrom)
      : null;
    if (activeFrom === null) {
      // D5：只有 `.cm-content` 左缘 25% 召唤；右侧 75% 移动指针不冒手柄。
      // 不在召唤区时 activeFrom 保持 null，下方 leave 分支会收掉已召唤的手柄。
      if (isInSummonZone(event.clientX, contentRect)) {
        const pos = this.view.posAtCoords({
          x: event.clientX,
          y: event.clientY,
        });
        if (pos !== null) {
          // 空行「+」也要能被召唤：它的范围退化为于点（from === to）。
          const hit = this.handles.find(
            (handle) => pos >= handle.block.from && pos <= handle.block.to,
          );
          if (hit) {
            activeFrom = hit.block.from;
            hit.anchorPos = Math.min(
              Math.max(pos, hit.block.from),
              hit.block.to,
            );
          }
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
    this.setSummonZone(false);
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
    this.removeIndicator();
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
      pointerId: 0,
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
      icon.appendChild(
        renderIcon(
          blockHandleIcon(
            block.type,
            firstLineOf(this.view.state, block.from, block.to),
          ),
        ),
      );
      el.appendChild(icon);

      // 图片块手柄只留图片图标（D18 / A-9.3：手柄内 svg[data-icon] 恰 1 个）。
      // 拖拽监听挂在整块手柄上，去掉右段把手不改变拖块行为。
      if (block.type !== "image") {
        const grip = document.createElement("span");
        grip.className = "cm-block-handle-grip";
        grip.appendChild(renderIcon("DragOutlined"));
        el.appendChild(grip);
      }
    }

    // 滑入即显示（D2 规则 1）＋意图延迟（对齐 md-bundle 的 120ms 缓冲）：
    // 指针停住才开菜单，擦过手柄不再把 236px 面板糊到正文上。
    //
    // 只有块手柄有转换菜单。空行「+」是插入入口，悬停弹转换菜单是错的
    // （#105）——它只在按压时打开插入菜单（见 onAddPointerDown）。
    //
    // 不要求 gate 已开：指针从正文滑入手柄时，gate 可能还在 300ms 显现延迟
    // 里，而 pointerenter 只触发一次；加了 gate 前置条件菜单就永远不会开。
    if (!empty) {
      el.addEventListener("pointerenter", () => {
        if (entry.dragging) return;
        if (entry.menuTimer !== null) window.clearTimeout(entry.menuTimer);
        entry.menuTimer = window.setTimeout(() => {
          entry.menuTimer = null;
          if (entry.dragging) return;
          if (isBlockMenuOpen(this.view)) return;
          openBlockMenu(this.view, block, entry.anchorPos ?? block.from, el);
        }, MENU_INTENT_DELAY_MS);
      });
    } else {
      // 空行「+」滑入即开插入菜单（不必先点一下），锚点取指针位置（#372）。
      el.addEventListener("pointerenter", (event) => {
        if (entry.dragging) return;
        cancelAddMenuClose(this.view);
        if (entry.menuTimer !== null) window.clearTimeout(entry.menuTimer);
        const anchor = {
          left: event.clientX,
          right: event.clientX,
          top: event.clientY,
          bottom: event.clientY,
        };
        entry.menuTimer = window.setTimeout(() => {
          entry.menuTimer = null;
          if (entry.dragging) return;
          if (isBlockMenuOpen(this.view)) return;
          openInsertMenu(
            this.view,
            block.from,
            defaultCommands,
            { from: block.from, to: block.from },
            "below",
            anchor,
          );
          // 菜单是 view.dom 的兄弟节点：指针移进去不能算「离开手柄」。
          this.view.dom
            .querySelector<HTMLElement>(".mdb-slash-menu")
            ?.addEventListener("pointerenter", () =>
              cancelAddMenuClose(this.view),
            );
        }, MENU_INTENT_DELAY_MS);
      });
    }
    el.addEventListener("pointerleave", () => {
      if (entry.menuTimer !== null) {
        window.clearTimeout(entry.menuTimer);
        entry.menuTimer = null;
      }
      if (entry.dragging) return;
      if (empty) {
        scheduleAddMenuClose(this.view);
        return;
      }
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
    // 拖拽开始即清掉悬停门控 / 菜单意图 / 菜单关闭计时器：拖拽中菜单不该再冒出来。
    for (const handle of this.handles) {
      if (handle.timer !== null) {
        clearTimeout(handle.timer);
        handle.timer = null;
      }
      if (handle.menuTimer !== null) {
        clearTimeout(handle.menuTimer);
        handle.menuTimer = null;
      }
    }
    cancelPendingClose(this.view);
    entry.dragging = false;
    entry.pointerId = event.pointerId;
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
    if (entry.dragging) {
      this.updateIndicator(event);
      return;
    }
    const dx = event.clientX - entry.startX;
    const dy = event.clientY - entry.startY;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    entry.dragging = true;
    entry.el.classList.add("cm-block-handle-dragging");
    this.highlightBlock(entry.block, true);
    this.updateIndicator(event);
  }

  private onDragEnd(event: PointerEvent, entry: HandleEntry): void {
    const wasDragging = entry.dragging;
    const cancelled = event.type === "pointercancel";
    this.endDrag(entry);
    if (!wasDragging) {
      // 移动不足阈值：视为点击，开菜单而不是空转。
      if (!isBlockMenuOpen(this.view)) {
        openBlockMenu(
          this.view,
          entry.block,
          entry.anchorPos ?? entry.block.from,
          entry.el,
        );
      }
      return;
    }
    if (cancelled) return;
    const pos = this.posFromEvent(event);
    if (pos === null) return;
    const target = this.computeDropTarget(pos);
    const doc = this.view.state.doc.toString();
    const next = moveBlock(doc, entry.block, { from: target.from });
    if (next === doc) return;
    // 单事务整篇替换：选择随变更自动映射，滚动位置不跳。
    this.view.dispatch({
      changes: { from: 0, to: doc.length, insert: next },
    });
  }

  private endDrag(entry: HandleEntry): void {
    entry.el.removeEventListener("pointermove", entry.onMove);
    entry.el.removeEventListener("pointerup", entry.onUp);
    entry.el.removeEventListener("pointercancel", entry.onUp);
    if (entry.el.hasPointerCapture(entry.pointerId)) {
      try {
        entry.el.releasePointerCapture(entry.pointerId);
      } catch {
        // 忽略：指针已释放。
      }
    }
    entry.dragging = false;
    entry.el.classList.remove("cm-block-handle-dragging");
    this.highlightBlock(entry.block, false);
    entry.gate.suppress(false);
    this.removeIndicator();
  }

  private readonly onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    const entry = this.handles.find((handle) => handle.dragging);
    if (!entry) return;
    event.preventDefault();
    this.endDrag(entry);
  };

  private posFromEvent(event: PointerEvent): number | null {
    try {
      return this.view.posAtCoords({ x: event.clientX, y: event.clientY });
    } catch {
      return null;
    }
  }

  /**
   * 落点：指针在块内 → 插到该块之前；落在块间空隙 / 文档末尾 → 贴前一块下沿；
   * 指针在文档最前 → 贴第一块上沿。与 `moveBlock` 的 `target.from` 同口径。
   */
  private computeDropTarget(pos: number): {
    from: number;
    block: Block | null;
    edge: "top" | "bottom";
  } {
    const blocks = getBlocks(this.view.state);
    const targetBlock = getBlockAt(pos, blocks);
    if (targetBlock) {
      return { from: targetBlock.from, block: targetBlock, edge: "top" };
    }
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].to <= pos) {
        return { from: blocks[i].to, block: blocks[i], edge: "bottom" };
      }
    }
    const first = blocks[0];
    if (first) return { from: first.from, block: first, edge: "top" };
    return { from: pos, block: null, edge: "bottom" };
  }

  // 样式内联：新增 `cm-*` 类会触发 CSS manifest 门禁，本票不改名也不改 CSS。
  private ensureIndicator(): HTMLDivElement {
    if (this.indicator) return this.indicator;
    const el = document.createElement("div");
    el.dataset.testid = "block-insert-indicator";
    el.style.position = "absolute";
    el.style.height = "2px";
    el.style.borderRadius = "1px";
    el.style.background = "var(--app-accent)";
    el.style.zIndex = "40";
    el.style.pointerEvents = "none";
    this.view.dom.appendChild(el);
    this.indicator = el;
    return el;
  }

  private removeIndicator(): void {
    this.indicator?.remove();
    this.indicator = null;
  }

  private showIndicator(block: Block | null, edge: "top" | "bottom"): void {
    if (!block) {
      this.removeIndicator();
      return;
    }
    const base = this.view.dom.getBoundingClientRect();
    const first = this.lineRectAt(block.from);
    const last = this.lineRectAt(block.to);
    if (!first || !last) {
      this.removeIndicator();
      return;
    }
    const el = this.ensureIndicator();
    el.style.left = `${Math.round(first.left - base.left)}px`;
    el.style.width = `${Math.round(first.width)}px`;
    const y = edge === "top" ? first.top : last.bottom;
    el.style.top = `${Math.round(y - base.top)}px`;
  }

  private updateIndicator(event: PointerEvent): void {
    const pos = this.posFromEvent(event);
    if (pos === null) {
      this.removeIndicator();
      return;
    }
    const target = this.computeDropTarget(pos);
    this.showIndicator(target.block, target.edge);
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
