/* 块级结构动作（#114）：复制 / 删除 / 缩进，均为纯函数。
 *
 * 只改目标块及其接缝处的空行，其余字节逐字保留——与「源码无损」红线一致。
 */

function trimNewlines(text: string): string {
  return text.replace(/^\n+/, "").replace(/\n+$/, "");
}

/** 在块后插入一份完全相同的内容，之间用一个空行隔开。 */
export function computeBlockDuplicate(
  docText: string,
  blockFrom: number,
  blockTo: number,
): string {
  const block = docText.slice(blockFrom, blockTo);
  if (block.length === 0) return docText;
  const head = trimNewlines(docText.slice(0, blockFrom));
  const tail = trimNewlines(docText.slice(blockTo));
  const body = trimNewlines(block);
  if (body.length === 0) return docText;
  const parts = [head, body, body, tail].filter((part) => part.length > 0);
  const joined = parts.join("\n\n");
  return docText.endsWith("\n") ? `${joined}\n` : joined;
}

/** 删除块；只在删除接缝处规整空行，文档结尾的换行保持原状。 */
export function computeBlockDelete(
  docText: string,
  blockFrom: number,
  blockTo: number,
): string {
  if (blockTo <= blockFrom) return docText;
  const before = trimNewlines(docText.slice(0, blockFrom));
  const after = trimNewlines(docText.slice(blockTo));
  const parts = [before, after].filter((part) => part.length > 0);
  const joined = parts.join("\n\n");
  if (joined.length === 0) return "";
  return docText.endsWith("\n") ? `${joined}\n` : joined;
}

/** 每行前缀两个空格；空行不加（加了就成了代码块）。 */
export function indentBlock(blockText: string): string {
  return blockText
    .split("\n")
    .map((line) => (line.trim() === "" ? line : `  ${line}`))
    .join("\n");
}

/** 每行剥掉最多两个前导空格；没有可剥的就原样返回。 */
export function outdentBlock(blockText: string): string {
  return blockText
    .split("\n")
    .map((line) => line.replace(/^ {1,2}/, ""))
    .join("\n");
}
