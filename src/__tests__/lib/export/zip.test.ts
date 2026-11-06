// 导出 ZIP：document.md 原文 + 本地图片资源，md-bundle toZip 语义（无 manifest.json、附 README.md）。
// 运行于 node 环境：vendored bundle 顶层引用 document，须先装 stub 再动态 import；
// 解压用 DecompressionStream（Node 18+ 全局，jsdom 无此 API）。
// @vitest-environment node
import { describe, expect, it } from "vitest";

installDocumentStub();

const { exportZipFromMarkdown, exportZipMessage, zipFileName } =
  await import("../../../lib/export/zip");

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const SOURCE_MD = [
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
  const result = await exportZipFromMarkdown(INPUT, {
    readBase64: reader,
    save: async (base64, defaultName) => {
      saved.push({ base64, defaultName });
      return `/Users/test/${defaultName}`;
    },
  });
  expect(result.status).toBe("saved");
  expect(saved).toHaveLength(1);
  expect(saved[0]!.defaultName).toBe("测试文档.zip");
  return Uint8Array.from(atob(saved[0]!.base64), (c) => c.charCodeAt(0));
}

describe("导出 ZIP", () => {
  it("合法 ZIP：document.md 原文、README.md、无 manifest.json、本地图片进包", async () => {
    const bytes = await packOk();
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const names = zipEntryNames(bytes);
    expect(names).toContain("document.md");
    expect(names).toContain("README.md");
    expect(names).not.toContain("manifest.json");
    expect(names).toContain("images/a.png");

    expect(await readZipText(bytes, "document.md")).toBe(SOURCE_MD);
  });

  it("取消保存返回 cancelled，不抛", async () => {
    const result = await exportZipFromMarkdown(INPUT, {
      readBase64: reader,
      save: async () => null,
    });
    expect(result).toEqual({ status: "cancelled" });
    expect(exportZipMessage(result)).toBeNull();
  });

  it("写盘抛 Cancelled 也收敛为 cancelled", async () => {
    const result = await exportZipFromMarkdown(INPUT, {
      readBase64: reader,
      save: async () => {
        throw new Error("Cancelled");
      },
    });
    expect(result).toEqual({ status: "cancelled" });
  });

  it("空文档直接报错，不调写盘", async () => {
    let called = false;
    const result = await exportZipFromMarkdown(
      { title: "空", markdown: "   \n", baseDir: "/Users/test" },
      {
        readBase64: reader,
        save: async () => {
          called = true;
          return "/tmp/空.zip";
        },
      },
    );
    expect(result.status).toBe("error");
    expect(called).toBe(false);
  });

  it("文件名去掉路径分隔符与 md 扩展名", () => {
    expect(zipFileName("a/b.md")).toBe("a-b.zip");
    expect(zipFileName("  ")).toBe("未命名.zip");
  });
});

interface ZipEntryInfo {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function zipEntryInfos(bytes: Uint8Array): ZipEntryInfo[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o: number) => view.getUint16(o, true);
  const u32 = (o: number) => view.getUint32(o, true);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (u32(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP 缺少 EOCD");
  const total = u16(eocd + 10);
  const centralSize = u32(eocd + 12);
  const centralOffset = u32(eocd + 16);
  const prefix = eocd - centralSize - centralOffset;
  const entries: ZipEntryInfo[] = [];
  let pos = prefix + centralOffset;
  for (let i = 0; i < total; i++) {
    const nameLen = u16(pos + 28);
    const extraLen = u16(pos + 30);
    const commentLen = u16(pos + 32);
    entries.push({
      name: new TextDecoder().decode(
        bytes.subarray(pos + 46, pos + 46 + nameLen),
      ),
      method: u16(pos + 10),
      compressedSize: u32(pos + 20),
      localOffset: u32(pos + 42) + prefix,
    });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function zipEntryNames(bytes: Uint8Array): string[] {
  return zipEntryInfos(bytes).map((e) => e.name);
}

async function readZipText(
  bytes: Uint8Array,
  name: string,
): Promise<string | null> {
  const entry = zipEntryInfos(bytes).find((e) => e.name === name);
  if (!entry) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o: number) => view.getUint16(o, true);
  const start =
    entry.localOffset +
    30 +
    u16(entry.localOffset + 26) +
    u16(entry.localOffset + 28);
  const compressed = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(compressed);
  if (entry.method !== 8) return null;
  const stream = new Blob([compressed.slice()])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(
    new Uint8Array(await new Response(stream).arrayBuffer()),
  );
}

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
