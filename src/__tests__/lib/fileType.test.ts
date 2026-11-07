import { describe, expect, it } from "vitest";
import { TYPE_COLORS, fileTypeOf, iconOfType } from "../../lib/fileType";
import { ICONS } from "../../ui/icons";

describe("文件类型 → 图标 / 类型色（layout-portal 1.1）", () => {
  it("8 类扩展名各自归到正确的类型", () => {
    expect(fileTypeOf("/a/b.md")).toBe("markdown");
    expect(fileTypeOf("x.html")).toBe("html");
    expect(fileTypeOf("x.txt")).toBe("text");
    expect(fileTypeOf("x.pdf")).toBe("pdf");
    expect(fileTypeOf("x.mp4")).toBe("video");
    expect(fileTypeOf("x.png")).toBe("image");
    expect(fileTypeOf("x.ts")).toBe("code");
    expect(fileTypeOf("x.mp3")).toBe("audio");
  });

  it("大小写不敏感，认不出的按文本", () => {
    expect(fileTypeOf("X.MD")).toBe("markdown");
    expect(fileTypeOf("x.unknownext")).toBe("text");
    expect(fileTypeOf(null)).toBe("text");
  });

  it("色值与规格 §10 严格一致", () => {
    expect(TYPE_COLORS).toEqual({
      markdown: "#6366f1",
      html: "#f59e0b",
      text: "#64748b",
      pdf: "#ef4444",
      video: "#a855f7",
      image: "#10b981",
      code: "#06b6d4",
      audio: "#ec4899",
    });
  });

  it("每个类型都有对应的图标定义", () => {
    for (const kind of Object.keys(TYPE_COLORS) as Array<
      keyof typeof TYPE_COLORS
    >) {
      const name = iconOfType(kind);
      expect(ICONS[name]).toBeTruthy();
      const glyph = ICONS[name].d ?? ICONS[name].s ?? "";
      expect(glyph.length).toBeGreaterThan(0);
    }
  });

  it("图标概念不重复（一概念一图标）", () => {
    const labels = Object.values(ICONS).map((d) => d.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
