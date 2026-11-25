/**
 * 编辑器交互的验收锚点 —— e2e 的唯一数值来源。
 *
 * 以前每个 spec 各自手抄数字（236、32、42×26…），抄错就永远绿。这里集中一份，
 * spec 只做断言，不改数字。
 *
 * 来源：
 * - `openspec/specs/editing/spec.md` E-7（手柄 42×26、菜单 176 / 行高 32 / 图标 18；
 *   行高与图标 2026-11-25 经 `menu-geometry-spec-sync` 裁定对齐实现，#1434）
 * - `md-bundle/docs/doubao-editor-study/ui-gap-and-target.md` §2.2（图标基准，见上）
 *   §2.3（菜单宽度与行高）§4.3（转为 10 项）
 * - `openspec/changes/editor-block-parity/anchors.md`（R-1 表格结构项 3 个）
 */

export const EDITOR_ANCHORS = {
  /** 块手柄药丸尺寸（E-7）。 */
  handle: { width: 42, height: 26 },
  /** 块菜单（E-7；豆包 §2.3；行高 2026-11-25 随 menu-geometry-spec-sync 收敛 32）。 */
  menu: { width: 176, rowHeight: 32 },
  /** 菜单行内图标渲染尺寸（设计系统 §2.1 常规档；E-47 由 20px 收敛）。 */
  menuIcon: 18,
  /** 「转为」单元数（豆包 §4.3；editor-refine-batch2 D1 起末尾固定「高亮」「标注」两项）。 */
  convertCells: 11,
  /** 新增手柄菜单项总数（D7：基础 10 + 常用 8），全局与单元格菜单共用（A-9.3）。 */
  addMenuItems: 18,
  /** 状态栏页面宽度弹窗（G-12 / #843）：未选中填充不透明度上限、同色相容差。 */
  widthPanel: { unselectedFillOpacityMax: 0.45, hueToleranceDeg: 5 },
} as const;

/** 允许的测量误差（取整与边框造成的 1px 级偏差）。 */
export const ANCHOR_TOLERANCE_PX = 1;
