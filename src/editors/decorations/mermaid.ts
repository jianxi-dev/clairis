/* mermaid 围栏块装饰（移植自 md-bundle packages/editor/src/decorations/mermaid.ts）。
 *
 * 语义揭示两态：
 * - 非活跃块：整个 ```mermaid 块被一个 widget 替换，DOM 里不残留围栏文本。
 * - 活跃块：不出装饰，原始围栏源码可见可编辑。
 *
 * 水合走注入的 `hydrateMermaid`（应用层注入 `renderMermaid`）。widget 根节点
 * 外面包一层 `div.mermaid-block`：渲染器按 `querySelectorAll('div.mermaid-block')`
 * 找块，而 querySelectorAll 不匹配上下文节点自身，包一层才让它成为可发现的
 * 后代。
 */
import type { Range } from "@codemirror/state";
import { Decoration, WidgetType } from "@codemirror/view";

export type MermaidTheme = "dark" | "light";

/** 可注入的水合钩子：`(root, theme) => Promise<void>`。 */
export type MermaidHydrator = (
  root: HTMLElement,
  theme: MermaidTheme,
) => Promise<void>;

/** 默认主题来源：文档根节点的 `data-theme` 属性。 */
function currentTheme(): MermaidTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

interface MermaidBlock {
  from: number;
  to: number;
  source: string;
}

const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\n]*)$/;
const FENCE_CLOSE_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*$/;

/**
 * 找出所有 ```mermaid / ~~~mermaid 块。范围按整行算：开栏行首 → 闭栏行尾
 * （`block: true` 要求范围对齐行边界）。未闭合围栏延伸到文末。
 */
function parseMermaidBlocks(docText: string): MermaidBlock[] {
  const lines = docText.split("\n");
  const offsets: number[] = [];
  let acc = 0;
  for (const line of lines) {
    offsets.push(acc);
    acc += line.length + 1;
  }

  const blocks: MermaidBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = FENCE_OPEN_RE.exec(lines[i]);
    const language = open ? open[3].trim().split(/\s+/)[0] : "";
    if (!open || language !== "mermaid") {
      i += 1;
      continue;
    }
    const fenceChar = open[2][0];
    const fenceLen = open[2].length;

    let close = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      const m = FENCE_CLOSE_RE.exec(lines[j]);
      if (m && m[2][0] === fenceChar && m[2].length >= fenceLen) {
        close = j;
        break;
      }
    }

    const contentStart = offsets[i] + lines[i].length + 1;
    const contentEnd = close === -1 ? docText.length : offsets[close];
    let source = docText.slice(contentStart, contentEnd);
    if (source.endsWith("\n")) source = source.slice(0, -1);

    blocks.push({
      from: offsets[i],
      to: close === -1 ? docText.length : offsets[close] + lines[close].length,
      source,
    });
    i = close === -1 ? lines.length : close + 1;
  }
  return blocks;
}

class MermaidWidget extends WidgetType {
  constructor(
    private readonly _source: string,
    private readonly _hydrate: MermaidHydrator,
    private readonly _theme: MermaidTheme,
  ) {
    super();
  }

  eq(other: MermaidWidget): boolean {
    return other._source === this._source;
  }

  toDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "cm-mermaid-block";

    const block = document.createElement("div");
    block.classList.add("mermaid-block");
    const pre = document.createElement("pre");
    pre.classList.add("mermaid");
    pre.textContent = this._source;
    block.appendChild(pre);
    container.appendChild(block);

    // 发出去就不管：水合失败绝不能击穿编辑器，异步拒绝与同步抛错都吞掉。
    try {
      void this._hydrate(container, this._theme).catch(() => {});
    } catch {
      // 忽略——源码仍然可见，块仍然可编辑
    }
    return container;
  }

  /**
   * 点击交回 CM6，让光标进入块内、原始围栏重新显示。CM6 只在
   * `ignoreEvent` 返回 false 时把事件当编辑器自己的，所以这里返回 false。
   */
  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 构建 mermaid 装饰。活跃块（与 `[activeFrom, activeTo]` 重叠）不出装饰，
 * 原始围栏保持可编辑；非活跃块整体替换成渲染后的图。
 */
export function createMermaidDecorations(
  docText: string,
  activeFrom: number = -1,
  activeTo: number = -1,
  hydrateMermaid?: MermaidHydrator,
  theme?: MermaidTheme,
): Range<Decoration>[] {
  // 没有注入水合器时什么都不渲染：装饰层不依赖任何渲染器实现。
  if (!hydrateMermaid) return [];
  const hydrate: MermaidHydrator = hydrateMermaid;
  const resolvedTheme = theme ?? currentTheme();

  return parseMermaidBlocks(docText)
    .filter(
      (block) =>
        !(activeFrom >= 0 && block.from < activeTo && block.to > activeFrom),
    )
    .map((block) =>
      // 整块一个 block replace：范围必须覆盖围栏首行到闭栏行尾。拆成
      // 「首行 replace + 其余行 line 装饰」会与 replace 区间重叠，CM6 直接
      // 拒绝整批装饰，widget 一个都不会出现。
      Decoration.replace({
        widget: new MermaidWidget(block.source, hydrate, resolvedTheme),
        block: true,
      }).range(block.from, block.to),
    );
}
