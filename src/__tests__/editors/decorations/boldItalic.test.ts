import { describe, it, expect } from "vitest";
import {
  boldRegex,
  italicRegex,
  BOLD_CLASS,
  ITALIC_CLASS,
  createBoldItalicDecorations,
  STRIKE_CLASS,
  UNDERLINE_CLASS,
  findIncompleteBold,
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

  describe("inline markers stay hidden in the active block", () => {
    it("keeps the strong class when the cursor is inside the bold range", () => {
      const result = createBoldItalicDecorations("A **bold** B", 2, 10);
      const strong = result.find((d) => d.value.spec.class === BOLD_CLASS);
      expect(strong).toBeDefined();
      expect(strong!.from).toBe(4);
      expect(strong!.to).toBe(8);
      // 行内标记两态都隐藏：活跃块里仍是 replace，不是 mark
      const hidden = result.filter(
        (d) => !d.value.spec.class && !d.value.spec.widget,
      );
      expect(hidden).toHaveLength(2);
    });
  });

  describe("strikethrough / underline / passthrough spans", () => {
    it("hides ~~ and applies cm-strikethrough", () => {
      const result = createBoldItalicDecorations("A ~~gone~~ B");
      const strike = result.find((d) => d.value.spec.class === STRIKE_CLASS);
      expect(strike).toBeDefined();
      expect(strike!.from).toBe(4);
      expect(strike!.to).toBe(8);
    });

    it("hides <u> tags and applies cm-underline", () => {
      const result = createBoldItalicDecorations("A <u>under</u> B");
      const underline = result.find(
        (d) => d.value.spec.class === UNDERLINE_CLASS,
      );
      expect(underline).toBeDefined();
      expect(underline!.from).toBe(5);
      expect(underline!.to).toBe(10);
    });

    it("hides mdb-bg-* span tags and applies cm-bg-*", () => {
      const result = createBoldItalicDecorations(
        'A <span class="mdb-bg-blue">tinted</span> B',
      );
      const tinted = result.find((d) => d.value.spec.class === "cm-bg-blue");
      expect(tinted).toBeDefined();
      expect(tinted!.from).toBe(28);
      expect(tinted!.to).toBe(34);
    });

    it("hides mdb-color-* and mdb-font-* spans", () => {
      const color = createBoldItalicDecorations(
        '<span class="mdb-color-green">green</span>',
      );
      expect(
        color.find((d) => d.value.spec.class === "cm-color-green"),
      ).toBeDefined();
      const font = createBoldItalicDecorations(
        '<span class="mdb-font-serif">serif</span>',
      );
      expect(
        font.find((d) => d.value.spec.class === "cm-font-serif"),
      ).toBeDefined();
    });

    it("renders nested <u> inside a color span as underline (#467)", () => {
      const result = createBoldItalicDecorations(
        '正文<span class="mdb-color-red"><u>段落</u></span>。',
      );
      expect(
        result.find((d) => d.value.spec.class === "cm-color-red"),
      ).toBeDefined();
      const underlined = result.find(
        (d) => d.value.spec.class === UNDERLINE_CLASS,
      );
      expect(underlined).toBeDefined();
      expect(underlined!.from).toBe(33);
      expect(underlined!.to).toBe(35);
    });
  });

  describe("type-as-render (unclosed markers)", () => {
    it("hides the opening ** and bolds the content while typing", () => {
      const result = createBoldItalicDecorations("**bold");
      expect(result[0].value.spec.class).toBeUndefined();
      expect(result[0].from).toBe(0);
      expect(result[0].to).toBe(2);
      expect(result[1].value.spec.class).toBe(BOLD_CLASS);
      expect(result[1].from).toBe(2);
      expect(result[1].to).toBe(6);
    });

    it("hides the opening * and italicises the content while typing", () => {
      const result = createBoldItalicDecorations("*ital");
      expect(result[0].from).toBe(0);
      expect(result[0].to).toBe(1);
      expect(result[1].value.spec.class).toBe(ITALIC_CLASS);
      expect(result[1].from).toBe(1);
      expect(result[1].to).toBe(5);
    });

    it("does not treat a closed bold as incomplete", () => {
      expect(findIncompleteBold("**bold**")).toBeNull();
    });
  });
});
