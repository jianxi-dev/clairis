import { describe, it, expect } from "vitest";
import {
  DOCX_ENTRY,
  docxFileName,
  exportDocxFromMarkdown,
  exportDocxMessage,
  stripFrontmatter,
} from "../lib/export/docx";

const PK = [0x50, 0x4b, 0x03, 0x04];

const PNG_1X1 = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44,
  0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d,
  0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);

const MD = "# 标题\n\n正文一段。\n";

function decodeBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

describe("stripFrontmatter", () => {
  it("去掉开头被 --- 包裹的元数据块", () => {
    const md = "---\ntitle: 测试\ntags: [a]\n---\n# 正文\n";
    expect(stripFrontmatter(md)).toBe("# 正文\n");
  });

  it("未闭合时原样返回", () => {
    const md = "---\ntitle: 测试\n# 正文\n";
    expect(stripFrontmatter(md)).toBe(md);
  });

  it("没有 frontmatter 时不动", () => {
    expect(stripFrontmatter(MD)).toBe(MD);
  });

  it("正文中间的 --- 分隔线不当成 frontmatter", () => {
    const md = "# 标题\n\n---\n\n分隔线之后\n";
    expect(stripFrontmatter(md)).toBe(md);
  });
});

describe("docxFileName", () => {
  it("去掉 .md 后缀并换成 .docx", () => {
    expect(docxFileName("测试文档.md")).toBe("测试文档.docx");
    expect(docxFileName("notes")).toBe("notes.docx");
  });
});

describe("exportDocxFromMarkdown", () => {
  it("真实 vendor 产出合法 ZIP 字节（PK\\x03\\x04 开头）", async () => {
    let savedBase64 = "";
    let savedName = "";
    const result = await exportDocxFromMarkdown(
      { title: "测试文档.md", markdown: MD },
      {
        save: async (base64, defaultName) => {
          savedBase64 = base64;
          savedName = defaultName;
          return "/Users/test/测试文档.docx";
        },
      },
    );

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    expect(result.path).toBe("/Users/test/测试文档.docx");
    expect(savedName).toBe("测试文档.docx");
    expect(Array.from(decodeBase64(savedBase64).subarray(0, 4))).toEqual(PK);
  });

  it("frontmatter 不进正文，图片随文档内联", async () => {
    let seen: Map<string, Uint8Array> | null = null;
    const result = await exportDocxFromMarkdown(
      {
        title: "带图.md",
        markdown: "---\ntitle: 元数据\n---\n# 标题\n\n![图](img/pic.png)\n",
        assets: [{ name: "img/pic.png", bytes: PNG_1X1 }],
      },
      {
        toDocx: (files) => {
          seen = files;
          return Uint8Array.from(PK);
        },
        save: async () => "/tmp/带图.docx",
      },
    );

    expect(result.status).toBe("saved");
    expect(seen).not.toBeNull();
    const files = seen as unknown as Map<string, Uint8Array>;
    const body = new TextDecoder().decode(files.get(DOCX_ENTRY)!);
    expect(body).not.toContain("title: 元数据");
    expect(body).toContain("# 标题");
    expect(files.get("img/pic.png")).toBe(PNG_1X1);
    expect([...files.keys()].sort()).toEqual([DOCX_ENTRY, "img/pic.png"]);
  });

  it("不注入署名或生成器标记", async () => {
    let seen: Map<string, Uint8Array> | null = null;
    await exportDocxFromMarkdown(
      { title: "无署名.md", markdown: MD },
      {
        toDocx: (files) => {
          seen = files;
          return Uint8Array.from(PK);
        },
        save: async () => "/tmp/无署名.docx",
      },
    );
    const body = new TextDecoder().decode(
      (seen as unknown as Map<string, Uint8Array>).get(DOCX_ENTRY)!,
    );
    expect(body).not.toMatch(/byline|generator|由.*生成|Biaoyue|标月/i);
  });

  it("上游警告汇总进结果，并在提示里显示条数", async () => {
    const result = await exportDocxFromMarkdown(
      { title: "有警告.md", markdown: MD },
      {
        toDocx: (_files, _opts, onWarning) => {
          onWarning?.("SVG 图片不嵌入 docx");
          onWarning?.("无法读取图片固有尺寸");
          return Uint8Array.from(PK);
        },
        save: async () => "/tmp/有警告.docx",
      },
    );

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    expect(result.warnings).toEqual([
      "SVG 图片不嵌入 docx",
      "无法读取图片固有尺寸",
    ]);
    expect(exportDocxMessage(result)).toBe("已导出 有警告.docx（2 条提示）");
  });

  it("保存对话框取消 → cancelled", async () => {
    const result = await exportDocxFromMarkdown(
      { title: "取消.md", markdown: MD },
      { save: async () => null },
    );
    expect(result).toEqual({ status: "cancelled" });
    expect(exportDocxMessage(result)).toBeNull();
  });

  it("生成失败收敛为 error，不抛出", async () => {
    const result = await exportDocxFromMarkdown(
      { title: "失败.md", markdown: MD },
      {
        toDocx: () => {
          throw new Error("MDPKG-E303 该文件包内没有可显示的文档内容");
        },
        save: async () => "/tmp/失败.docx",
      },
    );
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.message).toContain("MDPKG-E303");
    expect(exportDocxMessage(result)).toBe(`导出失败：${result.message}`);
  });

  it("空文档直接报错，不调 vendor", async () => {
    let called = false;
    const result = await exportDocxFromMarkdown(
      { title: "空.md", markdown: "   \n" },
      {
        toDocx: () => {
          called = true;
          return Uint8Array.from(PK);
        },
        save: async () => "/tmp/空.docx",
      },
    );
    expect(result.status).toBe("error");
    expect(called).toBe(false);
  });
});
