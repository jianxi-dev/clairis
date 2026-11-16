import { describe, it, expect } from "vitest";
import { searchScan } from "../lib/searchScan";
import {
  applyReplaceChanges,
  buildReplaceChanges,
} from "../lib/searchReplace";

/**
 * 替换事务纯函数（#983 / S-4）：一次 CM6 单事务的区间计算与字面插入。
 */

describe("buildReplaceChanges", () => {
  it("文档顺序输出，区间与命中一致，计数 = 命中数", () => {
    const doc = "甲甲\n\n乙甲";
    const hits = searchScan(doc, "甲");
    const changes = buildReplaceChanges(hits, "丙");
    expect(changes).toHaveLength(3);
    expect(changes.map((c) => c.from)).toEqual(hits.map((h) => h.from));
    for (let i = 0; i < hits.length; i++) {
      expect(changes[i].from).toBe(hits[i].from);
      expect(changes[i].to).toBe(hits[i].to);
      expect(changes[i].insert).toBe("丙");
    }
  });

  it("替换词为空即纯删除", () => {
    const doc = "属性面板";
    const hits = searchScan(doc, "属性");
    const changes = buildReplaceChanges(hits, "");
    expect(changes).toEqual([{ from: 0, to: 2, insert: "" }]);
    expect(applyReplaceChanges(doc, changes)).toBe("面板");
  });

  it("相邻命中各自成条，不被合并", () => {
    const doc = "aaaa";
    const hits = searchScan(doc, "aa");
    const changes = buildReplaceChanges(hits, "b");
    expect(changes).toEqual([
      { from: 0, to: 2, insert: "b" },
      { from: 2, to: 4, insert: "b" },
    ]);
    expect(applyReplaceChanges(doc, changes)).toBe("bb");
  });

  it("乱序输入仍按文档顺序输出（顺序安全）", () => {
    const doc = "属性面板属性";
    const hits = searchScan(doc, "属性");
    const reversed = [...hits].reverse();
    const changes = buildReplaceChanges(reversed, "X");
    expect(changes.map((c) => c.from)).toEqual([0, 4]);
  });

  it("重叠命中被丢弃，保证单事务合法", () => {
    const fake = [
      { from: 0, to: 4 },
      { from: 2, to: 6 },
      { from: 6, to: 8 },
    ] as unknown as ReturnType<typeof searchScan>;
    const changes = buildReplaceChanges(fake, "Y");
    expect(changes).toEqual([
      { from: 0, to: 4, insert: "Y" },
      { from: 6, to: 8, insert: "Y" },
    ]);
  });

  it("末尾命中：区间落在文档末尾", () => {
    const doc = "开头属性";
    const hits = searchScan(doc, "属性");
    const changes = buildReplaceChanges(hits, "尾");
    expect(changes[changes.length - 1]).toEqual({ from: 2, to: 4, insert: "尾" });
    expect(applyReplaceChanges(doc, changes)).toBe("开头尾");
  });
});

describe("applyReplaceChanges 字面插入", () => {
  it("替换词含 $& 等正则特殊字符按字面插入", () => {
    const doc = "属性面板属性";
    const hits = searchScan(doc, "属性");
    const changes = buildReplaceChanges(hits, "[$&]");
    expect(applyReplaceChanges(doc, changes)).toBe("[$&]面板[$&]");
  });

  it("整次全部替换：一次应用得到最终文本", () => {
    const doc = "# 属性面板\n\n这是属性面板的正文。\n\n属性面板可以配置。";
    const hits = searchScan(doc, "属性");
    const changes = buildReplaceChanges(hits, "特性");
    expect(applyReplaceChanges(doc, changes)).toBe(
      "# 特性面板\n\n这是特性面板的正文。\n\n特性面板可以配置。",
    );
  });
});
