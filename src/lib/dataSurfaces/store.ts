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
  CapsuleItemSpec,
  ReaderPresetSpec,
} from "./loader";
import { log } from "../../utils/log";
import {
  normalizeSurface,
  toCapsuleItem,
  toIconSpec,
  toMenuItem,
} from "./loader";

export type { MenuItem, IconSpec, CapsuleItemSpec } from "./loader";

/** 面 id → 最近一次归一化结果。 */
const surfaces = new Map<string, NormalizedSurface>();

/// 面集合版本号与订阅者：模块 Map 不是 React store，设置面板等消费端靠
/// useSyncExternalStore 在本版本号变化时重读（面级热应用即时反映）。
let surfacesVersion = 0;
const surfaceListeners = new Set<() => void>();

export function subscribeSurfaces(listener: () => void): () => void {
  surfaceListeners.add(listener);
  return () => {
    surfaceListeners.delete(listener);
  };
}

export function getSurfacesVersion(): number {
  return surfacesVersion;
}

function notifySurfaces(): void {
  surfacesVersion += 1;
  for (const listener of surfaceListeners) listener();
}

/// 写入并输出该面告警（台账第 6 项）：告警是「项被过滤」的诊断信号，
/// 受众是开发者与 AI（`read_data_surface` 已返回），故只落日志不新增 UI。
function recordSurface(surface: SurfacePayload): void {
  const normalized = normalizeSurface(surface, null);
  surfaces.set(surface.id, normalized);
  if (normalized.warnings.length > 0) {
    log.warn(
      "Surfaces",
      `${surface.id}: ${normalized.warnings.join("; ")}`,
    );
  }
  notifySurfaces();
}

/** 批量写入面（启动加载用）。 */
export function setSurfaces(list: SurfacePayload[]): void {
  for (const surface of list) {
    recordSurface(surface);
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

/** 取阅读预设面有效项（保持面数据的数组顺序）。 */
export function getReaderPresets(): ReaderPresetSpec[] {
  const items = surfaces.get("reader-presets")?.items ?? [];
  const out: ReaderPresetSpec[] = [];
  for (const entry of items) {
    const preset = entry as ReaderPresetSpec;
    if (preset && typeof preset.id === "string") out.push(preset);
  }
  return out;
}

/**
 * 取胶囊面有效项（保持面数据的数组顺序，顺序即语义）。未加载过返回空数组——
 * 消费端据此渲染，不留兜底常量。
 */
export function getCapsuleItems(): CapsuleItemSpec[] {
  const items = surfaces.get("capsules")?.items ?? [];
  const out: CapsuleItemSpec[] = [];
  for (const entry of items) {
    const item = toCapsuleItem(entry);
    if (item !== null) out.push(item);
  }
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
  recordSurface({ ...surface, id });
}

/** 清空缓存（测试隔离用）。 */
export function resetSurfaces(): void {
  surfaces.clear();
  notifySurfaces();
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
