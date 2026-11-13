/* 高亮块卡片装饰（移植自 md-bundle packages/editor/src/decorations/callout.ts）。
 *
 * 解析 Markdown 引用块式高亮块语法（`> [!TYPE][+-] 标题` + 后续 `> ` 行），
 * 渲染成带样式的卡片。颜色/标签来自 `resolveCalloutType`（先去重后的编辑集，
 * 回落到渲染端别名表，让解析别名仍能渲染）。非法类型（`[!FOO]`）回落到普通
 * 引用块显示。
 *
 * 编辑方式（D5/D7：高亮块绝不塌缩成 `> [!TYPE]` 源码）
 * ------------------------------------------------------------------------------
 * 卡片即使在其块活跃时也保持渲染。点正文在卡片内开一个真实 `<textarea>`，
 * 点标题在原位开一个真实 `<input>`（表单控件永不进 CM6 的可编辑内容，不触发
 * 它的 DOM 变更观察，且自带原生焦点、光标、IME 与撤销）。CM6 在 mousedown
 * 捕获期重建 widget DOM，所以编辑器在下一帧对着实时卡片打开。
 *
 * 输入的文本暂存在 per-view 表里（widget 重建也不丢），编辑落定时用一个事务
 * 写回。标题与正文编辑合并到同一张卡片的草稿，落定一个不会覆盖另一个。flush
 * 绝不在 CM6 update 内派发——会的话延到下一 tick。
 */
import { Decoration, WidgetType, type EditorView } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import { resolveCalloutType } from "../callout-types";
import {
  getCalloutEmojiOverride,
  openCalloutEmojiPicker,
} from "./callout-emoji";
import { getCalloutSlashCommands } from "./callout-insert";
import { createContentLineElement } from "./list";
import { renderIcon } from "../icons";
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

// --- 暂存 + flush -------------------------------------------------------------

/**
 * 暂存的高亮块编辑，按 view 再按序号存。只有用户改过的字段才存在，所以未编辑
 * 的标题/正文在 flush 时保持解析值。
 */
interface CalloutDraft {
  content?: string;
  title?: string;
}

const dirtyCallouts = new WeakMap<EditorView, Map<number, CalloutDraft>>();

const flushScheduled = new WeakSet<EditorView>();
const flushingViews = new WeakSet<EditorView>();
const externalFlushWired = new WeakSet<EditorView>();

/**
 * 把 flush 排到下一个宏任务。
 *
 * CM6 正在 update 时派发是非法的——而 widget/plugin 的拆除钩子正好在那里运行，
 * 所以延后 flush 是从那些路径保住暂存文本的唯一办法，而不是被吞掉的错误丢掉。
 */
export function scheduleCalloutFlush(view: EditorView): void {
  if (flushScheduled.has(view)) return;
  flushScheduled.add(view);
  setTimeout(() => {
    flushScheduled.delete(view);
    flushCalloutEdits(view);
  }, 0);
}

function markCalloutDirty(
  view: EditorView,
  index: number,
  patch: CalloutDraft,
): void {
  let pending = dirtyCallouts.get(view);
  if (!pending) {
    pending = new Map<number, CalloutDraft>();
    dirtyCallouts.set(view, pending);
  }
  // 合并：同一张卡片的标题与正文可能在同一次 flush 前都暂存了，不能互相覆盖。
  pending.set(index, { ...pending.get(index), ...patch });
}

function clearCalloutDirty(view: EditorView, index: number): void {
  dirtyCallouts.get(view)?.delete(index);
}

/** 用源码块 + 暂存编辑重建高亮块的 Markdown。 */
function buildCalloutMarkdown(
  block: CalloutBlock,
  draft: CalloutDraft,
): string {
  // 草稿里没有的字段保持解析值；有的字段——即使是空——优先，所以清空标题会
  // 回到只有徽标的头部。
  const title = (draft.title ?? block.title).trim();
  const content = draft.content ?? block.content;
  const head = `> [!${block.type.toUpperCase()}]${block.fold}${title ? ` ${title}` : ""}`;
  const lines =
    content === ""
      ? []
      : content.split("\n").map((line) => (line ? `> ${line}` : ">"));
  return [head, ...lines].join("\n");
}

