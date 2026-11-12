/* 编辑态公式装饰（design D7 / Q9）。
 *
 * 语义揭示两态，与 mermaid.ts 同构：
 * - 非活跃公式：整段被 KaTeX widget 替换，DOM 里不残留 $ 定界符。
 * - 活跃公式（光标/选区进入）：不出装饰，原始源码可见可编辑。
 *
 * 与 mermaid 的差别：KaTeX 是纯函数库，渲染不需要应用层引擎/主题，所以
 * 直接 import katex（与 src/renderers/math.ts 同路径），不注入水合器。
 * widget 不加 `cm-*` class：CSS manifest 门禁要求每个 cm-* class 在
 * src/styles 有对应规则，而本票明确不改 CSS。
 *
 * 解析保守性（正则歧义，逐条说明）：
 * - 块级 $$…$$：开栏 $$ 必须在行首（最多 3 空格缩进），闭栏 $$ 必须在行尾。
 *   单行 `$$\int...$$` 与多行都支持；开栏行只含 $$ 时按多行块处理，否则按
 *   单行块处理（闭栏必须在同一行行尾）。
 * - 行内 $…$：不跨行；定界符内侧不能紧邻空白（`$ x$`、`$x $` 不匹配）；
 *   开栏 $ 前不能是单词字符或反斜杠（`US$`、`\$` 不匹配）；闭栏 $ 后不能是
 *   单词字符（`$5`、`$x` 不匹配）。这三层守卫让 `$5 和 US$6` 这类货币写法
 *   不会被当成公式。
 * - 围栏代码块内的 $$ / $ 不参与解析（复用 code.ts 的 fencedCodeRanges）。
 */
import type { Range } from "@codemirror/state";
import { Decoration, WidgetType } from "@codemirror/view";
import katex from "katex";
import { isCapabilityEnabled } from "../../lib/capabilities";
import { fencedCodeRanges } from "./code";

interface MathRange {
  from: number;
  to: number;
  tex: string;
  displayMode: boolean;
}

/** 块级开栏：行首最多 3 空格缩进 + $$，捕获其后内容。 */
const BLOCK_OPEN_RE = /^ {0,3}\$\$(.*)$/;
/** 块级闭栏：行尾 $$（其后只有空白）。 */
const BLOCK_CLOSE_RE = /\$\$[ \t]*$/;
/**
 * 行内公式：开栏 $ 前不是单词字符/反斜杠、后不是空白；闭栏 $ 前不是空白、
 * 后不是单词字符；内容不跨行、不含 $。`+?` 要求内容非空，避免 `$$` 被当成
 * 空行内公式（`$$` 由块级解析负责）。
 */
const INLINE_RE = /(?<![\w\\])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\w])/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "html",
      strict: false,
    });
  } catch {
    // throwOnError:false 时 KaTeX 自己兜底；这里再兜一层，渲染失败不能击穿编辑器。
    return `<span class="katex-error">${escapeHtml(tex)}</span>`;
  }
}

/** 块级公式：开栏行首 → 闭栏行尾（单行块到本行尾）。未闭合延伸到文末。 */
function parseBlockMath(docText: string): MathRange[] {
  const lines = docText.split("\n");
  const offsets: number[] = [];
  let acc = 0;
  for (const line of lines) {
    offsets.push(acc);
    acc += line.length + 1;
  }

  const ranges: MathRange[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = BLOCK_OPEN_RE.exec(lines[i]);
    if (!open) {
      i += 1;
      continue;
    }
    const rest = open[1];

    let closeLine: number;
    let tex: string;
    if (rest.trim() !== "" && BLOCK_CLOSE_RE.test(rest)) {
      // 单行块：$$\int_0^1 x\,dx$$
      closeLine = i;
      tex = rest.slice(0, rest.lastIndexOf("$$")).trim();
    } else {
      // 多行块：开栏行只含 $$，向下找行尾 $$；找不到则延伸到文末。
      let j = i + 1;
      while (j < lines.length && !BLOCK_CLOSE_RE.test(lines[j])) j += 1;
      closeLine = j;
      const contentStart = offsets[i] + lines[i].length + 1;
      const contentEnd =
        j >= lines.length
          ? docText.length
          : offsets[j] + lines[j].lastIndexOf("$$");
      tex = docText.slice(contentStart, contentEnd).trim();
    }

    ranges.push({
      from: offsets[i],
      to:
        closeLine >= lines.length
          ? docText.length
          : offsets[closeLine] + lines[closeLine].length,
      tex,
      displayMode: true,
    });
    i = closeLine >= lines.length ? lines.length : closeLine + 1;
  }
  return ranges;
}

/** 行内公式：跳过块级区间与围栏代码块，避免 `$$` 被拆成行内公式。 */
function parseInlineMath(
  docText: string,
  blocks: MathRange[],
  fences: { from: number; to: number }[],
): MathRange[] {
  const ranges: MathRange[] = [];
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(docText)) !== null) {
    const from = m.index;
    const to = m.index + m[0].length;
    if (blocks.some((b) => from < b.to && to > b.from)) continue;
    if (fences.some((f) => from >= f.from && from < f.to)) continue;
    ranges.push({ from, to, tex: m[1], displayMode: false });
  }
  return ranges;
}

class MathWidget extends WidgetType {
  constructor(
    private readonly _tex: string,
    private readonly _displayMode: boolean,
  ) {
    super();
  }

  eq(other: MathWidget): boolean {
    return other._tex === this._tex && other._displayMode === this._displayMode;
  }

  toDOM(): HTMLElement {
    const el = document.createElement(this._displayMode ? "div" : "span");
    el.innerHTML = renderTex(this._tex, this._displayMode);
    return el;
  }

  /**
   * 点击交回 CM6，让光标进入公式、原始定界符重新显示。CM6 只在
   * `ignoreEvent` 返回 false 时把事件当编辑器自己的，所以这里返回 false。
   */
  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 构建公式装饰。活跃公式（与 `[selFrom, selTo]` 重叠）不出装饰，原始源码
 * 保持可编辑；非活跃公式替换成 KaTeX 渲染结果。
 *
 * `selFrom`/`selTo` 取 `state.selection.main` 的两端：选区整个盖住公式也算
 * 活跃；Collapsed 光标落在公式内（块级含首尾）也算活跃。
 */
export function createMathDecorations(
  docText: string,
  selFrom: number,
  selTo: number,
): Range<Decoration>[] {
  if (!isCapabilityEnabled("math")) return [];

  const blocks = parseBlockMath(docText);
  const fences = fencedCodeRanges(docText);
  const ranges = [...blocks, ...parseInlineMath(docText, blocks, fences)].sort(
    (a, b) => a.from - b.from || a.to - b.to,
  );

  const result: Range<Decoration>[] = [];
  for (const r of ranges) {
    // CM6 posAtCoords 对块级 replace widget 只映射到块首/块尾，块级需闭区间。
    const active = r.displayMode
      ? selFrom <= r.to && selTo >= r.from
      : selFrom < r.to && selTo > r.from;
    if (active) continue;
    const widget = new MathWidget(r.tex, r.displayMode);
    result.push(
      r.displayMode
        ? Decoration.replace({ widget, block: true }).range(r.from, r.to)
        : Decoration.replace({ widget }).range(r.from, r.to),
    );
  }
  return result;
}
