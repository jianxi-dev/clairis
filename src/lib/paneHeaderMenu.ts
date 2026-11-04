/**
 * 格头 ⋯ 菜单的静态定义与模式切换纯逻辑（layout-portal 4.1）。
 *
 * 与渲染解耦，便于单测断言「恰好 7 项、顺序与图标」以及「模式只在预览↔编辑」。
 */

import type { IconName } from "../ui/icons";
import type { EditorMode } from "../types";

export type PaneMenuAction =
  | "export"
  | "share"
  | "splitRight"
  | "splitDown"
  | "source"
  | "locate"
  | "copyPath";

export interface PaneMenuItem {
  action: PaneMenuAction;
  label: string;
  icon: IconName;
}

export const PANE_MENU_ITEMS: readonly PaneMenuItem[] = [
  { action: "export", label: "导出", icon: "export" },
  { action: "share", label: "分享", icon: "share" },
  { action: "splitRight", label: "右分", icon: "splitRight" },
  { action: "splitDown", label: "下分", icon: "splitDown" },
  { action: "source", label: "源码模式", icon: "code" },
  { action: "locate", label: "定位", icon: "locate" },
  { action: "copyPath", label: "复制路径", icon: "copyPath" },
];

/** 模式图标只在预览↔编辑间切换；源码模式由 ⋯ 菜单进入。 */
export function nextPaneMode(mode: EditorMode): EditorMode {
  return mode === "preview" ? "edit" : "preview";
}
