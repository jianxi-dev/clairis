import { ACTION_TIPS } from "./action-tips";
import { SHORTCUTS } from "./shortcuts";

const KEYS_BY_ID = new Map(SHORTCUTS.map((s) => [s.id, s.keys]));
const KEYS_BY_LABEL = new Map(SHORTCUTS.map((s) => [s.label, s.keys]));

/**
 * 菜单行动作键位显示，只读既有注册表（动作提示元数据 + `SHORTCUTS`）。
 * 查不到返回空串，由调用方留白。
 */
export function menuShortcut(id: string, label?: string): string {
  const tip = ACTION_TIPS[id];
  if (tip) return tip.shortcut;
  const byId = KEYS_BY_ID.get(id);
  if (byId) return byId;
  if (label) return KEYS_BY_LABEL.get(label) ?? "";
  return "";
}
