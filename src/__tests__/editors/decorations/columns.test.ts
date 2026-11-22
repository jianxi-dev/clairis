import { describe, it, expect } from "vitest";
import {
  columnContentKey,
  findColumnBlockByContent,
  type ColumnBlock,
  type ColumnContentKey,
} from "../../../editors/decorations/columns";

function makeBlock(overrides: Partial<ColumnBlock> = {}): ColumnBlock {
  return {
    from: 0,
    to: 0,
    openFrom: 0,
    openTo: 0,
    openText: "::: {.col-2}",
    count: 2,
    widths: null,
    cells: [],
    ...overrides,
  };
}

function makeKey(overrides: Partial<ColumnContentKey> = {}): ColumnContentKey {
  return {
    openLine: "::: {.col-2}",
    count: 2,
    cells: ["左", "右"],
    ...overrides,
  };
}

describe("分栏内容键", () => {
  it("随首行围栏与列数变化", () => {
    const base = columnContentKey(makeBlock());
    expect(base).toEqual({ openLine: "::: {.col-2}", count: 2, cells: [] });

    expect(
      columnContentKey(makeBlock({ openText: "::: {.col-3}" })).openLine,
    ).toBe("::: {.col-3}");
    expect(columnContentKey(makeBlock({ count: 3 })).count).toBe(3);
  });

  it("区分同属性、同列数但内容不同的两个分栏块", () => {
    const a = columnContentKey(
      makeBlock({
        openText: "::: {.col-2 cols:60,40}",
        cells: [
          { from: 0, to: 1, text: "甲" },
          { from: 0, to: 1, text: "乙" },
        ],
      }),
    );
    const b = columnContentKey(
      makeBlock({
        openText: "::: {.col-2 cols:60,40}",
        cells: [
          { from: 0, to: 1, text: "丙" },
          { from: 0, to: 1, text: "丁" },
        ],
      }),
    );
    expect(a).not.toEqual(b);
  });

  it("忽略单元格首尾空白后仍相等", () => {
    const a = columnContentKey(
      makeBlock({ cells: [{ from: 0, to: 1, text: " 左 " }] }),
    );
    const b = columnContentKey(
      makeBlock({ cells: [{ from: 0, to: 1, text: "左" }] }),
    );
    expect(a).toEqual(b);
  });
});

describe("按内容匹配分栏块", () => {
  const doc = "前言\n\n::: {.col-2}\n\n左栏\n\n右栏\n\n:::\n\n后记";

  it("文档位移（前方插入块）后仍命中同一围栏", () => {
    const shifted = `新增段落\n\n${doc}`;
    const key = makeKey({ cells: ["左栏", "右栏"] });
    const hit = findColumnBlockByContent(shifted, key, 0);
    expect(hit).not.toBeNull();
    expect(hit!.openText).toBe("::: {.col-2}");
    expect(hit!.from).toBe(shifted.indexOf(":::"));
  });

  it("区分同属性的两个分栏块", () => {
    const two =
      "::: {.col-2 cols:60,40}\n\n甲\n\n乙\n\n:::\n\n" +
      "::: {.col-2 cols:60,40}\n\n丙\n\n丁\n\n:::\n\n正文";
    const key = makeKey({
      openLine: "::: {.col-2 cols:60,40}",
      cells: ["丙", "丁"],
    });
    const hit = findColumnBlockByContent(two, key, 0);
    expect(hit).not.toBeNull();
    expect(hit!.cells.map((c) => c.text.trim())).toEqual(["丙", "丁"]);
  });

  it("内容不符时返回 null（兜底判定）", () => {
    const key = makeKey({ cells: ["不存在", "右栏"] });
    expect(findColumnBlockByContent(doc, key, 0)).toBeNull();
  });

  it("首行围栏被改时返回 null", () => {
    const key = makeKey({ openLine: "::: {.col-3}" });
    expect(findColumnBlockByContent(doc, key, 0)).toBeNull();
  });

  it("重复同文块取离 nearFrom 最近者", () => {
    const dup =
      "::: {.col-2}\n\n同\n\n同\n\n:::\n\n" +
      "中间\n\n" +
      "::: {.col-2}\n\n同\n\n同\n\n:::\n\n正文";
    const key = makeKey({ cells: ["同", "同"] });
    const secondFrom = dup.lastIndexOf("::: {.col-2}");
    const hit = findColumnBlockByContent(dup, key, secondFrom);
    expect(hit).not.toBeNull();
    expect(hit!.from).toBe(secondFrom);
  });
});
