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
