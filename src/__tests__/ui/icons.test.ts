import { describe, expect, it } from "vitest";
import { ICONS, type IconDef } from "../../ui/icons";

/**
 * IconDef 双字段契约（icon-system-v3-redraw 1.1）。
 *
 * `d` 与 `s` 至少存在其一：`d` = 实心子路径，`s` = 描边子路径。
 * 两者都空的条目会让 `Icon` 渲染出空白 path，等于把图标弄丢。
 */
describe("IconDef 双字段契约", () => {
  it("每个 IconDef 至少存在 d 或 s 之一", () => {
    for (const [name, def] of Object.entries(ICONS) as Array<
      [string, IconDef]
    >) {
      const glyph = def.d ?? def.s ?? "";
      expect(glyph.length, `${name} 缺 d/s`).toBeGreaterThan(0);
    }
  });

  it("每个 IconDef 都有非空 label", () => {
    for (const [name, def] of Object.entries(ICONS) as Array<
      [string, IconDef]
    >) {
      expect(def.label.trim().length, `${name} label 为空`).toBeGreaterThan(0);
    }
  });
});
