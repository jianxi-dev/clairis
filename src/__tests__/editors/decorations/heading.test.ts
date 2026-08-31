import { describe, it, expect } from "vitest";
import { headingRegex, HEADING_CLASS, createHeadingDecorations } from "../../../editors/decorations/heading";
import { Decoration } from "@codemirror/view";

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
    it("returns replace + mark decorations per heading", () => {
      const result = createHeadingDecorations("# Hello\n");
      // 2 decorations: 1 replace (##prefix) + 1 mark (text)
      expect(result.length).toBe(2);
      // First: replace with widget (hides "# ")
      expect(result[0].value.spec.widget).toBeDefined();
      // Second: mark with heading class (styles text)
      expect(result[1].value.spec.class).toBe(HEADING_CLASS);
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
});