/** 用一个事务把每个暂存高亮块写回文档。 */
export function flushCalloutEdits(view: EditorView): boolean {
  const pending = dirtyCallouts.get(view);
  if (!pending || pending.size === 0 || flushingViews.has(view)) return false;

  const docText = view.state.doc.toString();
  const blocks = findCalloutBlocks(docText);
  const changes: { from: number; to: number; insert: string }[] = [];
  for (const [index, draft] of pending) {
    const block = blocks[index];
    if (!block) continue;
    const insert = buildCalloutMarkdown(block, draft);
    if (insert === docText.slice(block.from, block.to)) continue;
    changes.push({ from: block.from, to: block.to, insert });
  }

  if (changes.length === 0) {
    pending.clear();
    return false;
  }

  changes.sort((a, b) => a.from - b.from);
  flushingViews.add(view);
  try {
    view.dispatch({ changes });
  } catch {
    // 只在更新周期内可达：保留暂存文本，等 CM6 空闲后由延后的 flush 重试。
    scheduleCalloutFlush(view);
    return false;
  } finally {
    flushingViews.delete(view);
  }
  pending.clear();
  return true;
}

// --- 正文斜杠菜单（#743） -----------------------------------------------------

/**
 * 高亮块正文菜单命令集：全局命令 + 高亮片段（A-4.4）。
 *
 * #743 评审：片段表与全局命令有 7 组同名标签（标题/任务/引用/分割线/表格/
 * 分栏/标注）。全局命令更丰富（grid/子菜单）且同样走 context 写回，优先保留；
 * 片段只在没有同名全局命令时补入，避免菜单出现双份。
 */
function getCalloutCommands(): SlashCommand[] {
  const global = getSlashCommands();
  const labels = new Set(global.map((cmd) => cmd.label));
  const snippets = getCalloutSlashCommands().filter(
    (cmd) => !labels.has(cmd.label),
  );
  return [...global, ...snippets];
}

/** 一个就地编辑器的斜杠菜单状态与宿主回调（按 textarea 存放）。 */
interface CalloutMenuEntry {
  mode: "slash" | "handle" | null;
  slashPos: number;
  close: () => void;
  cancel: () => void;
  write: (text: string) => void;
}

const calloutMenus = new WeakMap<HTMLTextAreaElement, CalloutMenuEntry>();
const calloutMenuOpeners = new WeakMap<HTMLElement, () => void>();

/** 光标前最后一个 `/` 的下标 + 1（查询锚点）；没有 `/` 时退回光标位。 */
function slashAnchor(area: HTMLTextAreaElement): number {
  const caret = area.selectionStart ?? area.value.length;
  const idx = area.value.lastIndexOf("/", caret);
  return idx >= 0 ? idx + 1 : caret;
}

/**
 * 打开高亮块正文的统一斜杠菜单（#743）。
 *
 * 与分栏（#742）同构：`slashMode` 为 true 时是查询模式（`/` 保留在 textarea 内
 * 作查询锚点，选中替换 `[slashPos - 1, caret]`，取消回滚 `/query`）；为 false 时是
 * 「+」手柄的非查询模式（无 `/`，选中在光标处零宽插入，取消无副作用）。两种模式都
 * 只写回 textarea，落文档仍由 blur/离开卡片的 commit 路径完成。
 */
export function openCalloutContextMenu(
  view: EditorView,
  area: HTMLTextAreaElement,
  commands: SlashCommand[],
  slashMode: boolean,
): void {
  const entry = calloutMenus.get(area);
  if (!entry) return;
  entry.mode = slashMode ? "slash" : "handle";
  entry.slashPos = slashMode ? slashAnchor(area) : -1;
  const rect = area.getBoundingClientRect();
  openContextMenu(view, commands, {
    anchorRect: () => {
      const r = area.isConnected ? area.getBoundingClientRect() : rect;
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    },
    applyText: entry.write,
    cancel: entry.cancel,
  });
}

