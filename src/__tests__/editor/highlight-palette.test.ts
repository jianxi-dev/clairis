import { describe, expect, it } from "vitest";
import {
  HIGHLIGHT_BORDER_COLORS,
  HIGHLIGHT_FILL_DEEP,
  HIGHLIGHT_FILL_MID,
  HIGHLIGHT_FONT_COLORS,
} from "../../editors/orchestration/color-palette";
import { buildHighlightColorPanel } from "../../editors/orchestration/callout-color-panel";
import {
  attrNameFromClassName,
  getCalloutAttrs,
  highlightCssVars,
  parseCalloutAttrs,
} from "../../editors/callout-attrs";

describe("高亮 24 格色板常量", () => {
  it("四组各 8 项", () => {
    expect(HIGHLIGHT_FONT_COLORS).toHaveLength(8);
    expect(HIGHLIGHT_BORDER_COLORS).toHaveLength(8);
    expect(HIGHLIGHT_FILL_DEEP).toHaveLength(8);
    expect(HIGHLIGHT_FILL_MID).toHaveLength(8);
  });

  it("字体行：默认 + 灰/红/橙/黄/绿/蓝/紫", () => {
    expect(HIGHLIGHT_FONT_COLORS[0]).toMatchObject({
      label: "默认",
      className: "",
      isDefault: true,
    });
    expect(HIGHLIGHT_FONT_COLORS.map((c) => c.swatch)).toEqual([
      "#ebebeb",
      "#757575",
      "#fa7873",
      "#f5a54a",
      "#fcd456",
      "#6dd162",
      "#71a0ff",
      "#a472fc",
    ]);
  });

  it("边框行：无（斜线）+ 7 色", () => {
    expect(HIGHLIGHT_BORDER_COLORS[0]).toMatchObject({
      label: "无",
      className: "",
      isDefault: true,
    });
    expect(HIGHLIGHT_BORDER_COLORS.map((c) => c.swatch)).toEqual([
      "",
      "#434343",
      "#9e3836",
      "#bd7017",
      "#c7b302",
      "#339428",
      "#2951a3",
      "#6532bd",
    ]);
  });

  it("填充深档：无（斜线）+ 深灰/暗红/暗橙/暗黄/暗绿/暗蓝/暗紫", () => {
    expect(HIGHLIGHT_FILL_DEEP[0]).toMatchObject({
      label: "无",
      className: "",
      isDefault: true,
    });
    expect(HIGHLIGHT_FILL_DEEP.map((c) => c.swatch)).toEqual([
      "",
      "#2b2b2b",
      "#4a1d1b",
      "#57330a",
      "#5c5514",
      "#1f471b",
      "#192a4c",
      "#361d61",
    ]);
  });

  it("填充中档：灰/灰/红/橙/黄/绿/蓝/紫（无默认项）", () => {
    expect(HIGHLIGHT_FILL_MID.some((c) => c.isDefault)).toBe(false);
    expect(HIGHLIGHT_FILL_MID.map((c) => c.swatch)).toEqual([
      "#363636",
      "#3c3c3c",
      "#6b2827",
      "#845117",
      "#877b10",
      "#296b22",
      "#213e78",
      "#4d2691",
    ]);
  });

  it("类名唯一且可解析", () => {
    const all = [
      ...HIGHLIGHT_FONT_COLORS,
      ...HIGHLIGHT_BORDER_COLORS,
      ...HIGHLIGHT_FILL_DEEP,
      ...HIGHLIGHT_FILL_MID,
    ].filter((c) => c.className !== "");
    expect(new Set(all.map((c) => c.className)).size).toBe(all.length);
    for (const color of HIGHLIGHT_FONT_COLORS.slice(1)) {
      expect(attrNameFromClassName("text", color.className)).not.toBe("");
    }
  });
});

