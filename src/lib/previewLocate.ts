/**
 * 预览态定位（#1146）：在渲染后的预览子树里按序数找第 N 处命中。
 *
 * 搜索命中集合来自原文（`searchScan`），预览 DOM 是原文的渲染结果，二者在
 * 文档顺序上一一对应。因此按文本节点顺序累计命中词出现次数，第 `ordinal` 处
 * （0 起）即对应该序号的搜索结果——与 ⌘N 的 target、Enter / 点击的选中 index
 * 共用同一套序数语义。同一节点内多次出现逐个计数。
 *
 * 纯查询函数，不滚动：返回应滚动到视口中心的元素（命中所在文本节点的父元素），
 * 越界（序数超出实际出现次数）返回 `null`，由调用方跳过滚动。
 */

/**
 * 在 `root` 的文本节点里找第 `ordinal` 处（0 起）包含 `needle` 的元素。
 *
 * 大小写不敏感；`needle` 为空或 `ordinal < 0` 时无解，返回 `null`。
 */
export function findPreviewMatchNode(
  root: ParentNode,
  needle: string,
  ordinal: number,
): HTMLElement | null {
  const lower = needle.toLowerCase();
  if (lower.length === 0 || ordinal < 0) return null;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let node = walker.nextNode();
  while (node) {
    const text = (node.textContent ?? "").toLowerCase();
    let from = 0;
    for (;;) {
      const at = text.indexOf(lower, from);
      if (at < 0) break;
      if (seen === ordinal) {
        return (node.parentElement as HTMLElement | null) ?? null;
      }
      seen += 1;
      from = at + lower.length;
    }
    node = walker.nextNode();
  }
  return null;
}
