/**
 * 文档大纲解析（移植自 md-bundle app-kit/outline/headings.ts）。
 *
 * 纯函数、不做 DOM：编辑/源码模式从 markdown 文本解析；预览模式由组件从 DOM
 * （h1–h6）提取。两条路径返回同一个形状，浮层只认这一种。
 */

export interface OutlineHeading {
  level: number;
  text: string;
  /** 0-based 行号；从 DOM 提取时为 -1。 */
  line: number;
  /** 仅预览模式：标题元素，用于 scrollIntoView。 */
  element?: HTMLElement;
}

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;
const ATX_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/**
 * frontmatter 的结束行下标（含）：首行 `---`、直到下一个 `---` / `...`。
 * 未闭合或首行不是 `---` 一律返回 -1（那是普通分隔线，不是 frontmatter）。
 */
function frontmatterEnd(lines: string[]): number {
  if (lines.length === 0 || lines[0].trim() !== "---") return -1;
  for (let i = 1; i < lines.length; i += 1) {
    const text = lines[i].trim();
    if (text === "---" || text === "...") return i;
  }
  return -1;
}

/**
 * 提取 ATX 标题（`#`–`######`），跳过 frontmatter 与围栏代码块内的所有行。
 *
 * 围栏按 CommonMark 认 ``` 与 ~~~；未闭合的围栏吃到文末，避免把代码里的 `#`
 * 当成标题。
 */
export function extractHeadings(markdown: string): OutlineHeading[] {
  const lines = markdown.split("\n");
  const headings: OutlineHeading[] = [];
  let fence: { char: string; len: number } | null = null;
  const fmEnd = frontmatterEnd(lines);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (fmEnd >= 0 && i <= fmEnd) continue;
    const fenceMatch = FENCE_RE.exec(line);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (fence === null) {
        fence = { char: marker[0], len: marker.length };
      } else if (marker[0] === fence.char && marker.length >= fence.len) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) continue;

    const match = ATX_RE.exec(line);
    if (match) {
      headings.push({ level: match[1].length, text: match[2], line: i });
    }
  }

  return headings;
}

/** 从预览 DOM 提取标题（h1–h6），行号为 -1。 */
export function headingsFromDom(container: HTMLElement): OutlineHeading[] {
  const nodes = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const headings: OutlineHeading[] = [];
  nodes.forEach((node) => {
    headings.push({
      level: Number(node.tagName[1]),
      text: node.textContent?.trim() ?? "",
      line: -1,
      element: node as HTMLElement,
    });
  });
  return headings;
}

/** 条目身份：同级同名标题共享（#925 已知取舍）。 */
export function outlineHeadingId(heading: OutlineHeading): string {
  return `${heading.level}:${heading.text}`;
}

/** #925 持久化键：按文档路径隔离拖动顺序。 */
export function outlineOrderKey(docPath: string): string {
  return `outline-order:${docPath}`;
}

/** 读取保存的身份序列；无记录或损坏一律返回 null。 */
export function readOutlineOrder(docPath: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(outlineOrderKey(docPath));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((item) => typeof item === "string")) return null;
    return parsed as string[];
  } catch {
    // localStorage 不可用 / JSON 损坏：视为无保存顺序。
    return null;
  }
}

export function writeOutlineOrder(docPath: string, order: string[]): void {
  try {
    window.localStorage.setItem(outlineOrderKey(docPath), JSON.stringify(order));
  } catch {
    // 写入失败（隐私模式 / 配额）不影响当次拖拽结果。
  }
}

/**
 * 清除某文档的持久化顺序（#1050）：正文重排后显示顺序必须跟随正文，否则
 * 旧的保存序列会把正文顺序再排一次，出现「大纲与正文不一致」。
 */
export function clearOutlineOrder(docPath: string): void {
  try {
    window.localStorage.removeItem(outlineOrderKey(docPath));
  } catch {
    // 同 writeOutlineOrder：存储不可用不影响当次结果。
  }
}

/**
 * 被拖标题的区段在标题序列里占到哪一项（含）：向后吃到连续更深层级为止，
 * 遇到同级或更浅层级即停。返回末尾下标（>= fromIndex）。
 */
export function outlineSectionRunEnd(
  headings: OutlineHeading[],
  fromIndex: number,
): number {
  if (fromIndex < 0 || fromIndex >= headings.length) return fromIndex;
  const level = headings[fromIndex].level;
  let end = fromIndex;
  for (let i = fromIndex + 1; i < headings.length; i += 1) {
    if (headings[i].level <= level) break;
    end = i;
  }
  return end;
}

/**
 * 按大纲落点重排正文（#1050）。
 *
 * `fromIndex` / `toIndex` 是文档顺序标题序列的下标；`toIndex` 指「移除被拖
 * 区段后、剩余标题列表里的插入位置」。被拖标题的整个区段（其标题行到下一个
 * 同级或更浅标题之前）随标题一起移动，子标题跟着走。
 *
 * 纯函数：不改 frontmatter（位于首个标题之前，属前言块），不动围栏代码；
 * from === to / 无标题 / 越界时原样返回，尾换行契约原样保留。
 */
export function reorderSections(
  markdown: string,
  fromIndex: number,
  toIndex: number,
): string {
  const headings = extractHeadings(markdown);
  if (headings.length === 0) return markdown;
  if (fromIndex < 0 || fromIndex >= headings.length) return markdown;

  const runEnd = outlineSectionRunEnd(headings, fromIndex);
  const runLen = runEnd - fromIndex + 1;
  const to = Math.min(Math.max(toIndex, 0), headings.length - runLen);
  if (fromIndex === to) return markdown;

  // 尾换行不跟着最后一块走：先摘掉末尾空行，重排后再补回。
  const trailingNewline = markdown.endsWith("\n");
  const lines = trailingNewline
    ? markdown.split("\n").slice(0, -1)
    : markdown.split("\n");
  const preamble = lines.slice(0, headings[0].line);

  // 扁平切块：每块 = 一个标题行到下一个标题行之前；前言块不参与移动。
  const blocks: string[][] = [];
  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i].line;
    const end = i + 1 < headings.length ? headings[i + 1].line - 1 : lines.length - 1;
    blocks.push(lines.slice(start, end + 1));
  }

  const moved = blocks.slice(fromIndex, runEnd + 1);
  const rest = blocks.filter((_, index) => index < fromIndex || index > runEnd);
  rest.splice(to, 0, ...moved);

  return [...preamble, ...rest.flat()].join("\n") + (trailingNewline ? "\n" : "");
}

/**
 * 按保存的身份序列排序：命中序列的按序列先后，未命中的新标题按文档顺序追加
 * 末尾（sort 稳定）。保存序列里的旧身份在下次写入时自然清掉——写的是当前条目
 * 的身份全集。
 */
export function applyOutlineOrder(
  headings: OutlineHeading[],
  order: readonly string[] | null,
): OutlineHeading[] {
  if (!order || order.length === 0) return headings;
  const rank = new Map<string, number>();
  for (let i = 0; i < order.length; i += 1) {
    if (!rank.has(order[i])) rank.set(order[i], i);
  }
  return [...headings].sort((a, b) => {
    const ra = rank.get(outlineHeadingId(a));
    const rb = rank.get(outlineHeadingId(b));
    if (ra === undefined) return rb === undefined ? 0 : 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}
