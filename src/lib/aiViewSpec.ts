/**
 * AI 视图改写规格（layout-portal 9.1）——纯逻辑层。
 *
 * 这里定义 AI 能改动的全部视图维度、默认值、归一化（老配置 / 缺失 / 非法值一律
 * 回落）、6 条预设与人话描述。无 DOM / 无 store：渲染侧只消费结果，落盘只序列化
 * 本结构。对话 store 是唯一真相，两形态（小窗 / 停靠）只换宿主容器。
 */

export interface ViewSpec {
  railLayout: "stacked" | "tabs";
  railDensity: "compact" | "comfortable" | "card";
  /** 卡片档高度 88–160，默认 112。 */
  railCardHeight: number;
  /** 是否给区块加类型配色；关闭时类型图标退为单色。 */
  blockColors: boolean;
  /** 图标标签级别：自动 / 始终文字 / 仅图标。 */
  iconLabel: "auto" | "text" | "icon";
  /** 悬浮预览总开关。 */
  previewEnabled: boolean;
  /** 阅读空间栏宽 200–360，默认 240。 */
  railPinnedWidth: number;
  /** 网格排布：网格 / 列表。 */
  gridMode: "grid" | "list";
  /** 网格分组：时间 / 不分组 / 按类型分组。 */
  gridGrouping: "time" | "none" | "type";
  /** 网格排序：最近 / 名称 / 类型。 */
  gridSort: "recent" | "name" | "type";
  /** 只显示未读。 */
  unreadOnly: boolean;
  /**
   * 网格按「主题」分组。
   *
   * 文件没有显式主题元数据，唯一可用的主题信号是父目录（同一目录视作同一主题）。
   * 语义放在这里，渲染侧只按父目录分组。
   */
  themeGroups: boolean;
  /** 阅读空间只留置顶与最近两段。 */
  pinnedAndRecentOnly: boolean;
  /** 置顶段条目高度倍率 1.0–1.5，默认 1。 */
  pinnedSegmentScale: number;
}

export const DEFAULT_VIEW_SPEC: ViewSpec = {
  railLayout: "stacked",
  railDensity: "card",
  railCardHeight: 112,
  blockColors: true,
  iconLabel: "text",
  previewEnabled: true,
  railPinnedWidth: 240,
  gridMode: "grid",
  gridGrouping: "time",
  gridSort: "recent",
  unreadOnly: false,
  themeGroups: false,
  pinnedAndRecentOnly: false,
  pinnedSegmentScale: 1,
};

export const RAIL_CARD_HEIGHT_MIN = 88;
export const RAIL_CARD_HEIGHT_MAX = 160;
export const RAIL_PINNED_WIDTH_MIN = 200;
export const RAIL_PINNED_WIDTH_MAX = 360;
export const PINNED_SEGMENT_SCALE_MIN = 1;
export const PINNED_SEGMENT_SCALE_MAX = 1.5;

/** 判断读数是否越界；非有限值一律取默认。 */
function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** 倍率保留两位小数（1.25 不被取整成 1）。 */
function clampScale(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const bounded = Math.min(
    PINNED_SEGMENT_SCALE_MAX,
    Math.max(PINNED_SEGMENT_SCALE_MIN, value),
  );
  return Math.round(bounded * 100) / 100;
}

const RAIL_LAYOUTS: ReadonlyArray<ViewSpec["railLayout"]> = ["stacked", "tabs"];
const RAIL_DENSITIES: ReadonlyArray<ViewSpec["railDensity"]> = [
  "compact",
  "comfortable",
  "card",
];
const ICON_LABELS: ReadonlyArray<ViewSpec["iconLabel"]> = [
  "auto",
  "text",
  "icon",
];
const GRID_MODES: ReadonlyArray<ViewSpec["gridMode"]> = ["grid", "list"];
const GRID_GROUPINGS: ReadonlyArray<ViewSpec["gridGrouping"]> = [
  "time",
  "none",
  "type",
];
const GRID_SORTS: ReadonlyArray<ViewSpec["gridSort"]> = [
  "recent",
  "name",
  "type",
];

