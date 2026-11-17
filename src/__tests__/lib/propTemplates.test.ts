import { describe, expect, it } from "vitest";
import {
  BUILTIN_PROP_TEMPLATES,
  BUILTIN_TEMPLATE_NAMES,
  applyTemplate,
  normalizePropTemplates,
} from "../../lib/propTemplates";
import { newDocFrontmatter, parseFrontmatter } from "../../lib/frontmatter";

function field(key: string, value: unknown = "", type: any = "text") {
  return { key, type, value, display: String(value) };
}

describe("applyTemplate", () => {
  it("只补缺失键、保持已有值、新键追加到末尾", () => {
    const base = [
      field("title", "已有标题"),
      field("status", "已定稿", "select"),
    ];
    const tpl = {
      name: "需求",
      fields: [
        { key: "status", type: "select" as const, value: "草稿" },
        { key: "category", type: "select" as const, value: "设计" },
        { key: "author", type: "text" as const, value: "" },
      ],
    };
    const { fields, added, skipped } = applyTemplate(base, tpl);
    expect(fields.map((f) => f.key)).toEqual([
      "title",
      "status",
      "category",
      "author",
    ]);
    expect(fields[1].value).toBe("已定稿");
    expect(fields[2].value).toBe("设计");
    expect(added).toBe(2);
    expect(skipped).toBe(1);
  });

  it("已有键值为空串也算已存在，不覆盖", () => {
    const base = [field("status", "", "select")];
    const tpl = {
      name: "通用",
      fields: [{ key: "status", type: "select" as const, value: "草稿" }],
    };
    const { fields, added, skipped } = applyTemplate(base, tpl);
    expect(fields).toHaveLength(1);
    expect(fields[0].value).toBe("");
    expect(added).toBe(0);
    expect(skipped).toBe(1);
  });

  it("空模板与无字段模板不改动", () => {
    const base = [field("title", "标题")];
    expect(applyTemplate(base, null)).toEqual({
      fields: base,
      added: 0,
      skipped: 0,
    });
    expect(applyTemplate(base, { name: "空", fields: [] }).added).toBe(0);
  });

  it("模板内重复键只保留首个", () => {
    const base: ReturnType<typeof field>[] = [];
    const tpl = {
      name: "重复",
      fields: [
        { key: "a", type: "text" as const, value: "1" },
        { key: "a", type: "text" as const, value: "2" },
      ],
    };
    const { fields, added, skipped } = applyTemplate(base, tpl);
    expect(fields.map((f) => f.key)).toEqual(["a"]);
    expect(fields[0].value).toBe("1");
    expect(added).toBe(1);
    expect(skipped).toBe(1);
  });
});

describe("normalizePropTemplates", () => {
  it("缺省给出内置三套", () => {
    const { config, warnings } = normalizePropTemplates(null);
    expect(config.map((t) => t.name)).toEqual(["通用", "会议记录", "需求"]);
    expect(warnings).toEqual([]);
    expect(config[0].fields.map((f) => f.key)).toEqual([
      "category",
      "author",
      "status",
    ]);
  });

  it("用户同名模板覆盖内置，新名追加", () => {
    const { config } = normalizePropTemplates([
      {
        name: "通用",
        fields: [{ key: "only", type: "text", value: "" }],
      },
      {
        name: "自定义",
        fields: [{ key: "优先级", type: "select", value: "高" }],
      },
    ]);
    expect(config.map((t) => t.name)).toEqual([
      "通用",
      "会议记录",
      "需求",
      "自定义",
    ]);
    expect(config[0].fields.map((f) => f.key)).toEqual(["only"]);
  });

  it("移除同名条目后回落内置定义", () => {
    const overridden = normalizePropTemplates([
      {
        name: "通用",
        fields: [{ key: "only", type: "date", value: "2026-11-17" }],
      },
    ]).config;
    expect(
      overridden.find((t) => t.name === "通用")?.fields.map((f) => f.key),
    ).toEqual(["only"]);

    const restored = normalizePropTemplates(
      overridden.filter((t) => t.name !== "通用"),
    ).config;
    expect(
      restored.find((t) => t.name === "通用")?.fields.map((f) => f.key),
    ).toEqual(["category", "author", "status"]);
    expect(
      restored.find((t) => t.name === "通用")?.fields.map((f) => f.type),
    ).toEqual(["select", "text", "select"]);
  });

  it("未知类型告警并按文本处理，非法键被跳过", () => {
    const { config, warnings } = normalizePropTemplates([
      {
        name: "混合",
        fields: [
          { key: "good", type: "color", value: "" },
          { key: "a:b", type: "text", value: "" },
          { key: "  ", type: "text", value: "" },
        ],
      },
      { name: "  ", fields: [] },
    ]);
    const tpl = config.find((t) => t.name === "混合");
    expect(tpl?.fields).toHaveLength(1);
    expect(tpl?.fields[0]).toMatchObject({ key: "good", type: "text" });
    expect(warnings.length).toBeGreaterThanOrEqual(3);
    expect(warnings.join("；")).toContain("未知类型");
  });
});

describe("newDocFrontmatter", () => {
  it("生成标题占位空串 + 创建 / 修改日期，可被解析回读", () => {
    const now = new Date(2026, 10, 16);
    const doc = newDocFrontmatter(now);
    const parsed = parseFrontmatter(doc);
    expect(parsed.present).toBe(true);
    expect(parsed.fields.map((f) => f.key)).toEqual([
      "title",
      "created",
      "updated",
    ]);
    expect(parsed.fields[0].value).toBe("");
    expect(parsed.fields[1].value).toBe("2026-11-16");
    expect(parsed.fields[2].value).toBe("2026-11-16");
  });
});

describe("内置模板常量", () => {
  it("三个内置名稳定且字段非空", () => {
    expect(BUILTIN_TEMPLATE_NAMES).toEqual(["通用", "会议记录", "需求"]);
    for (const t of BUILTIN_PROP_TEMPLATES) {
      expect(t.fields.length).toBeGreaterThan(0);
    }
  });
});
