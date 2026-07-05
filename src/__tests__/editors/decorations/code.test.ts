import { describe, it, expect } from "vitest";
import {
  inlineCodeRegex,
  INLINE_CODE_CLASS,
  createCodeDecorations,
} from "../../../editors/decorations/code";

describe("code decoration", () => {
  describe("inlineCodeRegex", () => {
    it("matches `inline code`", () => {
      inlineCodeRegex.lastIndex = 0;
      const m = inlineCodeRegex.exec("text `code` here");
      expect(m).not.toBeNull();
      expect(m![0]).toBe("`code`");
    });

    it("matches multi-backtick code", () => {
      inlineCodeRegex.lastIndex = 0;
      const m = inlineCodeRegex.exec("text ``code`` here");
      expect(m).not.toBeNull();
    });

    it("does not match single backtick alone", () => {
      inlineCodeRegex.lastIndex = 0;
      expect(inlineCodeRegex.exec("just a ` here")).toBeNull();
    });

    it("matches multiple inline codes", () => {
      inlineCodeRegex.lastIndex = 0;
      const text = "`a` and `b` and `c`";
      const matches = [...text.matchAll(inlineCodeRegex)];
      expect(matches).toHaveLength(3);
    });
  });

  describe("CSS classes", () => {
    it("INLINE_CODE_CLASS is defined", () => {
      expect(INLINE_CODE_CLASS).toBeDefined();
      expect(typeof INLINE_CODE_CLASS).toBe("string");
    });
  });

  describe("createCodeDecorations", () => {
    it("returns 3 decorations: hide backticks + style content", () => {
      const result = createCodeDecorations("text `code` here");
      // 3: replace open ` + mark content + replace close `
      expect(result.length).toBe(3);
    });

    it("first decoration hides opening backtick", () => {
      const result = createCodeDecorations("text `code` here");
      // Opening ` is at position 5
      expect(result[0].from).toBe(5);
      expect(result[0].to).toBe(6);
    });

    it("second decoration styles code content", () => {
      const result = createCodeDecorations("text `code` here");
      expect(result[1].value.spec.class).toBe(INLINE_CODE_CLASS);
      expect(result[1].from).toBe(6);
      expect(result[1].to).toBe(10);
    });

    it("third decoration hides closing backtick", () => {
      const result = createCodeDecorations("text `code` here");
      expect(result[2].from).toBe(10);
      expect(result[2].to).toBe(11);
    });

    it("returns empty for plain text", () => {
      const result = createCodeDecorations("plain text");
      expect(result).toHaveLength(0);
    });
  });
});