function pickEnum<T extends string>(
  value: unknown,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * 归一化任意输入为完整 ViewSpec。缺失 / 非法枚举回落 `base` 对应值，
 * 数值夹进合法区间。`base` 缺省为默认规格。
 */
export function normalizeViewSpec(
  input: unknown,
  base: ViewSpec = DEFAULT_VIEW_SPEC,
): ViewSpec {
  const src = (input ?? {}) as Record<string, unknown>;
  return {
    railLayout: pickEnum(src.railLayout, RAIL_LAYOUTS, base.railLayout),
    railDensity: pickEnum(src.railDensity, RAIL_DENSITIES, base.railDensity),
    railCardHeight: clampInt(
      src.railCardHeight,
      RAIL_CARD_HEIGHT_MIN,
      RAIL_CARD_HEIGHT_MAX,
      base.railCardHeight,
    ),
    blockColors: pickBool(src.blockColors, base.blockColors),
    iconLabel: pickEnum(src.iconLabel, ICON_LABELS, base.iconLabel),
    previewEnabled: pickBool(src.previewEnabled, base.previewEnabled),
    railPinnedWidth: clampInt(
      src.railPinnedWidth,
      RAIL_PINNED_WIDTH_MIN,
      RAIL_PINNED_WIDTH_MAX,
      base.railPinnedWidth,
    ),
    gridMode: pickEnum(src.gridMode, GRID_MODES, base.gridMode),
    gridGrouping: pickEnum(src.gridGrouping, GRID_GROUPINGS, base.gridGrouping),
    gridSort: pickEnum(src.gridSort, GRID_SORTS, base.gridSort),
    unreadOnly: pickBool(src.unreadOnly, base.unreadOnly),
    themeGroups: pickBool(src.themeGroups, base.themeGroups),
    pinnedAndRecentOnly: pickBool(
      src.pinnedAndRecentOnly,
      base.pinnedAndRecentOnly,
    ),
    pinnedSegmentScale: clampScale(
      src.pinnedSegmentScale,
      base.pinnedSegmentScale,
    ),
  };
}

/** 在 current 上叠加 patch（归一化 + 夹取），返回新对象，绝不修改入参。 */
export function applySpec(
  current: ViewSpec,
  patch: Partial<ViewSpec>,
): ViewSpec {
  return normalizeViewSpec({ ...current, ...patch }, current);
}

/** 两份规格是否逐字段相等。 */
export function viewSpecEquals(a: ViewSpec, b: ViewSpec): boolean {
  return (
    a.railLayout === b.railLayout &&
    a.railDensity === b.railDensity &&
    a.railCardHeight === b.railCardHeight &&
    a.blockColors === b.blockColors &&
    a.iconLabel === b.iconLabel &&
    a.previewEnabled === b.previewEnabled &&
    a.railPinnedWidth === b.railPinnedWidth &&
    a.gridMode === b.gridMode &&
    a.gridGrouping === b.gridGrouping &&
    a.gridSort === b.gridSort &&
    a.unreadOnly === b.unreadOnly &&
    a.themeGroups === b.themeGroups &&
    a.pinnedAndRecentOnly === b.pinnedAndRecentOnly &&
    a.pinnedSegmentScale === b.pinnedSegmentScale
  );
}

export interface SpecPreset {
  id: string;
  label: string;
  apply: (spec: ViewSpec) => ViewSpec;
}

/** 6 条固定预设（顺序与文案是契约，e2e 会逐条断言）。 */
export const SPEC_PRESETS: ReadonlyArray<SpecPreset> = [
  {
    id: "theme-groups",
    label: "按主题分组",
    apply: (s) => applySpec(s, { themeGroups: true }),
  },
  {
    id: "pinned-recent-only",
    label: "只留置顶和最近",
    apply: (s) => applySpec(s, { pinnedAndRecentOnly: true }),
  },
  {
    id: "pinned-scale",
    label: "置顶段放大",
    apply: (s) => applySpec(s, { pinnedSegmentScale: 1.25 }),
  },
  {
    id: "grid-list",
    label: "网格改列表",
    apply: (s) => applySpec(s, { gridMode: "list" }),
  },
  {
    id: "grid-group-type",
    label: "网格按类型分组",
    apply: (s) => applySpec(s, { gridGrouping: "type" }),
  },
  {
    id: "unread-filter",
    label: "加未读筛选",
    apply: (s) => applySpec(s, { unreadOnly: true }),
  },
];

export function presetById(id: string): SpecPreset | undefined {
  return SPEC_PRESETS.find((p) => p.id === id);
}

/**
 * 生成人话改动描述：纯中文、逐字段子句、以「；」连接。
 *
 * 明确禁止技术语言：不得出现字段名、英文枚举值、花括号或下划线。
 * 没有任何变化时返回「没有需要调整的地方」。
 */
export function humanizeChange(before: ViewSpec, after: ViewSpec): string {
  const parts: string[] = [];

  if (before.railLayout !== after.railLayout) {
    parts.push(
      after.railLayout === "tabs"
        ? "阅读空间改为标签布局"
        : "阅读空间改为堆叠布局",
    );
  }
  if (before.railDensity !== after.railDensity) {
    const label =
      after.railDensity === "compact"
        ? "紧凑"
        : after.railDensity === "comfortable"
          ? "舒适"
          : "卡片";
    parts.push(`阅读空间改为${label}密度`);
  }
  if (before.railCardHeight !== after.railCardHeight) {
    parts.push(`阅读空间改为卡片高度 ${after.railCardHeight} 像素`);
  }
  if (before.blockColors !== after.blockColors) {
    parts.push(after.blockColors ? "区块配色开启" : "区块配色关闭");
  }
  if (before.iconLabel !== after.iconLabel) {
    const label =
      after.iconLabel === "auto"
        ? "自动"
        : after.iconLabel === "icon"
          ? "图标"
          : "文字";
    parts.push(`图标标签改为${label}`);
  }
  if (before.previewEnabled !== after.previewEnabled) {
    parts.push(after.previewEnabled ? "开启悬浮预览" : "关闭悬浮预览");
  }
  if (before.railPinnedWidth !== after.railPinnedWidth) {
    parts.push(`阅读空间宽度改为 ${after.railPinnedWidth} 像素`);
  }
  if (before.gridMode !== after.gridMode) {
    parts.push(
      after.gridMode === "list" ? "网格视图改为列表" : "网格视图改为网格",
    );
  }
  if (before.gridGrouping !== after.gridGrouping) {
    parts.push(
      after.gridGrouping === "type"
        ? "网格按类型分组"
        : after.gridGrouping === "time"
          ? "网格按时间分组"
          : "网格取消分组",
    );
  }
  if (before.gridSort !== after.gridSort) {
    const label =
      after.gridSort === "name"
        ? "名称"
        : after.gridSort === "type"
          ? "类型"
          : "最近";
    parts.push(`网格改为按${label}排序`);
  }
  if (before.unreadOnly !== after.unreadOnly) {
    parts.push(after.unreadOnly ? "只显示未读的文件" : "显示全部文件");
  }
  if (before.themeGroups !== after.themeGroups) {
    parts.push(after.themeGroups ? "按主题分组" : "取消主题分组");
  }
  if (before.pinnedAndRecentOnly !== after.pinnedAndRecentOnly) {
    parts.push(
      after.pinnedAndRecentOnly ? "只显示置顶和最近的文件" : "显示全部段",
    );
  }
  if (before.pinnedSegmentScale !== after.pinnedSegmentScale) {
    parts.push(`置顶段放大到 ${after.pinnedSegmentScale} 倍`);
  }

  return parts.length > 0 ? parts.join("；") : "没有需要调整的地方";
}

/**
 * 未读判定：无阅读记录，或已读比例 < 95%（以 scrollPos / contentHeight 计）。
 * contentHeight 非法（≤0 / 非有限）时视为未读。
 */
export function isUnread(
  path: string,
  positions: Record<string, { scrollPos: number; contentHeight: number }>,
): boolean {
  const pos = positions[path];
  if (!pos) return true;
  if (!Number.isFinite(pos.contentHeight) || pos.contentHeight <= 0)
    return true;
  if (!Number.isFinite(pos.scrollPos)) return true;
  return pos.scrollPos / pos.contentHeight < 0.95;
}
