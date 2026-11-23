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
import {
  Transaction,
  type EditorState,
  type Extension,
  type Text,
} from "@codemirror/state";
import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import {
  getBlocks,
  getBlockAt,
  getNestedBlocks,
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
  addHandleCommands,
  openInsertMenu,
  openSlashMenuAtCursor,
} from "../slash";
import {
  HoverGate,
  SHOW_DELAY_MS,
  HIDE_DELAY_MS,
  type PointerKind,
} from "./hover-gate";
import { menuStack } from "./menu-stack";
import { classifyMedia, scanImageReference } from "../decorations/image";
import { parseMermaidBlocks } from "../decorations/mermaid";

// --- 纯函数 ------------------------------------------------------------------

/** 块型 → 手柄图标名（D6 验收锚点）。 */
const BLOCK_ICON_NAME: Record<string, string> = {
  table: "TableGridOutlined",
  list: "DisorderListOutlined",
  task: "TodoOutlined",
  callout: "CalloutOutlined",
  blockquote: "FormatQuoteOutlined",
  paragraph: "FormatParagraphOutlined",
  thematicBreak: "DividerOutlined",
  fencedCode: "CodeblockOutlined",
  codeBlock: "CodeblockOutlined",
  image: "ImageOutlined",
  htmlBlock: "CodeOutlined",
  yamlFrontMatter: "HeaderRowOutlined",
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

/** 手柄形态：块级 / 行级 / 空行「+」/ 文末「+」。 */
export type HandleKind = "block" | "line" | "empty" | "trailing";

/** 对账键的输入：块型 + 块首行文本（图标由首行解析）。 */
export interface HandleKeyEntry {
  readonly type: string;
  readonly firstLine: string;
  readonly kind?: HandleKind;
  /** 行手柄：文档行号。纯内容变更时稳定，不触发重建。 */
  readonly lineNumber?: number;
}

/** 对账键：顶层块序号 + 块型 + 解析出的图标名（行手柄再附行号）。 */
export function handleKey(
  index: number,
  type: string,
  icon: string,
  lineNumber?: number,
): string {
  return lineNumber === undefined
    ? `${index}:${type}:${icon}`
    : `${index}:${type}:${icon}:line:${lineNumber}`;
}

/** 按手柄枚举顺序计算对账键；纯函数，与 DOM 无关。 */
export function handleKeysFor(entries: readonly HandleKeyEntry[]): string[] {
  return entries.map((entry, index) =>
    entry.kind === "trailing"
      ? handleKey(index, "trailing", ADD_ICON_NAME)
      : handleKey(
          index,
          entry.type,
          blockHandleIcon(entry.type, entry.firstLine),
          entry.lineNumber,
        ),
  );
}

/**
 * 文末「+」入口的去重判定：文档最后一行非空（非空且不以换行结尾）才追加。
 *
 * 末尾空行已由空行「+」手柄覆盖，此时不重复出入口；纯输入不改变判定。
 */
export function shouldShowTrailingAdd(docText: string): boolean {
  return docText.length > 0 && !docText.endsWith("\n");
}

/** 文末插入空段的事务：在末尾补一个空段（`"\n\n"`），光标落进新空段。 */
export function trailingAddChanges(docText: string): {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
  readonly cursor: number;
} {
  return {
    from: docText.length,
    to: docText.length,
    insert: "\n\n",
    cursor: docText.length + 2,
  };
}

/**
 * 首个需要重建的手柄下标；键逐位一致且数量相同（纯内容输入）时返回 -1。
 *
 * 命中差异后，即使其后的键相同也一并重建：插入 / 删除会让其后序号位移，
 * 重建是正确上界，避免漏换 DOM 标识。
 */
export function firstRebuildIndex(
  prev: readonly string[],
  next: readonly string[],
): number {
  const shared = Math.min(prev.length, next.length);
  for (let i = 0; i < shared; i += 1) {
    if (prev[i] !== next[i]) return i;
  }
  return prev.length === next.length ? -1 : shared;
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

function leadingNewlines(text: string): number {
  return /^\n+/.exec(text)?.[0].length ?? 0;
}

function trailingNewlines(text: string): number {
  return /\n+$/.exec(text)?.[0].length ?? 0;
}

/**
 * 把 `doc.slice(block.from, block.to)` 移动到 `target.from` 之前。
 *
 * - 目标落在被移动块内（含块首）时返回原文，不产生事务。
 * - 块为空 / 文档为空时返回原文。
 * - 只规范化被移动块自身与两侧接缝：未移动块之间的多空行、块尾空格、
 *   文末换行等其余字节逐字保留，不再整段 `trimNewlines` + `join("\n\n")`。
 * - 行分隔符按 `\n` 处理（与编辑器一致）；CRLF 规范化不在本票范围。
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

  const body = trimNewlines(doc.slice(from, to));
  if (body.length === 0) return doc;

  // 移除被移动块：优先带走它后面的分隔换行；块在文末时带走前面的。
  const prefix = doc.slice(0, from);
  const suffix = doc.slice(to);
  const suffixNewlines = leadingNewlines(suffix);
  const prefixNewlines = suffixNewlines > 0 ? 0 : trailingNewlines(prefix);
  const rest =
    suffixNewlines > 0
      ? prefix + suffix.slice(suffixNewlines)
      : prefix.slice(0, prefix.length - prefixNewlines) + suffix;

  // 目标偏移映射进 rest：落在被移除区间内的目标贴到接缝。
  const regionStart = from - prefixNewlines;
  const regionEnd = to + suffixNewlines;
  const removedLen = regionEnd - regionStart;
  let shifted: number;
  if (target.from < regionStart) shifted = target.from;
  else if (target.from >= regionEnd) shifted = target.from - removedLen;
  else shifted = regionStart;
  const insertAt = Math.max(0, Math.min(shifted, rest.length));

  // 插入点只规整接缝：去掉 insertAt 两侧的换行串，用单个空行相接。
  const before = rest.slice(0, insertAt).replace(/\n+$/, "");
  const after = rest.slice(insertAt).replace(/^\n+/, "");
  // 移到文末时，文档原有的末尾换行串挪到被移动块之后，不吞掉。
  const atEnd = insertAt >= rest.length;
  const tail = atEnd ? (/\n+$/.exec(rest)?.[0] ?? "") : "";
  const parts: string[] = [];
  if (before.length > 0) parts.push(before);
  parts.push(body);
  if (after.length > 0) parts.push(after);
  return parts.join("\n\n") + tail;
}

// --- ViewPlugin --------------------------------------------------------------

/** 手柄宽度（px）；用于把药丸摆在块左侧。 */
const HANDLE_WIDTH_PX = 42;
/** 手柄高度（px），与 editor.css 的 `.cm-block-handle` 一致。 */
const HANDLE_HEIGHT_PX = 26;
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
  /** mermaid 围栏块：手柄锚定到块装饰的屏幕矩形，菜单贴手柄而非整块。 */
  mermaid?: boolean;
}

/** 文本行块：按文档行拆成行手柄（D1）。 */
const TEXT_LINE_TYPES = new Set([
  "paragraph",
  "heading",
  "list",
  "task",
  "blockquote",
]);

function isTextLineType(type: string): boolean {
  return TEXT_LINE_TYPES.has(type);
}

/** 枚举 [from, to) 内的文档行；CM6 一行一个 `.cm-line` 元素。 */
function docLinesInRange(
  doc: Text,
  from: number,
  to: number,
): Array<{ from: number; to: number; number: number }> {
  const lines: Array<{ from: number; to: number; number: number }> = [];
  let pos = Math.max(0, from);
  const end = Math.min(to, doc.length);
  while (pos < end) {
    const line = doc.lineAt(pos);
    lines.push({ from: line.from, to: line.to, number: line.number });
    pos = line.to + 1;
  }
  return lines;
}

function isLineCovered(
  line: { from: number; to: number },
  ranges: readonly BlockRange[],
): boolean {
  return ranges.some((range) => line.from < range.to && line.to > range.from);
}

interface HandleSpec {
  block: BlockRange;
  empty: boolean;
  kind: HandleKind;
  lineFrom?: number;
  lineTo?: number;
  lineNumber?: number;
}

/** 行盒是否落在滚动视口内（高度为 0 或完全在视口外都算不可见）。 */
function isRectInViewport(rect: DOMRect, viewport: DOMRect): boolean {
  return (
    rect.height > 0 && rect.bottom > viewport.top && rect.top < viewport.bottom
  );
}

/**
 * 枚举全部手柄（顶层块 → 容器嵌套块 → 独立 mermaid 围栏 → 空行「+」）。
 *
 * 文本行块按文档行拆成行手柄（D1）；非文本行块保留块级手柄。
 * 与 DOM 无关，供增量对账按同一顺序计算键；顺序必须与渲染顺序一致。
 */
export function collectHandleSpecs(state: EditorState): HandleSpec[] {
  const specs: HandleSpec[] = [];
  const doc = state.doc;
  const blocks = getBlocks(state);
  const docText = doc.toString();
  const mermaids = parseMermaidBlocks(docText);
  const rangeKey = (from: number, to: number): string => `${from}:${to}`;
  const mermaidKeys = new Set(
    mermaids.map((block) => rangeKey(block.from, block.to)),
  );
  const blockKeys = new Set(
    blocks.map((block) => rangeKey(block.from, block.to)),
  );

  // 非文本嵌套块的所在文档行不再溢出成行手柄（保留块级手柄）；
  // 文本嵌套块自己按行枚举，hover 取最小范围时命中它（#917）。
  const nestedBlocks: Block[] = [];
  const nestedKeys = new Set<string>();
  for (const block of blocks) {
    if (
      block.type !== "blockquote" &&
      block.type !== "list" &&
      block.type !== "task"
    ) {
      continue;
    }
    for (const nested of getNestedBlocks(state, block)) {
      const key = rangeKey(nested.from, nested.to);
      const inMermaid = mermaids.some(
        (fence) => nested.from >= fence.from && nested.to <= fence.to,
      );
      if (
        blockKeys.has(key) ||
        mermaidKeys.has(key) ||
        nestedKeys.has(key) ||
        inMermaid
      ) {
        continue;
      }
      nestedKeys.add(key);
      nestedBlocks.push(nested);
    }
  }
  const nestedBlockLevel: BlockRange[] = nestedBlocks
    .filter((nested) => !isTextLineType(nested.type))
    .map((nested) => ({
      from: nested.from,
      to: nested.to,
      type: nested.type,
    }));

  for (const block of blocks) {
    if (isTextLineType(block.type)) {
      for (const line of docLinesInRange(doc, block.from, block.to)) {
        if (isLineCovered(line, nestedBlockLevel)) continue;
        specs.push({
          block: { from: block.from, to: block.to, type: block.type },
          empty: false,
          kind: "line",
          lineFrom: line.from,
          lineTo: line.to,
          lineNumber: line.number,
        });
      }
      continue;
    }
    specs.push({
      block: {
        from: block.from,
        to: block.to,
        type: block.type,
        mermaid: mermaidKeys.has(rangeKey(block.from, block.to)),
      },
      empty: false,
      kind: "block",
    });
  }
  for (const nested of nestedBlocks) {
    if (isTextLineType(nested.type)) {
      for (const line of docLinesInRange(doc, nested.from, nested.to)) {
        specs.push({
          block: { from: nested.from, to: nested.to, type: nested.type },
          empty: false,
          kind: "line",
          lineFrom: line.from,
          lineTo: line.to,
          lineNumber: line.number,
        });
      }
      continue;
    }
    specs.push({
      block: { from: nested.from, to: nested.to, type: nested.type },
      empty: false,
      kind: "block",
    });
  }
  for (const fence of mermaids) {
    if (blockKeys.has(rangeKey(fence.from, fence.to))) continue;
    specs.push({
      block: {
        from: fence.from,
        to: fence.to,
        type: "fencedCode",
        mermaid: true,
      },
      empty: false,
      kind: "block",
    });
  }
  const covered = (pos: number): boolean =>
    blocks.some((block) => pos >= block.from && pos < block.to);
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (line.text.trim() !== "") continue;
    if (covered(line.from)) continue;
    specs.push({
      block: { from: line.from, to: line.to, type: "" },
      empty: true,
      kind: "empty",
    });
  }
  // 文末「+」：只在最后一行非空时追加，避免与文末空行「+」重复。
  // block 用文档末尾零宽点，既作锚点又不与任何块手柄的 data-block-from 冲突。
  if (shouldShowTrailingAdd(docText)) {
    specs.push({
      block: { from: doc.length, to: doc.length, type: "" },
      empty: false,
      kind: "trailing",
    });
  }
  return specs;
}

