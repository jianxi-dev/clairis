import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW_SPEC,
  SPEC_PRESETS,
  applySpec,
  humanizeChange,
  isUnread,
  normalizeViewSpec,
  viewSpecEquals,
  type ViewSpec,
} from "../lib/aiViewSpec";

const FORBIDDEN = [
  "spec",
  "Spec",
  "config",
  "Config",
  "_",
  "{",
  "}",
  "railLayout",
  "railDensity",
  "railCardHeight",
  "blockColors",
  "iconLabel",
  "previewEnabled",
  "railPinnedWidth",
  "gridMode",
  "gridGrouping",
  "gridSort",
  "unreadOnly",
  "themeGroups",
  "pinnedAndRecentOnly",
  "pinnedSegmentScale",
];

describe("aiViewSpec —— 归一化与夹取", () => {
  it("缺省输入回落默认规格", () => {
    expect(normalizeViewSpec(undefined)).toEqual(DEFAULT_VIEW_SPEC);
    expect(normalizeViewSpec(null)).toEqual(DEFAULT_VIEW_SPEC);
    expect(normalizeViewSpec({})).toEqual(DEFAULT_VIEW_SPEC);
  });

  it("数值夹进区间：卡片高度 87→88 / 200→160；宽 100→200；缩放 0.5→1", () => {
    const spec = normalizeViewSpec({
      railCardHeight: 87,
      railPinnedWidth: 100,
      pinnedSegmentScale: 0.5,
    });
    expect(spec.railCardHeight).toBe(88);
    expect(spec.railPinnedWidth).toBe(200);
    expect(spec.pinnedSegmentScale).toBe(1);

    const high = normalizeViewSpec({
      railCardHeight: 200,
      railPinnedWidth: 999,
      pinnedSegmentScale: 2,
    });
    expect(high.railCardHeight).toBe(160);
    expect(high.railPinnedWidth).toBe(360);
    expect(high.pinnedSegmentScale).toBe(1.5);

    // 倍率保留两位小数
    expect(
      normalizeViewSpec({ pinnedSegmentScale: 1.25 }).pinnedSegmentScale,
    ).toBe(1.25);
  });

  it("非法枚举回落，非布尔回落", () => {
    const spec = normalizeViewSpec({
      railLayout: "diagonal",
      railDensity: "roomy",
      iconLabel: "emoji",
      gridMode: "mosaic",
      gridGrouping: "size",
      blockColors: "yes",
      unreadOnly: 1,
    });
    expect(spec).toEqual(DEFAULT_VIEW_SPEC);
  });

  it("非有限数值回落默认", () => {
    const spec = normalizeViewSpec({
      railCardHeight: Number.NaN,
      railPinnedWidth: Number.POSITIVE_INFINITY,
      pinnedSegmentScale: Number.NaN,
    });
    expect(spec.railCardHeight).toBe(DEFAULT_VIEW_SPEC.railCardHeight);
    expect(spec.railPinnedWidth).toBe(DEFAULT_VIEW_SPEC.railPinnedWidth);
    expect(spec.pinnedSegmentScale).toBe(DEFAULT_VIEW_SPEC.pinnedSegmentScale);
  });

  it("applySpec 不修改入参，叠加缺失字段保持原值", () => {
    const current = { ...DEFAULT_VIEW_SPEC, gridMode: "list" as const };
    const frozen = { ...current };
    const next = applySpec(current, { unreadOnly: true });
    expect(current).toEqual(frozen);
    expect(next.gridMode).toBe("list");
    expect(next.unreadOnly).toBe(true);
  });
});

