/**
 * 网格概览（layout-portal 10.1）——纯逻辑层。
 *
 * 排序 / 时间分桶 / 分组 / tile 尺寸判定 / 筛选全部放在这里，无 DOM / 无 store。
 * 渲染侧（components/GridView.tsx、Grid/GridTile.tsx）只消费结果，不自己推规则；
 * 单测与 e2e 断言的是同一份确定性契约。
 */

import { fileTypeOf, type FileTypeKind } from "./fileType";
import { parentPathOf, thumbKindOf } from "./railCards";
import { RAIL_KIND_LABELS, RAIL_KIND_ORDER } from "./railView";
import type { RecentFile } from "../types";

export type GridSort = "recent" | "name" | "type";
export type GridGroupMode = "time" | "type" | "theme" | "none";
export type GridTileSize = "large" | "medium" | "small";

/** 时间粘性分组桶；固定顺序 today → earlier。 */
export type GridTimeBucket = "today" | "yesterday" | "this-week" | "earlier";

export const GRID_SORT_LABELS: Record<GridSort, string> = {
  recent: "最近",
  name: "名称",
  type: "类型",
};

export const GRID_GROUP_LABELS: Record<GridGroupMode, string> = {
  time: "时间",
  type: "类型",
  theme: "主题",
  none: "不分组",
};

/** 时间桶固定顺序（分组与渲染都按此顺序，不受数据影响）。 */
export const GRID_TIME_BUCKET_ORDER: readonly GridTimeBucket[] = [
  "today",
  "yesterday",
  "this-week",
  "earlier",
];

/** 时间桶中文标签（今天/昨天/本周/更早），顺序即 GRID_TIME_BUCKET_ORDER。 */
export const GRID_TIME_BUCKET_LABELS: Record<GridTimeBucket, string> = {
  today: "今天",
  yesterday: "昨天",
  "this-week": "本周",
  earlier: "更早",
};

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/**
 * 时间桶判定（本地时区，按自然日切分）：
 * - `today`：不早于今日 0 点
 * - `yesterday`：不早于昨日 0 点（周一时「昨天」是周日，仍标昨天）
 * - `this-week`：不早于今日 0 点往前 7 天（滚动一周，保证任意星期都能出该桶）
 * - `earlier`：更早，或 `iso` 不可解析（绝不落进今天）
 */
export function timeBucketOf(
  iso: string,
  now: number = Date.now(),
): GridTimeBucket {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "earlier";
  const ref = new Date(now);
  const startOfToday = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate(),
  ).getTime();
  if (t >= startOfToday) return "today";
  if (t >= startOfToday - DAY_MS) return "yesterday";
  if (t >= startOfToday - WEEK_MS) return "this-week";
  return "earlier";
}

function openedAtValue(item: RecentFile): number {
  const t = Date.parse(item.openedAt);
  return Number.isFinite(t) ? t : 0;
}

/**
 * 排序：绝不修改入参。
 * - `recent`：openedAt 降序（无法解析的时间视为 0，排最后）
 * - `name`：标题升序（中文按拼音）
 * - `type`：先按 8 类固定顺序，同类型内再按 openedAt 降序
 */
export function sortGridItems(
  items: RecentFile[],
  sort: GridSort,
): RecentFile[] {
  const copy = [...items];
  if (sort === "name") {
    copy.sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"));
    return copy;
  }
  if (sort === "type") {
    copy.sort((a, b) => {
      const ai = RAIL_KIND_ORDER.indexOf(fileTypeOf(a.path));
      const bi = RAIL_KIND_ORDER.indexOf(fileTypeOf(b.path));
      if (ai !== bi) return ai - bi;
      return openedAtValue(b) - openedAtValue(a);
    });
    return copy;
  }
  copy.sort((a, b) => openedAtValue(b) - openedAtValue(a));
  return copy;
}

export interface GridGroup {
  key: string;
  label: string;
  items: RecentFile[];
}

