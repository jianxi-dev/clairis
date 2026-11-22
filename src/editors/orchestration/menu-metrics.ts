/**
 * 菜单几何常量（#373）。
 *
 * 转换菜单、新增手柄的插入菜单、以及各级二级面板共用同一组尺寸：菜单在相近
 * 位置互相替换时宽度不变，指针不需要重新找目标。
 */

/** 菜单统一宽度（px）。 */
export const MENU_WIDTH = 176;

/** 菜单行高（px）。 */
export const MENU_ROW_HEIGHT = 36;

/** 字号（px）：三类菜单统一（与 editor.css 的 --menu-font-size 对齐，#912）。 */
export const MENU_FONT_SIZE = 14;

/** 行内容行高（px）：与 --menu-line-height 对齐。 */
export const MENU_LINE_HEIGHT = 21;

/** 圆角（px）：与 --menu-radius 对齐。 */
export const MENU_RADIUS = 8;

/** 阴影：指向主题 token（design-system §5；editor-batch3-lowcost D3）。 */
export const MENU_SHADOW = "var(--shadow-menu)";
