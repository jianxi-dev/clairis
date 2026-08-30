import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadPdfBytes } from "../utils/pdfSource";

const INTERNALS_KEY = "__TAURI_INTERNALS__" as keyof Window & string;

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

beforeEach(() => {
  invokeMock.mockReset();
});

afterEach(() => {
  // 恢复 setup.ts 声明的 Tauri 环境标志，避免污染其他用例
  Object.defineProperty(window, INTERNALS_KEY, {
    writable: true,
    configurable: true,
    value: {},
  });
});

describe("loadPdfBytes", () => {
  it("decodes base64 to correct bytes on happy path", async () => {
    invokeMock.mockResolvedValue("SGVsbG8="); // "Hello"
    const result = await loadPdfBytes("/a.pdf");
    expect(result).toEqual({
      ok: true,
      bytes: new Uint8Array([72, 101, 108, 108, 111]),
    });
    expect(invokeMock).toHaveBeenCalledWith("read_file_base64", {
      path: "/a.pdf",
    });
  });

  it("decodes the default fixture base64", async () => {
    invokeMock.mockResolvedValue("AAECAwQ="); // 解码为 [0,1,2,3,4]
    const result = await loadPdfBytes("/b.pdf");
    expect(result).toEqual({
      ok: true,
      bytes: new Uint8Array([0, 1, 2, 3, 4]),
    });
  });

  it("returns ok:false (does not throw) when invoke rejects", async () => {
    invokeMock.mockRejectedValue(new Error("boom"));
    const result = await loadPdfBytes("/c.pdf");
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("boom"),
    });
  });

  it("returns ok:false when invoke returns invalid base64", async () => {
    // "^^^^" 必然不是合法 base64，atob 会抛异常
    invokeMock.mockResolvedValue("^^^^");
    const result = await loadPdfBytes("/d.pdf");
    expect(result.ok).toBe(false);
  });

  it("returns ok:false with hint outside Tauri environment", async () => {
    delete (window as unknown as Record<string, unknown>)[INTERNALS_KEY];
    const result = await loadPdfBytes("/e.pdf");
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("无法预览 PDF"),
    });
  });
});