describe("高亮面板字体行读新常量", () => {
  it("字体行渲染 8 个 swatch", () => {
    const root = buildHighlightColorPanel({
      active: {},
      onPick: () => {},
      onReset: () => {},
      onRandom: () => {},
    });
    const fontRow = root.querySelector('.cm-color-row[data-kind="font"]');
    expect(fontRow).not.toBeNull();
    expect(
      fontRow!.querySelectorAll(".cm-color-swatch"),
    ).toHaveLength(8);
  });

  it("边框行与两行填充各 8 格", () => {
    const root = buildHighlightColorPanel({
      active: {},
      onPick: () => {},
      onReset: () => {},
      onRandom: () => {},
    });
    const borderRow = root.querySelector('.cm-color-row[data-kind="border"]');
    expect(borderRow!.querySelectorAll(".cm-color-swatch")).toHaveLength(8);
    const bgRows = root.querySelectorAll('.cm-color-row[data-kind="background"]');
    expect(bgRows).toHaveLength(2);
    for (const row of bgRows) {
      expect(row.querySelectorAll(".cm-color-swatch")).toHaveLength(8);
    }
  });
});

describe("高亮填充解析只查填充表", () => {
  it("bg=gray 解析为填充色而非边框色", () => {
    const vars = highlightCssVars({ bg: "gray" });
    // 填充中档 gray = #363636（叠 38%）；边框 gray = #434343 不应出现。
    expect(vars.bg).toBe("color-mix(in srgb, #363636 38%, transparent)");
    expect(vars.bg).not.toContain("#434343");
  });

  it("border=gray 解析为边框色而非填充色", () => {
    const vars = highlightCssVars({ border: "gray" });
    expect(vars.border).toBe("#434343");
  });
});

describe("旧文档打开面板的选中态", () => {
  it("{bg=darkred border=green text=yellow} 三色各一格命中", () => {
    const attrs = getCalloutAttrs(
      "> [!highlight]{bg=darkred border=green text=yellow}\n> 旧属性",
    );
    const root = buildHighlightColorPanel({
      active: attrs,
      onPick: () => {},
      onReset: () => {},
      onRandom: () => {},
    });
    const activeOf = (sel: string): number =>
      root.querySelectorAll(`${sel} .cm-color-swatch[data-active="true"]`).length;
    expect(activeOf('.cm-color-row[data-kind="font"]')).toBe(1);
    expect(activeOf('.cm-color-row[data-kind="border"]')).toBe(1);
    const bgRows = root.querySelectorAll('.cm-color-row[data-kind="background"]');
    const bgActive = Array.from(bgRows).reduce(
      (n, row) =>
        n + row.querySelectorAll('.cm-color-swatch[data-active="true"]').length,
      0,
    );
    expect(bgActive).toBe(1);
  });
});

describe("高亮新色名与旧色名兼容", () => {
  it("解析新常量色名", () => {
    const red = HIGHLIGHT_FONT_COLORS.find((c) => c.label === "红色")!;
    expect(parseCalloutAttrs(`{text=${attrNameFromClassName("text", red.className)}}`)).toEqual({
      text: attrNameFromClassName("text", red.className),
    });
  });

  it("旧文档色名仍渲染（bg=darkred border=green text=yellow）", () => {
    const attrs = parseCalloutAttrs("{bg=darkred border=green text=yellow}");
    expect(attrs).toEqual({ bg: "darkred", border: "green", text: "yellow" });
    const vars = highlightCssVars(attrs);
    expect(vars.bg).toContain("38%");
    expect(vars.border).not.toBe("");
    expect(vars.text).not.toBe("");
  });

  it("旧色名映射到非空色值", () => {
    const legacy = [
      "darkred",
      "brown",
      "olive",
      "darkgreen",
      "navy",
      "indigo",
      "slate",
      "cyan",
    ];
    for (const name of legacy) {
      const vars = highlightCssVars({ bg: name, border: name, text: name });
      expect(vars.bg, `bg=${name}`).toContain("38%");
      expect(vars.border, `border=${name}`).not.toBe("");
    }
  });
});