interface HandleEntry {
  el: HTMLDivElement;
  block: BlockRange;
  empty: boolean;
  kind: HandleKind;
  mermaid: boolean;
  /** 行手柄：文档行范围；块级手柄为 null。 */
  lineFrom: number | null;
  lineTo: number | null;
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
   * 指针所在位置：块菜单 / 拖拽落点的锚定。
   * 行手柄触发时取指针行，块级手柄取块首行。
   */
  anchorPos: number | null;
  /** 指针的视口 Y：mermaid 整块 widget 用它把手柄夹在块矩形内。 */
  anchorClientY: number | null;
}

function pointerKind(type: string): PointerKind {
  return type === "mouse" ? "mouse" : type === "pen" ? "pen" : "touch";
}

class BlockHandlePlugin {
  private handles: HandleEntry[] = [];
  private keys: string[] = [];
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
    this.reconcile();
    this.scheduleReposition();
  }

  update(update: ViewUpdate): void {
    if (update.docChanged) {
      this.reconcile();
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
      this.position(handle.el, handle);
    }
  }

  /**
   * 延迟到下一帧再定位。
   *
   * CM6 的 `updatePlugins` 先于 `docView.update`：对账时读行盒可能还是旧
   * doc 的 tile（`domAtPos` 抛 "No tile"），需等 doc 视图更新后再测一次。
   */
  private scheduleReposition(): void {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.reposition();
    });
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
   * 指针在正文里移动时，激活指针所在行 / 块的手柄。
   *
   * 只挂手柄自身的 pointerenter 会让手柄不可发现（手柄默认 opacity 0，
   * 用户根本不知道该往哪指）；这里用 `posAtCoords` 找到行 / 块，指针移到
   * 手柄上时按元素引用命中，避免「正文 → 手柄」的离开闪烁。
   */
  private readonly onDomPointerMove = (event: PointerEvent): void => {
    const kind = pointerKind(event.pointerType);
    const target = event.target as Element | null;
    const overHandle = target?.closest?.(
      ".cm-block-handle",
    ) as HTMLElement | null;
    // 菜单栈打开期间进入全局禁召唤会话（D2 不 retarget）：指针在菜单或别的块上
    // 滑动时，不能给「菜单后面的内容」再冒出手柄。栈清空后自动恢复。
    if (menuStack.isSummonSuppressed() && !overHandle) return;
    // 标题折叠三角与块手柄共用同一召唤区（.cm-content 左缘 25%）。
    const contentRect = this.view.contentDOM.getBoundingClientRect();
    this.setSummonZone(isInSummonZone(event.clientX, contentRect));
    // 补漏：keyup 有时落在编辑器外（菜单抢焦点），抑制标志会永久卡住，
    // 指针一动就解除，手柄不至于「忽然召唤不出来」。
    for (const handle of this.handles) handle.gate.suppress(false);
    let active: HandleEntry | null = overHandle
      ? (this.handles.find((handle) => handle.el === overHandle) ?? null)
      : null;
    if (active === null) {
      // D5：只有 `.cm-content` 左缘 25% 召唤；右侧 75% 移动指针不冒手柄。
      // 不在召唤区时 active 保持 null，下方 leave 分支会收掉已召唤的手柄。
      if (isInSummonZone(event.clientX, contentRect)) {
        const pos = this.view.posAtCoords({
          x: event.clientX,
          y: event.clientY,
        });
        if (pos !== null) {
          active = this.hitHandle(pos);
          if (active) {
            active.anchorPos = Math.min(
              Math.max(pos, active.block.from),
              active.block.to,
            );
            active.anchorClientY = event.clientY;
          }
        }
      }
    }
    for (const handle of this.handles) {
      const inside = handle === active;
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

  /**
   * 指针命中的最内层手柄：行手柄按文档行区间，块级手柄按块区间，
   * 同一行有容器 / 嵌套多个手柄时取块范围最小的那个（#917）。
   */
  private hitHandle(pos: number): HandleEntry | null {
    let hit: HandleEntry | null = null;
    let hitSize = Number.POSITIVE_INFINITY;
    for (const handle of this.handles) {
      // 文末「+」常显、不需 hover 召唤；零宽锚点会抢「行尾」命中。
      if (handle.kind === "trailing") continue;
      const from = handle.lineFrom ?? handle.block.from;
      const to = handle.lineTo ?? handle.block.to;
      if (pos < from || pos > to) continue;
      const size = handle.block.to - handle.block.from;
      if (size < hitSize) {
        hit = handle;
        hitSize = size;
      }
    }
    return hit;
  }

  private readonly onDomPointerLeave = (): void => {
    this.setSummonZone(false);
    for (const handle of this.handles) {
      if (!handle.hovered) continue;
      handle.hovered = false;
      handle.gate.leave("mouse", Date.now());
      this.arm(handle);
    }
  };

  // --- 键盘抑制（D5：输入中一律隐藏；文末 trailing 入口除外：它是固定入口，不遮挡正文）

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

  /**
   * 按对账键增量同步手柄：键不变只重算几何；从首个差异起重建其后手柄。
   */
  private reconcile(): void {
    const state = this.view.state;
    const specs = collectHandleSpecs(state);
    const keys = handleKeysFor(
      specs.map((spec) => ({
        type: spec.block.type,
        firstLine: firstLineOf(state, spec.block.from, spec.block.to),
        kind: spec.kind,
        lineNumber: spec.lineNumber,
      })),
    );
    const from = firstRebuildIndex(this.keys, keys);
    if (from === -1) {
      for (let i = 0; i < specs.length; i += 1) {
        const entry = this.handles[i];
        entry.block = specs[i].block;
        entry.empty = specs[i].empty;
        entry.kind = specs[i].kind;
        entry.mermaid = specs[i].block.mermaid === true;
        entry.lineFrom = specs[i].lineFrom ?? null;
        entry.lineTo = specs[i].lineTo ?? null;
        this.syncHandleBlock(entry);
        this.resetHover(entry);
      }
      this.keys = keys;
      this.scheduleReposition();
      return;
    }
    for (let i = 0; i < from; i += 1) this.resetHover(this.handles[i]);
    for (let i = this.handles.length - 1; i >= from; i -= 1) {
      const handle = this.handles[i];
      if (handle.timer !== null) clearTimeout(handle.timer);
      handle.el.remove();
    }
    this.handles.length = from;
    for (let i = from; i < specs.length; i += 1) {
      this.addHandle(
        specs[i].block,
        specs[i].kind,
        keys[i],
        specs[i].lineFrom,
        specs[i].lineTo,
      );
    }
    this.keys = keys;
    this.scheduleReposition();
  }

  private syncHandleBlock(entry: HandleEntry): void {
    entry.el.dataset.blockFrom = String(entry.block.from);
    entry.el.dataset.blockTo = String(entry.block.to);
    if (entry.lineFrom !== null && entry.lineTo !== null) {
      entry.el.dataset.lineFrom = String(entry.lineFrom);
      entry.el.dataset.lineTo = String(entry.lineTo);
    } else {
      entry.el.removeAttribute("data-line-from");
      entry.el.removeAttribute("data-line-to");
    }
  }

  /**
   * 文档变化后旧块的 hover 状态失效：清掉可见类与门控待办，
   * 否则指针未动时旧手柄仍挂着 visible，新块的手柄被抢先命中。
   */
  private resetHover(entry: HandleEntry): void {
    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    if (entry.menuTimer !== null) {
      clearTimeout(entry.menuTimer);
      entry.menuTimer = null;
    }
    entry.hovered = false;
    entry.anchorPos = null;
    entry.anchorClientY = null;
    entry.gate.cancel();
    entry.el.classList.remove("cm-block-handle-visible");
  }

  private clearHandles(): void {
    for (const handle of this.handles) {
      if (handle.timer !== null) clearTimeout(handle.timer);
      handle.el.remove();
    }
    this.handles = [];
    this.removeIndicator();
  }

  private addHandle(
    block: BlockRange,
    kind: HandleKind,
    key: string,
    lineFrom?: number,
    lineTo?: number,
  ): void {
    const el = document.createElement("div");
    el.className = "cm-block-handle";
    el.classList.add("mdb-block-handle");
    el.setAttribute("data-testid", "block-handle");
    el.dataset.blockFrom = String(block.from);
    el.dataset.blockTo = String(block.to);
    el.dataset.handleKey = key;
    if (kind === "empty") el.dataset.empty = "true";
    if (kind === "trailing") el.dataset.trailing = "true";
    if (lineFrom !== undefined && lineTo !== undefined) {
      el.dataset.lineFrom = String(lineFrom);
      el.dataset.lineTo = String(lineTo);
    }

    const entry: HandleEntry = {
      el,
      block,
      empty: kind === "empty",
      kind,
      mermaid: block.mermaid === true,
      lineFrom: lineFrom ?? null,
      lineTo: lineTo ?? null,
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
      anchorClientY: null,
    };

    if (kind === "empty" || kind === "trailing") {
      const add = document.createElement("span");
      add.className = "cm-block-handle-add";
      add.setAttribute(
        "aria-label",
        kind === "empty" ? "在下方添加" : "在文末添加",
      );
      add.appendChild(renderIcon(ADD_ICON_NAME));
      el.appendChild(add);
      if (kind === "trailing") {
        // 文末入口常显（不走 hover 门控的 visible 类，避免扰动既有 visible 计数）。
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
      }
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

      // 右段拖拽把手：其余块用四点（DragOutlined）；图片 / 视频块（A-8.1）与
      // 表格块（A-9.1 表头转换手柄）用六点（DragHandleOutlined，与参考产品的
      // 六点拖拽一致）。拖拽监听挂在整块手柄上，把手只是 affordance。
      const grip = document.createElement("span");
      grip.className = "cm-block-handle-grip";
      grip.appendChild(
        renderIcon(
          block.type === "image" || block.type === "table"
            ? "DragHandleOutlined"
            : "DragOutlined",
        ),
      );
      el.appendChild(grip);
    }

    // 滑入即显示（D2 规则 1）＋意图延迟（对齐 md-bundle 的 120ms 缓冲）：
    // 指针停住才开菜单，擦过手柄不再把 236px 面板糊到正文上。
    //
    // 只有块 / 行手柄有转换菜单。空行「+」是插入入口，悬停弹转换菜单是错的
    // （#105）——它只在按压时打开插入菜单（见 onAddPointerDown）。
    //
    // 不要求 gate 已开：指针从正文滑入手柄时，gate 可能还在 300ms 显现延迟
    // 里，而 pointerenter 只触发一次；加了 gate 前置条件菜单就永远不会开。
    if (kind === "block" || kind === "line") {
      el.addEventListener("pointerenter", () => {
        if (entry.dragging) return;
        if (entry.menuTimer !== null) window.clearTimeout(entry.menuTimer);
        entry.menuTimer = window.setTimeout(() => {
          entry.menuTimer = null;
          if (entry.dragging) return;
          if (isBlockMenuOpen(this.view)) return;
          // 读 entry.block 而非闭包捕获的 block：复用手柄时对账会更新块范围。
          openBlockMenu(
            this.view,
            entry.block,
            entry.anchorPos ?? entry.block.from,
            el,
          );
        }, MENU_INTENT_DELAY_MS);
      });
    } else if (kind === "empty") {
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
            entry.block.from,
            addHandleCommands,
            { from: entry.block.from, to: entry.block.from },
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
    // trailing 永不开菜单（点击直接落空段），不挂关闭监听，省掉无用的定时器。
    if (kind !== "trailing") {
      el.addEventListener("pointerleave", () => {
        if (entry.menuTimer !== null) {
          window.clearTimeout(entry.menuTimer);
          entry.menuTimer = null;
        }
        if (entry.dragging) return;
        if (kind === "empty") {
          scheduleAddMenuClose(this.view);
          return;
        }
        scheduleBlockMenuClose(this.view);
      });
    }

    if (kind === "empty") {
      el.addEventListener("pointerdown", (event) =>
        this.onAddPointerDown(event, entry),
      );
    } else if (kind === "trailing") {
      el.addEventListener("pointerdown", (event) =>
        this.onTrailingPointerDown(event),
      );
    } else {
      entry.onMove = (event) => this.onDragMove(event, entry);
      entry.onUp = (event) => this.onDragEnd(event, entry);
      el.addEventListener("pointerdown", (event) =>
        this.onDragPointerDown(event, entry),
      );
    }

    this.position(el, entry);
    this.view.dom.appendChild(el);
    this.handles.push(entry);
  }

  /**
   * 药丸绝对定位在行盒左侧：块级手柄贴块首行，行手柄贴所在文档行。
   * 行盒是用户真实所见的位置，比高度图推算稳定；取不到就不渲染（D1）。
   */
  private position(el: HTMLElement, entry: HandleEntry): void {
    const base = this.view.dom.getBoundingClientRect();
    const viewport = this.view.scrollDOM.getBoundingClientRect();

    if (entry.mermaid) {
      const widget = this.mermaidWidgetRect(entry.block.from);
      if (!widget || !isRectInViewport(widget, viewport)) {
        this.hideHandle(el);
        return;
      }
      const left = widget.left - base.left;
      const pointerY = entry.anchorClientY ?? widget.top + widget.height / 2;
      const clampedY = Math.max(widget.top, Math.min(pointerY, widget.bottom));
      const top = clampedY - base.top - HANDLE_HEIGHT_PX / 2;
      this.showHandle(el);
      el.style.top = `${Math.max(0, Math.round(top))}px`;
      el.style.left = `${Math.max(0, Math.round(left - HANDLE_WIDTH_PX - HANDLE_GAP_PX))}px`;
      return;
    }

    // 文末「+」：贴末行行盒下沿，水平对齐正文列左缘（不占块首行行盒）。
    if (entry.kind === "trailing") {
      const lineRect = this.lineRectAt(entry.block.from);
      if (!lineRect || !isRectInViewport(lineRect, viewport)) {
        this.hideHandle(el);
        return;
      }
      this.showHandle(el);
      el.style.top = `${Math.max(0, Math.round(lineRect.bottom - base.top))}px`;
      el.style.left = `${Math.max(
        0,
        Math.round(this.textColumnLeft(base) - HANDLE_WIDTH_PX - HANDLE_GAP_PX),
      )}px`;
      return;
    }

    const lineRect = this.lineRectAt(entry.lineFrom ?? entry.block.from);
    if (!lineRect || !isRectInViewport(lineRect, viewport)) {
      this.hideHandle(el);
      return;
    }
    let left = lineRect.left - base.left;
    // 图片 / 视频行满纸宽，左缘比正文列窄一个居中位；手柄改贴正文列左缘，
    // 与标题手柄同一中心线（A-8.2）。
    if (entry.block.type === "image") left = this.textColumnLeft(base);

    this.showHandle(el);
    el.style.top = `${Math.max(0, Math.round(lineRect.top - base.top))}px`;
    el.style.left = `${Math.max(0, Math.round(left - HANDLE_WIDTH_PX - HANDLE_GAP_PX))}px`;
  }

  private hideHandle(el: HTMLElement): void {
    el.classList.remove("cm-block-handle-visible");
    el.style.display = "none";
  }

  private showHandle(el: HTMLElement): void {
    el.style.display = "";
  }

  /**
   * 正文列左缘（px，相对 `view.dom`）。
   *
   * `.cm-line` 的 `max-width: var(--type-measure)` + `margin-inline: auto` 让正文行
   * 在 `.cm-content` 内居中；图片 / 视频行被 `max-width: 100%` 覆盖，左缘落在纸边。
   */
  private textColumnLeft(base: DOMRect): number {
    const content = this.view.contentDOM;
    const rect = content.getBoundingClientRect();
    const style = getComputedStyle(content);
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padRight = parseFloat(style.paddingRight) || 0;
    const boxWidth = rect.width - padLeft - padRight;
    const measure =
      parseFloat(style.getPropertyValue("--type-measure")) || 1080;
    const offset = Math.max(0, (boxWidth - measure) / 2);
    return rect.left + padLeft + offset - base.left;
  }

  /** mermaid 块装饰 widget 的屏幕矩形；未挂载（视口外）时返回 null。 */
  private mermaidWidgetRect(from: number): DOMRect | null {
    const el = this.view.dom.querySelector<HTMLElement>(
      `.cm-mermaid-block[data-mermaid-from="${from}"]`,
    );
    return el ? el.getBoundingClientRect() : null;
  }

  /** 位置所在行的几何矩形；DOM 里找不到时返回 null（块不可见 / 未测量）。 */
  private lineRectAt(pos: number): DOMRect | null {
    try {
      const found = this.view.domAtPos(pos);
      let node: Node | null = found.node;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const line = (node as Element | null)?.closest?.(
        ".cm-line",
      ) as HTMLElement | null;
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

  // 文末「+」点击即落一个空段（不开插入菜单）；单事务 + userEvent 标注，
  // 一次撤销整体还原。
  private onTrailingPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const doc = this.view.state.doc.toString();
    const changes = trailingAddChanges(doc);
    this.view.dispatch({
      changes: { from: changes.from, to: changes.to, insert: changes.insert },
      selection: { anchor: changes.cursor },
      annotations: Transaction.userEvent.of("click"),
    });
    this.view.focus();
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
