/**
 * 动作提示元数据注册表（既有 SSOT，原 `TooltipLayer.tsx` 内的 `TIP_META`）。
 *
 * 键位显示口径 `⌘ + X` 见 R-26 锚点 A-26.2/A-26.3。悬停胶囊与菜单行快捷键区
 * 都从这里读：新增键位只改本文件，两处消费点自动同源。查不到的动作由消费方
 * 留白，不猜键位、不另立映射表。
 */

export interface ActionTip {
  /** 展示形式，如 `⌘ + C`。 */
  shortcut: string;
  /** 纯图标按钮提示附带的 markdown 用法。 */
  markdown?: string;
}

export const ACTION_TIPS: Readonly<Record<string, ActionTip>> = {
  "format-underline": { shortcut: "⌘ + U", markdown: "~文本~ 空格" },
  duplicate: { shortcut: "⌘ + C" },
};
