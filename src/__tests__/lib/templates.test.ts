import { describe, expect, it } from "vitest";
import {
  applyTemplatePlaceholders,
  todayStamp,
  type Template,
} from "../../lib/extensions/templates";
import { loadExtensionSnapshot } from "../../lib/extensions/bundle";

describe("applyTemplatePlaceholders", () => {
  it("替换 {{date}} 与 {{title}}", () => {
    expect(
      applyTemplatePlaceholders("# {{title}}\n{{date}}\n", {
        title: "日记",
        date: "2026-11-02",
      }),
    ).toBe("# 日记\n2026-11-02\n");
  });

  it("未知占位符原样保留", () => {
    expect(
      applyTemplatePlaceholders("{{author}} {{title}} {{missing}}", {
        title: "x",
        date: "2026-11-02",
      }),
    ).toBe("{{author}} x {{missing}}");
  });

  it("同一占位符多次出现全部替换", () => {
    expect(
      applyTemplatePlaceholders("{{title}}/{{title}}/{{date}}/{{date}}", {
        title: "T",
        date: "D",
      }),
    ).toBe("T/T/D/D");
  });

  it("title 值含 {{date}} 时不被二次替换", () => {
    expect(
      applyTemplatePlaceholders("{{title}}", {
        title: "{{date}}",
        date: "2026-01-01",
      }),
    ).toBe("{{date}}");
  });

  it("date 值含 {{title}} 时不被二次替换", () => {
    expect(
      applyTemplatePlaceholders("{{date}}", {
        title: "X",
        date: "{{title}}",
      }),
    ).toBe("{{title}}");
  });

  it("正文原样保留（不 trim、不重排换行）", () => {
    const body = "  前导空格\n\n第二行  \n";
    expect(applyTemplatePlaceholders(body, { title: "x", date: "d" })).toBe(
      body,
    );
  });

  it("无占位符时正文不变", () => {
    expect(applyTemplatePlaceholders("纯文本", { title: "x", date: "d" })).toBe(
      "纯文本",
    );
  });
});

describe("todayStamp", () => {
  it("格式为 YYYY-MM-DD（本地时区）", () => {
    expect(todayStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayStamp(new Date(2026, 10, 25))).toBe("2026-11-25");
  });
});

describe("Template", () => {
  it("携带 name/body/path", () => {
    const template: Template = {
      name: "日记",
      body: "# {{title}}",
      path: "/Users/test/.config/clairis/templates/日记.md",
    };
    expect(template.path).toContain("templates");
  });
});

describe("loadExtensionSnapshot", () => {
  it("一次调用解析 templates 与 theme tokens", async () => {
    const snapshot = await loadExtensionSnapshot(async () => ({
      snippets: [],
      templates: [{ name: "日记", body: "# {{title}}", path: "/x/日记.md" }],
      theme: { tokens: { "--app-accent": "#c2410c" }, warnings: [] },
      warnings: [],
    }));
    expect(snapshot.templates).toEqual([
      { name: "日记", body: "# {{title}}", path: "/x/日记.md" },
    ]);
    expect(snapshot.themeTokens).toEqual({ "--app-accent": "#c2410c" });
  });

  it("无模板时返回空列表（回退空白新建）", async () => {
    await expect(
      loadExtensionSnapshot(async () => ({
        snippets: [],
        templates: [],
        theme: { tokens: {}, warnings: [] },
        warnings: [],
      })),
    ).resolves.toMatchObject({ templates: [] });
  });

  it("调用抛错时返回空快照", async () => {
    await expect(
      loadExtensionSnapshot(async () => {
        throw new Error("list_extensions unavailable");
      }),
    ).resolves.toEqual({ snippets: [], templates: [], themeTokens: {} });
  });

  it("返回形状不对时返回空快照", async () => {
    await expect(loadExtensionSnapshot(async () => null)).resolves.toEqual({
      snippets: [],
      templates: [],
      themeTokens: {},
    });
  });
});
