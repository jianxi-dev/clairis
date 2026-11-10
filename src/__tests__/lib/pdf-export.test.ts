import { describe, expect, it } from "vitest";
import { buildPdfFromJpeg, pdfFileName } from "../../lib/export/pdf";

describe("buildPdfFromJpeg", () => {
  it("生成以 %PDF 开头、含 DCTDecode 图像与单页结构的 PDF", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildPdfFromJpeg(jpeg, 100, 50);
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain("/Type /Page");
    expect(text).toContain("/Count 1");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("xref 偏移随对象内容变化且为 10 位定宽", () => {
    const pdf = buildPdfFromJpeg(new Uint8Array([1, 2, 3]), 10, 10);
    const text = new TextDecoder("latin1").decode(pdf);
    const xref = text.slice(text.indexOf("xref\n0 6"));
    const rows = xref.split("\n").slice(3, 8);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row).toMatch(/^\d{10} 00000 n $/);
    }
  });
});

describe("pdfFileName", () => {
  it("去掉扩展名与路径分隔符", () => {
    expect(pdfFileName("a/b/标题.md")).toBe("a-b-标题.pdf");
    expect(pdfFileName("   ")).toBe("未命名.pdf");
  });
});
