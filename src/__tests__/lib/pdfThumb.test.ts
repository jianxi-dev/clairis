import { afterEach, describe, expect, it } from "vitest";
import {
  clearPdfThumbCache,
  pdfThumbCacheGet,
  pdfThumbOf,
  setPdfThumbRenderer,
} from "../../lib/pdfThumb";

/**
 * PDF 卡片缩略图（#317）：只会「拿不到图」时返回 null，绝不抛；同一路径只渲一次。
 * 真实 pdfium 渲染在 e2e/rail-cards.spec.ts 里验，这里锁调度与失败语义。
 */
describe("pdfThumbOf", () => {
  afterEach(() => {
    setPdfThumbRenderer(null);
    clearPdfThumbCache();
  });

  it("渲染成功后缓存 dataURL，第二次不再调用渲染器", async () => {
    let calls = 0;
    setPdfThumbRenderer(async () => {
      calls += 1;
      return "data:image/png;base64,AAAA";
    });

    const first = await pdfThumbOf("/tmp/a.pdf");
    const second = await pdfThumbOf("/tmp/a.pdf");

    expect(first).toBe("data:image/png;base64,AAAA");
    expect(second).toBe(first);
    expect(calls).toBe(1);
    expect(pdfThumbCacheGet("/tmp/a.pdf")).toBe(first);
  });

  it("渲染器抛错时返回 null 且不抛出", async () => {
    setPdfThumbRenderer(async () => {
      throw new Error("pdfium exploded");
    });

    await expect(pdfThumbOf("/tmp/bad.pdf")).resolves.toBeNull();
    // 失败不落缓存，下一次还能重试（wasm 首次加载失败是瞬时的）
    expect(pdfThumbCacheGet("/tmp/bad.pdf")).toBeUndefined();
  });

  it("渲染器返回 null（无字节 / 无首页）时同样落到占位", async () => {
    setPdfThumbRenderer(async () => null);

    await expect(pdfThumbOf("/tmp/empty.pdf")).resolves.toBeNull();
  });

  it("并发请求同一路径只渲染一次", async () => {
    let calls = 0;
    setPdfThumbRenderer(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return "data:image/png;base64,BBBB";
    });

    const [a, b, c] = await Promise.all([
      pdfThumbOf("/tmp/c.pdf"),
      pdfThumbOf("/tmp/c.pdf"),
      pdfThumbOf("/tmp/c.pdf"),
    ]);

    expect([a, b, c]).toEqual([
      "data:image/png;base64,BBBB",
      "data:image/png;base64,BBBB",
      "data:image/png;base64,BBBB",
    ]);
    expect(calls).toBe(1);
  });

  it("不同路径各自独立", async () => {
    setPdfThumbRenderer(async (path) => `data:image/png;base64,${path}`);

    await pdfThumbOf("/tmp/x.pdf");
    await pdfThumbOf("/tmp/y.pdf");

    expect(pdfThumbCacheGet("/tmp/x.pdf")).toBe(
      "data:image/png;base64,/tmp/x.pdf",
    );
    expect(pdfThumbCacheGet("/tmp/y.pdf")).toBe(
      "data:image/png;base64,/tmp/y.pdf",
    );
  });
});
