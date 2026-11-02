/* 行内代码与围栏代码块装饰（移植自 md-bundle
 * packages/editor/src/decorations/code.ts）。
 *
 * 行内代码：
 * - 非活跃块：反引号隐藏，只留底色。
 * - 活跃块：底色 + 低透明度的反引号。
 *
 * 围栏代码块：
 * - 开栏行的语言名渲染成 widget。
 * - 非活跃块：开栏行（围栏 + info 串）与闭栏行都替换掉，DOM 里不残留 ``` / ~~~。
 * - 活跃块：不替换，原始源码保持可见可编辑。
 * - 无语言名 → 不出标签、不报错。
 */
import type { Range } from "@codemirror/state";
import { Decoration, WidgetType } from "@codemirror/view";

export const inlineCodeRegex = /(`+)(.+?)\1/g;

export const INLINE_CODE_CLASS = "cm-inline-code";
export const CODE_MARKER_ACTIVE_CLASS = "cm-code-marker-active";
export const FENCED_CODE_CLASS = "cm-fenced-code";
// 围栏标记行单独收高，否则非活跃块的上/下围栏各占一整行，卡片内多出空行。
export const FENCED_CODE_FENCE_START_CLASS = "cm-fenced-fence-start";
export const FENCED_CODE_FENCE_END_CLASS = "cm-fenced-fence-end";
export const FENCED_CODE_LANGUAGE_CLASS = "cm-fenced-code-language";
export const FENCED_CODE_LANGUAGE_ACTIVE_CLASS =
  "cm-fenced-code-language-active";
export const BLOCK_ACTIVE_CLASS = "cm-block-active";
export const BLOCK_INACTIVE_CLASS = "cm-block-inactive";

/**
 * 围栏代码块开栏行：最多 3 个空格缩进、3 个以上反引号或波浪线、可选 info 串。
 * 与 `mermaid.ts` 共用同一条 CommonMark 形状，保证两个模块对「哪行开栏」一致。
 */
const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\n]*)$/;

/**
 * 围栏代码块闭栏行：与开栏同字符、长度不短于开栏，其后只有空白。
 */
const FENCE_CLOSE_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*$/;

/**
 * 一个已闭合的围栏代码块。所有偏移都是行内容范围——结尾换行被刻意排除，
 * 因为 `Decoration.replace` 不能跨行。
 */
interface FencedBlock {
  openStart: number;
  openEnd: number;
  closeStart: number;
  closeEnd: number;
  language: string;
}

/**
 * 渲染开栏行语言名的 widget。
 */
class CodeLanguageLabel extends WidgetType {
  constructor(
    readonly language: string,
    readonly active: boolean,
  ) {
    super();
  }

  eq(other: CodeLanguageLabel): boolean {
    return other.language === this.language && other.active === this.active;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = FENCED_CODE_LANGUAGE_CLASS;
    span.textContent = this.language;
    if (this.active) {
      span.classList.add(FENCED_CODE_LANGUAGE_ACTIVE_CLASS);
    }
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 找出所有已闭合的围栏代码块，把每个开栏与匹配的闭栏配对（同字符、不短于
 * 开栏）。未闭合的开栏结束扫描：其后每一行都是围栏内容，没有下一个可配对的
 * 块，也没有可隐藏的闭栏标记。
 */
function parseFencedBlocks(text: string): FencedBlock[] {
  const lines = text.split("\n");
  const offsets: number[] = [];
  let acc = 0;
  for (const line of lines) {
    offsets.push(acc);
    acc += line.length + 1;
  }

  const blocks: FencedBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = FENCE_OPEN_RE.exec(lines[i]);
    if (!open) {
      i += 1;
      continue;
    }

    const fenceChar = open[2][0];
    const fenceLen = open[2].length;
    const language = open[3].trim().split(/\s+/)[0] ?? "";

    let close = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = FENCE_CLOSE_RE.exec(lines[j]);
      if (
        candidate &&
        candidate[2][0] === fenceChar &&
        candidate[2].length >= fenceLen
      ) {
        close = j;
        break;
      }
    }
    if (close === -1) break;

    blocks.push({
      openStart: offsets[i],
      openEnd: offsets[i] + lines[i].length,
      closeStart: offsets[close],
      closeEnd: offsets[close] + lines[close].length,
      language,
    });
    i = close + 1;
  }
  return blocks;
}

/**
 * 未闭合开栏行的起点（没有则 null）。扫描到第一个找不到闭栏的开栏即停。
 */
function findUnclosedFenceStart(text: string): number | null {
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const open = FENCE_OPEN_RE.exec(lines[i]);
    if (!open) {
      offset += lines[i].length + 1;
      continue;
    }
    const fenceChar = open[2][0];
    const fenceLen = open[2].length;
    let close = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = FENCE_CLOSE_RE.exec(lines[j]);
      if (
        candidate &&
        candidate[2][0] === fenceChar &&
        candidate[2].length >= fenceLen
      ) {
        close = j;
        break;
      }
    }
    if (close === -1) return offset;
    // 跳到闭栏之后继续找下一个开栏。
    for (let j = i; j <= close; j += 1) offset += lines[j].length + 1;
    i = close;
  }
  return null;
}

/**
 * 为整篇文档生成行内代码与围栏代码块装饰。
 *
 * @param text 全文。
 * @param activeFrom 活跃块起点（无活跃块时为 -1）。
 * @param activeTo 活跃块终点（无活跃块时为 -1）。
 */
export function createCodeDecorations(
  text: string,
  activeFrom: number = -1,
  activeTo: number = -1,
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  // 围栏代码块先行：行内代码扫描必须跳过围栏块占用的区间，否则 ```` ```ts ````
  // 的开栏反引号会被当成行内代码（`(`+)(.+?)\1` 会跨行匹配到闭栏），
  // 与围栏块的行装饰重叠、CM6 直接拒绝。
  const fencedBlocks = parseFencedBlocks(text);
  // 未闭合围栏（例如刚敲下 ```` ```ts ```` 还没写闭栏）没有可配对的块，但它的
  // 反引号同样不是行内代码：从开栏行起直到文末都算围栏区间。
  const unclosedFenceStart = findUnclosedFenceStart(text);
  const inFencedBlock = (from: number, to: number): boolean =>
    (unclosedFenceStart !== null && to > unclosedFenceStart) ||
    fencedBlocks.some((block) => from < block.closeEnd && to > block.openStart);

  // --- 行内代码 ---
  inlineCodeRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    if (inFencedBlock(from, to)) continue;
    const backtickLen = match[1].length;
    const isActive = activeFrom >= 0 && from >= activeFrom && to <= activeTo;

    if (isActive) {
      // 活跃：低透明度反引号 + 带样式的正文
      decorations.push(
        Decoration.mark({ class: CODE_MARKER_ACTIVE_CLASS }).range(
          from,
          from + backtickLen,
        ),
      );
      decorations.push(
        Decoration.mark({
          class: `${INLINE_CODE_CLASS} ${BLOCK_ACTIVE_CLASS}`,
        }).range(from + backtickLen, to - backtickLen),
      );
      decorations.push(
        Decoration.mark({ class: CODE_MARKER_ACTIVE_CLASS }).range(
          to - backtickLen,
          to,
        ),
      );
    } else {
      // 非活跃：隐藏反引号，只留样式
      decorations.push(Decoration.replace({}).range(from, from + backtickLen));
      decorations.push(
        Decoration.mark({ class: INLINE_CODE_CLASS }).range(
          from + backtickLen,
          to - backtickLen,
        ),
      );
      decorations.push(Decoration.replace({}).range(to - backtickLen, to));
    }
  }

  // --- 围栏代码块 ---
  // 全文行首偏移，用于给围栏块每一行上色。
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
  }

  for (const block of fencedBlocks) {
    // mermaid 块由 mermaid 装饰整体替换；这里再替换会与它重叠，CM6 会拒绝。
    if (block.language === "mermaid") continue;

    // 重叠判定（与 mermaid 装饰同形）：光标落在块内任意位置都算活跃。
    const isActive =
      activeFrom >= 0 &&
      block.openStart < activeTo &&
      block.closeEnd > activeFrom;

    // 语言标签 widget 锚在开栏行内容之后。
    if (block.language.length > 0) {
      decorations.push(
        Decoration.widget({
          widget: new CodeLanguageLabel(block.language, isActive),
          side: 1,
        }).range(block.openEnd),
      );
    }

    // 给整块每一行（开栏到闭栏）打行装饰，主题才能画出一整个圆角容器（#377）。
    for (const start of lineStarts) {
      if (start < block.openStart) continue;
      if (start > block.closeStart) break;
      const fenceClass =
        start === block.openStart
          ? FENCED_CODE_FENCE_START_CLASS
          : start === block.closeStart
            ? FENCED_CODE_FENCE_END_CLASS
            : "";
      const classes = [
        FENCED_CODE_CLASS,
        fenceClass,
        isActive ? BLOCK_ACTIVE_CLASS : BLOCK_INACTIVE_CLASS,
      ].filter(Boolean);
      decorations.push(
        Decoration.line({ class: classes.join(" ") }).range(start),
      );
    }

    // 非活跃：替换开栏行（围栏 + info 串）与闭栏行，让代码块读起来干净。
    // 活跃：不替换，原始源码保持可见可编辑。只替换两行标记，正文行不动。
    if (!isActive) {
      decorations.push(
        Decoration.replace({}).range(block.openStart, block.openEnd),
      );
      decorations.push(
        Decoration.replace({}).range(block.closeStart, block.closeEnd),
      );
    }
  }

  return decorations;
}
