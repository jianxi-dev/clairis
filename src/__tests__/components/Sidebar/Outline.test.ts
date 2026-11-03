import { describe, it, expect } from "vitest";
import { extractHeadings } from "../../../lib/outline";

describe("extractHeadings（大纲解析，编辑区与侧栏共用）", () => {
  it("extracts single heading", () => {
    expect(extractHeadings("# Hello")).toEqual([
      { level: 1, text: "Hello", line: 0 },
    ]);
  });

  it("extracts mixed headings", () => {
    const doc = ["# H1", "some text", "## H2", "### H3", "more text"].join(
      "\n",
    );
    expect(extractHeadings(doc).map((h) => h.level)).toEqual([1, 2, 3]);
  });

  it("skips headings inside fenced code blocks", () => {
    const doc = [
      "# Real heading",
      "```markdown",
      "# Not a heading",
      "## Also not",
      "```",
      "## Real again",
    ].join("\n");
    const result = extractHeadings(doc);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Real heading");
    expect(result[1].text).toBe("Real again");
  });

  it("skips tilde fences and unclosed fences", () => {
    expect(
      extractHeadings("~~~\n# inside\n~~~\n# outside").map((h) => h.text),
    ).toEqual(["outside"]);
    expect(extractHeadings("```\n# inside forever")).toHaveLength(0);
  });

  it("handles empty content", () => {
    expect(extractHeadings("")).toHaveLength(0);
  });

  it("does not match 7+ # as heading", () => {
    expect(extractHeadings("####### not a heading")).toHaveLength(0);
  });

  it("tracks 0-based line numbers", () => {
    const result = extractHeadings("\n\n### Third line heading");
    expect(result[0].line).toBe(2);
  });

  it("strips trailing closing hashes", () => {
    expect(extractHeadings("## 标题 ##")[0].text).toBe("标题");
  });
});
