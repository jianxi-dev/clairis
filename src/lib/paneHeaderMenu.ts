/**
 * 格头 ⋯ 菜单的静态定义与模式切换纯逻辑（layout-portal 4.1；editor-surface-batch18 D1 后只承载格级动作）。
 *
 * 与渲染解耦，便于单测断言「恰好 6 项、顺序与图标」以及「模式只在预览↔编辑」。
 * 文件级动作（导出 / 刷新 / 打开文件位置）已迁到页签右键菜单。
 */

import type { IconName } from "../ui/icons";
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

export interface PaneMenuItem {
  action: PaneMenuAction;
  label: string;
  icon: IconName;
}

export type ExportMenuAction =
  | "exportHtml"
  | "exportPng"
  | "exportPdf"
  | "exportDocx"
  | "exportMdpkg"
  | "exportZip";

export interface ExportMenuItem {
  action: ExportMenuAction;
  label: string;
  icon: IconName;
  disabled?: boolean;
  title?: string;
}

/** 格头 ⋯ 菜单：只保留格级动作，恰好 6 项（editor-surface-batch18 D1）。 */
export const PANE_MENU_ITEMS: readonly PaneMenuItem[] = [
  { action: "new-file", label: "新建文件", icon: "file" },
  { action: "share", label: "分享", icon: "share" },
  { action: "splitRight", label: "右分", icon: "splitRight" },
  { action: "splitDown", label: "下分", icon: "splitDown" },
  { action: "source", label: "源码模式", icon: "code" },
  { action: "locate", label: "定位", icon: "locate" },
];

// 导出能力清单，恰好 6 项；顺序即子菜单渲染顺序（用户 2026-11-10 指定：
// word、mdpkg、图片、pdf、html、zip）。打印不走导出管线，是同级独立菜单项。
export const EXPORT_MENU_ITEMS: readonly ExportMenuItem[] = [
  { action: "exportDocx", label: "Word", icon: "exportWord" },
  { action: "exportMdpkg", label: ".mdpkg", icon: "exportMdpkg" },
  { action: "exportPng", label: "图片", icon: "image" },
  { action: "exportPdf", label: "PDF", icon: "pdf" },
  { action: "exportHtml", label: "HTML", icon: "html" },
  { action: "exportZip", label: "ZIP", icon: "exportZip" },
];

/**
 * AI 停靠窗格的 ⋯ 菜单（layout-portal 9.1）——独立于普通格的 6 项列表，
 * 保证 pane-header 用例对普通格「恰好 6 项」的断言不受影响。
 */
export const AI_PANE_MENU_ITEMS: readonly PaneMenuItem[] = [
  { action: "undockAi", label: "脱离为小窗", icon: "export" },
];

/** 模式图标只在预览↔编辑间切换；源码模式由 ⋯ 菜单进入。 */
export function nextPaneMode(mode: EditorMode): EditorMode {
  return mode === "preview" ? "edit" : "preview";
}
