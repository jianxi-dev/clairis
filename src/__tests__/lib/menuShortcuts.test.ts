import { describe, expect, it } from "vitest";

import { menuShortcut } from "../../lib/menu-shortcuts";

describe("menuShortcut", () => {
  it("读动作提示元数据注册表（duplicate / format-underline）", () => {
    expect(menuShortcut("duplicate")).toBe("⌘ + C");
    expect(menuShortcut("format-underline")).toBe("⌘ + U");
  });

  it("按 id 读 SHORTCUTS 唯一真相源", () => {
    expect(menuShortcut("file-close-tab")).toBe("⌘W");
  });

  it("按展示名读 SHORTCUTS", () => {
    expect(menuShortcut("ai-translate", "翻译")).toBe("⌘⇧T");
  });

  it("查不到键位返回空串，不猜", () => {
    expect(menuShortcut("cut")).toBe("");
    expect(menuShortcut("move-up", "上移")).toBe("");
    expect(menuShortcut("closeTab", "关闭")).toBe("");
  });
});
