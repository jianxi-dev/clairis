import { describe, expect, it } from "vitest";
import {
  ALIAS,
  BUILTIN_ALIAS_MAP,
  CANON_TYPE,
  FRONTMATTER_RE,
  TAG_PALETTE,
  coerceFrontmatterValue,
  dedupeKeys,
  findTitleField,
  formatFrontmatterValue,
  isManagedDateKey,
  managedDateDisplay,
  mergeManagedDates,
  moveFieldBlock,
  normalizePropAliasMap,
  parseFrontmatter,
  renameFrontmatterField,
  resolveAlias,
  setFrontmatterField,
  tagColor,
  toListValue,
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
    expect(m.updated.display).toBe("2026-11-15 10:30");
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

describe("列表值容错（#1256）", () => {
  it("字符串 tags 按单元素列表展示且不抛错", () => {
    const doc = `---\ntitle: t\ntags: "#"\n---\n\n正文\n`;
    const fields = parseFrontmatter(doc).fields;
    const tags = fields.find((f) => f.key === "tags")!;
    expect(tags.type).toBe("array");
    expect(tags.display).toBe("#");
    expect(toListValue(tags.value)).toEqual(["#"]);
  });

  it("toListValue：数组逐项转字符串 / 空值空数组 / 标量单元素", () => {
    expect(toListValue(["a", 1])).toEqual(["a", "1"]);
    expect(toListValue(null)).toEqual([]);
    expect(toListValue("")).toEqual([]);
    expect(toListValue("#")).toEqual(["#"]);
  });

  it("formatFrontmatterValue 对非数组的 array 类型不抛错", () => {
    expect(formatFrontmatterValue("#", "array")).toBe("#");
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

describe("外部文档兜底解析（#1258）", () => {
  const OBSIDIAN = `---\n\ncreated: {{date}} {{time}}\ntags: ["模板", "IT", "学习", "出版", "思维工具"]\nbook_title: \nauthor: \nread_date: {{date:YYYY-MM}}\nrating: \nstatus: 阅读中\n\n---\n\n# 标题\n`;

  it("Obsidian 模板：整块 YAML 失败仍逐条识别全部字段", () => {
    const p = parseFrontmatter(OBSIDIAN);
    expect(p.present).toBe(true);
    expect(p.yamlValid).toBe(false);
    expect(p.fields.map((f) => f.key)).toEqual([
      "created",
      "tags",
      "book_title",
      "author",
      "read_date",
      "rating",
      "status",
    ]);
    const m = byKey(p.fields);
    expect(m.created.value).toBe("{{date}} {{time}}");
    expect(m.created.type).toBe("text");
    expect(m.tags.type).toBe("array");
    expect(m.book_title.type).toBe("text");
    expect(m.read_date.type).toBe("text");
    expect(m.status.type).toBe("select");
  });

  it("mdpkg 常见键识别：type / source_kind / *_via / *_at", () => {
    const doc = `---\ntype: guide\ntitle: t\ncaptured_at: 2026-09-01T00:56:05.946Z\ncaptured_via: capture-cli\ningested_via: put_page\ningested_at: 2026-09-01T00:56:09.822Z\nsource_kind: put_page\n---\n\n正文\n`;
    const p = parseFrontmatter(doc);
    expect(p.yamlValid).toBe(true);
    const m = byKey(p.fields);
    expect(m.type.type).toBe("select");
    expect(m.source_kind.type).toBe("select");
    expect(m.captured_via.type).toBe("text");
    expect(m.ingested_via.type).toBe("text");
    expect(m.captured_at.type).toBe("datetime");
    expect(m.ingested_at.type).toBe("datetime");
  });

  it("空值字段默认 text，不再落 unknown", () => {
    const doc = `---\nbook_title: \nauthor:\n---\n\n正文\n`;
    const m = byKey(parseFrontmatter(doc).fields);
    expect(m.book_title.type).toBe("text");
    expect(m.author.type).toBe("text");
  });

  it("不可解析块编辑：只改写目标行，其余字节不变", () => {
    const p = parseFrontmatter(OBSIDIAN);
    const fields = p.fields.map((f) =>
      f.key === "status" ? { ...f, value: "已完成" } : f,
    );
    const r = writeFrontmatter(OBSIDIAN, fields);
    expect(r.text).toContain("created: {{date}} {{time}}");
    expect(r.text).toContain("# 标题");
    expect(r.text).toContain("status: 已完成");
    const before = OBSIDIAN.split("\n").filter((l) => !l.startsWith("status:"));
    const after = r.text.split("\n").filter((l) => !l.startsWith("status:"));
    expect(after).toEqual(before);
  });

  it("编辑键时保留其后的注释与空行", () => {
    const doc = `---\ncreated: {{date}} {{time}}\nstatus: 阅读中\n# 我的注释\n\nbook_title: x\n---\n\n正文\n`;
    const p = parseFrontmatter(doc);
    expect(p.yamlValid).toBe(false);
    const fields = p.fields.map((f) =>
      f.key === "status" ? { ...f, value: "已完成" } : f,
    );
    const r = writeFrontmatter(doc, fields);
    expect(r.text).toContain("# 我的注释");
    expect(r.text).toContain("\n\nbook_title: x");
    expect(r.text).toContain("status: 已完成");
  });

  it("CRLF 行尾的坏块也能识别字段", () => {
    const doc = `---\r\ncreated: {{date}} {{time}}\r\nstatus: 阅读中\r\n---\r\n\r\n正文\r\n`;
    const p = parseFrontmatter(doc);
    expect(p.present).toBe(true);
    expect(p.yamlValid).toBe(false);
    expect(p.fields.map((f) => f.key)).toEqual(["created", "status"]);
  });

  it("不可解析块改名：位置保持且旧键消失", () => {
    const p = parseFrontmatter(OBSIDIAN);
    const fields = p.fields.map((f) =>
      f.key === "status" ? { ...f, key: "state" } : f,
    );
    const r = writeFrontmatter(OBSIDIAN, fields);
    expect(r.text).toContain("state: 阅读中");
    expect(r.text).not.toContain("status:");
    expect(r.text.indexOf("state:")).toBeGreaterThan(r.text.indexOf("rating:"));
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

describe("managedDateDisplay", () => {
  it("截取日期部分，缺失 / 非日期返回 null（不渲染空壳）", () => {
    expect(managedDateDisplay("2026-11-14")).toBe("2026-11-14");
    expect(managedDateDisplay("2026-11-15T10:30:00")).toBe("2026-11-15");
    expect(managedDateDisplay("2026-11-15 10:30")).toBe("2026-11-15");
    expect(managedDateDisplay("")).toBeNull();
    expect(managedDateDisplay(null)).toBeNull();
    expect(managedDateDisplay(undefined)).toBeNull();
    expect(managedDateDisplay("高")).toBeNull();
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

describe("BUILTIN_ALIAS_MAP", () => {
  it("由 ALIAS/CANON_TYPE 派生：规范键与别称同类型", () => {
    expect(BUILTIN_ALIAS_MAP.title).toBe("text");
    expect(BUILTIN_ALIAS_MAP["标题"]).toBe("text");
    expect(BUILTIN_ALIAS_MAP.tags).toBe("array");
    expect(BUILTIN_ALIAS_MAP["标签"]).toBe("array");
    expect(BUILTIN_ALIAS_MAP.createdate).toBe("date");
    expect(BUILTIN_ALIAS_MAP["创建日期"]).toBe("date");
    expect(BUILTIN_ALIAS_MAP.updatedate).toBe("date");
    expect(BUILTIN_ALIAS_MAP["更新日期"]).toBe("date");
  });
});

describe("resolveAlias with aliasMap", () => {
  it("应用配置优先于内置默认", () => {
    expect(resolveAlias("customdate", { customdate: "number" })).toBe("number");
    expect(resolveAlias("title", { title: "number" })).toBe("number");
    expect(resolveAlias("createdate", { customdate: "number" })).toBe("date");
  });

  it("大小写不敏感、trim 后比对", () => {
    expect(resolveAlias(" CustomDate ", { customdate: "date" })).toBe("date");
    expect(resolveAlias("CUSTOMDATE", { CustomDate: "date" })).toBe("date");
  });

  it("未命中回落内置；空映射等同缺省", () => {
    expect(resolveAlias("createdate", {})).toBe("date");
    expect(resolveAlias("createdate", null)).toBe("date");
    expect(resolveAlias("customdate", {})).toBeNull();
  });
});

describe("parseFrontmatter with aliasMap", () => {
  const DOC = `---\ntitle: 外部\ncustomdate: 高\ncreatedate: 2026-11-14\n---\n\n正文\n`;

  it("配置命中赋类型，显示名与 YAML 键不变", () => {
    const m = byKey(parseFrontmatter(DOC, { customdate: "date" }).fields);
    expect(m.customdate.type).toBe("date");
    expect(m.customdate.key).toBe("customdate");
    expect(m.createdate.type).toBe("date");
  });

  it("恢复默认（缺省）后自定义键回落值推断", () => {
    const withMap = byKey(parseFrontmatter(DOC, { customdate: "date" }).fields);
    expect(withMap.customdate.type).toBe("date");
    const without = byKey(parseFrontmatter(DOC).fields);
    expect(without.customdate.type).toBe("unknown");
    expect(without.createdate.type).toBe("date");
  });
});

describe("findTitleField（标题键识别 #1232）", () => {
  it("优先规范键 title，即使同时存在别称", () => {
    const fields = parseFrontmatter(
      "---\ntitle: 规范\n标题: 别称\n---\n",
    ).fields;
    expect(findTitleField(fields)?.key).toBe("title");
  });

  it("无规范键时命中内置别称「标题」", () => {
    const fields = parseFrontmatter(
      "---\n标题: 别称\nauthor: 甲\n---\n",
    ).fields;
    expect(findTitleField(fields)?.key).toBe("标题");
  });

  it("未登记时 author 不误判（同为 text）", () => {
    const fields = parseFrontmatter("---\nauthor: 甲\n---\n").fields;
    expect(findTitleField(fields)).toBeUndefined();
  });

  it("用户把某键登记为标题类型别名时按登记识别", () => {
    const fields = parseFrontmatter("---\n名称: 别名\n---\n").fields;
    expect(findTitleField(fields, { 名称: "text" })?.key).toBe("名称");
  });

  it("无标题字段返回 undefined", () => {
    const fields = parseFrontmatter("---\ntags:\n  - 甲\n---\n").fields;
    expect(findTitleField(fields)).toBeUndefined();
  });
});

describe("normalizePropAliasMap", () => {
  it("键 trim，丢弃非法键名与未知类型并告警", () => {
    const { config, warnings } = normalizePropAliasMap({
      " customdate ": "date",
      "a:b": "text",
      bad: "color",
      "": "text",
      ok: "number",
    });
    expect(config).toEqual({ customdate: "date", ok: "number" });
    expect(warnings).toHaveLength(3);
  });

  it("缺省 / 空对象返回空映射", () => {
    expect(normalizePropAliasMap(null).config).toEqual({});
    expect(normalizePropAliasMap(undefined).config).toEqual({});
    expect(normalizePropAliasMap({}).config).toEqual({});
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

describe("mergeManagedDates（托管日期并回，#1245）", () => {
  const f = (key: string): FrontmatterField => ({
    key,
    type: "text",
    value: key,
    display: key,
  });
  const parsed = [
    "title",
    "category",
    "created",
    "author",
    "updated",
    "source",
    "note",
  ].map(f);
  const all = parsed.map((x) => ({ ...x }));

  it("保留传入顺序，缺失的托管日期按原文相对位置补回", () => {
    const editable = [
      f("note"),
      f("title"),
      f("category"),
      f("author"),
      f("source"),
    ];
    expect(mergeManagedDates(editable, parsed, all).map((x) => x.key)).toEqual([
      "note",
      "title",
      "category",
      "created",
      "author",
      "updated",
      "source",
    ]);
  });

  it("created 始终排在 updated 之前", () => {
    const editable = [
      f("title"),
      f("category"),
      f("author"),
      f("source"),
      f("note"),
    ];
    expect(mergeManagedDates(editable, parsed, all).map((x) => x.key)).toEqual([
      "title",
      "category",
      "created",
      "author",
      "updated",
      "source",
      "note",
    ]);
  });

  it("已在列表中的托管日期不重复补入", () => {
    const editable = [
      f("title"),
      f("created"),
      f("category"),
      f("author"),
      f("updated"),
      f("source"),
      f("note"),
    ];
    expect(mergeManagedDates(editable, parsed, all).map((x) => x.key)).toEqual(
      editable.map((x) => x.key),
    );
  });

  it("无后续键时追加到末尾", () => {
    const tail = ["title", "category", "created", "updated"].map(f);
    expect(
      mergeManagedDates([f("category"), f("title")], tail, tail).map(
        (x) => x.key,
      ),
    ).toEqual(["category", "title", "created", "updated"]);
  });

  it("无托管日期时原样返回传入顺序", () => {
    const plain = ["b", "a", "c"].map(f);
    expect(mergeManagedDates([f("c"), f("a"), f("b")], plain, plain)).toEqual([
      f("c"),
      f("a"),
      f("b"),
    ]);
  });
});
