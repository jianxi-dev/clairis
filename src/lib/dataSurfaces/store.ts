/* 数据面 store：按面 id 缓存有效集合，事件到达只重载对应面。
 *
 * 模块级 Map（与 `src/editors/editorRef.ts` 的模块级模式一致），不进 zustand：
 * 面集合是「宿主下发的资源」，不是 React 状态，菜单在渲染路径里同步读取。
 *
 * 事件消费端只调 `reloadSurface(id)`，绝不走 `reloadAppConfig`/`applyRustConfig`
 * 全量重放（避开 SAVE_ECHO_WINDOW_MS 与 restorePaneLayout 副作用，DS-2）。
 */

import type {
  SurfacePayload,
  NormalizedSurface,
  MenuItem,
  IconSpec,
} from "./loader";
import { normalizeSurface, toIconSpec, toMenuItem } from "./loader";

export type { MenuItem, IconSpec } from "./loader";

/** 面 id → 最近一次归一化结果。 */
const surfaces = new Map<string, NormalizedSurface>();

/** 批量写入面（启动加载用）。 */
export function setSurfaces(list: SurfacePayload[]): void {
  for (const surface of list) {
    surfaces.set(surface.id, normalizeSurface(surface, null));
  }
}

/** 取某面的有效集合；未加载过返回空数组。 */
export function getSurfaceItems<T = unknown>(id: string): T[] {
  return (surfaces.get(id)?.items ?? []) as T[];
}

/** 取某面的告警；未加载过返回空数组。 */
export function getSurfaceWarnings(id: string): string[] {
  return surfaces.get(id)?.warnings ?? [];
}

/**
 * 取菜单面某消费端分组的有效项（按 group 过滤 + order 升序）。
 * 未加载过 / 分组无项返回空数组——消费端据此渲染，不留兜底常量。
 */
export function getMenuItems(group: string): MenuItem[] {
  const items = surfaces.get("menus")?.items ?? [];
  const out: MenuItem[] = [];
  for (const entry of items) {
    const item = toMenuItem(entry);
    if (item !== null && item.group === group && item.enabled) out.push(item);
  }
  out.sort((a, b) => a.order - b.order);
  return out;
}

/**
 * 按概念键取图标面定义；未加载过 / 缺该键返回 null——消费端回落 `ICONS`。
 */
export function getIconSpec(key: string): IconSpec | null {
  const items = surfaces.get("icons")?.items ?? [];
  for (const entry of items) {
    const spec = toIconSpec(entry);
    if (spec !== null && spec.key === key) return spec;
  }
  return null;
}

/** 用新的默认 payload 重新归一化某面（事件到达只重载对应面）。 */
export function applySurfacePayload(id: string, surface: SurfacePayload): void {
  surfaces.set(id, normalizeSurface(surface, null));
}

/** 清空缓存（测试隔离用）。 */
export function resetSurfaces(): void {
  surfaces.clear();
}

/** 重新加载某面：走一次 `load_surfaces` 后只更新对应面。 */
export async function reloadSurface(
  id: string,
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>,
): Promise<void> {
  const { loadSurfaces } = await import("./loader");
  const list = await loadSurfaces(invoke);
  const hit = list.find((surface) => surface.id === id);
  if (hit) {
    applySurfacePayload(id, hit);
  }
}

export type { NormalizedSurface };
