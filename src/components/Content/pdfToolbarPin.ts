/**
 * 活动 PDF 视图的「按钮栏固定」开关回调，按文件路径登记。
 * 视图级状态：切页签即卸载失效，不写配置、不写文档。
 */
const pdfToolbarPinToggles = new Map<string, () => void>();

/** 全局快捷键（⌘⇧D）入口：切换指定 PDF 视图的按钮栏固定状态。 */
export function togglePdfToolbarPin(path: string): void {
  pdfToolbarPinToggles.get(path)?.();
}

/** PdfViewer 挂载时登记本视图的固定开关，返回卸载时的注销函数。 */
export function setPdfToolbarPinToggle(
  path: string,
  toggle: () => void,
): () => void {
  pdfToolbarPinToggles.set(path, toggle);
  return () => {
    pdfToolbarPinToggles.delete(path);
  };
}
