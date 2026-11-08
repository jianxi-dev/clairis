import { describe, expect, it } from "vitest";
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  FONT_COLORS,
  createColorRow,
} from "../../editors/orchestration/color-palette";
import {
  parseCellBackground,
  stripCellBackground,
} from "../../editors/decorations/cell-text";

describe("色板数据", () => {
  it("字体色 9 格（默认 + 8），背景色 16 格（无 + 15）", () => {
    expect(FONT_COLORS).toHaveLength(9);
    expect(BACKGROUND_COLORS).toHaveLength(16);
  });

  it("首格是默认 / 无，且 className 为空", () => {
    expect(FONT_COLORS[0].isDefault).toBe(true);
    expect(FONT_COLORS[0].className).toBe("");
    expect(BACKGROUND_COLORS[0].isDefault).toBe(true);
    expect(BACKGROUND_COLORS[0].className).toBe("");
  });

  it("类名统一走 mdb-color-* / mdb-bg-* 前缀且不重复", () => {
    const fontClasses = FONT_COLORS.slice(1).map((c) => c.className);
    const bgClasses = BACKGROUND_COLORS.slice(1).map((c) => c.className);
    expect(fontClasses.every((c) => c.startsWith("mdb-color-"))).toBe(true);
    expect(bgClasses.every((c) => c.startsWith("mdb-bg-"))).toBe(true);
    expect(new Set(fontClasses).size).toBe(fontClasses.length);
    expect(new Set(bgClasses).size).toBe(bgClasses.length);
  });

  it("色块预览色为实色（对齐 md-bundle 色板，不是偏淡浅色块）", () => {
    const red = BACKGROUND_COLORS.find((c) => c.className === "mdb-bg-red");
    expect(red?.swatch).toBe("#f0000e");
    const blue = BACKGROUND_COLORS.find((c) => c.className === "mdb-bg-blue");
    expect(blue?.swatch).toBe("#4c88ff");
  });

  it("边框色与背景色同值，类名走 mdb-border-*", () => {
    expect(BORDER_COLORS).toHaveLength(BACKGROUND_COLORS.length);
    for (let i = 0; i < BACKGROUND_COLORS.length; i += 1) {
      const bg = BACKGROUND_COLORS[i];
      const border = BORDER_COLORS[i];
      expect(border.swatch).toBe(bg.swatch);
      expect(border.label).toBe(bg.label);
      expect(border.isDefault).toBe(bg.isDefault);
      if (bg.className === "") {
        expect(border.className).toBe("");
      } else {
        expect(border.className).toBe(
          bg.className.replace("mdb-bg-", "mdb-border-"),
        );
      }
    }
  });
});

describe("createColorRow", () => {
  it("渲染与数据等量的色块，默认格带 default 类", () => {
    const picks: string[] = [];
    const row = createColorRow("background", BACKGROUND_COLORS, (_k, cls) =>
      picks.push(cls),
    );

    const swatches =
      row.querySelectorAll<HTMLButtonElement>(".cm-color-swatch");
    expect(swatches).toHaveLength(16);
    expect(row.dataset.kind).toBe("background");
    expect(swatches[0].classList.contains("cm-color-swatch-default")).toBe(
      true,
    );
    expect(swatches[1].classList.contains("cm-color-swatch-default")).toBe(
      false,
    );
  });

  it("mousedown 回调带出类名；默认格回传空串（表示清除）", () => {
    const picks: string[] = [];
    const row = createColorRow("font", FONT_COLORS, (_k, cls) =>
      picks.push(cls),
    );
    const swatches =
      row.querySelectorAll<HTMLButtonElement>(".cm-color-swatch");

    swatches[1].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    swatches[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(picks).toEqual(["mdb-color-red", ""]);
  });

  it("字体色块渲染着色「A」字形，背景色块渲染实色底", () => {
    const fontRow = createColorRow("font", FONT_COLORS, () => {});
    const fontSwatch =
      fontRow.querySelectorAll<HTMLButtonElement>(".cm-color-swatch")[1];
    expect(
      fontSwatch.querySelector(".cm-color-swatch-glyph")?.textContent,
    ).toBe("A");

    const bgRow = createColorRow("background", BACKGROUND_COLORS, () => {});
    const bgSwatch =
      bgRow.querySelectorAll<HTMLButtonElement>(".cm-color-swatch")[1];
    expect(bgSwatch.style.background).toBe("rgb(240, 0, 14)");
    expect(bgSwatch.querySelector(".cm-color-swatch-glyph")).toBeNull();
  });
});

describe("单元格背景语法（1.4 扩到 15 色）", () => {
  it("每个背景色都能被解析并还原", () => {
    for (const color of BACKGROUND_COLORS.slice(1)) {
      const raw = `<span class="${color.className}">单元格</span>`;
      expect(parseCellBackground(raw)).toEqual({
        colorClass: color.className,
        inner: "单元格",
      });
      expect(stripCellBackground(raw)).toBe("单元格");
    }
  });

  it("未登记的类名不被识别为背景 span", () => {
    expect(
      parseCellBackground('<span class="mdb-bg-unknown">x</span>'),
    ).toBeNull();
  });
});
