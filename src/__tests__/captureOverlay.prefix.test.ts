import { describe, it, expect } from "vitest";
import { getLinePrefix } from "../stores/captureOverlay";

describe("getLinePrefix", () => {
  it("returns '-' for any cursor position on a '- 待办' line", () => {
    expect(getLinePrefix("- 待办", 0)).toBe("-");
    expect(getLinePrefix("- 待办", 1)).toBe("-");
    expect(getLinePrefix("- 待办", 5)).toBe("-");
  });

  it("returns '' for a plain '想法' line", () => {
    expect(getLinePrefix("想法", 0)).toBe("");
    expect(getLinePrefix("想法", 2)).toBe("");
  });

  it("maps full-width '。' to '.' on a '。问题' line", () => {
    expect(getLinePrefix("。问题", 0)).toBe(".");
    expect(getLinePrefix("。问题", 3)).toBe(".");
  });

  it("returns '' for an empty draft", () => {
    expect(getLinePrefix("", 0)).toBe("");
  });

  it("derives prefix from the line containing the cursor in multi-line input", () => {
    const raw = "- 待办\n想法\n。问题";
    expect(getLinePrefix(raw, 0)).toBe("-");
    expect(getLinePrefix(raw, 4)).toBe("-");
    expect(getLinePrefix(raw, 5)).toBe("");
    expect(getLinePrefix(raw, 7)).toBe("");
    expect(getLinePrefix(raw, 8)).toBe(".");
    expect(getLinePrefix(raw, raw.length)).toBe(".");
  });

  it("clamps cursorPos beyond raw length", () => {
    expect(getLinePrefix("- 待办", 999)).toBe("-");
  });
});
