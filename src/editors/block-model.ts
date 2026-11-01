/* 块模型（移植自 md-bundle packages/editor/src/block-model.ts）。
 *
 * 用 Lezer 语法树做块遍历，替代正则扫全文：CM6 的 markdown 解析器已经
 * 增量维护了语法树，块边界直接读树即可。
 *
 * `getBlocks()` 走文档树的顶层子节点，返回 `Block` 描述数组；
 * `getBlockAt()` 在该数组上二分查找。
 *
 * 重解析策略：编辑后对新 state 调 `getBlocks()` 即可——CM6 的增量解析
 * 只重解析改动区域，所以代价是 O(改动块数)，不是 O(文档)。
 */
import type { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// --- 块类型 ------------------------------------------------------------------

/**
 * 块的判别式，与 @lezer/markdown 的节点名一一对应。
 */
export type BlockType =
  | "paragraph"
  | "heading"
  | "blockquote"
  | "list"
  | "task"
  | "fencedCode"
  | "codeBlock"
  | "table"
  | "thematicBreak"
  | "image"
  | "htmlBlock"
  | "yamlFrontMatter";

// --- 块接口 ------------------------------------------------------------------

/**
 * 文档中的一个顶层块。
 *
 * `from`/`to` 是文档偏移（0 起，`to` 不含）。
 * `node` 是 Lezer SyntaxNode，供定向装饰使用；类型记为 `unknown`，
 * 以免直接依赖 @lezer/common（不是本项目的直接依赖）。
 * `level` 仅在 `type === 'heading'` 时存在（1-6）。
 * `checked` 仅在 `type === 'task'` 时存在（全部勾选才为 true）。
 */
export interface Block {
  readonly from: number;
  readonly to: number;
  readonly type: BlockType;
  readonly node: unknown;
  readonly level?: number;
  readonly checked?: boolean;
}

// --- Lezer 节点名 → BlockType ------------------------------------------------

/**
 * Lezer markdown 节点名到 BlockType 的映射。只登记顶层块节点；
 * 行内节点（Emphasis 等）不是块。
 */
const BLOCK_TYPE_MAP: Record<string, BlockType> = {
  Paragraph: "paragraph",
  ATXHeading1: "heading",
  ATXHeading2: "heading",
  ATXHeading3: "heading",
  ATXHeading4: "heading",
  ATXHeading5: "heading",
  ATXHeading6: "heading",
  SetextHeading1: "heading",
  SetextHeading2: "heading",
  Blockquote: "blockquote",
  BulletList: "list",
  OrderedList: "list",
  FencedCode: "fencedCode",
  CodeBlock: "codeBlock",
  Table: "table",
  HorizontalRule: "thematicBreak",
  HTMLBlock: "htmlBlock",
  Image: "image",
};

/** 把 Lezer 节点解析成 BlockType；非块节点（Document、行内节点等）返回 null。 */
function resolveBlockType(node: { name: string }): BlockType | null {
  return BLOCK_TYPE_MAP[node.name] ?? null;
}

/** 从标题节点名取级别（ATXHeading1-6 / SetextHeading1-2），非标题返回 null。 */
function headingLevel(nodeName: string): number | null {
  if (nodeName.startsWith("ATXHeading")) {
    const level = Number(nodeName.slice("ATXHeading".length));
    if (level >= 1 && level <= 6) return level;
  }
  if (nodeName.startsWith("SetextHeading")) {
    const level = Number(nodeName.slice("SetextHeading".length));
    if (level >= 1 && level <= 2) return level;
  }
  return null;
}

/** 列表项文本是否以任务标记开头：`- [ ] ` / `1. [x] ` 等。 */
function isTaskItem(text: string): boolean {
  return /^\s*[-*+] \[[ xX]\] /.test(text) || /^\s*\d+\. \[[ xX]\] /.test(text);
}

/** 任务项是否已勾选（`[x]` / `[X]`）。 */
function isTaskChecked(text: string): boolean {
  return /^\s*(?:[-*+]|\d+\.) \[[xX]\] /.test(text);
}

// --- getBlocks ---------------------------------------------------------------

/**
 * 遍历 Lezer 语法树，返回所有顶层块（按 `from` 升序）。
 *
 * 用 `Tree.cursor()` 只进入 Document 的顶层子节点，不碰行内内容。
 * 标题块取级别；列表块若每个顶层项都是任务项，则归类为 `task`，
 * 且只有全部勾选时 `checked` 才为 true。
 */
export function getBlocks(state: EditorState): Block[] {
  const blocks: Block[] = [];
  const tree = syntaxTree(state);

  // 游标停在文档根，只迭代顶层子节点。
  const cursor = tree.cursor();
  if (!cursor.firstChild()) return blocks;

  do {
    const node = cursor.node;
    const type = resolveBlockType(node);
    if (type !== null) {
      let level: number | undefined;
      let checked: boolean | undefined;
      let finalType = type;

      if (type === "heading") {
        const lvl = headingLevel(node.name);
        if (lvl !== null) level = lvl;
      } else if (type === "list") {
        // 进入列表检查顶层 ListItem：全部是任务项才归为 task，
        // 全部勾选才 checked = true。
        const listCursor = node.cursor();
        if (listCursor.firstChild()) {
          let allTask = true;
          let allChecked = true;
          let hasItems = false;

          do {
            const child = listCursor.node;
            if (child.name === "ListItem") {
              hasItems = true;
              const itemText = state.doc.sliceString(child.from, child.to);
              if (!isTaskItem(itemText)) {
                allTask = false;
              } else if (!isTaskChecked(itemText)) {
                allChecked = false;
              }
            }
          } while (listCursor.nextSibling());

          if (hasItems && allTask) {
            finalType = "task";
            checked = allChecked;
          }
        }
      }

      blocks.push({
        from: node.from,
        to: node.to,
        type: finalType,
        node,
        level,
        checked,
      });
    }
  } while (cursor.nextSibling());

  return blocks;
}

// --- getBlockAt --------------------------------------------------------------

/**
 * 二分查找包含 `pos` 的块。
 *
 * 返回 `[from, to)` 覆盖 `pos` 的块；空文档等无匹配情况返回 null。
 */
export function getBlockAt(pos: number, blocks: Block[]): Block | null {
  let lo = 0;
  let hi = blocks.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const block = blocks[mid];

    if (pos < block.from) {
      hi = mid - 1;
    } else if (pos >= block.to) {
      lo = mid + 1;
    } else {
      return block;
    }
  }

  return null;
}
