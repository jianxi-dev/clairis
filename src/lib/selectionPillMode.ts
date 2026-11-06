/**
 * 选区胶囊的模式判定。
 *
 * 编辑态选区必须整体落在 CodeMirror 的 DOM 内；阅读态选区必须整体落在同一个
 * `.preview-content` 容器内。跨越编辑/阅读边界、跨越多个预览容器、或落在
 * 两者之外的选区一律视为无效（不显示胶囊）。抽成纯函数以便单测。
 */
export type SelectionPillMode = "edit" | "preview";

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
    return "edit";
  }

  const bothInOnePreview = previewRoots.some(
    (root) => root.contains(anchorNode) && root.contains(focusNode),
  );
  return bothInOnePreview ? "preview" : null;
}
