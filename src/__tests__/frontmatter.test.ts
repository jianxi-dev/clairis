import { describe, expect, it } from "vitest";
import {
  ALIAS,
  CANON_TYPE,
  FRONTMATTER_RE,
  TAG_PALETTE,
  cloneFieldsForPaste,
  coerceFrontmatterValue,
  dedupeKeys,
  isManagedDateKey,
  moveFieldBlock,
  parseFrontmatter,
  renameFrontmatterField,
  resolveAlias,
  setFrontmatterField,
  tagColor,
  uniqueKey,
  validateFieldValue,
  writeFrontmatter,
  writeFrontmatterOrdered,
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

  it("类型推断：值可推断 + 纯文本未知", () => {
    const p = parseFrontmatter(DOC);
    const m = byKey(p.fields);
    expect(m.count.type).toBe("number");
    expect(m.published.type).toBe("boolean");
    expect(m.created.type).toBe("date");
    expect(m.updated.type).toBe("datetime");
    expect(m.tags.type).toBe("array");
    expect(m.title.type).toBe("text");
    expect(m["custom-note"].type).toBe("unknown");
  });

  it("别称命中赋类型，显示名保持原键样", () => {
    const doc = `---\ntitle: 外部\ncreatedate: 2026-11-14\npriority: 高\n---\n\n正文\n`;
    const p = parseFrontmatter(doc);
    const m = byKey(p.fields);
    expect(m.createdate.type).toBe("date");
    expect(m.createdate.key).toBe("createdate");
    expect(m.title.type).toBe("text");
    expect(m.priority.type).toBe("unknown");
    expect(m.priority.key).toBe("priority");
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

describe("validateFieldValue", () => {
  it("number：接受数值字面量，拒绝 abc / 空串 / Infinity", () => {
    expect(validateFieldValue("number", "1234567")).toEqual({
      ok: true,
      value: 1234567,
    });
    expect(validateFieldValue("number", " -12.5 ")).toEqual({
      ok: true,
      value: -12.5,
    });
    expect(validateFieldValue("number", "abc")).toEqual({
      ok: false,
      reason: "数字格式不正确",
    });
    expect(validateFieldValue("number", "")).toEqual({
      ok: false,
      reason: "数字格式不正确",
    });
    expect(validateFieldValue("number", "Infinity")).toEqual({
      ok: false,
      reason: "数字格式不正确",
    });
  });

  it("boolean：仅 true / false（大小写不敏感）", () => {
    expect(validateFieldValue("boolean", "true")).toEqual({
      ok: true,
      value: true,
    });
    expect(validateFieldValue("boolean", "FALSE")).toEqual({
      ok: true,
      value: false,
    });
    expect(validateFieldValue("boolean", "开")).toEqual({
      ok: false,
      reason: "布尔值只能是 true 或 false",
    });
  });

  it("date：YYYY-MM-DD 且为真实公历日期", () => {
    expect(validateFieldValue("date", "2026-11-16")).toEqual({
      ok: true,
      value: "2026-11-16",
    });
    expect(validateFieldValue("date", "2026-02-30").ok).toBe(false);
    expect(validateFieldValue("date", "2026/11/16").ok).toBe(false);
  });

  it("datetime：ISO 分隔，可带秒与空格", () => {
    expect(validateFieldValue("datetime", "2026-11-16T10:30")).toEqual({
      ok: true,
      value: "2026-11-16T10:30",
    });
    expect(validateFieldValue("datetime", "2026-11-16 10:30:00")).toEqual({
      ok: true,
      value: "2026-11-16 10:30:00",
    });
    expect(validateFieldValue("datetime", "2026-11-16T25:00").ok).toBe(false);
  });

  it("array：逗号 / 顿号分割并去空项", () => {
    expect(validateFieldValue("array", "甲、乙")).toEqual({
      ok: true,
      value: ["甲", "乙"],
    });
    expect(validateFieldValue("array", "甲, 乙，，")).toEqual({
      ok: true,
      value: ["甲", "乙"],
    });
  });

  it("text：任意原文（含首尾空格）", () => {
    expect(validateFieldValue("text", "anything 任意 ")).toEqual({
      ok: true,
      value: "anything 任意 ",
    });
  });
});

describe("setFrontmatterField（面板提交 API 往返）", () => {
  it("改单字段后键序、自由键与注释保持", () => {
    const doc = `---\ntitle: 甲\n# 注释\ncustom-note: x\ncount: 1\n---\n\n正文\n`;
    const r = setFrontmatterField(doc, "title", "乙");
    expect(r.text).toContain("title: 乙");
    expect(r.text).toContain("custom-note: x");
    expect(r.text).toContain("# 注释");
    expect(r.text).not.toContain("title: 甲");
    const p = parseFrontmatter(r.text);
    expect(p.fields.map((f) => f.key)).toEqual([
      "title",
      "custom-note",
      "count",
    ]);
    expect(p.fields[0].value).toBe("乙");
    expect(doc.slice(0, r.from) + r.block + doc.slice(r.to)).toBe(r.text);
  });

  it("同值提交无改动，from/to 为原块范围", () => {
    const p = parseFrontmatter(DOC);
    const r = setFrontmatterField(DOC, "title", "测试文档");
    expect(r.text).toBe(DOC);
    expect(r.from).toBe(p.start);
    expect(r.to).toBe(p.end);
  });

  it("数字字段写回为数值字面量", () => {
    const r = setFrontmatterField(DOC, "count", 999);
    expect(r.text).toContain("count: 999");
    const f = parseFrontmatter(r.text).fields.find((x) => x.key === "count");
    expect(f?.value).toBe(999);
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

describe("resolveAlias", () => {
  it("规范键与中文别称命中，返回类型", () => {
    expect(resolveAlias("title")).toBe("text");
    expect(resolveAlias("标题")).toBe("text");
    expect(resolveAlias("createdate")).toBe("date");
    expect(resolveAlias("创建日期")).toBe("date");
    expect(resolveAlias("updatedate")).toBe("date");
    expect(resolveAlias("category")).toBe("select");
    expect(resolveAlias("status")).toBe("select");
    expect(resolveAlias("author")).toBe("text");
    expect(resolveAlias("date")).toBe("date");
  });

  it("大小写不敏感，未命中返回 null", () => {
    expect(resolveAlias("Createdate")).toBe("date");
    expect(resolveAlias("TITLE")).toBe("text");
    expect(resolveAlias("priority")).toBeNull();
    expect(resolveAlias("来源")).toBeNull();
    expect(resolveAlias("")).toBeNull();
  });

  it("ALIAS 与 CANON_TYPE 键一一对应", () => {
    expect(Object.keys(ALIAS).sort()).toEqual(Object.keys(CANON_TYPE).sort());
  });
});

describe("coerceFrontmatterValue", () => {
  it("日期 / 数字 / 布尔：合法值转换成功", () => {
    expect(coerceFrontmatterValue("date", "2026-11-14")).toEqual({
      ok: true,
      value: "2026-11-14",
    });
    expect(coerceFrontmatterValue("number", "42")).toEqual({
      ok: true,
      value: 42,
    });
    expect(coerceFrontmatterValue("boolean", "true")).toEqual({
      ok: true,
      value: true,
    });
  });

  it("转换失败返回原因（高 → 日期）", () => {
    expect(coerceFrontmatterValue("date", "高")).toEqual({
      ok: false,
      reason: "日期格式应为 YYYY-MM-DD",
    });
  });

  it("下拉 / 未识别保留原文；数组转列表保持数组", () => {
    expect(coerceFrontmatterValue("select", "高")).toEqual({
      ok: true,
      value: "高",
    });
    expect(coerceFrontmatterValue("unknown", "高")).toEqual({
      ok: true,
      value: "高",
    });
    expect(coerceFrontmatterValue("array", ["甲", "乙"])).toEqual({
      ok: true,
      value: ["甲", "乙"],
    });
    expect(coerceFrontmatterValue("text", ["甲", "乙"])).toEqual({
      ok: true,
      value: "甲、乙",
    });
  });
});

describe("renameFrontmatterField", () => {
  const RENAME_DOC = `---\ntitle: 甲\n# 注释\nnote: 一段备注\ncount: 1\n---\n\n正文\n`;

  it("改键后键序位置不变，值与注释保留", () => {
    const r = renameFrontmatterField(RENAME_DOC, "note", "priority");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = parseFrontmatter(r.text);
    expect(p.fields.map((f) => f.key)).toEqual(["title", "priority", "count"]);
    expect(p.fields[1].key).toBe("priority");
    expect(p.fields[1].value).toBe("一段备注");
    expect(r.text).toContain("# 注释");
    expect(r.text).not.toContain("note:");
    expect(RENAME_DOC.slice(0, r.from) + r.block + RENAME_DOC.slice(r.to)).toBe(
      r.text,
    );
  });

  it("重名被拦截", () => {
    const r = renameFrontmatterField(RENAME_DOC, "note", "count");
    expect(r).toEqual({ ok: false, reason: "字段名「count」与已有键重名" });
  });

  it("非法键名被拒绝（空 / 含 : / 含 #）", () => {
    expect(renameFrontmatterField(RENAME_DOC, "note", "   ")).toEqual({
      ok: false,
      reason: "字段名不能为空",
    });
    expect(renameFrontmatterField(RENAME_DOC, "note", "a:b").ok).toBe(false);
    expect(renameFrontmatterField(RENAME_DOC, "note", "a#b").ok).toBe(false);
  });

  it("同名提交无改动", () => {
    const p = parseFrontmatter(RENAME_DOC);
    const r = renameFrontmatterField(RENAME_DOC, "note", "note");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toBe(RENAME_DOC);
    expect(r.from).toBe(p.start);
    expect(r.to).toBe(p.end);
  });

  it("字段不存在 / 无 frontmatter 被拒绝", () => {
    expect(renameFrontmatterField(RENAME_DOC, "missing", "x").ok).toBe(false);
    expect(renameFrontmatterField("# 正文\n", "note", "x").ok).toBe(false);
  });
});

describe("moveFieldBlock（整块移动）", () => {
  const F = ["a", "b", "c", "d", "e"].map((k) => ({
    key: k,
    type: "text" as const,
    value: k,
    display: k,
  }));

  it("后移：块整体搬到目标位置，相对顺序不变", () => {
    const out = moveFieldBlock(F, [1, 2], 4);
    expect(out.map((f) => f.key)).toEqual(["a", "d", "b", "c", "e"]);
  });

  it("前移：块搬到数组头部", () => {
    const out = moveFieldBlock(F, [3, 4], 0);
    expect(out.map((f) => f.key)).toEqual(["d", "e", "a", "b", "c"]);
  });

  it("目标落在块内 / 紧邻块前缘视为未移动", () => {
    expect(moveFieldBlock(F, [1, 2], 1).map((f) => f.key)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
    expect(moveFieldBlock(F, [1, 2], 2).map((f) => f.key)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("边界：移到末尾与越界目标都被夹紧", () => {
    expect(moveFieldBlock(F, [0], 99).map((f) => f.key)).toEqual([
      "b",
      "c",
      "d",
      "e",
      "a",
    ]);
    expect(moveFieldBlock(F, [4], -3).map((f) => f.key)).toEqual([
      "e",
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("非临近多选也按原相对顺序成组移动，重复 / 越界下标被忽略", () => {
    const out = moveFieldBlock(F, [3, 0, 3, 99], 5);
    expect(out.map((f) => f.key)).toEqual(["b", "c", "e", "a", "d"]);
  });
});

describe("uniqueKey / dedupeKeys（粘贴键名去重）", () => {
  it("无冲突保持原键名", () => {
    expect(uniqueKey("分类", ["作者"])).toBe("分类");
  });

  it("冲突时依次追加 -2 / -3", () => {
    expect(uniqueKey("分类", ["分类"])).toBe("分类-2");
    expect(uniqueKey("分类", ["分类", "分类-2"])).toBe("分类-3");
    expect(uniqueKey("分类", ["分类", "分类-2", "分类-3", "分类-4"])).toBe(
      "分类-5",
    );
  });

  it("列表内部去重：保留首个，后续顺延", () => {
    const out = dedupeKeys([
      { key: "a" },
      { key: "a" },
      { key: "b" },
      { key: "a" },
    ]);
    expect(out.map((f) => f.key)).toEqual(["a", "a-2", "b", "a-3"]);
  });
});

describe("cloneFieldsForPaste（复制语义）", () => {
  const fields: FrontmatterField[] = [
    {
      key: "tags",
      type: "array",
      value: ["甲", "乙"],
      display: "甲、乙",
    },
    {
      key: "meta",
      type: "unknown",
      value: { nested: [1, 2] },
      display: "x",
    },
    { key: "n", type: "number", value: 1, display: "1" },
  ];

  it("深拷贝：数组 / 对象独立，改副本不影响原字段", () => {
    const out = cloneFieldsForPaste(fields, [0, 1]);
    expect(out.map((f) => f.key)).toEqual(["tags", "meta"]);
    (out[0].value as string[]).push("丙");
    (out[1].value as { nested: number[] }).nested.push(3);
    expect(fields[0].value).toEqual(["甲", "乙"]);
    expect(fields[1].value).toEqual({ nested: [1, 2] });
    expect(out[0].value).toEqual(["甲", "乙", "丙"]);
  });

  it("按升序取用，重复下标只取一次", () => {
    const out = cloneFieldsForPaste(fields, [2, 0, 0]);
    expect(out.map((f) => f.key)).toEqual(["tags", "n"]);
  });
});

describe("writeFrontmatterOrdered（保序结构写回）", () => {
  const ORDER_DOC = `---
title: 测试
# 自由键注释
custom-note: 自由键
count: 1
note: x
---

# 正文
`;

  it("重排后键序更新，自由键与注释保留", () => {
    const p = parseFrontmatter(ORDER_DOC);
    const next = [p.fields[3], p.fields[0], p.fields[1], p.fields[2]];
    const r = writeFrontmatterOrdered(ORDER_DOC, next);
    const reparsed = parseFrontmatter(r.text);
    expect(reparsed.fields.map((f) => f.key)).toEqual([
      "note",
      "title",
      "custom-note",
      "count",
    ]);
    expect(r.text).toContain("# 自由键注释");
    expect(r.text).toContain("custom-note: 自由键");
    expect(r.text).toContain("note: x");
  });

  it("删除 + 粘贴新键：新键落在指定位置，注释不丢", () => {
    const p = parseFrontmatter(ORDER_DOC);
    const pasted: FrontmatterField = {
      key: "分类",
      type: "select",
      value: "草稿",
      display: "草稿",
    };
    const next = [p.fields[0], pasted, p.fields[1], p.fields[2]];
    const r = writeFrontmatterOrdered(ORDER_DOC, next);
    const reparsed = parseFrontmatter(r.text);
    expect(reparsed.fields.map((f) => f.key)).toEqual([
      "title",
      "分类",
      "custom-note",
      "count",
    ]);
    expect(r.text).toContain("# 自由键注释");
    expect(r.text).not.toContain("\nnote:");
  });

  it("无改动时原样返回，from/to 为原块范围", () => {
    const p = parseFrontmatter(ORDER_DOC);
    const r = writeFrontmatterOrdered(ORDER_DOC, p.fields);
    expect(r.text).toBe(ORDER_DOC);
    expect(r.from).toBe(p.start);
    expect(r.to).toBe(p.end);
  });

  it("无 frontmatter 时新建块", () => {
    const r = writeFrontmatterOrdered("# 正文\n", [
      { key: "title", type: "text", value: "新", display: "新" },
    ]);
    expect(r.from).toBe(0);
    expect(r.to).toBe(0);
    expect(r.text).toBe("---\ntitle: 新\n---\n# 正文\n");
  });
});
