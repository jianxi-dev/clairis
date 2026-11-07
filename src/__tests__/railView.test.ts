import { describe, expect, it } from "vitest";
import {
  HOVER_CLOSE_MS,
  HOVER_OPEN_MS,
  RAIL_EDGE_PX,
  RAIL_SEARCH_TIMES,
  RAIL_SECTIONS,
  RAIL_WIDTH_PX,
  fileTypeChips,
  filterRailItems,
  filterSearchHits,
  matchRanges,
  nextRailState,
  splitByRanges,
  timeBucketOf,
  type RailEvent,
  type RailState,
} from "../lib/railView";
import type { RecentFile, SearchHit } from "../types";

function file(path: string, title?: string): RecentFile {
  return {
    path,
    title: title ?? (path.split("/").pop() as string),
    openedAt: "2026-01-01T00:00:00.000Z",
  };
}

const SAMPLE: RecentFile[] = [
  file("/u/a.md", "设计笔记"),
  file("/u/b.md", "设计规范"),
  file("/u/c.html", "页面"),
  file("/u/d.html", "设计稿"),
  file("/u/e.txt", "笔记"),
  file("/u/f.pdf", "报告"),
  file("/u/g.png", "截图"),
];

describe("railView —— 常量", () => {
  it("边缘条 12px、栏宽 240px、收回 300ms、展开驻留 250ms", () => {
    expect(RAIL_EDGE_PX).toBe(12);
    expect(RAIL_WIDTH_PX).toBe(240);
    expect(HOVER_CLOSE_MS).toBe(300);
    expect(HOVER_OPEN_MS).toBe(250);
  });

  it("段固定为 现在/收藏/最近/分类", () => {
    expect(RAIL_SECTIONS.map((s) => s.key)).toEqual([
      "now",
      "pinned",
      "recent",
      "category",
    ]);
    expect(RAIL_SECTIONS.map((s) => s.label)).toEqual([
      "现在",
      "收藏",
      "最近",
      "分类",
    ]);
  });
});

describe("nextRailState —— 三态状态机", () => {
  const state = (c: RailState, e: RailEvent) => nextRailState(c, e);

  it("折叠 + 悬停进入 → 浮层", () => {
    expect(state("collapsed", { type: "hover-enter" })).toBe("hover");
  });

  it("浮层 + 指针离开 → 折叠", () => {
    expect(state("hover", { type: "hover-leave" })).toBe("collapsed");
  });

  it("悬停浮层里可以钉住；钉住后指针离开不收回", () => {
    expect(state("hover", { type: "toggle-pin" })).toBe("pinned");
    expect(state("pinned", { type: "hover-leave" })).toBe("pinned");
    expect(state("pinned", { type: "hover-enter" })).toBe("pinned");
  });

  it("折叠 + 钉住 → 常驻；常驻再钉住 → 折叠", () => {
    expect(state("collapsed", { type: "toggle-pin" })).toBe("pinned");
    expect(state("pinned", { type: "toggle-pin" })).toBe("collapsed");
  });

  it("⌘\\ 在 钉住 ↔ 折叠 之间切换", () => {
    expect(state("pinned", { type: "toggle-key" })).toBe("collapsed");
    expect(state("collapsed", { type: "toggle-key" })).toBe("pinned");
    expect(state("hover", { type: "toggle-key" })).toBe("pinned");
  });

  it("collapse 事件从任意态都回到折叠", () => {
    for (const c of ["collapsed", "hover", "pinned"] as RailState[]) {
      expect(state(c, { type: "collapse" })).toBe("collapsed");
    }
  });
});

describe("fileTypeChips —— 分类 chips", () => {
  it("恒为 9 个：全部 + 8 类", () => {
    const chips = fileTypeChips(SAMPLE);
    expect(chips).toHaveLength(9);
    expect(chips[0]).toEqual({ kind: "all", label: "全部", count: 7 });
    expect(chips.map((c) => c.kind)).toEqual([
      "all",
      "markdown",
      "html",
      "text",
      "pdf",
      "video",
      "image",
      "code",
      "audio",
    ]);
  });

  it("计数与类型严格对应", () => {
    const chips = fileTypeChips(SAMPLE);
    const byKind = new Map(chips.map((c) => [c.kind, c.count]));
    expect(byKind.get("markdown")).toBe(2);
    expect(byKind.get("html")).toBe(2);
    expect(byKind.get("text")).toBe(1);
    expect(byKind.get("pdf")).toBe(1);
    expect(byKind.get("image")).toBe(1);
    expect(byKind.get("video")).toBe(0);
    expect(byKind.get("code")).toBe(0);
    expect(byKind.get("audio")).toBe(0);
  });

  it("空列表也有 9 个 chip，全部计数为 0", () => {
    const chips = fileTypeChips([]);
    expect(chips).toHaveLength(9);
    expect(chips.every((c) => c.count === 0)).toBe(true);
  });
});