describe("aiViewSpec —— 预设", () => {
  it("恰好 6 条，固定顺序与文案", () => {
    expect(SPEC_PRESETS.map((p) => p.id)).toEqual([
      "theme-groups",
      "pinned-recent-only",
      "pinned-scale",
      "grid-list",
      "grid-group-type",
      "unread-filter",
    ]);
    expect(SPEC_PRESETS.map((p) => p.label)).toEqual([
      "按主题分组",
      "只留收藏和最近",
      "收藏段放大",
      "网格改列表",
      "网格按类型分组",
      "加未读筛选",
    ]);
  });

  it("每条预设只改动目标字段", () => {
    const intended: Record<string, keyof ViewSpec> = {
      "theme-groups": "themeGroups",
      "pinned-recent-only": "pinnedAndRecentOnly",
      "pinned-scale": "pinnedSegmentScale",
      "grid-list": "gridMode",
      "grid-group-type": "gridGrouping",
      "unread-filter": "unreadOnly",
    };
    for (const preset of SPEC_PRESETS) {
      const after = preset.apply(DEFAULT_VIEW_SPEC);
      const target = intended[preset.id];
      for (const key of Object.keys(DEFAULT_VIEW_SPEC) as Array<
        keyof ViewSpec
      >) {
        if (key === target) {
          expect(after[key]).not.toBe(DEFAULT_VIEW_SPEC[key]);
        } else {
          expect(after[key]).toBe(DEFAULT_VIEW_SPEC[key]);
        }
      }
    }
  });
});

describe("aiViewSpec —— 人话描述", () => {
  const VARIANTS: Array<[keyof ViewSpec, unknown]> = [
    ["railLayout", "tabs"],
    ["railDensity", "compact"],
    ["railCardHeight", 128],
    ["blockColors", false],
    ["iconLabel", "auto"],
    ["previewEnabled", false],
    ["railPinnedWidth", 300],
    ["gridMode", "list"],
    ["gridGrouping", "type"],
    ["gridSort", "name"],
    ["unreadOnly", true],
    ["themeGroups", true],
    ["pinnedAndRecentOnly", true],
    ["pinnedSegmentScale", 1.25],
  ];

  it("无改动时返回固定文案", () => {
    expect(humanizeChange(DEFAULT_VIEW_SPEC, { ...DEFAULT_VIEW_SPEC })).toBe(
      "没有需要调整的地方",
    );
  });

  it("覆盖全部 14 个字段且不含技术语言", () => {
    for (const [key, value] of VARIANTS) {
      const after = applySpec(DEFAULT_VIEW_SPEC, {
        [key]: value,
      } as Partial<ViewSpec>);
      const text = humanizeChange(DEFAULT_VIEW_SPEC, after);
      expect(text).not.toBe("没有需要调整的地方");
      for (const token of FORBIDDEN) {
        expect(text).not.toContain(token);
      }
    }
  });

  it("多条改动以「；」连接", () => {
    const after = applySpec(DEFAULT_VIEW_SPEC, {
      gridMode: "list",
      unreadOnly: true,
    });
    const text = humanizeChange(DEFAULT_VIEW_SPEC, after);
    expect(text).toContain("网格视图改为列表");
    expect(text).toContain("只显示未读的文件");
    expect(text).toContain("；");
  });
});

describe("aiViewSpec —— 未读判定", () => {
  it("无记录即未读；已读比例 < 95% 为未读", () => {
    const positions = {
      "/a.md": { scrollPos: 50, contentHeight: 100 },
      "/b.md": { scrollPos: 95, contentHeight: 100 },
      "/c.md": { scrollPos: 0, contentHeight: 0 },
    };
    expect(isUnread("/missing.md", positions)).toBe(true);
    expect(isUnread("/a.md", positions)).toBe(true);
    expect(isUnread("/b.md", positions)).toBe(false);
    expect(isUnread("/c.md", positions)).toBe(true);
  });
});

describe("aiViewSpec —— 相等判定", () => {
  it("逐字段相等", () => {
    expect(viewSpecEquals(DEFAULT_VIEW_SPEC, { ...DEFAULT_VIEW_SPEC })).toBe(
      true,
    );
    expect(
      viewSpecEquals(DEFAULT_VIEW_SPEC, {
        ...DEFAULT_VIEW_SPEC,
        gridMode: "list",
      }),
    ).toBe(false);
    expect(
      viewSpecEquals(DEFAULT_VIEW_SPEC, {
        ...DEFAULT_VIEW_SPEC,
        gridSort: "name",
      }),
    ).toBe(false);
  });
});
