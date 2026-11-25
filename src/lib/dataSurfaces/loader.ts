/* 数据面加载：一次 `load_surfaces` 调用拿回全部已登记面的有效集合与告警。
 *
 * 与 `src/lib/extensions/bundle.ts` 同款纪律：任何调用异常或返回形状不对都静默
 * 降级（空集合 / 空告警），不抛错——`load_surfaces` 在纯浏览器或老版本里不存在。
 *
 * 有效集合 = 默认 ← 用户覆盖：未知 id 过滤并聚合为一条告警；覆盖为空或全部
 * 非法时回落默认（DS-1）。默认的唯一来源是仓库内 JSON 文件（Rust 侧内嵌），
 * 前端不再保留任何兜底常量。
 */

import type { ToolbarSlotItem } from "../../editors/orchestration/slots";

/** Rust `load_surfaces` 返回的单面形状。 */
export interface SurfacePayload {
  id: string;
  items: ToolbarSlotItem[];
  warnings: string[];
}

export interface NormalizedSurface {
  id: string;
  items: ToolbarSlotItem[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const GROUPS = new Set(["ai", "format", "align"]);

/** 宽松解析单个 item；缺字段或类型不对返回 null。 */
function toItem(raw: unknown): ToolbarSlotItem | null {
  if (!isRecord(raw)) return null;
  const { id, label, icon, group } = raw;
  if (typeof id !== "string" || id === "") return null;
  if (typeof label !== "string") return null;
  if (typeof icon !== "string") return null;
  if (typeof group !== "string" || !GROUPS.has(group)) return null;
  return {
    id,
    label,
    icon: icon as ToolbarSlotItem["icon"],
    group: group as ToolbarSlotItem["group"],
  };
}

/** 从 `load_surfaces` 返回值里取单面；形状不对返回 null。 */
function toSurface(raw: unknown): SurfacePayload | null {
  if (!isRecord(raw)) return null;
  const { id, items, warnings } = raw;
  if (typeof id !== "string" || !Array.isArray(items)) return null;
  const parsed: ToolbarSlotItem[] = [];
  for (const entry of items) {
    const item = toItem(entry);
    if (item !== null) parsed.push(item);
  }
  const warnList = Array.isArray(warnings)
    ? warnings.filter((w): w is string => typeof w === "string")
    : [];
  return { id, items: parsed, warnings: warnList };
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
  const known = new Set(defaults.map((item) => item.id));
  if (!Array.isArray(override) || override.length === 0) {
    return { id: surface.id, items: defaults, warnings: surface.warnings };
  }
  const out: ToolbarSlotItem[] = [];
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const id of override) {
    if (!known.has(id)) {
      if (!unknown.includes(id)) unknown.push(id);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const item = defaults.find((entry) => entry.id === id);
    if (item) out.push(item);
  }
  const warnings = [...surface.warnings];
  if (unknown.length > 0) {
    warnings.push(`未知工具条动作: ${unknown.join(", ")}`);
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