/** 内容区（正文或就地编辑器）的屏幕矩形，供「+」手柄定位。 */
function calloutContentArea(container: HTMLElement): {
  left: number;
  top: number;
  height: number;
} {
  const editorEl = container.querySelector<HTMLElement>(".cm-callout-editor");
  const contentEl = container.querySelector<HTMLElement>(".cm-callout-content");
  const anchor = editorEl ?? contentEl;
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) {
      return { left: r.left, top: r.top, height: r.height };
    }
  }
  // 空正文且未在编辑：锚在头部下方、卡片内容 box 的左缘。
  const containerRect = container.getBoundingClientRect();
  const headerEl = container.querySelector<HTMLElement>(".cm-callout-header");
  const style = window.getComputedStyle(container);
  const padLeft = Number.parseFloat(style.paddingLeft) || 0;
  const padBottom = Number.parseFloat(style.paddingBottom) || 0;
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
  const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
  const headerBottom = headerEl
    ? headerEl.getBoundingClientRect().bottom
    : containerRect.top;
  return {
    left: containerRect.left + borderLeft + padLeft,
    top: headerBottom,
    height: Math.max(
      0,
      containerRect.bottom - borderBottom - padBottom - headerBottom,
    ),
  };
}

/**
 * 打开高亮块卡片的正文行内编辑器。CM6 可能在上次点击后重建了 widget，所以按
 * 序号从实时 DOM 解析。
 */
function openCalloutEditor(
  view: EditorView,
  index: number,
  press?: { x: number; y: number },
  openHandleMenu = false,
): void {
  // 先落定任何打开的高亮块，且要在解析 DOM 之前：flush 派发可能重建本 widget，
  // 那样会摘掉更早解析出的卡片。
  flushCalloutEdits(view);

  const card = view.dom.querySelectorAll(".cm-callout")[index];
  if (!(card instanceof HTMLElement)) return;
  const existing = card.querySelector(
    ".cm-callout-editor",
  ) as HTMLTextAreaElement | null;
  if (existing) {
    existing.focus();
    if (openHandleMenu) calloutMenuOpeners.get(card)?.();
    return;
  }

  const block = findCalloutBlocks(view.state.doc.toString())[index];
  if (!block) return;

  const contentEl = card.querySelector<HTMLElement>(".cm-callout-content");
  const editor = document.createElement("textarea");
  editor.className = "cm-callout-editor";
  editor.setAttribute("data-testid", "cm-callout-editor");
  editor.rows = 1;
  editor.value = block.content;
  contentEl?.setAttribute("hidden", "");
  card.appendChild(editor);
  autoGrow(editor);
  editor.focus();
  // 把光标放到用户按下的位置（textarea 无法自己映射一个点，所以用镜像节点测量），
  // 失败则落到末尾（#496）。
  const offset = press ? caretOffsetAt(editor, press.x, press.y) : null;
  const caret = offset ?? editor.value.length;
  editor.setSelectionRange(caret, caret);

  let composing = false;
  // #743：正文 `/` 与「+」手柄都走统一斜杠菜单（独立片段菜单已退役）。
  const entry: CalloutMenuEntry = {
    mode: null,
    slashPos: -1,
    close: (): void => {
      entry.mode = null;
      entry.slashPos = -1;
      releaseInsertMenu(view, "context");
    },
    cancel: (): void => {
      if (entry.mode === "slash" && entry.slashPos >= 0 && editor.isConnected) {
        const end = Math.max(
          entry.slashPos,
          editor.selectionStart ?? editor.value.length,
        );
        editor.value =
          editor.value.slice(0, entry.slashPos - 1) + editor.value.slice(end);
        editor.setSelectionRange(entry.slashPos - 1, entry.slashPos - 1);
        // 程序化改值要同步暂存，否则外点 flush 会把回滚前的 `/query` 写进文档。
        markCalloutDirty(view, index, { content: editor.value });
      }
      entry.close();
    },
    write: (text: string): void => {
      if (!editor.isConnected) {
        entry.close();
        return;
      }
      if (entry.mode === "slash" && entry.slashPos >= 0) {
        const end = Math.max(
          entry.slashPos,
          editor.selectionStart ?? editor.value.length,
        );
        editor.value =
          editor.value.slice(0, entry.slashPos - 1) +
          text +
          editor.value.slice(end);
        const next = entry.slashPos - 1 + text.length;
        editor.setSelectionRange(next, next);
      } else {
        const at = editor.selectionStart ?? editor.value.length;
        editor.value =
          editor.value.slice(0, at) + text + editor.value.slice(at);
        const next = at + text.length;
        editor.setSelectionRange(next, next);
      }
      // 同 cancel：程序化写回要同步暂存，外点 flush 才不会写旧值。
      markCalloutDirty(view, index, { content: editor.value });
      entry.close();
    },
  };
  calloutMenus.set(editor, entry);
  calloutMenuOpeners.set(card, () => {
    openCalloutContextMenu(view, editor, getCalloutCommands(), false);
  });

  const teardown = (): void => {
    calloutMenus.delete(editor);
    calloutMenuOpeners.delete(card);
    editor.remove();
    contentEl?.removeAttribute("hidden");
  };
  const commit = (): void => {
    if (!editor.isConnected) return;
    markCalloutDirty(view, index, { content: editor.value });
    flushCalloutEdits(view);
    teardown();
  };

  editor.addEventListener("input", () => {
    autoGrow(editor);
    if (composing) {
      markCalloutDirty(view, index, { content: editor.value });
      return;
    }
    if (entry.mode === "slash") {
      // 查询模式（#743 评审）：不暂存 "/query"——否则菜单开着时外部 mousedown
      // 的 flush 会把它写进文档（瞬态脏值）。回滚/写回时 cancel/write 会显式
      // 暂存最终文本。
      // 触发符被删 = 查询锚点失效，直接关菜单（无残留可回滚）。
      if (entry.slashPos < 0 || editor.value[entry.slashPos - 1] !== "/") {
        entry.close();
        return;
      }
      // 光标退到触发符之前也算放弃查询。
      const at = editor.selectionStart ?? editor.value.length;
      if (at < entry.slashPos) {
        entry.close();
        return;
      }
      updateSlashMenuQuery(view, editor.value.slice(entry.slashPos, at));
      return;
    }
    markCalloutDirty(view, index, { content: editor.value });
    if (entry.mode === "handle") return;
    // 末尾 `/` 就地打开查询菜单。
    if (!editor.value.endsWith("/")) return;
    openCalloutContextMenu(view, editor, getCalloutCommands(), true);
  });
  editor.addEventListener("compositionstart", () => {
    composing = true;
  });
  editor.addEventListener("compositionend", () => {
    composing = false;
    markCalloutDirty(view, index, { content: editor.value });
  });
  editor.addEventListener("keydown", (event) => {
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
      clearCalloutDirty(view, index);
      teardown();
    }
  });
  editor.addEventListener("blur", () => {
    if (composing) return;
    // 菜单还开着就失焦（Alt-Tab 等）：先取消回滚，绝不让 `/query` 进文档。
    if (entry.mode !== null && isSlashMenuOpen(view)) slashMenuClose(view);
    commit();
  });
  editor.addEventListener("mousedown", (event) => event.stopPropagation());
  // #468：空正文不能残留成一行游离的 `>`。离开卡片即落定，空提交会整段删掉正文
  // （buildCalloutMarkdown 对空内容不产出行）。
  card.addEventListener("mouseleave", () => {
    if (composing || !editor.isConnected) return;
    if (editor.value.trim() === "") commit();
  });

  if (openHandleMenu) {
    openCalloutContextMenu(view, editor, getCalloutCommands(), false);
  }
}

