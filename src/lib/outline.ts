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
 * 提取 ATX 标题（`#`–`######`），跳过围栏代码块内的所有行。
 *
 * 围栏按 CommonMark 认 ``` 与 ~~~；未闭合的围栏吃到文末，避免把代码里的 `#`
 * 当成标题。
 */
export function extractHeadings(markdown: string): OutlineHeading[] {
  const lines = markdown.split("\n");
  const headings: OutlineHeading[] = [];
  let fence: { char: string; len: number } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
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
