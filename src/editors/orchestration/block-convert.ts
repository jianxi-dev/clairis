/* 块类型转换（md-orchestration 1.3b / design D6「转为」）。
 *
 * 纯函数：只吃 `Text` + 块范围，产出 `{from,to,insert}` 变更数组，调用方一次
 * 事务 dispatch。不碰 DOM、不读视图，便于单测钉死「源码无损」。
 */

import type { Text } from "@codemirror/state";
import type { BlockType } from "../block-model";

/** 菜单只需要这三样：块范围与块型。 */
export interface BlockLike {
  from: number;
  to: number;
  /** 空行退化手柄的 type 为空串。 */
  type: BlockType | "";
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
        insert: `> [!NOTE]\n${toQuote(lines)}`,
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
}

/** 菜单十项（design D6：236px / 行高 32px / 按块型裁剪）。 */
const ALL_ITEMS: readonly BlockMenuItem[] = [
  { target: "paragraph", label: "正文", icon: "TextOutlined" },
  { target: "h1", label: "一级标题", shortLabel: "一级", icon: "H1Outlined" },
  { target: "h2", label: "二级标题", shortLabel: "二级", icon: "H2Outlined" },
  { target: "h3", label: "三级标题", shortLabel: "三级", icon: "H3Outlined" },
  { target: "ordered", label: "有序", icon: "OrderListOutlined" },
  { target: "bullet", label: "无序", icon: "DisorderListOutlined" },
  { target: "todo", label: "待办", icon: "TodoOutlined" },
  { target: "code", label: "代码", icon: "CodeblockOutlined" },
  { target: "quote", label: "引用", icon: "ReferenceOutlined" },
  { target: "callout", label: "高亮", icon: "CalloutOutlined" },
];

/** 不可转换的块型：只保留「在下方添加」。 */
const NON_CONVERTIBLE = new Set([
  "table",
  "thematicBreak",
  "image",
  "htmlBlock",
  "yamlFrontMatter",
]);

/** 按块型裁剪后的菜单项。 */
export function blockMenuItems(
  block: Pick<BlockLike, "type">,
): BlockMenuItem[] {
  if (NON_CONVERTIBLE.has(block.type)) return [];
  if (block.type === "fencedCode" || block.type === "codeBlock") {
    return ALL_ITEMS.filter((item) => item.target !== "code");
  }
  return [...ALL_ITEMS];
}
