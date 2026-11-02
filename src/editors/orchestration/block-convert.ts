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
  | "ordered"
  | "bullet"
  | "todo"
  | "quote"
  | "code"
  | "callout";

export interface BlockChange {
  from: number;
  to: number;
  insert: string;
}

/** 单行前缀（除代码块与高亮这两类需要整块重写）。 */
const PREFIX: Record<
  Exclude<BlockConvertTarget, "code" | "callout">,
  string
> = {
  paragraph: "",
  h1: "# ",
  h2: "## ",
  h3: "### ",
  ordered: "1. ",
  bullet: "- ",
  todo: "- [ ] ",
  quote: "> ",
};

/** 一个行首标记：标题 / 引用 / 待办 / 无序 / 有序。只剥一层。 */
const MARKER_RE = /^(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/;

/** 去掉行首块标记，其余字符原样保留。 */
export function stripBlockMarker(line: string): string {
  return line.replace(MARKER_RE, "");
}

/** 普通块转换：换掉首行标记。 */
export function convertLine(line: string, target: BlockConvertTarget): string {
  if (target === "code" || target === "callout") return line;
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

  const firstLineEnd = block.from + leading.length;
  return [
    {
      from: block.from,
      to: firstLineEnd,
      insert: convertLine(leading, target),
    },
  ];
}

export interface BlockMenuItem {
  target: BlockConvertTarget;
  label: string;
  icon: string;
}

/** 菜单十项（design D6：236px / 行高 32px / 按块型裁剪）。 */
const ALL_ITEMS: readonly BlockMenuItem[] = [
  { target: "paragraph", label: "正文", icon: "TextOutlined" },
  { target: "h1", label: "一级标题", icon: "H1Outlined" },
  { target: "h2", label: "二级标题", icon: "H2Outlined" },
  { target: "h3", label: "三级标题", icon: "H3Outlined" },
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
