import { describe, expect, it } from "vitest";
import {
  HEADING_FONT_STACK,
  HEADING_LEVELS,
  ensureHeadingFonts,
  headingFontInputValue,
  isFontFamilyAllowed,
  isFontFamilyStructurallyValid,
  normalizeHeadingFonts,
  parseHeadingFontInput,
} from "../lib/headingFonts";

const INSTALLED = ["PingFang SC", "Songti SC", "Menlo"];

describe("标题字体默认栈", () => {
  it("六级键齐备", () => {
    expect(HEADING_LEVELS).toEqual(["h1", "h2", "h3", "h4", "h5", "h6"]);
  });

  it("与 --type-font-sans 逐字一致", () => {
    expect(HEADING_FONT_STACK).toBe(
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif',
    );
  });
});

describe("结构性校验", () => {
  it("拒绝空值 / 控制字符 / CSS 结构字符 / 超长", () => {
    expect(isFontFamilyStructurallyValid("")).toBe(false);
    expect(isFontFamilyStructurallyValid("   ")).toBe(false);
    expect(isFontFamilyStructurallyValid("A\nB")).toBe(false);
    expect(isFontFamilyStructurallyValid("Bad{Font}")).toBe(false);
    expect(isFontFamilyStructurallyValid("Bad`Font`")).toBe(false);
    expect(isFontFamilyStructurallyValid("x".repeat(301))).toBe(false);
    expect(isFontFamilyStructurallyValid("PingFang SC")).toBe(true);
    expect(isFontFamilyStructurallyValid(HEADING_FONT_STACK)).toBe(true);
  });
});

describe("系统可用性", () => {
  it("默认栈恒通过", () => {
    expect(isFontFamilyAllowed(HEADING_FONT_STACK, INSTALLED)).toBe(true);
  });

  it("命中已安装列表即通过", () => {
    expect(isFontFamilyAllowed("Songti SC", INSTALLED)).toBe(true);
    expect(isFontFamilyAllowed("songti sc", INSTALLED)).toBe(true);
    expect(isFontFamilyAllowed("Inter, sans-serif", ["Inter"])).toBe(true);
  });

  it("未命中且非 generic 时拒绝", () => {
    expect(isFontFamilyAllowed("ZzzNoSuchFont", INSTALLED)).toBe(false);
  });

  it("枚举不可用（null/空）时只做结构性校验", () => {
    expect(isFontFamilyAllowed("ZzzNoSuchFont", null)).toBe(true);
    expect(isFontFamilyAllowed("ZzzNoSuchFont", [])).toBe(true);
    expect(isFontFamilyAllowed("Bad{Font}", null)).toBe(false);
  });
});

describe("归一化", () => {
  it("缺失 / 结构非法值回落默认栈，始终 6 级键", () => {
    const out = normalizeHeadingFonts({
      h1: "Songti SC",
      h2: "Zzz{NoSuchFont}",
    });
    expect(Object.keys(out).sort()).toEqual([
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ]);
    expect(out.h1).toBe("Songti SC");
    expect(out.h2).toBe(HEADING_FONT_STACK);
    expect(out.h6).toBe(HEADING_FONT_STACK);
  });

  it("null / 非对象输入回落默认栈", () => {
    expect(normalizeHeadingFonts(null)).toEqual(ensureHeadingFonts(null));
    expect(normalizeHeadingFonts(undefined)).toEqual(ensureHeadingFonts(null));
  });
});

describe("输入解析", () => {
  it("空输入视为默认，非法值拒绝", () => {
    expect(parseHeadingFontInput("   ", INSTALLED)).toEqual({
      kind: "default",
    });
    expect(parseHeadingFontInput("Songti SC", INSTALLED)).toEqual({
      kind: "valid",
      value: "Songti SC",
    });
    expect(parseHeadingFontInput("ZzzNoSuchFont", INSTALLED)).toEqual({
      kind: "invalid",
    });
  });

  it("默认栈在输入框显示为空", () => {
    expect(headingFontInputValue(HEADING_FONT_STACK)).toBe(HEADING_FONT_STACK);
    expect(headingFontInputValue("Songti SC")).toBe("Songti SC");
  });
});
