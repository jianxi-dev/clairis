import { describe, it, expect } from "vitest";

/** Direct test of heading parser logic (extracted for testability). */
function parseHeadings(content: string): { level: number; text: string; line: number }[] {
  const stripped = content.replace(/```[\s\S]*?```/g, "");
  const lines = stripped.split("\n");
  const headings: { level: number; text: string; line: number }[] = [];
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: lineNumber,
      });
    }
  }
  return headings;
}

describe("Outline heading parser", () => {
  it("extracts single heading", () => {
    const result = parseHeadings("# Hello");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ level: 1, text: "Hello", line: 1 });
  });

  it("extracts mixed headings", () => {
    const doc = `# H1
some text
## H2
### H3
more text`;
    const result = parseHeadings(doc);
    expect(result).toHaveLength(3);
    expect(result.map((h) => h.level)).toEqual([1, 2, 3]);
  });

  it("skips headings inside fenced code blocks", () => {
    const doc = `# Real heading
\`\`\`markdown
# Not a heading
## Also not
\`\`\`
## Real again`;
    const result = parseHeadings(doc);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Real heading");
    expect(result[1].text).toBe("Real again");
  });

  it("handles empty content", () => {
    expect(parseHeadings("")).toHaveLength(0);
  });

  it("handles content with only code blocks", () => {
    const doc = `\`\`\`
# inside code
## also inside
\`\`\``;
    expect(parseHeadings(doc)).toHaveLength(0);
  });

  it("does not match 7+ # as heading", () => {
    const doc = "####### not a heading";
    expect(parseHeadings(doc)).toHaveLength(0);
  });

  it("tracks line numbers correctly", () => {
    const doc = `\n\n### Third line heading`;
    const result = parseHeadings(doc);
    expect(result[0].line).toBe(3);
  });
});
