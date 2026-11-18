/* frontmatter 源码块隐藏（doc-property-panel / #1019）。
 *
 * 面板可见且处于编辑态时，文档开头的 `--- ... ---` 块由属性面板演示，正文
 * 不再重复显示源码：整块用无 widget 的 `Decoration.replace` 隐藏；面板折叠
 * 时改为一行摘要占位「文档属性 · N 个字段」。面板隐藏（⌘⇧Y）或源码态时不
 * 装配本装饰，完整 YAML 恢复可见。
 *
 * 光标安全：选区/光标与块区间相交时不隐藏（防编辑盲区），移出后由 StateField
 * 重建恢复。隐藏是纯视图装饰——不改文档内容、不进 undo 栈。
 *
 * 区间口径复用 `src/lib/frontmatter.ts` 的 `FRONTMATTER_RE` 与 `parseFrontmatter`，
 * 与预览剥离、面板解析同一判定，避免「面板隐藏了但预览没剥掉」这类不一致。
 */
import type { EditorState, Range } from "@codemirror/state";
import { Decoration, WidgetType } from "@codemirror/view";
import { FRONTMATTER_RE, parseFrontmatter } from "../../lib/frontmatter";

/** 摘要占位节点 class（CSS manifest 要求 `cm-` 前缀并在 src/styles 落规则）。 */
export const FMH_SUMMARY_CLASS = "cm-fmh-summary";

/** 面板显隐档 + 折叠态；`null` / 缺省表示不隐藏。 */
export interface FrontmatterHideOptions {
  /** 面板可见且编辑态：隐藏整块。 */
  hide: boolean;
  /** 折叠态：以一行摘要代替整块；仅在 `hide` 为 true 时生效。 */
  collapsed: boolean;
}

/** 文档开头 frontmatter 块的三个关键偏移。 */
export interface FrontmatterBlock {
  /** 块起点（含 BOM）。 */
  readonly start: number;
  /** 闭合 `---` 行末（不含该行换行）。 */
  readonly blockEnd: number;
  /** 正文起点（跳过块后连续空行）。 */
  readonly bodyStart: number;
}

/**
 * 定位文档开头的 frontmatter 块。
 *
 * 闭合围栏按行扫描取「去掉尾随空白后等于 `---`」的第一行，不依赖正则尾部的
 * `\s*` 贪婪消费了哪些换行——那会随正文缩进漂移。`bodyStart` 只跳过块后的
 * 换行，保留正文自身的缩进。
 */
export function findFrontmatterBlock(text: string): FrontmatterBlock | null {
  // 正则锚定在文首且含 `[\s\S]*?`：先做两次原生预检，避免无闭合围栏的
  // 大文档在每次输入时整篇扫描。
  const bom = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (!text.startsWith("---", bom) || text.indexOf("\n---", bom) === -1) {
    return null;
  }
  const match = FRONTMATTER_RE.exec(text);
  if (!match) return null;
  const start = match.index;

  const openNl = text.indexOf("\n", start);
  if (openNl === -1) return null;

  let lineStart = openNl + 1;
  for (;;) {
    const nl = text.indexOf("\n", lineStart);
    const lineEnd = nl === -1 ? text.length : nl;
    if (text.slice(lineStart, lineEnd).trimEnd() === "---") {
      let bodyStart = lineEnd;
      if (bodyStart < text.length && text[bodyStart] === "\n") bodyStart += 1;
      while (bodyStart < text.length && text[bodyStart] === "\n")
        bodyStart += 1;
      return { start, blockEnd: lineEnd, bodyStart };
    }
    if (nl === -1) return null;
    lineStart = nl + 1;
  }
}

/**
 * 选区或光标是否严格落入块区间 `(start, bodyStart)`。
 *
 * 端点语义：块起点与正文首字符都是边界，不算块内——新建编辑器默认光标停在
 * 块起点，若把它算作命中，整块永远不会隐藏。非空选区跨边界仍算命中。
 */
export function frontmatterTouchesSelection(
  state: EditorState,
  block: FrontmatterBlock,
): boolean {
  for (const range of state.selection.ranges) {
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);
    if (from === to) {
      // 块起点是边界（正文即将开始处），不算块内；块尾/正文首字符同理。
      if (from > block.start && from < block.bodyStart) return true;
    } else if (from < block.bodyStart && to > block.start) {
      return true;
    }
  }
  return false;
}

/** 折叠态摘要占位。 */
class FrontmatterSummaryWidget extends WidgetType {
  constructor(private readonly count: number) {
    super();
  }

  eq(other: FrontmatterSummaryWidget): boolean {
    return other.count === this.count;
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = FMH_SUMMARY_CLASS;
    el.setAttribute("role", "note");
    el.textContent = `文档属性 · ${this.count} 个字段`;
    return el;
  }
}

export interface FrontmatterHideResult {
  /** 被隐藏/占位的起点。 */
  readonly from: number;
  /** 被隐藏/占位的终点（用于过滤区间内的既有装饰）。 */
  readonly to: number;
  readonly decorations: Range<Decoration>[];
}

/** 激活隐藏时把落入块内的光标/选区迁到正文起点；无需迁移返回 null。 */
export function frontmatterSelectionFix(
  state: EditorState,
  options?: FrontmatterHideOptions | null,
): { anchor: number } | null {
  if (!options || !options.hide) return null;
  const block = findFrontmatterBlock(state.doc.toString());
  if (!block) return null;
  if (!frontmatterTouchesSelection(state, block)) return null;
  return { anchor: block.bodyStart };
}

/**
 * 按当前状态生成 frontmatter 隐藏装饰；不适用时返回 null（零开销早退）。
 *
 * - 面板隐藏 / 非编辑态（`options` 为 null 或 `hide:false`）→ null。
 * - 无 frontmatter / 空块（正则不命中）→ null。
 * - 选区落入块内 → null（临时显示完整块，防编辑盲区）。
 * - 折叠态：隐藏闭合行以上部分 + 在块首插入一行摘要 widget。
 * - 展开态：从块首隐藏到正文起点（含块后空行）。
 */
export function createFrontmatterHideDecorations(
  state: EditorState,
  options?: FrontmatterHideOptions | null,
): FrontmatterHideResult | null {
  if (!options || !options.hide) return null;

  const text = state.doc.toString();
  const block = findFrontmatterBlock(text);
  if (!block) return null;
  if (frontmatterTouchesSelection(state, block)) return null;

  if (options.collapsed) {
    const count = parseFrontmatter(text).fields.length;
    return {
      from: block.start,
      to: block.blockEnd,
      decorations: [
        Decoration.replace({}).range(block.start, block.blockEnd),
        Decoration.widget({
          widget: new FrontmatterSummaryWidget(count),
          side: -1,
        }).range(block.start),
      ],
    };
  }

  return {
    from: block.start,
    to: block.bodyStart,
    decorations: [Decoration.replace({}).range(block.start, block.bodyStart)],
  };
}
