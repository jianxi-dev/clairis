/**
 * 阅读空间竖排栏（layout-portal 6.1）——纯逻辑层。
 *
 * 三态状态机、段定义、分类 chips 与搜索过滤全部放在这里，无 DOM / 无 store，
 * 渲染侧（components/Rail/ReadingRail.tsx）只订阅结果、不自己推状态。
 */

import { fileTypeOf, type FileTypeKind } from "./fileType";
import type { RecentFile, SearchHit } from "../types";

/** 折叠态边缘条宽度（严格 12px，e2e 会量）。 */
export const RAIL_EDGE_PX = 12;
/** 悬停浮层 / 钉住常驻的栏宽（严格 240px）。 */
export const RAIL_WIDTH_PX = 240;
/** 指针移开后收回折叠的延迟。 */
export const HOVER_CLOSE_MS = 300;
/** 悬停边缘条的驻留时间，超过才展开浮层。 */
export const HOVER_OPEN_MS = 250;

export type RailState = "collapsed" | "hover" | "pinned";

export interface RailEvent {
  type:
    "hover-enter" | "hover-leave" | "toggle-pin" | "collapse" | "toggle-key";
}

/**
 * 三态状态机。hover 是瞬态：指针离开即回折叠；pinned 常驻，不受 hover 影响。
 * `toggle-key` 即 ⌘\ 的语义——在「钉住」与「折叠」之间来回。
 */
export function nextRailState(current: RailState, event: RailEvent): RailState {
  switch (event.type) {
    case "hover-enter":
      return current === "pinned" ? "pinned" : "hover";
    case "hover-leave":
      return current === "hover" ? "collapsed" : current;
    case "toggle-pin":
      return current === "pinned" ? "collapsed" : "pinned";
    case "collapse":
      return "collapsed";
    case "toggle-key":
      return current === "pinned" ? "collapsed" : "pinned";
  }
}

export type RailSection = "now" | "pinned" | "recent" | "category";

/** 段的固定顺序与中文名；竖排栏按此顺序渲染，标签页也按此顺序出签。 */
export const RAIL_SECTIONS: ReadonlyArray<{
  key: RailSection;
  label: string;
}> = [
  { key: "now", label: "现在" },
  { key: "pinned", label: "置顶" },
  { key: "recent", label: "最近" },
  { key: "category", label: "分类" },
];

export type RailLayout = "stacked" | "tabs";
export type RailDensity = "compact" | "comfortable" | "card";

/** 「设为默认」保存的视图规格（持久化到 Rust `rail_view_spec`）。 */
export interface RailViewSpec {
  layout: RailLayout;
  density: RailDensity;
  /** 卡片档高度；88–160。旧配置缺省时由 normalize 补 112。 */
  cardHeight?: number;
}

export const DEFAULT_RAIL_VIEW_SPEC: RailViewSpec = {
  layout: "stacked",
  // 7.1 起默认卡片档（112px）；布局仍是堆叠
  density: "card",
  cardHeight: 112,
};

/** 8 类固定顺序（与门户磁贴、fileType 词表一致）。 */
export const RAIL_KIND_ORDER: readonly FileTypeKind[] = [
  "markdown",
  "html",
  "text",
  "pdf",
  "video",
  "image",
  "code",
  "audio",
];

export const RAIL_KIND_LABELS: Record<FileTypeKind, string> = {
  markdown: "Markdown",
  html: "HTML",
  text: "文本",
  pdf: "PDF",
  video: "视频",
  image: "图片",
  code: "代码",
  audio: "音频",
};

export type RailChipKind = "all" | FileTypeKind;

export interface RailChip {
  kind: RailChipKind;
  label: string;
  count: number;
}

/**
 * 分类过滤 chips：恒为 9 个（全部 + 8 类），带计数。纯过滤行，不做瀑布式分类行。
 */
