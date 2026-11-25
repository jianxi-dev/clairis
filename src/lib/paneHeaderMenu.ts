/**
 * 格头 ⋯ 菜单的纯逻辑（layout-portal 4.1；editor-surface-batch18 D1 后只承载格级动作）。
 *
 * 菜单项的唯一来源是数据面 `menus`（见 `src/lib/dataSurfaces/store.ts` 的
 * `getMenuItems`）；本文件只保留动作 id 联合类型与模式切换纯逻辑，不再持有
 * 任何兜底常量（避免默认源双真相）。
 */

import type { EditorMode } from "../types";

export type PaneMenuAction =
  | "new-file"
  | "share"
  | "splitRight"
  | "splitDown"
  | "source"
  | "locate"
  | "copyPath"
  | "undockAi"
  | "closePane";

export type ExportMenuAction =
  | "exportHtml"
  | "exportPng"
  | "exportPdf"
  | "exportDocx"
  | "exportMdpkg"
  | "exportZip";

/** 模式图标只在预览↔编辑间切换；源码模式由 ⋯ 菜单进入。 */
export function nextPaneMode(mode: EditorMode): EditorMode {
  return mode === "preview" ? "edit" : "preview";
}