/**
 * 视图点在一个 textarea 下的字符偏移。textarea 没有命中测试 API，所以把值重新
 * 渲染进一个离屏镜像（复制计算后的文本样式、正好坐在 textarea 处），浏览器
 * 的 caret API 再报出该文本节点内的偏移（#496）。
 */
function caretOffsetAt(
  editor: HTMLTextAreaElement,
  clientX: number,
  clientY: number,
): number | null {
  const doc = editor.ownerDocument;
  const caretFromPoint =
    typeof doc.caretRangeFromPoint === "function"
      ? (x: number, y: number): number | null => {
          const range = doc.caretRangeFromPoint(x, y);
          if (!range) return null;
          if (!editor.contains(range.startContainer)) return range.startOffset;
          return range.startOffset;
        }
      : null;
  if (!caretFromPoint) return null;

  const computed = doc.defaultView?.getComputedStyle(editor);
  const rect = editor.getBoundingClientRect();
  if (!computed || rect.width === 0) return null;

  const mirror = doc.createElement("div");
  mirror.textContent = editor.value;
  mirror.setAttribute("aria-hidden", "true");
  mirror.style.position = "fixed";
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  mirror.style.width = `${rect.width}px`;
  mirror.style.height = "auto";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = computed.whiteSpace;
  mirror.style.wordBreak = computed.wordBreak;
  mirror.style.overflowWrap = computed.overflowWrap;
  mirror.style.font = computed.font;
  mirror.style.fontFamily = computed.fontFamily;
  mirror.style.fontSize = computed.fontSize;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.padding = computed.padding;
  mirror.style.border = computed.border;
  mirror.style.boxSizing = computed.boxSizing;
  mirror.style.textAlign = computed.textAlign;
  doc.body.appendChild(mirror);

  try {
    const offset = caretFromPoint(clientX, clientY);
    if (offset === null) return null;
    return Math.max(0, Math.min(offset, editor.value.length));
  } finally {
    mirror.remove();
  }
}

