import { describe, expect, it } from "vitest";
import { nextCalloutAttrs } from "../../editors/orchestration/callout-color-panel";

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
