import { describe, it, expect } from "vitest";
import {
  extractHeadings,
  outlineSectionRunEnd,
  reorderSections,
} from "../../lib/outline";

/**
 * #1050：大纲拖动落点 = 正文重排。纯函数给定 markdown + fromIndex + toIndex
 * 返回新 markdown；索引是「文档顺序标题序列」的下标，toIndex 是移除被拖
 * 区段后、剩余标题列表里的插入位置。
 */
describe("reorderSections（大纲拖动 → 正文顺序同步）", () => {
  // 甲(H1) 与其子 甲一(H2) 是一个区段；乙(H1) 是甲的兄弟。
  const DOC = [
    "# 甲",
    "",
    "甲文。",
    "",
    "## 甲一",
    "",
    "甲一文。",
    "",
    "# 乙",
    "",
    "乙文。",
    "",
  ].join("\n");

  it("from === to 时原样返回（含尾换行）", () => {
    expect(reorderSections(DOC, 0, 0)).toBe(DOC);
    expect(reorderSections(DOC, 1, 1)).toBe(DOC);
  });

  it("标题无后代时单块移动", () => {
    const doc = ["## 甲", "甲文。", "## 乙", "乙文。", "## 丙", "丙文。"].join(
      "\n",
    );
    // 剩余 [乙, 丙]，插到 2 = 末尾。
    expect(reorderSections(doc, 0, 2)).toBe(
      ["## 乙", "乙文。", "## 丙", "丙文。", "## 甲", "甲文。"].join("\n"),
    );
  });

  it("拖动父标题带走其整个区段（含子标题）", () => {
    // 甲 的区段 = 甲 + 甲一；剩余 [乙]，插到 1。区段尾部的空行跟着走。
    expect(reorderSections(DOC, 0, 1)).toBe(
      [
        "# 乙",
        "",
        "乙文。",
        "# 甲",
        "",
        "甲文。",
        "",
        "## 甲一",
        "",
        "甲一文。",
        "",
      ].join("\n") + "\n",
    );
  });

  it("子上移：乙 提到最前", () => {
    expect(reorderSections(DOC, 2, 0)).toBe(
      [
        "# 乙",
        "",
        "乙文。",
        "# 甲",
        "",
        "甲文。",
        "",
        "## 甲一",
        "",
        "甲一文。",
        "",
      ].join("\n") + "\n",
    );
  });

  it("子标题单独移动，不带走兄弟", () => {
    const doc = ["# 甲", "甲文。", "## 甲一", "甲一一。", "## 甲二", "甲二二。"].join(
      "\n",
    );
    // 甲一（索引 1）移到 2（末尾）。
    expect(reorderSections(doc, 1, 2)).toBe(
      ["# 甲", "甲文。", "## 甲二", "甲二二。", "## 甲一", "甲一一。"].join("\n"),
    );
  });

  it("保留 frontmatter，且不把 frontmatter 里的 # 当标题", () => {
    const doc = [
      "---",
      "title: 标题",
      "# 不是标题",
      "---",
      "",
      "# 甲",
      "",
      "甲文。",
      "",
      "# 乙",
      "",
      "乙文。",
      "",
    ].join("\n");
    expect(extractHeadings(doc).map((h) => h.text)).toEqual(["甲", "乙"]);
    expect(reorderSections(doc, 0, 1)).toBe(
      [
        "---",
        "title: 标题",
        "# 不是标题",
        "---",
        "",
        "# 乙",
        "",
        "乙文。",
        "# 甲",
        "",
        "甲文。",
        "",
      ].join("\n") + "\n",
    );
  });

  it("围栏代码里的 # 不当标题，且随区段一起移动", () => {
    const doc = [
      "# 甲",
      "",
      "~~~md",
      "# 代码里的井号",
      "~~~",
      "",
      "## 甲一",
      "",
      "甲一文。",
      "",
      "# 乙",
      "",
      "乙文。",
      "",
    ].join("\n");
    expect(extractHeadings(doc).map((h) => h.text)).toEqual(["甲", "甲一", "乙"]);
    expect(reorderSections(doc, 0, 1)).toBe(
      [
        "# 乙",
        "",
        "乙文。",
        "# 甲",
        "",
        "~~~md",
        "# 代码里的井号",
        "~~~",
        "",
        "## 甲一",
        "",
        "甲一文。",
        "",
      ].join("\n") + "\n",
    );
  });

  it("无标题 / 越界索引原样返回", () => {
    expect(reorderSections("纯文本\n没有标题\n", 0, 1)).toBe(
      "纯文本\n没有标题\n",
    );
    expect(reorderSections(DOC, -1, 1)).toBe(DOC);
    expect(reorderSections(DOC, 99, 1)).toBe(DOC);
  });

  it("尾换行契约：有则保留，无则不补", () => {
    const withNl = "# 甲\n甲文。\n# 乙\n乙文。\n";
    const withoutNl = "# 甲\n甲文。\n# 乙\n乙文。";
    expect(reorderSections(withNl, 0, 1)).toBe("# 乙\n乙文。\n# 甲\n甲文。\n");
    expect(reorderSections(withoutNl, 0, 1)).toBe("# 乙\n乙文。\n# 甲\n甲文。");
  });

  it("toIndex 越界收敛到末尾", () => {
    expect(reorderSections(DOC, 0, 99)).toBe(reorderSections(DOC, 0, 1));
  });
});

describe("outlineSectionRunEnd（被拖区段的末尾下标）", () => {
  const headings = [
    { level: 1, text: "甲", line: 0 },
    { level: 2, text: "甲一", line: 2 },
    { level: 3, text: "甲一一", line: 4 },
    { level: 2, text: "甲二", line: 6 },
    { level: 1, text: "乙", line: 8 },
  ];

  it("包含所有连续更深层级", () => {
    expect(outlineSectionRunEnd(headings, 0)).toBe(3);
  });

  it("同级即停止", () => {
    expect(outlineSectionRunEnd(headings, 1)).toBe(2);
  });

  it("末位即自身", () => {
    expect(outlineSectionRunEnd(headings, 4)).toBe(4);
  });
});
