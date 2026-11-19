import { describe, expect, it } from "vitest";
import type { SystemFont } from "../types";
import {
  HEADING_FONT_STACK,
  HEADING_LEVELS,
  headingFontInputValue,
  isFontFamilyAllowed,
  isFontFamilyStructurallyValid,
  normalizeHeadingFonts,
  parseHeadingFontInput,
} from "../lib/headingFonts";

const INSTALLED: SystemFont[] = [
  { family: "PingFang SC", localized: "苹方-简" },
  { family: "Songti SC", localized: "宋体-简" },
  { family: "Menlo", localized: "Menlo" },
];

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
    expect(
      isFontFamilyAllowed("Inter, sans-serif", [
        { family: "Inter", localized: "Inter" },
      ]),
    ).toBe(true);
  });

  it("按 family 或 localized 双命中（#1178）", () => {
    expect(isFontFamilyAllowed("苹方-简", INSTALLED)).toBe(true);
    expect(isFontFamilyAllowed("宋体-简", INSTALLED)).toBe(true);
    expect(isFontFamilyAllowed("PingFang SC", INSTALLED)).toBe(true);
    expect(isFontFamilyAllowed("苹方-简, sans-serif", INSTALLED)).toBe(true);
    expect(isFontFamilyAllowed("不存在体", INSTALLED)).toBe(false);
  });

  it("未命中且非 generic 时拒绝", () => {
    expect(isFontFamilyAllowed("ZzzNoSuchFont", INSTALLED)).toBe(false);
  });

  it("枚举不可用（null/空）时只做结构性校验", () => {
    expect(isFontFamilyAllowed("ZzzNoSuchFont", null)).toBe(true);
    expect(isFontFamilyAllowed("ZzzNoSuchFont", [])).toBe(true);
    expect(isFontFamilyAllowed("Bad{Font}", null)).toBe(false);
  });

  it("非枚举（预设兜底）时合法字体不因不在列表中而被拒", () => {
    expect(parseHeadingFontInput("ZzzNoSuchFont", null)).toEqual({
      kind: "valid",
      value: "ZzzNoSuchFont",
    });
    expect(parseHeadingFontInput("Bad{Font}", null)).toEqual({
      kind: "invalid",
    });
  });
});

describe("归一化", () => {
  it("只保留结构合法且不等于默认栈的显式值（部分映射）", () => {
    const out = normalizeHeadingFonts({
      h1: "Songti SC",
      h2: "Zzz{NoSuchFont}",
      h4: HEADING_FONT_STACK,
      h5: "",
    });
    expect(out).toEqual({ h1: "Songti SC" });
  });

  it("null / 非对象输入返回空映射", () => {
    expect(normalizeHeadingFonts(null)).toEqual({});
    expect(normalizeHeadingFonts(undefined)).toEqual({});
  });

  it("历史「6 级全默认栈」配置加载后等价未配置", () => {
    const legacy = Object.fromEntries(
      HEADING_LEVELS.map((level) => [level, HEADING_FONT_STACK]),
    );
    expect(normalizeHeadingFonts(legacy)).toEqual({});
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

  it("空值 / 默认栈显示为空串，由 placeholder 呈现「默认」", () => {
    expect(headingFontInputValue(HEADING_FONT_STACK)).toBe("");
    expect(headingFontInputValue("")).toBe("");
    expect(headingFontInputValue(undefined)).toBe("");
    expect(headingFontInputValue("Songti SC")).toBe("Songti SC");
  });
});
