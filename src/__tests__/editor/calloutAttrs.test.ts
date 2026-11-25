import { describe, expect, it } from "vitest";
import {
  attrNameFromClassName,
  calloutCssVars,
  highlightCssVars,
  getCalloutAttrs,
  parseCalloutAttrs,
  serializeCalloutAttrs,
  setCalloutAttrs,
} from "../../editors/callout-attrs";
import { changeCalloutType } from "../../editors/orchestration/block-actions";

describe("parseCalloutAttrs", () => {
  it("parses the three known colors", () => {
    expect(parseCalloutAttrs("{bg=green border=red text=gray}")).toEqual({
      bg: "green",
      border: "red",
      text: "gray",
    });
  });

  it("is order-independent and accepts bare content", () => {
    expect(parseCalloutAttrs("text=gray bg=green border=red")).toEqual({
      bg: "green",
      border: "red",
      text: "gray",
    });
  });

  it("ignores unknown color names", () => {
    expect(parseCalloutAttrs("{bg=nope border=red}")).toEqual({
      border: "red",
    });
  });

  it("treats none as unset", () => {
    expect(parseCalloutAttrs("{bg=none text=none}")).toEqual({});
  });

  it("ignores unknown keys and malformed tokens", () => {
    expect(parseCalloutAttrs("{foo=green bg green=red =blue}")).toEqual({});
  });
});

describe("serializeCalloutAttrs", () => {
  it("round-trips a parsed block", () => {
    const attrs = parseCalloutAttrs("{border=red bg=green text=gray}");
    expect(serializeCalloutAttrs(attrs)).toBe(
      "{bg=green border=red text=gray}",
    );
  });

  it("returns an empty string when nothing is set", () => {
    expect(serializeCalloutAttrs({})).toBe("");
  });
});

describe("setCalloutAttrs", () => {
  it("writes the attribute block after the fold marker", () => {
    expect(setCalloutAttrs("> [!NOTE]+ 标题\n> 正文", { bg: "green" })).toBe(
      "> [!NOTE]+{bg=green} 标题\n> 正文",
    );
  });

  it("replaces an existing block and keeps the title", () => {
    expect(setCalloutAttrs("> [!NOTE]{bg=green} 标题", { border: "red" })).toBe(
      "> [!NOTE]{border=red} 标题",
    );
  });

  it("removes the block when every color is cleared", () => {
    expect(setCalloutAttrs("> [!NOTE]{bg=green} 标题", {})).toBe(
      "> [!NOTE] 标题",
    );
  });

  it("leaves an old `> [!NOTE]` document byte-identical", () => {
    const doc = "> [!NOTE] 标题\n> 正文\n";
    expect(setCalloutAttrs(doc, {})).toBe(doc);
    expect(getCalloutAttrs(doc)).toEqual({});
  });

  it("preserves type and fold when the type changes", () => {
    const doc = "> [!NOTE]{bg=green border=red text=gray}+\n> 正文";
    expect(changeCalloutType(doc, "tip")).toBe(
      "> [!TIP]{bg=green border=red text=gray}+\n> 正文",
    );
    expect(changeCalloutType("> [!note]\n> 正文", "tip")).toBe(
      "> [!tip]\n> 正文",
    );
  });
});

describe("calloutCssVars", () => {
  it("softens the fill and keeps border / text solid", () => {
    const vars = calloutCssVars({ bg: "green", border: "red", text: "gray" });
    expect(vars.bg).toBe("color-mix(in srgb, #419e34 10%, transparent)");
    expect(vars.border).toBe("#f0000e");
    expect(vars.text).toBe("#8b8f96");
  });

  it("omits unknown colors so CSS falls back to the tone", () => {
    expect(calloutCssVars({ bg: "nope", text: "gray" })).toEqual({
      text: "#8b8f96",
    });
  });
});

describe("attrNameFromClassName", () => {
  it("maps palette class suffixes to storage names", () => {
    expect(attrNameFromClassName("bg", "mdb-bg-green")).toBe("green");
    expect(attrNameFromClassName("border", "mdb-border-red")).toBe("red");
    expect(attrNameFromClassName("text", "mdb-color-gray")).toBe("gray");
    expect(attrNameFromClassName("bg", "")).toBe("");
    expect(attrNameFromClassName("text", "mdb-bg-green")).toBe("");
  });
});

describe("纯高亮渲染变量", () => {
  it("填充用 38% 叠底，边框/文字各走自己的色板", () => {
    const vars = highlightCssVars({
      bg: "red",
      border: "darkred",
      text: "gray",
    });
    expect(vars.bg).toContain("38%");
    expect(vars.border).toBe("#9e3836");
    expect(vars.text).toBe("#757575");
  });
});