/** 让 textarea 高度贴合内容，卡片增长而不是滚动。 */
function autoGrow(editor: HTMLTextAreaElement): void {
  editor.style.height = "auto";
  editor.style.height = `${editor.scrollHeight}px`;
}

/**
 * 打开高亮块卡片的标题行内编辑器。与正文编辑器同构：真实 `<input>` 替换标题
 * span，暂存走同一张 per-view 表，标题与正文在同一个事务里落定。CM6 可能在上次
 * 点击后重建了 widget，所以按序号从实时 DOM 解析。
 */
function openCalloutTitleEditor(view: EditorView, index: number): void {
  // 先落定任何打开的高亮块，且要在解析 DOM 之前：flush 派发可能重建本 widget，
  // 那样会摘掉更早解析出的卡片。
  flushCalloutEdits(view);

  const card = view.dom.querySelectorAll(".cm-callout")[index];
  if (!(card instanceof HTMLElement)) return;
  const existing = card.querySelector(
    ".cm-callout-title-editor",
  ) as HTMLInputElement | null;
  if (existing) {
    existing.focus();
    existing.select();
    return;
  }

  const block = findCalloutBlocks(view.state.doc.toString())[index];
  if (!block) return;
  const titleEl = card.querySelector<HTMLElement>(".cm-callout-title");
  if (!titleEl) return;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "cm-callout-title-editor";
  input.setAttribute("data-testid", "cm-callout-title-editor");
  input.value = block.title;
  titleEl.setAttribute("hidden", "");
  // 兄弟节点而非子节点：卡片的 mousedown 路由用 `closest('.cm-callout-title')`
  // 命中标题，嵌套 input 会让它继续命中。
  titleEl.after(input);
  input.focus();
  input.select();

  let composing = false;
  const teardown = (): void => {
    input.remove();
    titleEl.removeAttribute("hidden");
  };
  const commit = (): void => {
    if (!input.isConnected) return;
    markCalloutDirty(view, index, { title: input.value });
    flushCalloutEdits(view);
    teardown();
  };

  input.addEventListener("input", () =>
    markCalloutDirty(view, index, { title: input.value }),
  );
  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    markCalloutDirty(view, index, { title: input.value });
  });
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      clearCalloutDirty(view, index);
      teardown();
    }
  });
  input.addEventListener("blur", () => {
    if (!composing) commit();
  });
  input.addEventListener("mousedown", (event) => event.stopPropagation());
}

/**
 * 指针按在所有卡片之外时落定暂存高亮块。捕获阶段，这样即使某个卡片的监听
 * 阻止了冒泡也照样触发。
 */
function wireExternalFlush(view: EditorView): void {
  if (externalFlushWired.has(view)) return;
  externalFlushWired.add(view);
  view.dom.addEventListener(
    "mousedown",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(".cm-callout")) return;
      flushCalloutEdits(view);
    },
    true,
  );
}

// --- Callout widget -----------------------------------------------------------

class CalloutWidget extends WidgetType {
  private view: EditorView | null = null;

  constructor(
    readonly index: number,
    readonly type: string,
    readonly label: string,
    readonly tone: string,
    readonly icon: string,
    readonly title: string,
    readonly content: string,
    readonly fold: "+" | "-" | "",
  ) {
    super();
  }

