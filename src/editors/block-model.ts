/* 块模型（移植自 md-bundle packages/editor/src/block-model.ts）。
 *
 * 用 Lezer 语法树做块遍历，替代正则扫全文：CM6 的 markdown 解析器已经
 * 增量维护了语法树，块边界直接读树即可。
 *
 * `getBlocks()` 走文档树的顶层子节点，返回 `Block` 描述数组；
 * `getBlockAt()` 在该数组上二分查找。
 *
 * 重解析策略：编辑后对新 state 调 `getBlocks()` 即可——CM6 的增量解析
 * 只重解析改动区域，所以代价是 O(改动块数)，不是 O(文档)。首次调用会
 * 强制解析到文档末尾一次（见 `getBlocks` 内的 `ensureSyntaxTree`）。
 */
import type { EditorState } from "@codemirror/state";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { resolveCalloutType } from "./callout-types";

// --- 块类型 ------------------------------------------------------------------

/**
 * 块的判别式，与 @lezer/markdown 的节点名一一对应。
 */
export type BlockType =
  | "paragraph"
  | "heading"
  | "blockquote"
  | "callout"
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

/** 高亮块首行：`> [!TYPE]`（允许最多 3 个前导空格，与 Lezer 的引用块一致）。 */
const CALLOUT_HEAD_RE = /^\s{0,3}>\s*\[!([A-Za-z]+)\]/;

/**
 * 引用块是否其实是高亮块：首行是 `> [!TYPE]` 且类型合法。
 *
 * 不只看前缀：非法类型（如 `[!FOO]`）要落回普通引用块，否则手柄图标会对不上
 * 渲染端（`callout.ts` 同样按类型表判定）。
 */
function isCalloutText(text: string): boolean {
  const firstLine = text.split("\n")[0] ?? "";
  const match = CALLOUT_HEAD_RE.exec(firstLine);
  return match !== null && resolveCalloutType(match[1].toLowerCase()) !== null;
}

/** 遍历块子节点所需的最小结构（不直接依赖 @lezer/common）。 */
interface BlockChildNode {
  readonly name: string;
  readonly from: number;
  readonly to: number;
  cursor(): {
    firstChild(): boolean;
    nextSibling(): boolean;
    readonly node: BlockChildNode;
  };
}

/**
 * 段落是否只含一张图片：`![alt](path)` 独占一行。
 *
 * `Image` 在 @lezer/markdown 里是**行内**节点，所以独占一行的图片会被解析成
 * `Paragraph > Image`；只看顶层节点会把它误判成段落，手柄图标也随错（#649）。
 * 判定要求恰好一个 Image 子节点、其余子节点只有空白文本。
 */
function isImageOnlyParagraph(
  node: BlockChildNode,
  state: EditorState,
): boolean {
  const cursor = node.cursor();
  if (!cursor.firstChild()) return false;
  let imageFrom = -1;
  let imageTo = -1;
  do {
    const child = cursor.node;
    if (child.name !== "Image") continue;
    if (imageFrom !== -1) return false;
    imageFrom = child.from;
    imageTo = child.to;
  } while (cursor.nextSibling());
  if (imageFrom === -1) return false;
  const before = state.doc.sliceString(node.from, imageFrom).trim();
  const after = state.doc.sliceString(imageTo, node.to).trim();
  return before === "" && after === "";
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
  // `syntaxTree()` 返回的是「当前已解析」的树：解析受时间预算约束，可能只覆盖
  // 文档前段。块遍历要求读到文档全部顶层节点，故先强制解析到文档末尾；超时
  // 时退回当前树，保持原有降级行为（不阻塞编辑）。
  const tree =
    ensureSyntaxTree(state, state.doc.length, 5000) ?? syntaxTree(state);

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
      } else if (type === "paragraph") {
        if (isImageOnlyParagraph(node, state)) finalType = "image";
      } else if (type === "blockquote") {
        if (isCalloutText(state.doc.sliceString(node.from, node.to))) {
          finalType = "callout";
        }
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
