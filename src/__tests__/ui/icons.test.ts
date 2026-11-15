import { describe, expect, it } from "vitest";
import { ICONS, iconSvg, type IconDef } from "../../ui/icons";

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

  it("iconSvg 描边图标带 stroke，实心图标不带", () => {
    const stroke = iconSvg("close");
    expect(stroke).toContain('stroke="currentColor"');
    expect(stroke).toContain('fill="none"');
    const fill = iconSvg("more");
    expect(fill).not.toContain('stroke="currentColor"');
    expect(fill).toContain('fill="currentColor"');
  });

  it("iconSvg 默认 22px，parts 保留虚线", () => {
    expect(iconSvg("close")).toContain('width="22"');
    expect(iconSvg("splitRight")).toContain('stroke-dasharray="2 2"');
  });

  it("iconSvg 显式尺寸生效", () => {
    expect(iconSvg("playlist", 36)).toContain('width="36"');
    expect(iconSvg("playlist", 36)).toContain('height="36"');
  });

  it("导出族三项各为独立形状，不复用 file/folder/markdown", () => {
    const trio = [ICONS.exportWord.s, ICONS.exportZip.s, ICONS.exportMdpkg.s];
    for (const s of trio) {
      expect((s ?? "").length, "导出族图标缺形状").toBeGreaterThan(0);
    }
    expect(new Set(trio).size).toBe(3);
    const generic = [ICONS.file.s, ICONS.folder.s, ICONS.markdown.s];
    for (const s of trio) {
      expect(generic).not.toContain(s);
    }
  });

  it("字幕与快捷键说明的 path 字符串不同", () => {
    expect(ICONS.subtitle.s).not.toBe(ICONS.keyboardHints.s);
  });
});

// IconDef 可能把子路径放在 parts 而非 d/s，去重要覆盖两种存法。
function pathsOf(def: IconDef): string[] {
  const parts = def.parts ?? [{ d: def.d, s: def.s }];
  return parts.flatMap((part) =>
    [part.d, part.s].filter((v): v is string => !!v),
  );
}

describe("播放角标与截图/视频文件型不复用图形", () => {
  it("播放（play）有一条非空图形，与截图（camera）无相同子路径", () => {
    const play = pathsOf(ICONS.play);
    const camera = pathsOf(ICONS.camera);
    expect(play).toHaveLength(1);
    expect(play[0].trim().length).toBeGreaterThan(0);
    for (const d of play) {
      expect(camera, "播放角标不得复用截图图形").not.toContain(d);
    }
  });

  it("播放 / 截图 / 视频文件型三者两两不同形", () => {
    const play = pathsOf(ICONS.play);
    const camera = pathsOf(ICONS.camera);
    const video = pathsOf(ICONS.video);
    const all = [...play, ...camera, ...video];
    expect(new Set(all).size, "不同概念复用了同一条 path").toBe(all.length);
  });
});
