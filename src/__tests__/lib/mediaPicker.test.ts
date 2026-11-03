import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openMock = vi.fn();
const invokeMock = vi.fn();

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { pickMediaForDocument } from "../../lib/mediaPicker";

describe("pickMediaForDocument（Tauri 原生通道）", () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    openMock.mockReset();
    invokeMock.mockReset();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it("选中文件后导入到 assets/，href 用相对名", async () => {
    openMock.mockResolvedValue("/tmp/shots/pic.png");
    invokeMock.mockResolvedValue({
      path: "/vault/assets/pic.png",
      name: "assets/pic.png",
    });

    const got = await pickMediaForDocument("/vault/note.md");

    expect(invokeMock).toHaveBeenCalledWith("import_media_file", {
      docPath: "/vault/note.md",
      srcPath: "/tmp/shots/pic.png",
    });
    expect(got).toEqual({ name: "pic.png", href: "assets/pic.png" });
  });

  it("同名退位后的名字也正确（assets/pic-1.png）", async () => {
    openMock.mockResolvedValue("/tmp/pic.png");
    invokeMock.mockResolvedValue({
      path: "/vault/assets/pic-1.png",
      name: "assets/pic-1.png",
    });

    const got = await pickMediaForDocument("/vault/note.md");
    expect(got).toEqual({ name: "pic-1.png", href: "assets/pic-1.png" });
  });

  it("用户取消返回 null，不触发导入", async () => {
    openMock.mockResolvedValue(null);
    const got = await pickMediaForDocument("/vault/note.md");
    expect(got).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("对话框没真正接上（返回非字符串）时返回 null，不抛出", async () => {
    openMock.mockResolvedValue({ unexpected: true });
    const got = await pickMediaForDocument("/vault/note.md");
    expect(got).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("未保存的文档没有落点，退回只写文件名", async () => {
    openMock.mockResolvedValue("/tmp/shots/clip.mp4");
    const got = await pickMediaForDocument(null);
    expect(got).toEqual({ name: "clip.mp4", href: "clip.mp4" });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("浏览器环境明确不支持（返回 null 并给出警告）", async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const got = await pickMediaForDocument("/vault/note.md");
    expect(got).toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(openMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
