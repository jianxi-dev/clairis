import { describe, expect, it } from "vitest";
import { mapHueToType } from "../editors/orchestration/color-palette";

describe("mapHueToType", () => {
  it("六色各自映射到目标类型的默认色名", () => {
    expect(mapHueToType("#f0000e", "red")).toBe("red");
    expect(mapHueToType("#f2962c", "orange")).toBe("orange");
    expect(mapHueToType("#f0b622", "yellow")).toBe("yellow");
    expect(mapHueToType("#419e34", "green")).toBe("green");
    expect(mapHueToType("#4c88ff", "blue")).toBe("blue");
    expect(mapHueToType("#8a5cf6", "purple")).toBe("purple");
  });

  it("同色相优先：红色填充切到 red 类型取 red，不取最近的其他色", () => {
    expect(mapHueToType("#f0000e", "red")).toBe("red");
    // 暗红与红同色相（仅亮度差），仍取 red 而非暗红。
    expect(mapHueToType("#b34444", "red")).toBe("red");
  });

  it("目标类型无同色相时回落到色板中色相最近者", () => {
    // 目标 gray 无彩色色相；暗红 #b34444 与 gray 的色相距离大于 20°，
    // 落到色板中色相最近者（暗红自身）。
    expect(mapHueToType("#b34444", "gray")).toBe("darkred");
  });

  it("teal / muted / yellow tone 各有可用映射", () => {
    expect(mapHueToType("#20b2aa", "teal")).toBe("cyan");
    // 灰色无色相：取色板中色相最近者（藏蓝，低饱和冷色）。
    expect(mapHueToType("#8b8f96", "muted")).toBe("navy");
    expect(mapHueToType("#f0b622", "yellow")).toBe("yellow");
  });

  it("无法解析色相或未知 tone 时回落目标默认色", () => {
    expect(mapHueToType("", "red")).toBe("red");
    expect(mapHueToType("not-a-color", "blue")).toBe("blue");
    expect(mapHueToType("#f0000e", "unknown-tone")).toBe("");
  });

  it("纯函数：同输入同输出，不依赖 DOM", () => {
    const a = mapHueToType("#f0000e", "green");
    const b = mapHueToType("#f0000e", "green");
    expect(a).toBe(b);
  });
});
