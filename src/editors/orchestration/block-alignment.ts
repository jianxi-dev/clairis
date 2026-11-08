/* 块对齐（shell-editor-batch5 / design D16，迁移自 md-bundle commands.ts
 * `toggleBlockAlignment` / `clearBlockAlignment`）。
 *
 * 作者语法沿用 Pandoc 围栏 div：`::: {.align-left|center|right}` … `:::`。
 * 纯函数：只改目标块及其包裹标记，其余字节逐字保留（与「源码无损」红线一致）。
 * 切换语义：同对齐再应用 → 拆掉包裹；异对齐 → 换类名；无包裹 → 新包一层。
 */

export type BlockAlignment = "left" | "center" | "right";

/** 块首行的对齐围栏标记；没有匹配返回 null。 */
const ALIGN_OPEN_RE = /^:::\s*\{\.align-(left|center|right)\}\s*\n/;

/** 闭合标记：块尾单独一行的 `:::`。 */
const ALIGN_CLOSE_RE = /\n:::\s*$/;

/** 读出块上已有的对齐；没有（或只有半截包裹）返回 null。 */
export function blockAlignmentOf(blockText: string): BlockAlignment | null {
  const match = ALIGN_OPEN_RE.exec(blockText);
  if (!match) return null;
  if (!ALIGN_CLOSE_RE.test(blockText)) return null;
  return match[1] as BlockAlignment;
}

/** 拆掉对齐包裹，取出内部内容。 */
function stripAlignmentWrapper(blockText: string): string {
  const openLineEnd = blockText.indexOf("\n");
  const innerStart = openLineEnd + 1;
  const innerEnd = blockText.lastIndexOf("\n:::");
  return blockText.slice(innerStart, innerEnd);
}

/**
 * 切换块对齐（块文本级）：同对齐拆除，异对齐换类名，无包裹新包。
 * 返回新块文本；块为空或没有意义时原样返回。
 */
export function toggleBlockAlignmentText(
  blockText: string,
  alignment: BlockAlignment,
): string {
  if (blockText.trim() === "") return blockText;
  const existing = blockAlignmentOf(blockText);
  const inner = existing ? stripAlignmentWrapper(blockText) : blockText;
  if (existing === alignment) return inner;
  return `::: {.align-${alignment}}\n${inner}\n:::`;
}

/** 清除块对齐（块文本级）；没有对齐包裹时原样返回。 */
export function clearBlockAlignmentText(blockText: string): string {
  if (!blockAlignmentOf(blockText)) return blockText;
  return stripAlignmentWrapper(blockText);
}

/**
 * 切换块对齐：同对齐拆除，异对齐换类名，无包裹新包。
 * 返回新文档；块为空或范围非法时原样返回。
 */
export function toggleBlockAlignment(
  docText: string,
  blockFrom: number,
  blockTo: number,
  alignment: BlockAlignment,
): string {
  if (blockTo <= blockFrom) return docText;
  const blockText = docText.slice(blockFrom, blockTo);
  const nextBlock = toggleBlockAlignmentText(blockText, alignment);
  if (nextBlock === blockText) return docText;
  return docText.slice(0, blockFrom) + nextBlock + docText.slice(blockTo);
}

/** 清除块对齐；没有对齐包裹时原样返回。 */
export function clearBlockAlignment(
  docText: string,
  blockFrom: number,
  blockTo: number,
): string {
  if (blockTo <= blockFrom) return docText;
  const blockText = docText.slice(blockFrom, blockTo);
  const nextBlock = clearBlockAlignmentText(blockText);
  if (nextBlock === blockText) return docText;
  return docText.slice(0, blockFrom) + nextBlock + docText.slice(blockTo);
}

/** 对齐 → 预览 CSS 类名。 */
export function alignmentClass(alignment: BlockAlignment): string {
  return `layout-align-${alignment}`;
}
