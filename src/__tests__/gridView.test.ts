import { describe, expect, it } from "vitest";
import {
  GRID_GROUP_LABELS,
  GRID_TIME_BUCKET_LABELS,
  GRID_TIME_BUCKET_ORDER,
  filterGridItems,
  groupGridItems,
  sortGridItems,
  tileSizeOf,
  timeBucketOf,
} from "../lib/gridView";
import type { RecentFile } from "../types";
import { useStore } from "../stores/index";

function file(
  path: string,
  openedAt = "2026-01-01T00:00:00.000Z",
  excerpt?: string,
): RecentFile {
  return { path, title: path.split("/").pop() ?? path, openedAt, excerpt };
}

// 固定 now（本地时间正午），边界全部由它推导，避免依赖运行机器时区/当前时间。
const NOW = Date.parse("2026-06-17T12:00:00");
const DAY = 86_400_000;
const REF = new Date(NOW);
const START_TODAY = new Date(
  REF.getFullYear(),
  REF.getMonth(),
  REF.getDate(),
).getTime();

const IN_TODAY = new Date(START_TODAY + 5 * 3_600_000).toISOString();
const IN_YESTERDAY = new Date(START_TODAY - 5 * 3_600_000).toISOString();
const IN_WEEK = new Date(START_TODAY - 3 * DAY).toISOString();
const IN_EARLIER = new Date(START_TODAY - 8 * DAY).toISOString();

describe("gridView —— 时间桶", () => {
  it("标签与顺序是固定契约（今天/昨天/本周/更早）", () => {
    expect(GRID_TIME_BUCKET_ORDER).toEqual([
      "today",
      "yesterday",
      "this-week",
      "earlier",
    ]);
    expect(GRID_TIME_BUCKET_LABELS).toEqual({
      today: "今天",
      yesterday: "昨天",
      "this-week": "本周",
      earlier: "更早",
    });
  });

  it("今日 0 点算今天、昨日 0 点算昨天、更早判更早", () => {
    expect(timeBucketOf(new Date(START_TODAY).toISOString(), NOW)).toBe(
      "today",
    );
    expect(timeBucketOf(new Date(START_TODAY - 1).toISOString(), NOW)).toBe(
      "yesterday",
    );
    expect(timeBucketOf(new Date(START_TODAY - DAY).toISOString(), NOW)).toBe(
      "yesterday",
    );
    expect(timeBucketOf(IN_TODAY, NOW)).toBe("today");
    expect(timeBucketOf(IN_YESTERDAY, NOW)).toBe("yesterday");
    expect(timeBucketOf(IN_EARLIER, NOW)).toBe("earlier");
  });

  it("本周为滚动一周窗口：7 天前算本周、8 天前算更早", () => {
    expect(timeBucketOf(IN_WEEK, NOW)).toBe("this-week");
    expect(
      timeBucketOf(new Date(START_TODAY - 7 * DAY).toISOString(), NOW),
    ).toBe("this-week");
    expect(
      timeBucketOf(new Date(START_TODAY - 7 * DAY - 1).toISOString(), NOW),
    ).toBe("earlier");
  });

  it("不可解析的时间归更早，绝不落进今天", () => {
    expect(timeBucketOf("not-a-date", NOW)).toBe("earlier");
    expect(timeBucketOf("", NOW)).toBe("earlier");
  });
});

describe("gridView —— 排序", () => {
  const items = [
    file("/u/b.md", "2026-01-02T00:00:00.000Z"),
    file("/u/a.md", "2026-01-03T00:00:00.000Z"),
    file("/u/c.html", "2026-01-01T00:00:00.000Z"),
  ];

  it("recent：openedAt 降序，且不修改入参", () => {
    const input = [...items];
    const sorted = sortGridItems(input, "recent");
    expect(sorted.map((f) => f.path)).toEqual([
      "/u/a.md",
      "/u/b.md",
      "/u/c.html",
    ]);
    expect(input).toEqual(items); // 原数组顺序不变
    expect(sorted).not.toBe(input);
  });

  it("name：标题升序", () => {
    const sorted = sortGridItems(items, "name");
    expect(sorted.map((f) => f.title)).toEqual(["a.md", "b.md", "c.html"]);
  });

  it("type：先按 8 类固定顺序（markdown 在 html 前），同类内 recent 降序", () => {
    const sorted = sortGridItems(items, "type");
    expect(sorted.map((f) => f.path)).toEqual([
      "/u/a.md",
      "/u/b.md",
      "/u/c.html",
    ]);
  });
});