  toDOM(view?: EditorView): HTMLElement {
    this.view = view ?? null;
    const container = document.createElement("div");
    container.className = "cm-callout";
    container.classList.add(`cm-callout-tone-${this.tone}`);
    if (this.fold) container.setAttribute("data-fold", this.fold);
    const emoji =
      (view
        ? getCalloutEmojiOverride(view, this.index, this.type)
        : undefined) ?? this.icon;
    container.setAttribute("data-callout-emoji", emoji);
    // #468：徽标已移除，卡片改为用 data 携带类型。
    container.setAttribute("data-callout-type", this.type);
    container.setAttribute("aria-label", this.label);

    if (view) {
      wireExternalFlush(view);
      const index = this.index;
      const defaultEmoji = this.icon;
      // 卡片替换了整个块，所以它自己接管指针事件。下一帧打开行内编辑器：CM6
      // 在 mousedown 捕获期重建本 widget，会摘掉事件目标。按在头部 emoji 上
      // 打开取色器，而不是文本编辑器。
      container.addEventListener("mousedown", (event) => {
        // 正文编辑器打开后，按在它内部必须保留浏览器原生光标落点——取消并重
        // 聚焦会把光标重置到值开头（#496）。
        if (
          event.target instanceof Element &&
          event.target.closest(".cm-callout-editor") !== null
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const onEmoji =
          event.target instanceof Element &&
          event.target.closest(".cm-callout-icon") !== null;
        const onHeader =
          event.target instanceof Element &&
          event.target.closest(".cm-callout-header") !== null;
        const onTitle =
          (event.target instanceof Element &&
            event.target.closest(".cm-callout-title") !== null) ||
          (onHeader && !this.title);
        const press = { x: event.clientX, y: event.clientY };
        const open = (): void => {
          if (onEmoji) {
            flushCalloutEdits(view);
            openCalloutEmojiPicker(view, index, defaultEmoji, this.type);
          } else if (onTitle) {
            openCalloutTitleEditor(view, index);
          } else {
            openCalloutEditor(view, index, press);
          }
        };
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(open);
        } else {
          open();
        }
      });
    }

    const header = document.createElement("div");
    header.className = "cm-callout-header";

    const iconEl = document.createElement("span");
    iconEl.className = "cm-callout-icon";
    iconEl.setAttribute("data-testid", "cm-callout-emoji-btn");
    iconEl.setAttribute("data-callout-emoji", emoji);
    iconEl.setAttribute("role", "button");
    iconEl.setAttribute("tabindex", "0");
    iconEl.setAttribute("aria-label", "更改 emoji");
    iconEl.title = "更改 emoji";
    iconEl.textContent = emoji;
    if (view) {
      const index = this.index;
      const defaultEmoji = this.icon;
      // 与鼠标路径的键盘等价；焦点留在（重建后的）卡片上。
      iconEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        flushCalloutEdits(view);
        openCalloutEmojiPicker(view, index, defaultEmoji, this.type);
      });
    }
    header.appendChild(iconEl);

    // #468：头部只显示前置 emoji。类型徽标与「添加标题」占位是用户要求移除的
    // 重复装饰；标题槽仍是空的（可点）元素，让标题保持可达（#451）且不印任何文字。
    const titleEl = document.createElement("span");
    titleEl.className = "cm-callout-title";
    if (this.title) titleEl.textContent = this.title;
    if (!this.title) titleEl.setAttribute("data-callout-empty-title", "true");
    header.appendChild(titleEl);

    container.appendChild(header);

    if (this.content) {
      const contentEl = document.createElement("div");
      contentEl.className = "cm-callout-content";
      // 逐行渲染而不是一个文本节点：widget 不能带 CM6 装饰，所以列表行在这里
      // 带上编辑器的列表类，保证卡片内 WYSIWYG（#382）。
      for (const line of this.content.split("\n")) {
        contentEl.appendChild(createContentLineElement(line));
      }
      container.appendChild(contentEl);
    }

    container.appendChild(this.buildAddHandle(view, container));
    return container;
  }

  eq(other: CalloutWidget): boolean {
    return (
      this.index === other.index &&
      this.type === other.type &&
      this.label === other.label &&
      this.tone === other.tone &&
      this.icon === other.icon &&
      this.title === other.title &&
      this.content === other.content &&
      this.fold === other.fold
    );
  }

  get estimatedHeight(): number {
    return 60;
  }

  /**
   * 内容区「+」新增手柄（#743 / A-4.5）：贴内容区左缘外侧、纵向居中，与分栏手柄
   * 同款形态（16×16、圆角 3px）。悬停卡片才显示；点击打开正文编辑器并以非查询
   * 模式打开菜单。
   */
  private buildAddHandle(
    view: EditorView | undefined,
    container: HTMLElement,
  ): HTMLElement {
    const handle = document.createElement("div");
    handle.className = "cm-callout-add-handle";
    handle.setAttribute("data-testid", "cm-callout-add-handle");
    handle.title = "新增内容";
    handle.replaceChildren(renderIcon("AddOutlined"));
    if (!view) return handle;

    const position = (): void => {
      const area = calloutContentArea(container);
      const containerRect = container.getBoundingClientRect();
      const style = window.getComputedStyle(container);
      const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
      const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
      handle.style.left = `${
        area.left - containerRect.left - borderLeft - 16
      }px`;
      handle.style.top = `${
        area.top - containerRect.top - borderTop + area.height / 2
      }px`;
    };
    container.addEventListener("mouseenter", position, { passive: true });
    container.addEventListener("mousemove", position, { passive: true });
    handle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const opener = calloutMenuOpeners.get(container);
      if (opener) {
        opener();
        return;
      }
      openCalloutEditor(view, this.index, undefined, true);
    });
    return handle;
  }

  /**
   * widget 消失（高亮块被删、模式切换拆除视图）时丢掉它拥有的上下文菜单，避免
   * 孤儿面板浮在别的视图上。
   */
  destroy(): void {
    if (!this.view) return;
    releaseInsertMenu(this.view, "context");
  }
}

