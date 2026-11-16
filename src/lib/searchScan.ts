/* 文档内搜索扫描（#981 / S-2 扫描规则）。
 *
 * 纯前端即时扫描：默认不分大小写的子串匹配，无「区分大小写 / 整词」开关，
 * 无 AI、无索引。命中文本、行号、文档偏移直接来自原文，保证 `doc.slice(from, to)`
 * 与 `text` 严格一致（定位、高亮、替换都依赖这一点）。
 *
 * 块划分说明：仓库的规范块模型（`editors/block-model.ts`）挂在 CM6 的 Lezer
 * 语法树上，需要 `EditorState`，无法在纯文本函数里复用；这里按**空行分隔段落**
 * 切作块，并给常见块型（标题 / 列表 / 引用 / 围栏代码 / 前置元数据）一个标签，
 * 供结果行的「L行号 · 块」使用。块边界只影响 `blockIndex` / `blockType`，
 * 不影响命中集合本身。
 */

/** 单条命中。 */
export interface SearchScanHit {
  /** 命所在块的序号（0 起，按文档顺序）。 */
  blockIndex: number;
  /** 块型标签：heading / paragraph / fencedCode / blockquote / list / frontmatter / thematicBreak。 */
  blockType: string;
  /** 命中起始行的 1 起行号。 */
  line: number;
  /** 命中在文档中的起始偏移（含）。 */
  from: number;
  /** 命中在文档中的结束偏移（不含）。 */
  to: number;
  /** 命中的原文文本（保留原文大小写）。 */
  text: string;
  /** 命中所在行的单行上下文（不含换行）。 */
  context: string;
}

/** 空行分隔出的块。 */
export interface SearchScanBlock {
  index: number;
  type: string;
  /** 块起始偏移（含）。 */
  from: number;
  /** 块结束偏移（不含，不含尾随换行）。 */
  to: number;
  /** 块首行的 1 起行号。 */
  startLine: number;
  text: string;
}

/** 转义正则元字符：查询按字面子串匹配。 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 块首行判定块型；识别不出来一律段落。 */
function detectBlockType(firstLine: string, blockIndex: number): string {
  const line = firstLine;
  if (/^#{1,6}\s/.test(line)) return "heading";
  if (/^\s*(?:```|~~~)/.test(line)) return "fencedCode";
  if (/^\s*>/.test(line)) return "blockquote";
  if (/^\s*(?:[-*+]|\d+[.)])\s/.test(line)) return "list";
  if (/^\s*(?:[-_*]\s*){3,}$/.test(line)) return "thematicBreak";
  // 前置元数据只可能是文档开头的 `---` 块。
  if (blockIndex === 0 && /^---\s*$/.test(line)) return "frontmatter";
  return "paragraph";
}

/**
 * 按空行把文档切成块。
 *
 * 逐行扫描一次，记录每行的起始偏移与行号；连续的非空行并成一块，
 * 空行只作分隔符、不产出块。块 `to` 取末行的结束偏移（不含换行）。
 */
export function splitSearchBlocks(text: string): SearchScanBlock[] {
  const blocks: SearchScanBlock[] = [];
  let blockLines: { start: number; end: number; lineNo: number }[] = [];

  const flush = () => {
    if (blockLines.length === 0) return;
    const first = blockLines[0];
    const last = blockLines[blockLines.length - 1];
    const from = first.start;
    const to = last.end;
    const blockText = text.slice(from, to);
    const firstLine = blockText.split("\n", 1)[0] ?? "";
    blocks.push({
      index: blocks.length,
      type: detectBlockType(firstLine, blocks.length),
      from,
      to,
      startLine: first.lineNo,
      text: blockText,
    });
    blockLines = [];
  };

  let pos = 0;
  let lineNo = 1;
  while (pos <= text.length) {
    let newline = text.indexOf("\n", pos);
    if (newline === -1) newline = text.length;
    const line = text.slice(pos, newline);
    if (line.trim() === "") {
      flush();
    } else {
      blockLines.push({ start: pos, end: newline, lineNo });
    }
    if (newline === text.length) break;
    pos = newline + 1;
    lineNo += 1;
  }
  flush();

  return blocks;
}

/**
 * 扫描全文命中。
 *
 * 查询按 trim 后的字面子串做不分大小写匹配；空 / 纯空白查询返回 `[]`
 * （零宽匹配防护：非空查询的每次推进至少前进一个匹配长度，不会死循环）。
 */
export function searchScan(text: string, query: string): SearchScanHit[] {
  const needle = query.trim();
  if (needle.length === 0) return [];

  let matcher: RegExp;
  try {
    matcher = new RegExp(escapeRegExp(needle), "gi");
  } catch {
    return [];
  }

  const blocks = splitSearchBlocks(text);
  const hits: SearchScanHit[] = [];

  for (const block of blocks) {
    matcher.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(block.text)) !== null) {
      if (match[0].length === 0) {
        // 理论上网关已挡住空查询，这里再兜一层：零宽匹配只推进游标。
        matcher.lastIndex += 1;
        continue;
      }
      const from = block.from + match.index;
      const to = from + match[0].length;
      const localFrom = match.index;
      const lineStart = block.text.lastIndexOf("\n", localFrom - 1) + 1;
      let lineEnd = block.text.indexOf("\n", to - block.from);
      if (lineEnd === -1) lineEnd = block.text.length;
      const newlinesBefore =
        block.text.slice(0, localFrom).split("\n").length - 1;
      hits.push({
        blockIndex: block.index,
        blockType: block.type,
        line: block.startLine + newlinesBefore,
        from,
        to,
        text: match[0],
        context: block.text.slice(lineStart, lineEnd),
      });
    }
  }

  return hits;
}
