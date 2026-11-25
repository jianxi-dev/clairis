/* 数据面 store：按面 id 缓存有效集合，事件到达只重载对应面。
 *
 * 模块级 Map（与 `src/editors/editorRef.ts` 的模块级模式一致），不进 zustand：
 * 面集合是「宿主下发的资源」，不是 React 状态，工具条在命令闭包里同步读取。
 *
 * 事件消费端只调 `reloadSurface(id)`，绝不走 `reloadAppConfig`/`applyRustConfig`
 * 全量重放（避开 SAVE_ECHO_WINDOW_MS 与 restorePaneLayout 副作用，DS-2）。
 */

import type { SurfacePayload, NormalizedSurface } from "./loader";
import { normalizeSurface } from "./loader";

/** 面 id → 最近一次归一化结果。 */
const surfaces = new Map<string, NormalizedSurface>();

/** 批量写入面（启动加载用）。 */
export function setSurfaces(list: SurfacePayload[]): void {
  for (const surface of list) {
    surfaces.set(surface.id, normalizeSurface(surface, null));
  }
}

/** 取某面的有效集合；未加载过返回空数组。 */
export function getSurfaceItems(id: string) {
  return surfaces.get(id)?.items ?? [];
}

/** 取某面的告警；未加载过返回空数组。 */
export function getSurfaceWarnings(id: string): string[] {
  return surfaces.get(id)?.warnings ?? [];
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
