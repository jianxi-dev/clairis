// 导出 .mdpkg：打包往返逐字一致、本地图片进包、远程图片不进包、无署名标记、取消不抛。
// 运行于 node 环境：vendored bundle 顶层引用 document，须先装 stub 再动态 import。
// @vitest-environment node
import { describe, expect, it } from "vitest";

installDocumentStub();

const { openPackage, readEntrySource } = await import("../lib/mdpkg/index");
import type { OpenPackageResult } from "../lib/mdpkg/index";
const { buildMdpkgFiles, exportMdpkgFromMarkdown, mdpkgFileName } =
  await import("../lib/export/mdpkg");

const dec = (b: Uint8Array): string => new TextDecoder().decode(b);

type OkResult = Exclude<OpenPackageResult, { error: string }>;

const isError = (r: OpenPackageResult): r is { error: string } =>
  typeof r.error === "string" && r.error.length > 0;

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const SOURCE_MD = [
  "---",
  "title: 元数据",
  "---",
  "# 标题",
  "",
  "正文 **加粗**。",
  "",
  "![图](images/a.png)",
  "",
  "![远程](https://example.com/b.png)",
  "",
].join("\n");

const reader = async (path: string): Promise<string | null> =>
  path.endsWith("images/a.png") ? PNG_BASE64 : null;

const INPUT = {
  title: "测试文档",
  markdown: SOURCE_MD,
  baseDir: "/Users/test",
};

async function packOk(): Promise<Uint8Array> {
  const saved: { base64: string; defaultName: string }[] = [];
  const result = await exportMdpkgFromMarkdown(INPUT, {
    readBase64: reader,
    save: async (base64, defaultName) => {
      saved.push({ base64, defaultName });
      return `/Users/test/${defaultName}`;
    },
  });
  expect(result.status).toBe("saved");
  expect(saved).toHaveLength(1);
  expect(saved[0]!.defaultName).toBe("测试文档.mdpkg");
  return Uint8Array.from(atob(saved[0]!.base64), (c) => c.charCodeAt(0));
}

describe("导出 .mdpkg", () => {
  it("往返：入口 Markdown 逐字一致，本地图片在包内", async () => {
    const bytes = await packOk();
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const opened = await openPackage(bytes);
    if (isError(opened))
      throw new Error(`unexpected open failure: ${opened.error}`);
    const ok = opened as OkResult;

    expect(ok.validation.ok).toBe(true);
    expect(readEntrySource(ok.files, ok.entry)).toBe(SOURCE_MD);
    expect(ok.manifest?.format).toBe("mdpkg");
    expect(ok.manifest?.spec_version.startsWith("1.")).toBe(true);

    const image = ok.files.get("images/a.png");
    expect(image).toBeDefined();
    expect(image!.length).toBeGreaterThan(0);
  });

  it("远程图片不进包", async () => {
    const files = await buildMdpkgFiles(INPUT, reader);
    expect([...files.keys()]).toEqual(["document.md", "images/a.png"]);
    expect([...files.keys()].some((p) => /^https?:/i.test(p))).toBe(false);
  });

  it("包内无署名 / 生成器标记", async () => {
    const files = await buildMdpkgFiles(INPUT, reader);
    const names = [...files.keys()];
    expect(names.some((p) => /byline|generator|signature/i.test(p))).toBe(
      false,
    );
    expect(dec(files.get("document.md")!)).toBe(SOURCE_MD);

    const bytes = await packOk();
    const opened = await openPackage(bytes);
    if (isError(opened))
      throw new Error(`unexpected open failure: ${opened.error}`);
    const ok = opened as OkResult;
    expect(ok.manifest?.resources.map((r) => r.path).sort()).toEqual([
      "document.md",
      "images/a.png",
    ]);
    expect(Object.keys(ok.manifest ?? {})).not.toContain("generator");
  });

  it("取消保存返回 cancelled，不抛", async () => {
    const result = await exportMdpkgFromMarkdown(INPUT, {
      readBase64: reader,
      save: async () => null,
    });
    expect(result).toEqual({ status: "cancelled" });
  });

  it("写盘抛 Cancelled 也收敛为 cancelled", async () => {
    const result = await exportMdpkgFromMarkdown(INPUT, {
      readBase64: reader,
      save: async () => {
        throw new Error("Cancelled");
      },
    });
    expect(result).toEqual({ status: "cancelled" });
  });

  it("文件名去掉路径分隔符与 md 扩展名", () => {
    expect(mdpkgFileName("a/b.md")).toBe("a-b.mdpkg");
    expect(mdpkgFileName("  ")).toBe("未命名.mdpkg");
  });
});

/** Minimal `document` so the vendored bundle can initialise under node. */
function installDocumentStub(): void {
  if (typeof globalThis.document !== "undefined") return;
  const decodeEntities = (s: string): string =>
    s.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_m, e: string) => {
      const table: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
      };
      return table[e] ?? _m;
    });
  globalThis.document = {
    createElement: () => ({
      style: {},
      set innerHTML(value: string) {
        this.textContent = decodeEntities(value);
      },
      textContent: "",
      setAttribute: () => {},
      appendChild: () => {},
    }),
    createTextNode: (text: string) => ({ textContent: text }),
    implementation: { createHTMLDocument: () => ({ body: { innerHTML: "" } }) },
    body: { innerHTML: "" },
  } as unknown as Document;
}
