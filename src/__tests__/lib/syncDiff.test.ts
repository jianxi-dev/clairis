import { describe, expect, it } from "vitest";
import { diffContent } from "../../lib/syncDiff";

describe("diffContent 最小 diff", () => {
  it("内容相同返回 null（调用方据此跳过 dispatch）", () => {
    expect(diffContent("abc", "abc")).toBeNull();
    expect(diffContent("", "")).toBeNull();
  });

  it("纯插入：只覆盖插入点", () => {
    expect(diffContent("ac", "abc")).toEqual({ from: 1, to: 1, insert: "b" });
  });

  it("纯删除：插入为空串", () => {
    expect(diffContent("abc", "ac")).toEqual({ from: 1, to: 2, insert: "" });
  });

  it("中间替换：保留前后公共部分", () => {
    expect(diffContent("hello world", "hello 世界")).toEqual({
      from: 6,
      to: 11,
      insert: "世界",
    });
  });

  it("空文档 → 有内容：整篇灌入", () => {
    expect(diffContent("", "abc")).toEqual({ from: 0, to: 0, insert: "abc" });
  });

  it("有内容 → 空文档：整篇删除", () => {
    expect(diffContent("abc", "")).toEqual({ from: 0, to: 3, insert: "" });
  });

  it("只有前缀相同：替换尾部", () => {
    expect(diffContent("sameTAIL", "sametail")).toEqual({
      from: 4,
      to: 8,
      insert: "tail",
    });
  });

  it("只有后缀相同：替换头部", () => {
    expect(diffContent("HEADsame", "headsame")).toEqual({
      from: 0,
      to: 4,
      insert: "head",
    });
  });

  it("中文字符按码元比较，区间仍是合法的下标", () => {
    // 前缀「一二」相同，后缀 0（「四」≠「八」），替换区间是 [2, 4)
    const diff = diffContent("一二三四", "一二六七八");
    expect(diff).toEqual({ from: 2, to: 4, insert: "六七八" });
  });

  it("换行差异只覆盖变化的那一行", () => {
    const before = "第一行\n第二行\n第三行";
    const after = "第一行\n改过的\n第三行";
    expect(diffContent(before, after)).toEqual({
      from: 4,
      to: 7,
      insert: "改过的",
    });
  });

  it("结果区间永远落在原文档内且 from <= to", () => {
    const cases: Array<[string, string]> = [
      ["", "x"],
      ["x", ""],
      ["abcdef", "abcdefg"],
      ["abcdef", "zabcdef"],
      ["aaaaa", "aaa"],
    ];
    for (const [current, next] of cases) {
      const diff = diffContent(current, next);
      expect(diff).not.toBeNull();
      expect(diff!.from).toBeGreaterThanOrEqual(0);
      expect(diff!.to).toBeLessThanOrEqual(current.length);
      expect(diff!.from).toBeLessThanOrEqual(diff!.to);
      // 还原校验：按 diff 应用后必须严格等于 next
      const applied =
        current.slice(0, diff!.from) + diff!.insert + current.slice(diff!.to);
      expect(applied).toBe(next);
    }
  });
});
