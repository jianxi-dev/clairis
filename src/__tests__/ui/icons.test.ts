import { describe, expect, it } from "vitest";
import { ICONS, type IconDef } from "../../ui/icons";

/**
 * IconDef 契约（icon-system-v3-redraw 1.1 / 3.2）。
 *
 * `d`（实心）/ `s`（描边）/ `parts`（多段）至少存在其一。
 * 全空的条目会让 `Icon` 渲染出空白 path，等于把图标弄丢。
 */
describe("IconDef 双字段契约", () => {
  it("每个 IconDef 至少存在 d / s / parts 之一", () => {
    for (const [name, def] of Object.entries(ICONS) as Array<
      [string, IconDef]
    >) {
      const hasSingle = (def.d ?? def.s ?? "").length > 0;
      const hasParts = (def.parts ?? []).some(
        (part) => (part.d ?? part.s ?? "").length > 0,
      );
      expect(hasSingle || hasParts, `${name} 缺 d/s/parts`).toBe(true);
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
