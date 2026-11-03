/**
 * 编辑器交互的验收锚点 —— e2e 的唯一数值来源。
 *
 * 以前每个 spec 各自手抄数字（236、32、42×26…），抄错就永远绿。这里集中一份，
 * spec 只做断言，不改数字。
 *
 * 来源：
 * - `openspec/specs/editing/spec.md` E-7（手柄 42×26、菜单 264 / 行高 36，2026-11-03 放大一档）
 * - `md-bundle/docs/doubao-editor-study/ui-gap-and-target.md` §2.2（图标 20px，同上放大一档）
 *   §2.3（菜单宽度与行高）§4.3（转为 10 项）
 * - `openspec/changes/editor-block-parity/anchors.md`（R-1 表格结构项 3 个）
 */

export const EDITOR_ANCHORS = {
  /** 块手柄药丸尺寸（E-7）。 */
  handle: { width: 42, height: 26 },
  /** 块菜单（E-7；豆包 §2.3）。 */
  menu: { width: 264, rowHeight: 36 },
  /** 菜单行内图标渲染尺寸（豆包 §2.2）。 */
  menuIcon: 20,
  /** 「转为」单元数（豆包 §4.3）。 */
  convertCells: 10,
  /** 表格块菜单的结构开关数（change editor-block-parity R-1）。 */
  tableStructuralSwitches: 3,
} as const;

/** 允许的测量误差（取整与边框造成的 1px 级偏差）。 */
export const ANCHOR_TOLERANCE_PX = 1;
