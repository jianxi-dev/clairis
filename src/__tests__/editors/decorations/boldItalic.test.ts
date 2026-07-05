import { describe, it, expect } from "vitest";
import {
  boldRegex,
  italicRegex,
  BOLD_CLASS,
  ITALIC_CLASS,
  createBoldItalicDecorations,
} from "../../../editors/decorations/boldItalic";

describe("boldItalic decoration", () => {
  describe("boldRegex", () => {
    it("matches **bold**", () => {
      boldRegex.lastIndex = 0;
      const m = boldRegex.exec("hello **world** here");
      expect(m).not.toBeNull();
      expect(m![0]).toBe("**world**");
    });

    it("does not match single *", () => {
      boldRegex.lastIndex = 0;
      expect(boldRegex.exec("hello *world* here")).toBeNull();
    });

    it("matches across multiple lines", () => {
      boldRegex.lastIndex = 0;
      const text = "**bold1** and **bold2**";
      const matches = [...text.matchAll(boldRegex)];
      expect(matches).toHaveLength(2);
    });
  });

  describe("italicRegex", () => {
    it("matches *italic*", () => {
      italicRegex.lastIndex = 0;
      const m = italicRegex.exec("hello *world* here");
      expect(m).not.toBeNull();
      expect(m![0]).toBe("*world*");
    });

    it("does not match **bold**", () => {
      italicRegex.lastIndex = 0;
      // Should not match ** as italic
      const m = italicRegex.exec("hello **world** here");
      expect(m).toBeNull();
    });

    it("matches _underscore_ style", () => {
      italicRegex.lastIndex = 0;
      const m = italicRegex.exec("hello _world_ here");
      expect(m).not.toBeNull();
    });
  });

  describe("CSS classes", () => {
    it("BOLD_CLASS is defined", () => {
      expect(BOLD_CLASS).toBeDefined();
      expect(typeof BOLD_CLASS).toBe("string");
    });

    it("ITALIC_CLASS is defined", () => {
      expect(ITALIC_CLASS).toBeDefined();
      expect(typeof ITALIC_CLASS).toBe("string");
    });
  });

  describe("createBoldItalicDecorations", () => {
    it("returns decorations for bold and italic", () => {
      const result = createBoldItalicDecorations("**bold** and *italic*");
      // 3 per bold (replace-open + mark + replace-close) + 3 per italic = 6
      expect(result.length).toBe(6);
    });

    it("returns empty for plain text", () => {
      const result = createBoldItalicDecorations("plain text");
      expect(result).toHaveLength(0);
    });

    it("first bold decoration is a replace (hides **)", () => {
      const result = createBoldItalicDecorations("**bold**");
      // [0] = replace opening **, [1] = mark bold text, [2] = replace closing **
      expect(result[0].value.spec.widget).toBeUndefined();
      expect(result[0].value.spec.class).toBeUndefined();
      // Opening ** replaced (empty replace = hidden)
      expect(result[0].from).toBe(0);
      expect(result[0].to).toBe(2);
    });

    it("second bold decoration is a mark (styles text)", () => {
      const result = createBoldItalicDecorations("**bold**");
      expect(result[1].value.spec.class).toBe(BOLD_CLASS);
      expect(result[1].from).toBe(2);
      expect(result[1].to).toBe(6); // "bold" = 4 chars
    });

    it("third bold decoration hides closing **", () => {
      const result = createBoldItalicDecorations("**bold**");
      expect(result[2].from).toBe(6);
      expect(result[2].to).toBe(8); // closing **
    });
  });
});