/**
 * 分组。空输入返回空数组（不产出空组）：
 * - `time`：按 GRID_TIME_BUCKET_ORDER 固定顺序，只出有内容的时间桶
 * - `type`：按 RAIL_KIND_ORDER 固定顺序 + RAIL_KIND_LABELS
 * - `theme`：按父目录（同一目录 = 同一主题），首次出现顺序
 * - `none`：单组，label 为空串
 */
export function groupGridItems(
  items: RecentFile[],
  mode: GridGroupMode,
  now: number = Date.now(),
): GridGroup[] {
  if (items.length === 0) return [];

  if (mode === "none") {
    return [{ key: "all", label: "", items: [...items] }];
  }

  if (mode === "time") {
    const buckets = new Map<GridTimeBucket, RecentFile[]>();
    for (const item of items) {
      const bucket = timeBucketOf(item.openedAt, now);
      const list = buckets.get(bucket);
      if (list) list.push(item);
      else buckets.set(bucket, [item]);
    }
    return GRID_TIME_BUCKET_ORDER.filter((b) => buckets.has(b)).map((b) => ({
      key: b,
      label: GRID_TIME_BUCKET_LABELS[b],
      items: buckets.get(b)!,
    }));
  }

  if (mode === "type") {
    const buckets = new Map<FileTypeKind, RecentFile[]>();
    for (const item of items) {
      const kind = fileTypeOf(item.path);
      const list = buckets.get(kind);
      if (list) list.push(item);
      else buckets.set(kind, [item]);
    }
    return RAIL_KIND_ORDER.filter((k) => buckets.has(k)).map((k) => ({
      key: k,
      label: RAIL_KIND_LABELS[k],
      items: buckets.get(k)!,
    }));
  }

  // theme = 父目录；根目录归 "/"，空父路径也归 "/"
  const buckets = new Map<string, RecentFile[]>();
  for (const item of items) {
    const key = parentPathOf(item.path) || "/";
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  return [...buckets.entries()].map(([key, list]) => ({
    key,
    label: key,
    items: list,
  }));
}

export interface TileSizeContext {
  /** 该条目是否被置顶。 */
  pinned: boolean;
  /** 「继续阅读」条目路径；null = 无。 */
  continuePath: string | null;
}

/**
 * tile 尺寸（确定性规则）：
 * 1. 置顶、或等于「继续阅读」条目 → `large`（2×2）
 * 2. 有缩略图类型、或摘要非空 → `medium`（2×1）
 * 3. 其余（无图且无摘要）→ `small`（1×1）
 */
export function tileSizeOf(
  item: RecentFile,
  ctx: TileSizeContext,
): GridTileSize {
  if (
    ctx.pinned ||
    (ctx.continuePath !== null && item.path === ctx.continuePath)
  ) {
    return "large";
  }
  if (thumbKindOf(item) !== null || (item.excerpt ?? "").trim() !== "") {
    return "medium";
  }
  return "small";
}

export interface GridFilter {
  /** 严格类型过滤；null = 全部。 */
  type: FileTypeKind | null;
  /** 标题大小写不敏感子串；空串 = 不过滤。 */
  query: string;
  /** 只留置顶条目。 */
  pinnedOnly: boolean;
  pinnedPaths: readonly string[];
}

/** 筛选：类型严格相等、query 走标题子串、pinnedOnly 只留集合内。 */
export function filterGridItems(
  items: RecentFile[],
  filter: GridFilter,
): RecentFile[] {
  const q = filter.query.trim().toLowerCase();
  const pinned = new Set(filter.pinnedPaths);
  return items.filter((item) => {
    if (filter.type !== null && fileTypeOf(item.path) !== filter.type) {
      return false;
    }
    if (filter.pinnedOnly && !pinned.has(item.path)) return false;
    if (q !== "" && !item.title.toLowerCase().includes(q)) return false;
    return true;
  });
}