describe("gridView —— 分组", () => {
  it("none：单组、label 空；空输入返回空数组", () => {
    expect(groupGridItems([], "none")).toEqual([]);
    const groups = groupGridItems([file("/u/a.md")], "none");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "all", label: "" });
    expect(groups[0].items).toHaveLength(1);
  });

  it("time：固定顺序，只出有内容的桶", () => {
    const groups = groupGridItems(
      [
        file("/u/y.md", IN_YESTERDAY),
        file("/u/t.md", IN_TODAY),
        file("/u/e.md", IN_EARLIER),
      ],
      "time",
      NOW,
    );
    const keys = groups.map((g) => g.key);
    expect(keys).toEqual(["today", "yesterday", "earlier"]);
    expect(groups.map((g) => g.label)).toEqual(["今天", "昨天", "更早"]);
  });

  it("type：按 8 类顺序 + RAIL_KIND_LABELS", () => {
    const groups = groupGridItems(
      [file("/u/x.html"), file("/u/a.md"), file("/u/b.md")],
      "type",
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual(["markdown", "html"]);
    expect(groups.map((g) => g.label)).toEqual(["Markdown", "HTML"]);
    expect(groups[0].items.map((f) => f.path)).toEqual(["/u/a.md", "/u/b.md"]);
  });

  it("theme：父目录为键，根目录归 /，首次出现顺序", () => {
    const groups = groupGridItems(
      [file("/a/x.md"), file("/b/y.md"), file("/a/z.md")],
      "theme",
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual(["/a", "/b"]);
    expect(groups[0].items.map((f) => f.path)).toEqual(["/a/x.md", "/a/z.md"]);
  });
});

describe("gridView —— tile 尺寸", () => {
  it("置顶或继续阅读 → large", () => {
    const item = file("/u/a.md", undefined, "正文");
    expect(tileSizeOf(item, { pinned: true, continuePath: null })).toBe(
      "large",
    );
    expect(tileSizeOf(item, { pinned: false, continuePath: "/u/a.md" })).toBe(
      "large",
    );
  });

  it("有缩略图或有摘要 → medium；两者皆无 → small", () => {
    expect(
      tileSizeOf(file("/u/a.html"), { pinned: false, continuePath: null }),
    ).toBe("medium");
    expect(
      tileSizeOf(file("/u/a.md", undefined, "真摘要"), {
        pinned: false,
        continuePath: null,
      }),
    ).toBe("medium");
    expect(
      tileSizeOf(file("/u/a.txt"), { pinned: false, continuePath: null }),
    ).toBe("small");
    expect(
      tileSizeOf(file("/u/a.txt", undefined, "   "), {
        pinned: false,
        continuePath: null,
      }),
    ).toBe("small");
  });
});

describe("gridView —— 筛选", () => {
  const items = [
    file("/u/Design.md"),
    file("/u/report.html"),
    file("/u/design-notes.md"),
  ];

  it("类型严格相等", () => {
    const out = filterGridItems(items, {
      type: "markdown",
      query: "",
      pinnedOnly: false,
      pinnedPaths: [],
    });
    expect(out.map((f) => f.path)).toEqual([
      "/u/Design.md",
      "/u/design-notes.md",
    ]);
  });

  it("query 大小写不敏感匹配标题", () => {
    const out = filterGridItems(items, {
      type: null,
      query: "DESIGN",
      pinnedOnly: false,
      pinnedPaths: [],
    });
    expect(out.map((f) => f.path)).toEqual([
      "/u/Design.md",
      "/u/design-notes.md",
    ]);
  });

  it("pinnedOnly 只留集合内", () => {
    const out = filterGridItems(items, {
      type: null,
      query: "",
      pinnedOnly: true,
      pinnedPaths: ["/u/report.html"],
    });
    expect(out.map((f) => f.path)).toEqual(["/u/report.html"]);
  });

  it("空 query 不过滤；组合过滤同时生效", () => {
    expect(
      filterGridItems(items, {
        type: null,
        query: "   ",
        pinnedOnly: false,
        pinnedPaths: [],
      }),
    ).toHaveLength(3);
    const combo = filterGridItems(items, {
      type: "markdown",
      query: "design",
      pinnedOnly: true,
      pinnedPaths: ["/u/design-notes.md", "/u/report.html"],
    });
    expect(combo.map((f) => f.path)).toEqual(["/u/design-notes.md"]);
  });
});

it("setGridGroup 同步 viewSpec 分组，避免重载回退", () => {
  useStore.getState().setGridGroup("type");
  expect(useStore.getState().viewSpec.gridGrouping).toBe("type");
  useStore.getState().setGridGroup("theme");
  expect(useStore.getState().viewSpec.themeGroups).toBe(true);
  useStore.getState().setGridGroup("time");
  expect(useStore.getState().viewSpec.themeGroups).toBe(false);
  expect(useStore.getState().viewSpec.gridGrouping).toBe("time");
  useStore.getState().reset();
});

it("setGridSort 同步 viewSpec 排序，避免重载回退", () => {
  useStore.getState().setGridSort("name");
  expect(useStore.getState().viewSpec.gridSort).toBe("name");
  useStore.getState().setGridSort("type");
  expect(useStore.getState().viewSpec.gridSort).toBe("type");
  useStore.getState().reset();
});
