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
      dark: "brown",
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
    expect(fontIcons).toHaveLength(9);
    expect(fontIcons[0].getAttribute("data-icon")).toBe(
      "FormatColorTextOutlined",
    );
    expect(
      root.querySelectorAll('.cm-color-row[data-kind="background"]').length,
    ).toBe(2);
  });
});