export function fileTypeChips(
  items: ReadonlyArray<{ path: string }>,
): RailChip[] {
  const counts = new Map<FileTypeKind, number>();
  for (const item of items) {
    const kind = fileTypeOf(item.path);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [
    { kind: "all", label: "全部", count: items.length },
    ...RAIL_KIND_ORDER.map((kind) => ({
      kind,
      label: RAIL_KIND_LABELS[kind],
      count: counts.get(kind) ?? 0,
    })),
  ];
}

export type RailSearchTime = "all" | "today" | "week" | "older";

export const RAIL_SEARCH_TIMES: ReadonlyArray<{
  key: RailSearchTime;
  label: string;
}> = [
  { key: "all", label: "全部" },
  { key: "today", label: "今天" },
  { key: "week", label: "本周" },
  { key: "older", label: "更早" },
];

const DAY_MS = 86_400_000;

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function timeBucketOf(
  openedAt: string,
  now: number = Date.now(),
): Exclude<RailSearchTime, "all"> {
  const t = new Date(openedAt).getTime();
  if (!Number.isFinite(t)) return "older";
  if (t >= startOfLocalDay(now)) return "today";
  if (t >= now - 7 * DAY_MS) return "week";
  return "older";
}

export interface SearchMatch {
  hit: SearchHit;
  /** 标题里需要高亮的区间。 */
  ranges: MatchRange[];
  /** 命中片段里需要高亮的区间。 */
  excerptRanges: MatchRange[];
}

/**
 * 本机检索结果过滤：类型 chip + 时间段 + query 命中区间。
 * Rust 侧已按 query 过滤，这里再算一次高亮区间（标题与片段各自独立）。
 */
export function filterSearchHits(
  hits: ReadonlyArray<SearchHit>,
  opts: {
    chip: RailChipKind;
    time: RailSearchTime;
    query: string;
    now?: number;
  },
): SearchMatch[] {
  const { chip, time, query, now } = opts;
  const needle = query.trim();
  const out: SearchMatch[] = [];
  for (const hit of hits) {
    if (chip !== "all" && fileTypeOf(hit.path) !== chip) continue;
    if (time !== "all" && timeBucketOf(hit.openedAt, now) !== time) continue;
    const ranges = matchRanges(hit.title, needle);
    const excerptRanges = matchRanges(hit.excerpt, needle);
    if (needle && ranges.length === 0 && excerptRanges.length === 0) continue;
    out.push({ hit, ranges, excerptRanges });
  }
  return out;
}

/** 一处命中：`[start, end)` 的半开区间（单位是字符下标）。 */
export type MatchRange = [number, number];

/** 大小写不敏感地找出 query 在 text 中的全部命中区间（非重叠、顺着扫）。 */
export function matchRanges(text: string, query: string): MatchRange[] {
  if (!query) return [];
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return [];
  const ranges: MatchRange[] = [];
  let from = 0;
  for (;;) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) break;
    ranges.push([idx, idx + needle.length]);
    from = idx + needle.length;
  }
  return ranges;
}

export interface RailMatch {
  item: RecentFile;
  /** 标题里需要高亮的区间；query 为空时为空数组。 */
  ranges: MatchRange[];
}

/**
 * 过滤 + 命中高亮。chip 是严格类型相等（非 all 时只留该类型，类型不符的绝不出现在
 * 结果里）；query 走标题的大小写不敏感子串匹配，空 query 即不过滤、无命中区间。
 */
export function filterRailItems(
  items: RecentFile[],
  opts: { chip: RailChipKind; query: string },
): RailMatch[] {
  const { chip, query } = opts;
  const out: RailMatch[] = [];
  for (const item of items) {
    if (chip !== "all" && fileTypeOf(item.path) !== chip) continue;
    if (!query) {
      out.push({ item, ranges: [] });
      continue;
    }
    const ranges = matchRanges(item.title, query);
    if (ranges.length > 0) out.push({ item, ranges });
  }
  return out;
}

/**
 * 把标题按命中区间切成片段，供渲染层插入 `<mark>`。
 * 命中区间不重叠且有序（见 matchRanges），这里不再去重。
 */
export function splitByRanges(
  text: string,
  ranges: MatchRange[],
): Array<{ text: string; hit: boolean }> {
  if (ranges.length === 0) return [{ text, hit: false }];
  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor)
      parts.push({ text: text.slice(cursor, start), hit: false });
    parts.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length)
    parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}