describe("filterRailItems —— 过滤 + 命中", () => {
  it("query 为空时全部通过且无命中区间", () => {
    const out = filterRailItems(SAMPLE, { chip: "all", query: "" });
    expect(out).toHaveLength(7);
    expect(out.every((m) => m.ranges.length === 0)).toBe(true);
  });

  it("chip 是严格类型相等：HTML chip 后不含任何非 HTML 条目", () => {
    const out = filterRailItems(SAMPLE, { chip: "html", query: "" });
    expect(out.map((m) => m.item.title)).toEqual(["页面", "设计稿"]);
    expect(out.every((m) => m.item.path.endsWith(".html"))).toBe(true);
  });

  it("query 命中大小写不敏感并给出高亮区间", () => {
    const out = filterRailItems(SAMPLE, { chip: "all", query: "设计" });
    expect(out.map((m) => m.item.title)).toEqual([
      "设计笔记",
      "设计规范",
      "设计稿",
    ]);
    expect(out[0].ranges).toEqual([[0, 2]]);
  });

  it("chip 与 query 叠加：HTML 里搜「设计」只剩设计稿", () => {
    const out = filterRailItems(SAMPLE, { chip: "html", query: "设计" });
    expect(out.map((m) => m.item.title)).toEqual(["设计稿"]);
  });

  it("query 无命中时结果为空", () => {
    expect(
      filterRailItems(SAMPLE, { chip: "all", query: "不存在的词" }),
    ).toHaveLength(0);
  });
});

describe("matchRanges / splitByRanges", () => {
  it("同一词多次命中全部给出", () => {
    expect(matchRanges("abABab", "ab")).toEqual([
      [0, 2],
      [2, 4],
      [4, 6],
    ]);
  });

  it("切片段：命中区间包上 hit 标记，其余原样", () => {
    expect(splitByRanges("设计笔记", [[0, 2]])).toEqual([
      { text: "设计", hit: true },
      { text: "笔记", hit: false },
    ]);
    expect(splitByRanges("无命中", [])).toEqual([
      { text: "无命中", hit: false },
    ]);
  });
});

function hit(
  path: string,
  title: string,
  excerpt: string,
  openedAt: string,
): SearchHit {
  return { path, title, excerpt, openedAt, matchedIn: "content" };
}

const NOW = new Date(2026, 0, 10, 12, 0, 0).getTime();
const TODAY = new Date(2026, 0, 10, 9, 0, 0).toISOString();
const WEEK = new Date(2026, 0, 7, 9, 0, 0).toISOString();
const OLDER = new Date(2026, 0, 1, 9, 0, 0).toISOString();

const HITS: SearchHit[] = [
  hit("/u/Documents/架构笔记.md", "架构笔记", "…正文片段包含关键词…", TODAY),
  hit("/u/Documents/会议纪要.md", "会议纪要", "关键词出现在这里。", OLDER),
  hit("/u/Desktop/页面.html", "页面", "HTML 里的关键词。", WEEK),
];

describe("timeBucketOf —— 时间段归类", () => {
  it("今天 / 本周 / 更早按本地日期边界划分", () => {
    expect(timeBucketOf(TODAY, NOW)).toBe("today");
    expect(timeBucketOf(WEEK, NOW)).toBe("week");
    expect(timeBucketOf(OLDER, NOW)).toBe("older");
  });

  it("无法解析的时间归入更早", () => {
    expect(timeBucketOf("not-a-date", NOW)).toBe("older");
  });

  it("时间段 chips 恒为 全部/今天/本周/更早", () => {
    expect(RAIL_SEARCH_TIMES.map((t) => t.key)).toEqual([
      "all",
      "today",
      "week",
      "older",
    ]);
    expect(RAIL_SEARCH_TIMES.map((t) => t.label)).toEqual([
      "全部",
      "今天",
      "本周",
      "更早",
    ]);
  });
});

describe("filterSearchHits —— 本机检索过滤", () => {
  it("类型 chip 严格过滤", () => {
    const out = filterSearchHits(HITS, {
      chip: "markdown",
      time: "all",
      query: "关键词",
    });
    expect(out.map((m) => m.hit.title)).toEqual(["架构笔记", "会议纪要"]);
    const html = filterSearchHits(HITS, {
      chip: "html",
      time: "all",
      query: "关键词",
    });
    expect(html.map((m) => m.hit.title)).toEqual(["页面"]);
  });

  it("时间段过滤：今天只剩架构笔记，更早只剩会议纪要", () => {
    const today = filterSearchHits(HITS, {
      chip: "all",
      time: "today",
      query: "关键词",
      now: NOW,
    });
    expect(today.map((m) => m.hit.title)).toEqual(["架构笔记"]);
    const older = filterSearchHits(HITS, {
      chip: "all",
      time: "older",
      query: "关键词",
      now: NOW,
    });
    expect(older.map((m) => m.hit.title)).toEqual(["会议纪要"]);
  });

  it("标题与片段各自计算高亮区间", () => {
    const out = filterSearchHits(HITS, {
      chip: "all",
      time: "all",
      query: "关键词",
    });
    expect(out).toHaveLength(3);
    const first = out[0];
    expect(first.ranges).toEqual([]);
    expect(first.excerptRanges.length).toBeGreaterThan(0);
    expect(
      first.hit.excerpt.slice(
        first.excerptRanges[0][0],
        first.excerptRanges[0][1],
      ),
    ).toBe("关键词");
  });

  it("query 为空时全部通过且区间为空", () => {
    const out = filterSearchHits(HITS, { chip: "all", time: "all", query: "" });
    expect(out).toHaveLength(3);
    expect(out.every((m) => m.ranges.length === 0)).toBe(true);
    expect(out.every((m) => m.excerptRanges.length === 0)).toBe(true);
  });

  it("query 在结果里无命中时剔除该条（防御）", () => {
    const out = filterSearchHits(HITS, {
      chip: "all",
      time: "all",
      query: "不存在的词",
    });
    expect(out).toHaveLength(0);
  });
});
