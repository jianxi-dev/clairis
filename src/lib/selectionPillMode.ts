/**
 * 选区胶囊的模式判定。
 *
 * 编辑态的 AI 三动作由选区轮盘承载（2026-11-09 维护者裁决），胶囊只在阅读态
 * 出现：选区必须整体落在同一个 `.preview-content` 容器内。编辑态、跨越
 * 编辑/阅读边界、跨越多个预览容器、或落在两者之外的选区一律不显示胶囊。
 */
export type SelectionPillMode = "preview";

export function detectSelectionPillMode(
  selection: Selection | null,
  editorDom: HTMLElement | null,
  previewRoots: readonly HTMLElement[],
): SelectionPillMode | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode) return null;

  if (
    editorDom &&
    editorDom.contains(anchorNode) &&
    editorDom.contains(focusNode)
  ) {
    return null;
  }

  const bothInOnePreview = previewRoots.some(
    (root) => root.contains(anchorNode) && root.contains(focusNode),
  );
  return bothInOnePreview ? "preview" : null;
}
