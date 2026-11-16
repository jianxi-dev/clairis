import { describe, it, expect } from "vitest";
import { searchScan, splitSearchBlocks } from "../lib/searchScan";

/**
 * searchScan（#981 / S-2 扫描规则）：默认不分大小写的子串匹配，
 * 扫描全文全部块；空查询是零宽匹配的守卫边界。
 */

describe("searchScan", () => {
  it("中文关键词：全文命中并带行号与上下文", () => {
    const doc = "# 属性面板\n\n这是属性面板的正文。";
    const hits = searchScan(doc, "属性");
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.text)).toEqual(["属性", "属性"]);
    expect(hits[0].blockIndex).toBe(0);
    expect(hits[0].line).toBe(1);
    expect(hits[1].blockIndex).toBe(1);
    expect(hits[1].line).toBe(3);
    expect(hits[0].context).toBe("# 属性面板");
    expect(hits[1].context).toBe("这是属性面板的正文。");
  });

  it("多块：空行分隔的段落各自成块，blockIndex 递增", () => {
    const doc = "甲一段\n\n乙二段甲\n\n丙三段甲";
    const hits = searchScan(doc, "甲");
    expect(hits.map((h) => h.blockIndex)).toEqual([0, 1, 2]);
  });

  it("大小写不敏感：原文大小写保留在命中里", () => {
    const doc = "Hello World\n\nhello again";
    const hits = searchScan(doc, "hello");
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.text)).toEqual(["Hello", "hello"]);
  });

  it("零宽 / 空查询防护：空串与纯空白不产生无穷匹配", () => {
    expect(searchScan("属性面板", "")).toEqual([]);
    expect(searchScan("", "属性")).toEqual([]);
    expect(searchScan("属性面板", "   ")).toEqual([]);
  });

  it("查询首尾空白按 trim 后匹配", () => {
    const hits = searchScan("属性 面板", " 属性 ");
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toBe("属性");
  });

  it("命中文本与文档切片一致", () => {
    const doc = "前置\n\n属性面板在后\n\n尾部";
    for (const hit of searchScan(doc, "属性")) {
      expect(doc.slice(hit.from, hit.to)).toBe(hit.text);
    }
  });

  it("正则元字符按字面匹配", () => {
    const doc = "a.b 与 axb";
    const hits = searchScan(doc, "a.b");
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toBe("a.b");
  });

  it("块切分：空行分隔，块偏移覆盖原文", () => {
    const doc = "第一块\nstill 第一块\n\n第二块";
    const blocks = splitSearchBlocks(doc);
    expect(blocks).toHaveLength(2);
    expect(doc.slice(blocks[0].from, blocks[0].to)).toBe(
      "第一块\nstill 第一块",
    );
    expect(doc.slice(blocks[1].from, blocks[1].to)).toBe("第二块");
    expect(blocks[1].startLine).toBe(4);
  });
});
