import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isExternalHref,
  mediaKindOf,
  mediaUrlForPath,
  resolveDocMediaHref,
  resolveRelativeToDoc,
} from "../../lib/mediaUrl";

describe("媒体引用解析", () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      convertFileSrc: (p: string) =>
        `asset://localhost/${encodeURIComponent(p)}`,
    };
  });
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it("外部链接原样放行（远程图片不该被改写）", () => {
    for (const href of [
      "https://a.com/x.png",
      "data:image/png;base64,AAA",
      "//cdn/x.png",
      "asset://localhost/x",
    ]) {
      expect(isExternalHref(href)).toBe(true);
      expect(resolveDocMediaHref(href, "/vault/note.md")).toBe(href);
    }
  });

  it("相对引用按文档目录落到绝对路径", () => {
    expect(resolveRelativeToDoc("assets/pic.png", "/vault/note.md")).toBe(
      "/vault/assets/pic.png",
    );
    expect(resolveRelativeToDoc("./pic.png", "/vault/note.md")).toBe(
      "/vault/pic.png",
    );
    expect(resolveRelativeToDoc("../img/pic.png", "/vault/sub/note.md")).toBe(
      "/vault/img/pic.png",
    );
    expect(resolveRelativeToDoc("/abs/pic.png", "/vault/note.md")).toBe(
      "/abs/pic.png",
    );
  });

  it("图片走 asset://，视频走 media://", () => {
    const img = resolveDocMediaHref("assets/pic.png", "/vault/note.md");
    expect(img?.startsWith("asset://")).toBe(true);
    const video = resolveDocMediaHref("assets/clip.mp4", "/vault/note.md");
    expect(video).toBe("media://localhost/vault/assets/clip.mp4");
  });

  it("未保存文档 / 非 Tauri 环境返回 null（不留必然 404 的 src）", () => {
    expect(resolveDocMediaHref("assets/pic.png", null)).toBeNull();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    expect(resolveDocMediaHref("assets/pic.png", "/vault/note.md")).toBeNull();
  });

  it("按扩展名判类型", () => {
    expect(mediaKindOf("a.PNG")).toBe("image");
    expect(mediaKindOf("a.mp4")).toBe("video");
    expect(mediaKindOf("a.mp3")).toBe("audio");
    expect(mediaKindOf("a.pdf")).toBe("file");
    expect(mediaKindOf("noext")).toBe("file");
  });

  it("media:// 保留斜杠（不做 %2F 编码）", () => {
    expect(mediaUrlForPath("/Users/张三/a.mp4")).toContain(
      "/Users/%E5%BC%A0%E4%B8%89/a.mp4",
    );
  });
});
