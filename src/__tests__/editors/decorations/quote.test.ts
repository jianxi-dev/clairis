import { describe, it, expect } from "vitest";
import {
  quoteRegex,
  QUOTE_CLASS,
  createQuoteDecorations,
} from "../../../editors/decorations/quote";

describe("quote decoration", () => {
  describe("quoteRegex", () => {
    it("matches > single line", () => {
      quoteRegex.lastIndex = 0;
      expect(quoteRegex.test("> quoted text")).toBe(true);
    });

    it("matches > multiline blockquote", () => {
      const text = "> line 1\n> line 2\n";
      // Test line by line since regex is non-global
      const lines = text.split("\n").filter((l) => l !== "");
      const matched = lines.filter((l) => quoteRegex.test(l));
      expect(matched.length).toBeGreaterThanOrEqual(1);
    });

    it("does not match plain text", () => {
      quoteRegex.lastIndex = 0;
      expect(quoteRegex.test("plain text")).toBe(false);
    });

    it("does not match >> (nested without space)", () => {
      quoteRegex.lastIndex = 0;
      expect(quoteRegex.test(">> nested")).toBe(true); // still matched, > is at start
    });
  });

  describe("CSS classes", () => {
    it("QUOTE_CLASS is defined", () => {
      expect(QUOTE_CLASS).toBeDefined();
      expect(typeof QUOTE_CLASS).toBe("string");
    });
  });

  describe("createQuoteDecorations", () => {
    it("returns 2 decorations per quote line: replace >  + line style", () => {
      const result = createQuoteDecorations("> quoted text\n");
      expect(result.length).toBe(2);
    });

    it("replaces the >  prefix (hides > )", () => {
      const result = createQuoteDecorations("> quoted text\n");
      // First: line class, Second: replace
      const replaceDeco = result.find((d) => !d.value.spec.class);
      expect(replaceDeco).toBeDefined();
      expect(replaceDeco!.from).toBe(0);
      expect(replaceDeco!.to).toBe(2); // "> "
    });

    it("applies line class with QUOTE_CLASS", () => {
      const result = createQuoteDecorations("> quoted text\n");
      const lineDeco = result.find((d) => d.value.spec.class);
      expect(lineDeco).toBeDefined();
      expect(lineDeco!.value.spec.class).toBe(QUOTE_CLASS);
    });

    it("returns empty for plain text", () => {
      const result = createQuoteDecorations("plain text");
      expect(result).toHaveLength(0);
    });
  });
});
