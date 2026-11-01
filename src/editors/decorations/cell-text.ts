/* GFM 管道表格单元格的文本工具（移植自 md-bundle
 * packages/editor/src/decorations/cell-text.ts，仅取 `sanitizeCellText`）。
 *
 * 斜杠菜单插入表格时用它把用户输入压平；单元格渲染（`renderCellText`）
 * 与背景 span 解析属于表格装饰批次，未随本模块移植。
 */

/**
 * 压平文本，使其可安全放进 GFM 管道表格的单元格。
 *
 * 换行会开启新块、裸 `|` 会多出一列，两者都会让下次解析静默破坏表格结构，
 * 所以一律替换为空格：丢一个字符好过毁掉文档。
 */
export function sanitizeCellText(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(/\|/g, " ");
}
