import { describe, expect, it } from "vitest";
import {
  dedupeLinks,
  dedupeTags,
  dedupeValues,
  parseLinkListText,
  parseTagListText,
} from "../../lib/frontmatter";

describe("dedupeValues", () => {
  it("保序去重并 trim、去空项", () => {
    expect(dedupeValues(["甲", " 乙 ", "甲", "", "丙", "乙"])).toEqual([
      "甲",
      "乙",
      "丙",
    ]);
  });

  it("链接按整体字符串比较", () => {
    expect(dedupeLinks(["[[a]]", "[[a]]", "[[b]]"])).toEqual([
      "[[a]]",
      "[[b]]",
    ]);
  });

  it("dedupeTags 与 dedupeLinks 同实现", () => {
    expect(dedupeTags(["x", "x", "y"])).toEqual(["x", "y"]);
  });
});

describe("parseLinkListText", () => {
  it("抽出 [[链接]] 并保留原样", () => {
    expect(parseLinkListText("[[设计说明.md]]、[[架构现状.md]]")).toEqual([
      "[[设计说明.md]]",
      "[[架构现状.md]]",
    ]);
  });

  it("链接与普通文本混排时两部分都保留", () => {
    expect(parseLinkListText("[[a]] 普通、乙\n丙")).toEqual([
      "[[a]]",
      "普通",
      "乙",
      "丙",
    ]);
  });

  it("无链接时退化为分隔符分割", () => {
    expect(parseLinkListText("甲、乙，丙\n丁")).toEqual([
      "甲",
      "乙",
      "丙",
      "丁",
    ]);
  });
});

describe("parseTagListText", () => {
  it("按顿号 / 逗号 / 换行分割并去空", () => {
    expect(parseTagListText("甲、乙，丙\n丁")).toEqual([
      "甲",
      "乙",
      "丙",
      "丁",
    ]);
  });
});
