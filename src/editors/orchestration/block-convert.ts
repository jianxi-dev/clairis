/* 块类型转换（md-orchestration 1.3b / design D6「转为」）。
 *
 * 纯函数：只吃 `Text` + 块范围，产出 `{from,to,insert}` 变更数组，调用方一次
 * 事务 dispatch。不碰 DOM、不读视图，便于单测钉死「源码无损」。
 */

import type { Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { BlockType } from "../block-model";
import { structureTransaction } from "../structure-history";
import { classifyListLine } from "../list-number";
import { CALLOUT_ANNOTATION_TYPES } from "../callout-types";

/** 菜单只需要这三样：块范围与块型。 */
export interface BlockLike {
  from: number;
  to: number;
  /** 空行退化手柄的 type 为空串。 */
  type: BlockType | "";
  /** mermaid 围栏块：菜单锚点取手柄矩形，而非整块。 */
  mermaid?: boolean;
}

export type BlockConvertTarget =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "ordered"
  | "bullet"
  | "todo"
  | "quote"
  | "code"
  | "callout"
  | "table"
  | "divider";

export interface BlockChange {
  from: number;
  to: number;
  insert: string;
}

/** 单行前缀（除代码块与高亮这两类需要整块重写）。 */
const PREFIX: Record<
  Exclude<BlockConvertTarget, "code" | "callout" | "table" | "divider">,
  string
> = {
  paragraph: "",
  h1: "# ",
  h2: "## ",
  h3: "### ",
  h4: "#### ",
  h5: "##### ",
  h6: "###### ",
  ordered: "1. ",
  bullet: "- ",
  todo: "- [ ] ",
  quote: "> ",
};

const LIST_TARGETS: ReadonlySet<BlockConvertTarget> = new Set([
  "ordered",
  "bullet",
  "todo",
]);

function indentOf(line: string): string {
  return /^\s*/.exec(line)?.[0] ?? "";
}

function isListLine(line: string): boolean {
  return /^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)/.test(line);
}

/** 同一缩进层级的连续列表行（含当前块）——用于「同级整体转换」。 */
function expandSiblingList(
  doc: Text,
  from: number,
  to: number,
): { from: number; to: number; lines: string[] } | null {
  const first = doc.lineAt(from);
  if (!isListLine(first.text)) return null;
  const indent = indentOf(first.text);
  let start = first.from;
  let end = doc.lineAt(to).to;
  let lineNo = first.number - 1;
  while (lineNo >= 1) {
    const line = doc.line(lineNo);
    if (
      line.text.trim() === "" ||
      !isListLine(line.text) ||
      indentOf(line.text) !== indent
    ) {
      break;
    }
    start = line.from;
    lineNo--;
  }
  lineNo = doc.lineAt(to).number + 1;
  while (lineNo <= doc.lines) {
    const line = doc.line(lineNo);
    if (
      line.text.trim() === "" ||
      !isListLine(line.text) ||
      indentOf(line.text) !== indent
    ) {
      break;
    }
    end = line.to;
    lineNo++;
  }
  return {
    from: start,
    to: end,
    lines: doc.sliceString(start, end).split("\n"),
  };
}

