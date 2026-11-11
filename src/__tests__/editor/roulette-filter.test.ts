import { describe, expect, test } from "vitest";
import {
  matchCommandsIn,
  type RouletteItem,
} from "../../editors/orchestration/roulette-view";

const exec = (item: RouletteItem): boolean => !!item.run;

const leaf = (label: string, run = true): RouletteItem => ({
  id: label,
  label,
  icon: "callout",
  ...(run ? { run: () => {} } : {}),
});

const group = (label: string, children: RouletteItem[]): RouletteItem => ({
  id: label,
  label,
  icon: "callout",
  children,
});

describe("matchCommandsIn（轮盘筛选树遍历）", () => {
  const groups = [
    {
      items: [
        group("高亮", [leaf("注释"), leaf("信息"), leaf("提示")]),
        leaf("加粗"),
      ],
      label: "转换",
    },
  ];

  test("父级命中 → 全部可执行子级出列，父级自身不重复显示", () => {
    const rows = matchCommandsIn(groups, "高亮", exec);
    expect(rows.map((r) => r.item.label)).toEqual(["注释", "信息", "提示"]);
    expect(rows.every((r) => r.group === "高亮")).toBe(true);
    expect(rows.some((r) => r.item.label === "高亮")).toBe(false);
  });

  test("父级未命中 → 叶子子串命中照常收录", () => {
    const rows = matchCommandsIn(groups, "提示", exec);
    expect(rows.map((r) => r.item.label)).toEqual(["提示"]);
    expect(rows[0]?.group).toBe("高亮");
  });

  test("空查询 → 无结果", () => {
    expect(matchCommandsIn(groups, "", exec)).toEqual([]);
    expect(matchCommandsIn(groups, "   ", exec)).toEqual([]);
  });

  test("命中父级且子级仍是父级 → 后代全部平铺，group 记最近父级", () => {
    const deep = [
      {
        items: [group("列表", [group("有序", [leaf("有序列表")])])],
        label: "转换",
      },
    ];
    const rows = matchCommandsIn(deep, "列表", exec);
    expect(rows.map((r) => r.item.label)).toEqual(["有序列表"]);
    expect(rows[0]?.group).toBe("有序");
  });

  test("叶子命中但不可执行 → 不收录死行", () => {
    const dead = [{ items: [leaf("加粗", false)], label: "格式" }];
    expect(matchCommandsIn(dead, "加粗", exec)).toEqual([]);
  });
});
