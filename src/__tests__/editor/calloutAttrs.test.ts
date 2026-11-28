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
  it("填充/边框/文字各走自己的 var 色板（主题由 CSS 切换）", () => {
    const vars = highlightCssVars({
      bg: "red",
      border: "darkred",
      text: "contrast",
    });
    expect(vars.bg).toBe("var(--hl-fill-red)");
    expect(vars.border).toBe("var(--hl-border-red)");
    expect(vars.text).toBe("var(--hl-font-contrast)");
  });
});

describe("属性块与标题之间的空白（#1676 回归）", () => {
  it("读取：`] {attrs}` 的写法也能解析出属性", () => {
    expect(getCalloutAttrs("> [!NOTE] {bg=red} 标题")).toEqual({ bg: "red" });
    expect(getCalloutAttrs("> [!NOTE]{bg=red} 标题")).toEqual({ bg: "red" });
  });

  it("写回：不叠加第二个属性块", () => {
    expect(
      setCalloutAttrs("> [!NOTE] {bg=red} 标题", { bg: "green" }),
    ).toBe("> [!NOTE]{bg=green} 标题");
    expect(
      setCalloutAttrs("> [!NOTE]{bg=red} 标题", { bg: "green" }),
    ).toBe("> [!NOTE]{bg=green} 标题");
  });
});

describe("属性块健壮性与 emoji 持久化", () => {
  it("解析同一行的多个属性块并以后者覆盖", () => {
    expect(
      parseCalloutAttrs(
        "{bg=red border=red text=purple} {bg=gray border=gray} {bg=blue}",
      ),
    ).toEqual({ bg: "blue", border: "gray", text: "purple" });
  });

  it("写回时把多个属性块收敛成一个", () => {
    const dirty =
      "> [!highlight]{bg=darkred border=red} {bg=gray border=gray}\n> 正文";
    const out = setCalloutAttrs(dirty, { bg: "yellow", border: "yellow" });
    const first = out.split("\n")[0];
    expect((first.match(/\{/g) ?? [])).toHaveLength(1);
    expect(first).toBe("> [!highlight]{bg=yellow border=yellow}");
    expect(out).toContain("> 正文");
  });

  it("emoji 可解析、序列化并往返保留", () => {
    expect(parseCalloutAttrs("{emoji=🖍 bg=red}")).toEqual({
      bg: "red",
      emoji: "🖍",
    });
    const written = setCalloutAttrs("> [!highlight]\n> 正文", {
      emoji: "🖍",
    });
    expect(written.split("\n")[0]).toBe("> [!highlight]{emoji=🖍}");
    expect(getCalloutAttrs(written).emoji).toBe("🖍");
  });

  it("改色写回不丢 emoji", () => {
    const withEmoji = "> [!highlight]{emoji=🖍 bg=red}\n> 正文";
    const out = setCalloutAttrs(withEmoji, {
      ...getCalloutAttrs(withEmoji),
      bg: "blue",
      border: "blue",
    });
    expect(getCalloutAttrs(out)).toEqual({
      bg: "blue",
      border: "blue",
      emoji: "🖍",
    });
  });
});