/** 一个行首标记：标题 / 引用 / 待办 / 无序 / 有序。只剥一层。 */
const MARKER_RE = /^(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/;

/** 去掉行首块标记，其余字符原样保留。 */
export function stripBlockMarker(line: string): string {
  return line.replace(MARKER_RE, "");
}

/** 普通块转换：换掉首行标记。 */
export function convertLine(line: string, target: BlockConvertTarget): string {
  if (
    target === "code" ||
    target === "callout" ||
    target === "table" ||
    target === "divider"
  )
    return line;
  return PREFIX[target] + stripBlockMarker(line);
}

function toQuote(lines: string[]): string {
  return lines.map((line) => `> ${line.replace(/^>\s?/, "")}`).join("\n");
}

/**
 * 计算把 `block` 转成 `target` 需要的变更。
 * 已是对应类型时返回空数组（幂等，不产生多余事务）。
 */
export function blockConvertChanges(
  doc: Text,
  block: { from: number; to: number },
  target: BlockConvertTarget,
  options: LineConvertOptions = {},
): BlockChange[] {
  const text = doc.sliceString(block.from, block.to);
  if (text === "") return [];
  const lines = text.split("\n");
  const leading = lines[0];

  if (target === "table") {
    if (/^\|/.test(leading)) return [];
    const cell = text.replace(/\n/g, " ").trim();
    return [
      {
        from: block.from,
        to: block.to,
        insert: `| 列 1 | 列 2 |\n| --- | --- |\n| ${cell} |  |`,
      },
    ];
  }

  if (target === "divider") {
    if (/^---\s*$/.test(leading)) return [];
    return [{ from: block.from, to: block.to, insert: "---" }];
  }

  if (target === "code") {
    if (/^```/.test(leading)) return [];
    return [
      { from: block.from, to: block.to, insert: `\`\`\`\n${text}\n\`\`\`` },
    ];
  }

  if (target === "callout") {
    if (/^>\s*\[!/.test(leading)) return [];
    return [
      {
        from: block.from,
        to: block.to,
        insert: `> [!${(options.calloutKind ?? "NOTE").toUpperCase()}]\n${toQuote(lines)}`,
      },
    ];
  }

  if (target === "quote") {
    return [{ from: block.from, to: block.to, insert: toQuote(lines) }];
  }

  // 从引用转出：逐行剥掉 `>` 再补新前缀。
  // 列表类目标逐行加标记（每行一项），标题/正文只改首行。
  if (/^>\s?/.test(leading)) {
    const body = lines.map(stripBlockMarker);
    const prefix = PREFIX[target];
    const insert =
      prefix === "" || target === "paragraph"
        ? body.join("\n")
        : target === "ordered" || target === "bullet" || target === "todo"
          ? body.map((line) => prefix + line).join("\n")
          : prefix + body.join("\n");
    return [{ from: block.from, to: block.to, insert }];
  }

  if (LIST_TARGETS.has(target)) {
    const group = expandSiblingList(doc, block.from, block.to);
    if (group) {
      let n = 1;
      const insert = group.lines
        .map((line) => {
          const indent = indentOf(line);
          const body = stripBlockMarker(line.slice(indent.length));
          if (target === "ordered") return `${indent}${n++}. ${body}`;
          if (target === "todo") return `${indent}- [ ] ${body}`;
          return `${indent}- ${body}`;
        })
        .join("\n");
      return [{ from: group.from, to: group.to, insert }];
    }
  }

  const firstLineEnd = block.from + leading.length;
  return [
    {
      from: block.from,
      to: firstLineEnd,
      insert: convertLine(leading, target),
    },
  ];
}

/**
 * 把块转换的变更作为结构命令 dispatch：事务带 `userEvent: "app.structure"` 与
 * `isolateHistory.of("full")`，一次转换一个 undo 步（design D5 / ADR 0012）。
 * 已是目标类型（changes 为空）时不产生事务。
 */
export function dispatchBlockConvert(
  view: EditorView,
  block: { from: number; to: number },
  target: BlockConvertTarget,
  options: LineConvertOptions & { scrollIntoView?: boolean } = {},
): void {
  const { calloutKind, scrollIntoView = false } = options;
  const changes = blockConvertChanges(view.state.doc, block, target, {
    calloutKind,
  });
  if (changes.length === 0) return;
  view.dispatch(structureTransaction({ changes, scrollIntoView }));
}

/** 行范围（文档偏移，`to` 不含）。 */
export interface LineRange {
  from: number;
  to: number;
}

/**
 * 行子树区间：列表行 → 自身 + 嵌套更深的连续子级；非列表行 → 仅自身。
 *
 * 子级按缩进判定：紧随其后、缩进严格更深的列表行属于该子树；同缩进（兄弟）
 * 或更浅（上级 / 无关行）立即停止，空行与非列表行也停止。
 */
export function lineSubtreeRange(
  doc: Text,
  from: number,
  to: number,
): { from: number; to: number; lines: string[] } {
  const startPos = Math.max(0, Math.min(from, doc.length));
  const endPos = Math.max(startPos, Math.min(to, doc.length));
  const first = doc.lineAt(startPos);
  const last = doc.lineAt(endPos);
  const rootIndent = indentOf(first.text);
  let endNumber = last.number;
  if (isListLine(first.text)) {
    for (let lineNo = last.number + 1; lineNo <= doc.lines; lineNo += 1) {
      const line = doc.line(lineNo);
      if (line.text.trim() === "" || !isListLine(line.text)) break;
      if (indentOf(line.text).length <= rootIndent.length) break;
      endNumber = lineNo;
    }
  }
  const start = first.from;
  const end = doc.line(endNumber).to;
  return {
    from: start,
    to: end,
    lines: doc.sliceString(start, end).split("\n"),
  };
}

/**
 * 把子树行重排成目标列表标记。
 *
 * 有序编号按层级独立计数（与 `list-number.ts` 的 `computeOrderedNumbers` 同口径：
 * 同深度连续段内从 1 起，回到更浅层级时重置更深计数），所以 2 层无序转有序后
 * 2 级从 1 起连续；无序 / 待办不按层级计数，只换标记。
 */
function renumberSubtreeLines(
  lines: string[],
  target: BlockConvertTarget,
): string {
  const counters = new Map<number, number>();
  return lines
    .map((line) => {
      const info = classifyListLine(line);
      const indent = line.slice(
        info.prefixLen,
        info.prefixLen + info.indentLen,
      );
      const body = line.slice(info.prefixLen + info.indentLen + info.markerLen);
      if (target === "ordered") {
        const n = (counters.get(info.depth) ?? 0) + 1;
        counters.set(info.depth, n);
        for (const depth of [...counters.keys()]) {
          if (depth > info.depth) counters.set(depth, 0);
        }
        return `${indent}${n}. ${body}`;
      }
      if (target === "todo") return `${indent}- [ ] ${body}`;
      return `${indent}- ${body}`;
    })
    .join("\n");
}

/**
 * 列表转高亮：在列表外套 callout 首行，列表行保持原标记与缩进。
 *
 * 与 `toQuote` 同层：每行补 `> ` 前缀（已带 `>` 的剥掉再补），列表标记不变。
 */
export function wrapListInCallout(lines: string[], kind = "NOTE"): string {
  return `> [!${kind}]\n${toQuote(lines)}`;
}

export interface LineConvertOptions {
  /** 高亮类型 key（`target === "callout"` 时使用，默认 `NOTE`）。 */
  calloutKind?: string;
}

/**
 * 行手柄触发的转换：上级行联同其子树一起转换，末级行只转当前行。
 *
 * - 列表行：子树区间内按目标重排（有序按层级计数，见 `renumberSubtreeLines`）；
 *   转高亮走 `wrapListInCallout`，列表标记保留。
 * - 非列表行：子树退化为该行自身，走既有 `blockConvertChanges`。
 */
export function convertLineWithChildren(
  doc: Text,
  line: LineRange,
  target: BlockConvertTarget,
  options: LineConvertOptions = {},
): BlockChange[] {
  const subtree = lineSubtreeRange(doc, line.from, line.to);
  const first = subtree.lines[0] ?? "";
  if (target === "callout") {
    if (/^>\s*\[!/.test(first)) return [];
    return [
      {
        from: subtree.from,
        to: subtree.to,
        insert: wrapListInCallout(subtree.lines, options.calloutKind ?? "NOTE"),
      },
    ];
  }
  if (!isListLine(first)) {
    return blockConvertChanges(doc, subtree, target);
  }
  if (LIST_TARGETS.has(target)) {
    return [
      {
        from: subtree.from,
        to: subtree.to,
        insert: renumberSubtreeLines(subtree.lines, target),
      },
    ];
  }
  return blockConvertChanges(doc, subtree, target);
}

/**
 * 行转换的结构命令 dispatch：与 `dispatchBlockConvert` 同走 `structureTransaction`，
 * 一次转换一个 undo 步。
 */
export function dispatchLineConvert(
  view: EditorView,
  line: LineRange,
  target: BlockConvertTarget,
  options: LineConvertOptions & { scrollIntoView?: boolean } = {},
): void {
  const { calloutKind, scrollIntoView = false } = options;
  const changes = convertLineWithChildren(view.state.doc, line, target, {
    calloutKind,
  });
  if (changes.length === 0) return;
  view.dispatch(structureTransaction({ changes, scrollIntoView }));
}

/**
 * 当前块对应的「转为」目标，用于菜单里的高亮单元。
 *
 * 只认能一一对应的形态：H4 及以上、图片/表格等没有对应单元，返回 null
 * （菜单里就不高亮任何一格，而不是错高亮 H3）。
 */
export function currentConvertTarget(
  blockText: string,
  type: BlockType | "",
): BlockConvertTarget | null {
  const firstLine = blockText.split("\n")[0] ?? "";
  switch (type) {
    case "heading": {
      const match = /^(#{1,6})\s/.exec(firstLine);
      if (!match) return null;
      const level = match[1].length;
      return level <= 3 ? (`h${level}` as BlockConvertTarget) : null;
    }
    case "paragraph":
      return "paragraph";
    case "blockquote":
      return "quote";
    case "task":
      return "todo";
    case "list":
      return /^\s*\d+\./.test(firstLine) ? "ordered" : "bullet";
    case "fencedCode":
    case "codeBlock":
      return "code";
    default:
      return null;
  }
}

export interface BlockMenuItem {
  target: BlockConvertTarget;
  label: string;
  icon: string;
  /** 网格单元里的短标签：236px / 5 列只有约 44px 宽，四字标题会压到邻格。 */
  shortLabel?: string;
  /** 有子项时该格是「标注」展开层（13 类语义 callout），不直接转换。 */
  children?: readonly BlockMenuItem[];
  /** `target === "callout"` 时的具体类型 key（默认 NOTE）。 */
  calloutKind?: string;
}

/** 菜单九项（design D6：236px / 行高 32px / 按块型裁剪）。 */
const ALL_ITEMS: readonly BlockMenuItem[] = [
  { target: "paragraph", label: "正文", icon: "TextOutlined" },
  { target: "h1", label: "一级标题", shortLabel: "一级", icon: "H1Outlined" },
  { target: "h2", label: "二级标题", shortLabel: "二级", icon: "H2Outlined" },
  { target: "h3", label: "三级标题", shortLabel: "三级", icon: "H3Outlined" },
  { target: "ordered", label: "有序", icon: "OrderListOutlined" },
  { target: "bullet", label: "无序", icon: "DisorderListOutlined" },
  { target: "todo", label: "待办", icon: "TodoOutlined" },
  { target: "code", label: "代码", icon: "CodeblockOutlined" },
  { target: "quote", label: "引用", icon: "FormatQuoteOutlined" },
];

/**
 * 「高亮」= 纯高亮块（`cm-callout-mark` 分支），直落 `> [!highlight]`。
 * 「标注」= 13 类语义 callout，展开 `CALLOUT_ANNOTATION_TYPES`（D1 / R-1）。
 */
export const CALLOUT_MARK_ITEM: BlockMenuItem = {
  target: "callout",
  label: "高亮",
  icon: "CalloutOutlined",
};

export function calloutAnnotationItems(): BlockMenuItem[] {
  return CALLOUT_ANNOTATION_TYPES.map((type) => ({
    target: "callout" as const,
    label: type.label,
    icon: "CalloutOutlined",
    calloutKind: type.key,
  }));
}

export function calloutMenuItems(): BlockMenuItem[] {
  return [
    CALLOUT_MARK_ITEM,
    {
      target: "callout",
      label: "标注",
      icon: "CalloutOutlined",
      children: calloutAnnotationItems(),
    },
  ];
}

/** 不可转换的块型：只保留「在下方添加」。 */
const NON_CONVERTIBLE = new Set([
  "table",
  "thematicBreak",
  "image",
  "htmlBlock",
  "yamlFrontMatter",
]);

/** 按块型裁剪后的菜单项（末尾固定「高亮」「标注」两项）。 */
export function blockMenuItems(
  block: Pick<BlockLike, "type">,
): BlockMenuItem[] {
  if (NON_CONVERTIBLE.has(block.type)) return [];
  if (block.type === "fencedCode" || block.type === "codeBlock") {
    return [
      ...ALL_ITEMS.filter((item) => item.target !== "code"),
      ...calloutMenuItems(),
    ];
  }
  return [...ALL_ITEMS, ...calloutMenuItems()];
}
