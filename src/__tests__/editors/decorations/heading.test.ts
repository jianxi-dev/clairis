import { describe, it, expect } from "vitest";
import {
  headingRegex,
  HEADING_CLASS,
  HEADING_MARKER_CLASS,
  HEADING_MARKER_ACTIVE_CLASS,
  BLOCK_ACTIVE_CLASS,
  BLOCK_INACTIVE_CLASS,
  createHeadingDecorations,
} from "../../../editors/decorations/heading";

describe("heading decoration", () => {
  describe("headingRegex", () => {
    it("matches h1-h6", () => {
      const tests = [
        { input: "# Title", captures: ["#", "Title"] },
        { input: "## Section", captures: ["##", "Section"] },
        { input: "### Sub", captures: ["###", "Sub"] },
        { input: "#### Deep", captures: ["####", "Deep"] },
        { input: "##### Deeper", captures: ["#####", "Deeper"] },
        { input: "###### Deepest", captures: ["######", "Deepest"] },
      ];
      for (const { input, captures } of tests) {
        headingRegex.lastIndex = 0;
        const m = headingRegex.exec(input);
        expect(m).not.toBeNull();
        expect(m![1]).toBe(captures[0]);
        expect(m![2]).toBe(captures[1]);
      }
    });

    it("does not match plain text", () => {
      headingRegex.lastIndex = 0;
      expect(headingRegex.exec("Not a heading")).toBeNull();
    });

    it("does not match # with no space", () => {
      headingRegex.lastIndex = 0;
      expect(headingRegex.exec("#NotHeading")).toBeNull();
    });

    it("matches multiline", () => {
      headingRegex.lastIndex = 0;
      const text = "# First\nparagraph\n## Second\n";
      const matches = [...text.matchAll(headingRegex)];
      expect(matches).toHaveLength(2);
      expect(matches[0][1]).toBe("#");
      expect(matches[1][1]).toBe("##");
    });
  });

  describe("HEADING_CLASS", () => {
    it("is defined", () => {
      expect(HEADING_CLASS).toBeDefined();
    });

    it("is a string", () => {
      expect(typeof HEADING_CLASS).toBe("string");
    });
  });

  describe("createHeadingDecorations", () => {
    it("returns marker mark + text mark per heading", () => {
      const result = createHeadingDecorations("# Hello\n");
      // 2 个装饰：标记 mark（`# `，非活跃块透明度 0）+ 正文 mark
      expect(result.length).toBe(2);
      // 第一个：标记 mark，不是 replace——原始 `# ` 必须留在 DOM 里才能编辑
      expect(result[0].value.spec.widget).toBeUndefined();
      expect(result[0].value.spec.class).toContain(HEADING_MARKER_CLASS);
      // 第二个：正文 mark，带标题类
      expect(result[1].value.spec.class).toContain(HEADING_CLASS);
    });

    it("empty heading emits no zero-width mark (slash menu inserts `# `)", () => {
      const result = createHeadingDecorations("# ");
      // 只有标记 mark；正文范围宽度为 0，CM6 拒绝空 mark
      expect(result.length).toBe(1);
      expect(result[0].from).toBe(0);
      expect(result[0].to).toBe(2);
    });

    it("replaces only the # prefix, preserves heading text", () => {
      const result = createHeadingDecorations("## Section Title\n");
      // Replace range covers only "## " (3 chars), not "Section Title"
      expect(result[0].from).toBe(0);
      expect(result[0].to).toBe(3); // "## " = 3 characters
      // Mark range covers the text
      expect(result[1].from).toBe(3);
      expect(result[1].to).toBe(16); // "Section Title" starts after "## "
    });

    it("handles multiple headings", () => {
      const result = createHeadingDecorations("# A\n### B\n");
      // 2 headings × 2 decorations = 4
      expect(result.length).toBe(4);
    });

    it("returns empty for plain text", () => {
      const result = createHeadingDecorations("plain text\nno headings\n");
      expect(result).toHaveLength(0);
    });
  });

  describe("two-state (active / inactive)", () => {
    it("keeps the marker but emits no active class when the cursor is outside", () => {
      const result = createHeadingDecorations("# Title\n\nParagraph", 10, 19);
      const marker = result.find((d) =>
        d.value.spec.class?.includes(HEADING_MARKER_CLASS),
      );
      expect(marker).toBeDefined();
      expect(marker!.value.spec.class).not.toContain(
        HEADING_MARKER_ACTIVE_CLASS,
      );
    });

    it("emits the active marker class when the cursor is inside the heading", () => {
      const result = createHeadingDecorations("# Title", 0, 7);
      const marker = result.find((d) =>
        d.value.spec.class?.includes(HEADING_MARKER_CLASS),
      );
      expect(marker!.value.spec.class).toContain(HEADING_MARKER_ACTIVE_CLASS);
    });

    it("scales the heading text by level", () => {
      const result = createHeadingDecorations("### Sub", 0, 7);
      const text = result.find((d) => d.value.spec.class?.includes("cm-h3"));
      expect(text!.value.spec.class).toContain(HEADING_CLASS);
      expect(text!.value.spec.class).toContain(BLOCK_ACTIVE_CLASS);
    });

    it("marks inactive heading text with cm-block-inactive", () => {
      const result = createHeadingDecorations("### Sub");
      const text = result.find((d) => d.value.spec.class?.includes("cm-h3"));
      expect(text!.value.spec.class).toContain(BLOCK_INACTIVE_CLASS);
    });
  });
});