// --- Callout 解析 -------------------------------------------------------------

/**
 * 匹配高亮块首行的正则：`> [!TYPE][+-] 可选标题`。
 * 捕获：(1) 类型（大小写不敏感）、(2) 折叠指示（+/-/空）、(3) 可选标题。
 */
const CALLOUT_OPEN_RE = /^>\s*\[!([A-Za-z]+)\]([+-]?)\s*(.*)$/;

/** 匹配续行：`> 可选内容`。 */
const CALLOUT_LINE_RE = /^>\s?(.*)$/;

interface CalloutBlock {
  from: number;
  to: number;
  type: string;
  title: string;
  content: string;
  fold: "+" | "-" | "";
}

function findCalloutBlocks(docText: string): CalloutBlock[] {
  const blocks: CalloutBlock[] = [];
  const lines = docText.split("\n");

  let i = 0;
  while (i < lines.length) {
    const openMatch = CALLOUT_OPEN_RE.exec(lines[i]);
    if (openMatch) {
      const type = openMatch[1].toLowerCase();
      const fold = (openMatch[2] as "+" | "-") || "";
      const title = openMatch[3].trim();

      const typeInfo = resolveCalloutType(type);
      if (!typeInfo) {
        i++;
        continue;
      }

      let from = 0;
      for (let j = 0; j < i; j++) {
        from += lines[j].length + 1;
      }

      const contentLines: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const lineMatch = CALLOUT_LINE_RE.exec(lines[j]);
        if (lineMatch) {
          if (lines[j].startsWith(">")) {
            // 检查这行是不是新的高亮块首行——是就停止收集当前块。防止相邻
            // 高亮块被合并。
            if (CALLOUT_OPEN_RE.test(lines[j])) {
              break;
            }
            contentLines.push(lineMatch[1]);
            j++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      let to = from;
      for (let k = i; k < j; k++) {
        to += lines[k].length;
        if (k < j - 1) to += 1;
      }

      blocks.push({
        from,
        to,
        type,
        title,
        content: contentLines.join("\n"),
        fold,
      });

      i = j;
    } else {
      i++;
    }
  }

  return blocks;
}

// --- 公共 API -----------------------------------------------------------------

/**
 * 为给定文档文本生成高亮块装饰。即使块活跃，卡片也保持渲染——高亮块绝不塌缩成
 * `> [!TYPE]` 源码（D5/D7）；编辑发生在卡片内联。
 */
export function createCalloutDecorations(
  docText: string,
  _activeFrom: number = -1,
  _activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  findCalloutBlocks(docText).forEach((block, index) => {
    const typeInfo = resolveCalloutType(block.type);
    if (!typeInfo) return;

    decorations.push(
      Decoration.replace({
        widget: new CalloutWidget(
          index,
          block.type,
          typeInfo.label,
          typeInfo.tone,
          typeInfo.icon,
          block.title,
          block.content,
          block.fold,
        ),
        inclusive: true,
      }).range(block.from, block.to),
    );
  });

  return decorations;
}
