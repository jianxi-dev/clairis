/* 数据面加载：一次 `load_surfaces` 调用拿回全部已登记面的有效集合与告警。
 *
 * 与 `src/lib/extensions/bundle.ts` 同款纪律：任何调用异常或返回形状不对都静默
 * 降级（空集合 / 空告警），不抛错——`load_surfaces` 在纯浏览器或老版本里不存在。
 *
 * 有效集合 = 默认 ← 用户覆盖：未知 id 过滤并聚合为一条告警；覆盖为空或全部
 * 非法时回落默认（DS-1）。默认的唯一来源是仓库内 JSON 文件（Rust 侧内嵌），
 * 前端不再保留任何兜底常量。
 *
 * 形状（DS-4）：`html-toolbar` 项为 `ToolbarSlotItem`；`menus` 项为 `MenuItem`
 * （含 group / order / action / enabled）。归一化按面 id 分派。
 */

import type { ToolbarSlotItem } from "../../editors/orchestration/slots";
import type { IconName } from "../../ui/icons";

/** Rust `load_surfaces` 返回的单面形状（items 为原始 JSON，按面分派解析）。 */
export interface SurfacePayload {
  id: string;
  items: unknown[];
  warnings: string[];
}

/** 菜单项（design D2）：action 是代码侧动作 id，数据声明顺序/可见性/文案。 */
export interface MenuItem {
  id: string;
  group: string;
  order: number;
  label: string;
  icon: IconName;
  action: string;
  enabled: boolean;
}

/** 归一化后的面：items 为原始项（消费端按面 id 解释）。 */
export interface NormalizedSurface {
  id: string;
  items: unknown[];
  warnings: string[];
}

/**
 * 前端已知面清单。必须与 Rust `src-tauri/src/surfaces.rs` 的 `SURFACES` 表
 * 逐值一致——由 `src/__tests__/lib/dataSurfacesParity.test.ts` 对账锁定。
 */
export const SUPPORTED_SURFACES = ["html-toolbar", "menus"] as const;

/** 菜单六处消费端分组（与 Rust `MENU_GROUPS` 对账）。 */
export const MENU_GROUPS = [
  "pane-header",
  "ai-pane",
  "export-submenu",
  "tab-context",
  "preview-context",
  "ai-float-presets",
] as const;

export type MenuGroup = (typeof MENU_GROUPS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TOOLBAR_GROUPS = new Set(["ai", "format", "align"]);

/** 宽松解析单个工具条 item；缺字段或类型不对返回 null。 */
function toToolbarItem(raw: unknown): ToolbarSlotItem | null {
  if (!isRecord(raw)) return null;
  const { id, label, icon, group } = raw;
  if (typeof id !== "string" || id === "") return null;
  if (typeof label !== "string") return null;
  if (typeof icon !== "string") return null;
  if (typeof group !== "string" || !TOOLBAR_GROUPS.has(group)) return null;
  return {
    id,
    label,
    icon: icon as ToolbarSlotItem["icon"],
    group: group as ToolbarSlotItem["group"],
  };
}

/** 宽松解析单个菜单项；缺字段、类型错、未知 group 返回 null（DS-4）。 */
export function toMenuItem(raw: unknown): MenuItem | null {
  if (!isRecord(raw)) return null;
  const { id, group, order, label, icon, action, enabled } = raw;
  if (typeof id !== "string" || id === "") return null;
  if (typeof group !== "string" || !MENU_GROUPS.includes(group as MenuGroup)) {
    return null;
  }
  if (typeof order !== "number" || !Number.isFinite(order)) return null;
  if (typeof label !== "string" || label === "") return null;
  if (typeof icon !== "string" || icon === "") return null;
  if (typeof action !== "string" || action === "") return null;
  if (typeof enabled !== "boolean") return null;
  return {
    id,
    group,
    order,
    label,
    icon: icon as IconName,
    action,
    enabled,
  };
}

/** 按面 id 解析 item；形状不对的项被丢弃（不整体失败）。 */
function parseItems(id: string, rawItems: unknown[]): unknown[] {
  if (id === "menus") {
    const out: MenuItem[] = [];
    for (const entry of rawItems) {
      const item = toMenuItem(entry);
      if (item !== null) out.push(item);
    }
    return out;
  }
  const out: ToolbarSlotItem[] = [];
  for (const entry of rawItems) {
    const item = toToolbarItem(entry);
    if (item !== null) out.push(item);
  }
  return out;
}

/** 从 `load_surfaces` 返回值里取单面；形状不对返回 null。 */
function toSurface(raw: unknown): SurfacePayload | null {
  if (!isRecord(raw)) return null;
  const { id, items, warnings } = raw;
  if (typeof id !== "string" || !Array.isArray(items)) return null;
  const warnList = Array.isArray(warnings)
    ? warnings.filter((w): w is string => typeof w === "string")
    : [];
  return { id, items: parseItems(id, items), warnings: warnList };
}

/**
 * 归一化单个面：默认 ← 用户覆盖。
 *
 * 覆盖为 null / 空 / 全非法时回落默认；覆盖内未知 id 过滤并聚合为一条告警；
 * 重复 id 去重保留首个。纯函数，供测试直接驱动。
 */
export function normalizeSurface(
  surface: SurfacePayload,
  override: string[] | null | undefined,
): NormalizedSurface {
  const defaults = surface.items;
  const known = new Set(
    defaults
      .map((item) => (isRecord(item) ? item.id : undefined))
      .filter((id): id is string => typeof id === "string"),
  );
  if (!Array.isArray(override) || override.length === 0) {
    return { id: surface.id, items: defaults, warnings: surface.warnings };
  }
  const out: unknown[] = [];
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const id of override) {
    if (!known.has(id)) {
      if (!unknown.includes(id)) unknown.push(id);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const item = defaults.find(
      (entry) => isRecord(entry) && entry.id === id,
    );
    if (item !== undefined) out.push(item);
  }
  const warnings = [...surface.warnings];
  if (unknown.length > 0) {
    warnings.push(`未知菜单动作: ${unknown.join(", ")}`);
  }
  if (out.length === 0) {
    return { id: surface.id, items: defaults, warnings };
  }
  return { id: surface.id, items: out, warnings };
}

/** 一次 `load_surfaces` 调用解析出全部面；形状不对的字段各自降级。 */
export function parseSurfaces(result: unknown): SurfacePayload[] {
  if (!Array.isArray(result)) return [];
  const out: SurfacePayload[] = [];
  for (const entry of result) {
    const surface = toSurface(entry);
    if (surface !== null) out.push(surface);
  }
  return out;
}

/** 启动加载：调 `load_surfaces`，异常或形状不对静默返回空数组。 */
export async function loadSurfaces(
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>,
): Promise<SurfacePayload[]> {
  try {
    return parseSurfaces(await invoke("load_surfaces"));
  } catch {
    return [];
  }
}
