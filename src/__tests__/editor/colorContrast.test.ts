import { afterEach, describe, expect, it } from "vitest";
import {
  contrastRatio,
  pickVariedText,
  mixOver,
  parseHexColor,
  pickReadableText,
  readCssColor,
  relativeLuminance,
} from "../../editors/orchestration/color-contrast";

const LIGHT_CANDIDATES = [
  { name: "", hex: "#24262b" },
  { name: "gray", hex: "#8f959e" },
  { name: "red", hex: "#d83930" },
  { name: "orange", hex: "#de7704" },
  { name: "yellow", hex: "#dd9b02" },
  { name: "green", hex: "#2ea122" },
  { name: "blue", hex: "#245bdb" },
  { name: "purple", hex: "#6425d0" },
  { name: "contrast", hex: "#111111" },
];

const DARK_CANDIDATES = [
  { name: "", hex: "#d8dade" },
  { name: "gray", hex: "#757575" },
  { name: "red", hex: "#fa7873" },
  { name: "orange", hex: "#f5a54a" },
  { name: "yellow", hex: "#fcd456" },
  { name: "green", hex: "#6dd162" },
  { name: "blue", hex: "#71a0ff" },
  { name: "purple", hex: "#a472fc" },
  { name: "contrast", hex: "#ffffff" },
];

describe("WCAG 对比度", () => {
  it("#000/#fff = 21", () => {
    expect(contrastRatio(parseHexColor("#000000")!, parseHexColor("#ffffff")!)).toBeCloseTo(21, 5);
  });

  it("#fff/#fff = 1", () => {
    expect(contrastRatio(parseHexColor("#ffffff")!, parseHexColor("#ffffff")!)).toBeCloseTo(1, 5);
  });

  it("相对亮度单调", () => {
    expect(relativeLuminance(parseHexColor("#000000")!)).toBe(0);
    expect(relativeLuminance(parseHexColor("#ffffff")!)).toBeCloseTo(1, 5);
  });
});

describe("pickReadableText", () => {
  it("浅底返回默认文字", () => {
    const pick = pickReadableText("#ffffcc", LIGHT_CANDIDATES);
    expect(pick.name).toBe("");
    expect(pick.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("深色中档黄底返回「高对比」且 ratio > 4", () => {
    const pick = pickReadableText("#877b10", DARK_CANDIDATES);
    expect(pick.name).toBe("contrast");
    expect(pick.ratio).toBeGreaterThan(4);
  });
});

describe("mixOver", () => {
  it("红 10% 叠白 ≈ #fee6e7（误差 ≤2/255）", () => {
    const mixed = mixOver(
      parseHexColor("#f0000e")!,
      parseHexColor("#ffffff")!,
      0.1,
    );
    expect(Math.abs(mixed.r - 0xfe)).toBeLessThanOrEqual(2);
    expect(Math.abs(mixed.g - 0xe6)).toBeLessThanOrEqual(2);
    expect(Math.abs(mixed.b - 0xe7)).toBeLessThanOrEqual(2);
  });
});

describe("readCssColor", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--t-a");
  });

  it("变量名读回计算值", () => {
    document.documentElement.style.setProperty("--t-a", "#123456");
    expect(readCssColor("--t-a")).toBe("#123456");
  });

  it("hex 原样返回", () => {
    expect(readCssColor("#abcdef")).toBe("#abcdef");
  });

  it("未定义变量返回空串", () => {
    expect(readCssColor("--t-missing")).toBe("");
  });

  it("非 hex 值返回空串", () => {
    expect(readCssColor("red")).toBe("");
  });
});

describe("pickVariedText（随机换字色）", () => {
  const cands = [
    { name: "red", hex: "#d83930" },
    { name: "blue", hex: "#245bdb" },
    { name: "purple", hex: "#6425d0" },
  ];

  it("排除当前色，优先 ≥4.5 且不同色相", () => {
    const pick = pickVariedText("#fde2e2", cands, "red", "red", () => 0);
    expect(pick).not.toBeNull();
    expect(pick!.name).not.toBe("red");
    expect(pick!.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("同色相不可用时退到异色相的 ≥3 候选", () => {
    const pick = pickVariedText(
      "#cdb2fa",
      [
        { name: "purple", hex: "#6425d0", hue: "purple" },
        { name: "blue", hex: "#245bdb", hue: "blue" },
      ],
      "",
      "purple",
      () => 0,
    );
    expect(pick).not.toBeNull();
    expect(pick!.name).toBe("blue");
  });

  it("全部低于 3 时返回 null（保持当前文字色）", () => {
    expect(
      pickVariedText("#ffffff", [{ name: "yellow", hex: "#ffff00" }], "", "yellow"),
    ).toBeNull();
  });

  it("唯一候选等于当前色时返回 null", () => {
    expect(
      pickVariedText("#fde2e2", [{ name: "purple", hex: "#6425d0" }], "purple", "red"),
    ).toBeNull();
  });
});
