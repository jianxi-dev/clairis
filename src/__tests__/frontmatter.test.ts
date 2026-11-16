import { describe, expect, it } from "vitest";
import {
  FRONTMATTER_RE,
  TAG_PALETTE,
  isManagedDateKey,
  parseFrontmatter,
  tagColor,
  writeFrontmatter,
  type FrontmatterField,
} from "../lib/frontmatter";

const DOC = `---
title: 测试文档
tags:
  - 甲
  - 乙
count: 1234567
published: true
created: 2026-11-14
updated: 2026-11-15T10:30:00
custom-note: 自由键
---

# 正文
`;

function byKey(fields: FrontmatterField[]): Record<string, FrontmatterField> {
  return Object.fromEntries(fields.map((f) => [f.key, f]));
}

describe("frontmatter parse", () => {
  it("键序保留", () => {
    const p = parseFrontmatter(DOC);
    expect(p.present).toBe(true);
    expect(p.fields.map((f) => f.key)).toEqual([
      "title",
      "tags",
      "count",
      "published",
      "created",
      "updated",
      "custom-note",
    ]);
  });

  it("自由键原文保留（无改动往返一致）", () => {
    const p = parseFrontmatter(DOC);
    const r = writeFrontmatter(DOC, p.fields);
    expect(r.text).toBe(DOC);
    expect(r.from).toBe(p.start);
    expect(r.to).toBe(p.end);
    expect(r.block).toBe(DOC.slice(p.start, p.end));
  });

  it("类型推断", () => {
    const p = parseFrontmatter(DOC);
    const m = byKey(p.fields);
    expect(m.count.type).toBe("number");
    expect(m.published.type).toBe("boolean");
    expect(m.created.type).toBe("date");
    expect(m.updated.type).toBe("datetime");
    expect(m.tags.type).toBe("array");
    expect(m.title.type).toBe("text");
    expect(m["custom-note"].type).toBe("text");
  });

  it("显示格式：千分位 / 布尔 / 数组顿号 / 日期时间空格", () => {
    const m = byKey(parseFrontmatter(DOC).fields);
    expect(m.count.display).toBe("1,234,567");
    expect(m.published.display).toBe("开");
    expect(m.tags.display).toBe("甲、乙");
    expect(m.updated.display).toBe("2026-11-15 10:30:00");
  });

  it("BOM 兼容", () => {
    const bom = "\uFEFF" + DOC;
    const p = parseFrontmatter(bom);
    expect(p.present).toBe(true);
    expect(p.fields[0].key).toBe("title");
    expect(bom.slice(p.start, p.end)).toMatch(FRONTMATTER_RE);
  });

  it("无 frontmatter", () => {
    const p = parseFrontmatter("# 标题\n\n正文");
    expect(p.present).toBe(false);
    expect(p.fields).toEqual([]);
    expect(p.start).toBe(0);
    expect(p.end).toBe(0);
  });

  it("注释与自由键在写回后保留", () => {
    const withComment = `---\ntitle: 甲\n# 注释\ncustom-note: x\n---\n\n正文\n`;
    const p = parseFrontmatter(withComment);
    const next = p.fields.map((f) =>
      f.key === "title" ? { ...f, value: "乙" } : f,
    );
    const r = writeFrontmatter(withComment, next);
    expect(r.text).toContain("# 注释");
    expect(r.text).toContain("custom-note: x");
    expect(r.text).toContain("title: 乙");
    expect(r.text).not.toBe(withComment);
    expect(
      withComment.slice(0, r.from) + r.block + withComment.slice(r.to),
    ).toBe(r.text);
  });

  it("无 frontmatter 时创建块", () => {
    const fields: FrontmatterField[] = [
      { key: "title", type: "text", value: "新文档", display: "新文档" },
    ];
    const r = writeFrontmatter("# 正文\n", fields);
    expect(r.text.startsWith("---\ntitle: 新文档\n---\n")).toBe(true);
    expect(r.block).toMatch(FRONTMATTER_RE);
    expect(r.from).toBe(0);
    expect(r.to).toBe(0);
  });

  it("往返一致：序列化输出可被同一正则再次识别", () => {
    const p = parseFrontmatter(DOC);
    const next = p.fields.map((f, i) => (i === 2 ? { ...f, value: 999 } : f));
    const r = writeFrontmatter(DOC, next);
    expect(r.block).toMatch(FRONTMATTER_RE);
    const p2 = parseFrontmatter(r.text);
    expect(p2.present).toBe(true);
    expect(p2.fields.map((f) => f.key)).toEqual(p.fields.map((f) => f.key));
    expect(p2.fields[2].value).toBe(999);
  });
});

describe("tagColor", () => {
  it("色板为 10 色，色值逐值来自 design-system §6", () => {
    expect(TAG_PALETTE).toHaveLength(10);
    expect(TAG_PALETTE[0].name).toBe("靛蓝");
    expect(TAG_PALETTE[0].light).toEqual(["#eef0ff", "#4338ca", "#c7cbff"]);
    expect(TAG_PALETTE[0].dark).toEqual(["#262a52", "#aeb4ff", "#3c4278"]);
    expect(TAG_PALETTE[9].name).toBe("藤黄");
    expect(TAG_PALETTE[9].light).toEqual(["#fbf5df", "#854d0e", "#ecdfa8"]);
    expect(TAG_PALETTE[9].dark).toEqual(["#383114", "#e0c96a", "#564b20"]);
  });

  it("FNV-1a 已知向量：索引落在 0..9", () => {
    expect(tagColor("甲")).toBe(1);
    expect(tagColor("丁")).toBe(4);
    expect(tagColor("戊")).toBe(5);
    for (const n of ["甲", "丁", "戊"]) {
      expect(tagColor(n)).toBeGreaterThanOrEqual(0);
      expect(tagColor(n)).toBeLessThan(10);
    }
  });

  it("同名同色，不同名分布到不同索引", () => {
    expect(tagColor("甲")).toBe(tagColor("甲"));
    const names = ["甲", "丁", "戊", "工作", "生活", "读书"];
    const idx = names.map(tagColor);
    expect(new Set(idx).size).toBeGreaterThan(1);
  });

  it("删除中间标签后，其余标签索引不漂移（按名不按位）", () => {
    const tags = ["甲", "丁", "戊", "工作", "生活"];
    const before = new Map(tags.map((t) => [t, tagColor(t)]));
    const after = tags.filter((_, i) => i !== 2);
    expect(after).toEqual(["甲", "丁", "工作", "生活"]);
    for (const t of after) {
      expect(tagColor(t)).toBe(before.get(t));
    }
  });
});

describe("isManagedDateKey", () => {
  it("仅 created / updated 为自动托管日期键", () => {
    expect(isManagedDateKey("created")).toBe(true);
    expect(isManagedDateKey("updated")).toBe(true);
    expect(isManagedDateKey("title")).toBe(false);
    expect(isManagedDateKey("createdate")).toBe(false);
  });
});
