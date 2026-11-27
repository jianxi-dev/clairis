import { describe, expect, it } from "vitest";
import {
  buildHighlightColorPanel,
  nextCalloutAttrs,
  pickHighlightFamily,
} from "../../editors/orchestration/callout-color-panel";

describe("nextCalloutAttrs", () => {
  it("写入新色名", () => {
    expect(nextCalloutAttrs({}, "bg", "green")).toEqual({ bg: "green" });
  });

  it("切换已设色", () => {
    expect(
      nextCalloutAttrs({ bg: "green", text: "gray" }, "bg", "red"),
    ).toEqual({ bg: "red", text: "gray" });
  });

  it("点击已选颜色清除该项", () => {
    expect(
      nextCalloutAttrs({ bg: "green", border: "red" }, "bg", "green"),
    ).toEqual({ border: "red" });
  });

  it("默认项（空名）清除该项", () => {
    expect(nextCalloutAttrs({ text: "gray" }, "text", "")).toEqual({});
  });

  it("不改动的属性保持原样", () => {
    expect(nextCalloutAttrs({ border: "red" }, "bg", "green")).toEqual({
      border: "red",
      bg: "green",
    });
  });
});

describe("纯高亮随机与面板", () => {
  it("同一色相族的浅填充 + 深边框，避开当前色相", () => {
    // rand 固定取第一个候选：当前红 → 候选从橙开始。
    expect(pickHighlightFamily({ bg: "red" }, () => 0)).toMatchObject({
      key: "orange",
      light: "orange",
      dark: "darkorange",
    });
    expect(
      pickHighlightFamily({ bg: "darkgreen", border: "darkgreen" }, () => 0),
    ).toMatchObject({ key: "red" });
  });

  it("面板含随机、恢复默认、字体 A 与两行填充", () => {
    const root = buildHighlightColorPanel({
      active: {},
      onPick: () => {},
      onReset: () => {},
      onRandom: () => {},
    });
    expect(root.querySelector('[data-testid="color-random"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="color-reset"]')).not.toBeNull();
    const fontIcons = root.querySelectorAll(
      '.cm-color-row[data-kind="font"] .cm-color-swatch-icon svg',
    );
    expect(fontIcons).toHaveLength(8);
    expect(fontIcons[0].getAttribute("data-icon")).toBe(
      "FormatColorTextOutlined",
    );
    expect(
      root.querySelectorAll('.cm-color-row[data-kind="background"]').length,
    ).toBe(2);
  });

  it("四行各 8 格（字体/边框/填充深/填充中）", () => {
    const root = buildHighlightColorPanel({
      active: {},
      onPick: () => {},
      onReset: () => {},
      onRandom: () => {},
    });
    const count = (sel: string): number =>
      root.querySelectorAll(`${sel} .cm-color-swatch`).length;
    expect(count('.cm-color-row[data-kind="font"]')).toBe(8);
    expect(count('.cm-color-row[data-kind="border"]')).toBe(8);
    const bgRows = root.querySelectorAll('.cm-color-row[data-kind="background"]');
    expect(bgRows).toHaveLength(2);
    for (const row of bgRows) {
      expect(row.querySelectorAll(".cm-color-swatch")).toHaveLength(8);
    }
  });
});

describe("选中态即时刷新（D5）", () => {
  const mousedown = (el: Element): void => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  };

  it("点击色块后旧格 false、新格 true，节点未重建", () => {
    let current: { bg?: string } = { bg: "darkred" };
    const root = buildHighlightColorPanel({
      active: { bg: "darkred" },
      getActive: () => current,
      onPick: (_key, className) => {
        current = { bg: className === "" ? undefined : "darkgreen" };
      },
      onReset: () => {},
      onRandom: () => {},
    });
    const deepRow = root.querySelector('.cm-color-row[data-kind="background"]')!;
    const swatches = deepRow.querySelectorAll<HTMLButtonElement>(
      ".cm-color-swatch",
    );
    const oldSwatch = Array.from(swatches).find(
      (s) => s.dataset.className === "hl-fill-darkred",
    )!;
    const newSwatch = Array.from(swatches).find(
      (s) => s.dataset.className === "hl-fill-darkgreen",
    )!;
    expect(oldSwatch.dataset.active).toBe("true");
    expect(newSwatch.dataset.active).toBe("false");

    mousedown(newSwatch);

    expect(oldSwatch.dataset.active).toBe("false");
    expect(newSwatch.dataset.active).toBe("true");
    // 节点身份不变 = 未重建面板。
    expect(
      root.querySelector('.cm-color-row[data-kind="background"]'),
    ).toBe(deepRow);
    expect(
      deepRow.querySelectorAll(".cm-color-swatch")[0],
    ).toBe(swatches[0]);
  });

  it("「随机」后边框行与两行填充的选中态同时刷新", () => {
    let current: { bg?: string; border?: string } = {
      bg: "darkred",
      border: "red",
    };
    const root = buildHighlightColorPanel({
      active: { bg: "darkred", border: "red" },
      getActive: () => current,
      onPick: () => {},
      onReset: () => {},
      onRandom: () => {
        current = { bg: "darkgreen", border: "green" };
      },
    });
    const activeBefore = () =>
      Array.from(
        root.querySelectorAll('.cm-color-swatch[data-active="true"]'),
      ).map((el) => el.getAttribute("data-class-name"));
    const before = activeBefore();
    expect(before).toContain("hl-border-red");
    expect(before).toContain("hl-fill-darkred");

    mousedown(root.querySelector('[data-testid="color-random"]')!);

    const borderActive = root.querySelectorAll(
      '.cm-color-row[data-kind="border"] .cm-color-swatch[data-active="true"]',
    );
    expect(borderActive).toHaveLength(1);
    expect(borderActive[0].getAttribute("data-class-name")).toBe(
      "hl-border-green",
    );
    const bgActive = root.querySelectorAll(
      '.cm-color-row[data-kind="background"] .cm-color-swatch[data-active="true"]',
    );
    expect(bgActive).toHaveLength(1);
    expect(bgActive[0].getAttribute("data-class-name")).toBe(
      "hl-fill-darkgreen",
    );
    // 与点击前不同。
    expect(activeBefore()).not.toEqual(before);
  });

  it("未提供 getActive 时保持构建时的一次性计算（向后兼容）", () => {
    const root = buildHighlightColorPanel({
      active: { bg: "darkred" },
      onPick: () => {},
      onReset: () => {},
      onRandom: () => {},
    });
    const deepRow = root.querySelector('.cm-color-row[data-kind="background"]')!;
    const oldSwatch = Array.from(
      deepRow.querySelectorAll<HTMLButtonElement>(".cm-color-swatch"),
    ).find((s) => s.dataset.className === "hl-fill-darkred")!;
    const newSwatch = Array.from(
      deepRow.querySelectorAll<HTMLButtonElement>(".cm-color-swatch"),
    ).find((s) => s.dataset.className === "hl-fill-darkgreen")!;

    mousedown(newSwatch);

    expect(oldSwatch.dataset.active).toBe("true");
    expect(newSwatch.dataset.active).toBe("false");
  });
});
