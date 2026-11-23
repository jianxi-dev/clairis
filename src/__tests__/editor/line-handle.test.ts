/**
 * 行手柄纯函数测试（editor-refine-batch1 / 1.1）。
 *
 * `handleKeysFor` 钉死行键含文档行起点（纯内容变更不重建）；
 * `collectHandleSpecs` 钉死文本行块按文档行拆行手柄、非文本行块保留块级手柄。
 */
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  collectHandleSpecs,
  handleKey,
  handleKeysFor,
} from "../../editors/orchestration/block-handle";

function specsOf(doc: string) {
  return collectHandleSpecs(
    EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage })],
    }),
  );
}

describe("handleKey 行键", () => {
  it("行手柄键含文档行号", () => {
    expect(handleKey(0, "paragraph", "FormatParagraphOutlined", 1)).toBe(
      "0:paragraph:FormatParagraphOutlined:line:1",
    );
    expect(handleKey(1, "paragraph", "FormatParagraphOutlined", 2)).toBe(
      "1:paragraph:FormatParagraphOutlined:line:2",
    );
  });

  it("块级键不含行后缀", () => {
    expect(handleKey(0, "table", "TableGridOutlined")).toBe(
      "0:table:TableGridOutlined",
    );
  });
});

describe("handleKeysFor 行键", () => {
  it("多行段落每行一个键，纯内容变更键不变", () => {
    const before = handleKeysFor([
      { type: "paragraph", firstLine: "第一行", kind: "line", lineNumber: 1 },
      { type: "paragraph", firstLine: "第二行", kind: "line", lineNumber: 2 },
    ]);
    const after = handleKeysFor([
      {
        type: "paragraph",
        firstLine: "第一行加了十个字",
        kind: "line",
        lineNumber: 1,
      },
      { type: "paragraph", firstLine: "第二行", kind: "line", lineNumber: 2 },
    ]);
    expect(after).toEqual(before);
  });

  it("行数变化改变键", () => {
    const before = handleKeysFor([
      { type: "paragraph", firstLine: "第一行", kind: "line", lineNumber: 1 },
    ]);
    const after = handleKeysFor([
      { type: "paragraph", firstLine: "第一行", kind: "line", lineNumber: 1 },
      { type: "paragraph", firstLine: "第二行", kind: "line", lineNumber: 2 },
    ]);
    expect(after).not.toEqual(before);
  });

  it("同一块内不同行的键不相等", () => {
    const keys = handleKeysFor([
      { type: "paragraph", firstLine: "第一行", kind: "line", lineNumber: 1 },
      { type: "paragraph", firstLine: "第二行", kind: "line", lineNumber: 2 },
    ]);
    expect(keys[0]).not.toBe(keys[1]);
  });
});

describe("collectHandleSpecs 行级枚举", () => {
  it("多行段落按文档行产出 line 规格", () => {
    const specs = specsOf("第一行\n第二行\n第三行");
    const lines = specs.filter((s) => s.kind === "line");
    expect(lines).toHaveLength(3);
    expect(lines.map((s) => s.lineFrom)).toEqual([0, 4, 8]);
    expect(lines.every((s) => s.block.type === "paragraph")).toBe(true);
    expect(specs.some((s) => s.kind === "trailing")).toBe(true);
  });

  it("标题按行产出 line 规格", () => {
    const heading = specsOf("# 标题");
    expect(heading.filter((s) => s.kind === "line")).toHaveLength(1);
    expect(heading[0].block.type).toBe("heading");
  });

  it("引用：容器与嵌套段落各自按行产出 line 规格（hover 命中嵌套）", () => {
    const quote = specsOf("> 甲\n> 乙");
    const quoteLines = quote.filter((s) => s.kind === "line");
    expect(quoteLines).toHaveLength(4);
    expect(quoteLines.some((s) => s.block.type === "blockquote")).toBe(true);
    expect(quoteLines.some((s) => s.block.type === "paragraph")).toBe(true);
  });

  it("列表每个条目行一个 line 规格", () => {
    const specs = specsOf("- 甲\n- 乙");
    const lines = specs.filter((s) => s.kind === "line");
    expect(lines).toHaveLength(2);
    expect(lines.map((s) => s.lineFrom)).toEqual([0, 4]);
  });

  it("表格 / 代码块保留块级手柄，不产生行手柄", () => {
    const table = specsOf("| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(table.filter((s) => s.kind === "line")).toHaveLength(0);
    expect(table.filter((s) => s.kind === "block")).toHaveLength(1);

    const code = specsOf("```\ncode\n```");
    expect(code.filter((s) => s.kind === "line")).toHaveLength(0);
    expect(code.filter((s) => s.kind === "block")).toHaveLength(1);
  });

  it("高亮块保留块级手柄", () => {
    const specs = specsOf("> [!NOTE] 标题\n> 正文");
    expect(specs.filter((s) => s.kind === "line")).toHaveLength(0);
    expect(specs.filter((s) => s.kind === "block")).toHaveLength(1);
  });

  it("列表内的代码块：代码行不溢出成行手柄，代码块保留块级手柄", () => {
    const specs = specsOf("- 甲\n  ```\n  code\n  ```");
    const lines = specs.filter((s) => s.kind === "line");
    expect(lines).toHaveLength(1);
    expect(lines[0].lineFrom).toBe(0);
    expect(
      specs.some((s) => s.kind === "block" && s.block.type === "fencedCode"),
    ).toBe(true);
  });

  it("块间空行仍产出 empty 规格", () => {
    const specs = specsOf("第一段\n\n第二段");
    expect(specs.filter((s) => s.kind === "empty")).toHaveLength(1);
  });
});
