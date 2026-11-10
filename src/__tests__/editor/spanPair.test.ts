import { describe, expect, it } from "vitest";
import {
  expandRangeToSpans,
  spanPairs,
} from "../../editors/orchestration/toolbar-shared";

const NESTED =
  '<span class="mdb-color-green"><span class="mdb-bg-purple">发现遗漏</span></span>';

describe("spanPairs", () => {
  it("pairs nested mdb spans independently", () => {
    const pairs = spanPairs(NESTED);
    expect(pairs).toHaveLength(2);
    const outer = pairs.find((p) => p.family === "mdb-color")!;
    const inner = pairs.find((p) => p.family === "mdb-bg")!;
    expect(outer.variant).toBe("green");
    expect(outer.openFrom).toBe(0);
    expect(outer.contentFrom).toBe(30);
    expect(outer.closeTo).toBe(NESTED.length);
    expect(inner.variant).toBe("purple");
    expect(inner.openFrom).toBe(30);
    expect(inner.closeTo).toBe(30 + 28 + "发现遗漏".length + 7);
  });

  it("ignores unmatched closing tags", () => {
    expect(spanPairs("text</span>")).toHaveLength(0);
  });
});

describe("expandRangeToSpans", () => {
  it("expands a selection inside the innermost span to the whole pair", () => {
    const contentFrom = NESTED.indexOf("发现遗漏");
    const range = expandRangeToSpans(NESTED, contentFrom + 1, contentFrom + 2);
    expect(range).toEqual({ from: 0, to: NESTED.length });
  });

  it("leaves a selection outside every span untouched", () => {
    const doc = `before ${NESTED} after`;
    const range = expandRangeToSpans(doc, 0, 6);
    expect(range).toEqual({ from: 0, to: 6 });
  });
});
