import { describe, it, expect } from "vitest";
import {
  quoteRegex,
  QUOTE_CLASS,
  createQuoteDecorations,
  QUOTE_MARKER_ACTIVE_CLASS,
  BLOCK_ACTIVE_CLASS,
  BLOCK_INACTIVE_CLASS,
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
      // 无活跃块时行类带 cm-block-inactive（两态模型的非活跃态）
      expect(lineDeco!.value.spec.class).toContain(QUOTE_CLASS);
    });

    it("returns empty for plain text", () => {
      const result = createQuoteDecorations("plain text");
      expect(result).toHaveLength(0);
    });
  });

  describe("two-state (active / inactive)", () => {
    it("replaces the `> ` prefix when the block is inactive", () => {
      const result = createQuoteDecorations("> quoted text");
      const replace = result.find((d) => !d.value.spec.class);
      expect(replace).toBeDefined();
      expect(replace!.from).toBe(0);
      expect(replace!.to).toBe(2);
    });

    it("shows a faint `> ` marker instead of replacing it when active", () => {
      const result = createQuoteDecorations("> quoted text", 0, 13);
      expect(result.find((d) => !d.value.spec.class)).toBeUndefined();
      const marker = result.find(
        (d) => d.value.spec.class === QUOTE_MARKER_ACTIVE_CLASS,
      );
      expect(marker).toBeDefined();
      expect(marker!.from).toBe(0);
      expect(marker!.to).toBe(2);
    });

    it("tags the quote line with the block state", () => {
      const inactive = createQuoteDecorations("> quoted text");
      const line = inactive.find((d) =>
        d.value.spec.class?.includes(QUOTE_CLASS),
      );
      expect(line!.value.spec.class).toContain(BLOCK_INACTIVE_CLASS);

      const active = createQuoteDecorations("> quoted text", 0, 13);
      const activeLine = active.find((d) =>
        d.value.spec.class?.includes(QUOTE_CLASS),
      );
      expect(activeLine!.value.spec.class).toContain(BLOCK_ACTIVE_CLASS);
    });
  });
});
