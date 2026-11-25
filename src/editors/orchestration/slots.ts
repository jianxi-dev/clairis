import type { IconName } from "../../ui/icons";

export interface ToolbarSlotItem {
  id: string;
  label: string;
  icon: IconName;
  group: "ai" | "format" | "align";
}

/**
 * 按用户覆盖过滤默认集合，保持覆盖给出的顺序。
 *
 * 默认集合的唯一来源是数据面（`html-toolbar.default.json`，经 Rust `load_surfaces`
 * 下发）；本函数只做「默认 ← 覆盖」的纯过滤，不再持有任何兜底常量。
 * 未知 id 过滤 + 去重；覆盖为空 / 全非法时返回完整默认集合。
 */
export function resolveToolbarOrder(
  configured: string[] | null | undefined,
  defaultItems: readonly ToolbarSlotItem[],
): string[] {
  const defaults = defaultItems.map((item) => item.id);
  if (!Array.isArray(configured) || configured.length === 0) {
    return defaults;
  }
  const known = new Set(defaults);
  const out: string[] = [];
  for (const id of configured) {
    if (!known.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out.length > 0 ? out : defaults;
}
