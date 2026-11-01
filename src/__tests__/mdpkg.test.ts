// mdpkg 读写层：任何硬错误都必须收敛成 { error }，绝不抛出；打包往返一致、manifest 封闭。
// 运行于 node 环境：vendored bundle 顶层引用 document，须先装 stub 再动态 import。
// @vitest-environment node
import { describe, expect, it } from "vitest";

installDocumentStub();

const {
  openPackage,
  packPackage,
  readEntrySource,
  MdeError,
  translateVendorError,
  buildManifest,
} = await import("../lib/mdpkg/index");
import type { OpenPackageResult } from "../lib/mdpkg/index";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array): string => new TextDecoder().decode(b);

type OkResult = Exclude<OpenPackageResult, { error: string }>;

const isError = (r: OpenPackageResult): r is { error: string } =>
  typeof r.error === "string" && r.error.length > 0;

describe("mdpkg 解包", () => {
  it("非 ZIP 字节返回中文错误而不是抛异常", async () => {
    const result = await openPackage(new Uint8Array([1, 2, 3, 4]));
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error).not.toMatch(/MDPKG-E\d+/);
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("技术错误码翻译为中文且不暴露错误码", () => {
    expect(translateVendorError("MDPKG-E103")).toBe(
      "文件格式不正确，无法打开此文件",
    );
    expect(translateVendorError("[MDPKG-E103] 解压失败")).toBe(
      "文件格式不正确，无法打开此文件",
    );
    expect(translateVendorError("MDPKG-E101")).toBe("不是有效的 .mdpkg 文件");
    expect(translateVendorError("MDPKG-E303")).toBe(
      "该文件包内没有可显示的文档内容",
    );
    expect(translateVendorError("MDPKG-E401")).toBe(
      "文档引用了未导入的本地资源，请先导入图片或移除引用后重试",
    );
    // 未知码：剥离前缀；空则给通用提示
    expect(translateVendorError("[MDPKG-E999] 路径超长")).toBe("路径超长");
    expect(translateVendorError("MDPKG-E999")).toBe(
      "文件处理失败，请检查文件是否完整",
    );
  });

  it("0 条目的 ZIP 返回错误而不是抛异常", async () => {
    // 0 条目 ZIP = 仅 EOCD 记录
    const emptyZip = new Uint8Array([
      0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0,
    ]);
    const result = await openPackage(emptyZip);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.error).not.toMatch(/MDPKG-E\d+/);
  });
});

describe("mdpkg 打包往返", () => {
  const md = "# 标题\n\n正文 **加粗**。\n";

  it("打包后再解包，入口原文与打包前逐字一致", async () => {
    const files = new Map<string, Uint8Array>([["document.md", enc(md)]]);
    const manifest = buildManifest(files);
    const packed = packPackage(files, manifest);

    const result = await openPackage(packed);
    if (isError(result))
      throw new Error(`unexpected open failure: ${result.error}`);

    expect(result.entry).toBe("document.md");
    expect(result.validation.ok).toBe(true);
    expect(result.html).toContain("标题");
    expect(dec(result.files.get("document.md")!)).toBe(md);
    expect(readEntrySource(result.files, result.entry)).toBe(md);
    expect(result.manifest?.resources.map((r) => r.path)).toEqual([
      "document.md",
    ]);
  });

  it("manifest 含 schema 之外的字段时打包失败并报出字段名", () => {
    const files = new Map<string, Uint8Array>([["document.md", enc(md)]]);
    const manifest = {
      ...buildManifest(files),
      signature: "me",
    } as unknown as Parameters<typeof packPackage>[1];
    expect(() => packPackage(files, manifest)).toThrow(/signature/);
  });

  it("入口缺失时 readEntrySource 抛 MdeError", () => {
    const files = new Map<string, Uint8Array>([["other.md", enc("x")]]);
    expect(() => readEntrySource(files, "document.md")).toThrow(MdeError);
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
