import { describe, it, expect } from "vitest";
import {
  inlineCodeRegex,
  INLINE_CODE_CLASS,
  createCodeDecorations,
  CODE_MARKER_ACTIVE_CLASS,
  FENCED_CODE_CLASS,
  BLOCK_ACTIVE_CLASS,
  BLOCK_INACTIVE_CLASS,
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

  describe("inline code two-state", () => {
    it("hides backticks when the block is inactive", () => {
      const result = createCodeDecorations("Use `code` here");
      expect(result[0].value.spec.widget).toBeUndefined();
      expect(result[0].value.spec.class).toBeUndefined();
      expect(result[2].value.spec.class).toBeUndefined();
    });

    it("reveals faint backticks and marks the content active", () => {
      const result = createCodeDecorations("Use `code` here", 4, 11);
      expect(result[0].value.spec.class).toBe(CODE_MARKER_ACTIVE_CLASS);
      expect(result[1].value.spec.class).toContain(INLINE_CODE_CLASS);
      expect(result[1].value.spec.class).toContain(BLOCK_ACTIVE_CLASS);
      expect(result[2].value.spec.class).toBe(CODE_MARKER_ACTIVE_CLASS);
    });
  });

  describe("fenced code blocks", () => {
    const fenced = "```ts\nconst a = 1;\n```";

    it("replaces both fence lines when inactive", () => {
      const result = createCodeDecorations(fenced);
      const replaces = result.filter(
        (d) => !d.value.spec.class && !d.value.spec.widget,
      );
      expect(replaces).toHaveLength(2);
      expect(replaces[0].from).toBe(0);
      expect(replaces[0].to).toBe(5); // "```ts"
      expect(replaces[1].from).toBe(19); // "```"
      expect(replaces[1].to).toBe(22);
    });

    it("keeps the raw fences when the block is active", () => {
      const result = createCodeDecorations(fenced, 0, 22);
      const replaces = result.filter(
        (d) => !d.value.spec.class && !d.value.spec.widget,
      );
      expect(replaces).toHaveLength(0);
    });

    it("renders the language label widget", () => {
      const result = createCodeDecorations(fenced);
      const widget = result.find((d) => d.value.spec.widget);
      expect(widget).toBeDefined();
      expect(widget!.from).toBe(5);
      expect(widget!.value.spec.widget.language).toBe("ts");
      expect(widget!.value.spec.widget.active).toBe(false);
    });

    it("marks the active language label", () => {
      const result = createCodeDecorations(fenced, 0, 22);
      const widget = result.find((d) => d.value.spec.widget);
      expect(widget!.value.spec.widget.active).toBe(true);
    });

    it("paints every line of the block", () => {
      const result = createCodeDecorations(fenced);
      const lines = result.filter((d) =>
        d.value.spec.class?.includes(FENCED_CODE_CLASS),
      );
      expect(lines).toHaveLength(3);
      expect(lines[0].value.spec.class).toContain(BLOCK_INACTIVE_CLASS);
    });

    it("emits no label and no error without a language", () => {
      const result = createCodeDecorations("```\nbody\n```");
      expect(result.find((d) => d.value.spec.widget)).toBeUndefined();
    });

    it("skips mermaid blocks (replaced wholesale by the mermaid decorator)", () => {
      const result = createCodeDecorations("```mermaid\ngraph TD\n```");
      expect(result).toHaveLength(0);
    });

    it("leaves an unclosed fence alone", () => {
      const result = createCodeDecorations("```ts\nconst a = 1;");
      expect(result).toHaveLength(0);
    });
  });
});
