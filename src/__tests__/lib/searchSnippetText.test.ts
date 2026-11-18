import { describe, it, expect } from "vitest";
import {
  isMarkdownTable,
  plainTableSnippet,
} from "../../lib/searchSnippetText";

describe("isMarkdownTable", () => {
  it("表头 + 紧邻对齐行判定为表格", () => {
    expect(isMarkdownTable("| 列A | 列B |\n| --- | --- |\n| 值1 | 值2 |")).toBe(
      true,
    );
    expect(isMarkdownTable("姓名 | 年龄\n--- | ---\n张三 | 28")).toBe(true);
  });

  it("普通段落中的竖线 / 分隔线不算表格", () => {
    expect(isMarkdownTable("甲 | 乙\n丙 | 丁")).toBe(false);
    expect(isMarkdownTable("正文提到 a | b 而已")).toBe(false);
    expect(isMarkdownTable("标题\n\n---\n\n正文")).toBe(false);
  });
});

describe("plainTableSnippet", () => {
  it("按行拼接单元格文字并剥离竖线与对齐行", () => {
    const src = [
      "…| 35 | 上海 | 设计师 |",
      "| 王五 | 42 | 广州 | 产品经理 |",
      "| --- | --- | --- | --- |",
    ].join("\n");
    const out = plainTableSnippet(src);
    expect(out.text).not.toContain("|");
    expect(out.text).not.toContain("---");
    expect(out.text).toContain("35 上海 设计师");
    expect(out.text).toContain("王五 42 广州 产品经理");
  });

  it("映射保持命中区间落在同一字符", () => {
    const src = "| 赵六 | 31 | 深圳 | 测试工程师 |";
    const out = plainTableSnippet(src);
    expect(out.text).toBe("赵六 31 深圳 测试工程师");
    expect(out.text.slice(out.map[2], out.map[4])).toBe("赵六");
  });

  it("跨行映射同样保持命中落点", () => {
    const src = "| 张三 | 28 | 北京 | 工程师 |\n| 李四 | 35 | 上海 | 设计师 |";
    const out = plainTableSnippet(src);
    const from = src.indexOf("李四");
    const to = from + 2;
    expect(out.text.slice(out.map[from], out.map[to])).toBe("李四");
  });

  it("代码跨度与转义竖线不被误切", () => {
    const src = "| `a|b` | c\\|d |";
    const out = plainTableSnippet(src);
    expect(out.text).toBe("`a|b` c\\|d");
    expect(out.map[src.length]).toBe(out.text.length);
  });

  it("无竖线的普通文本原样返回且映射恒等", () => {
    const src = "普通段落 **加粗**";
    const out = plainTableSnippet(src);
    expect(out.text).toBe(src);
    for (let i = 0; i <= src.length; i++) expect(out.map[i]).toBe(i);
  });
});
