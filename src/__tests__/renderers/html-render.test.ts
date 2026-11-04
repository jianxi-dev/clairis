import { beforeEach, describe, expect, it } from "vitest";
import { rewriteHtmlPaths } from "../../renderers/html";

describe("rewriteHtmlPaths", () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      convertFileSrc: (p: string) =>
        `asset://localhost/${encodeURIComponent(p)}`,
    };
  });

  it("双引号引用被重写成 asset://", () => {
    const out = rewriteHtmlPaths('<img src="./pic.png">', "/tmp/doc/a.md");
    expect(out).toContain("asset://");
  });

  it("单引号引用同样重写（用户手写 HTML 常见）", () => {
    const out = rewriteHtmlPaths("<img src='./pic.png'>", "/vault/a.html");
    expect(out).toContain("asset://");
    // 保留单引号风格
    expect(out).toContain("src='asset://");
  });

  it("远程与 data 引用不动", () => {
    const out = rewriteHtmlPaths(
      '<img src="https://a.com/x.png"><img src="data:image/png;base64,AA">',
      "/vault/a.html",
    );
    expect(out).toContain("https://a.com/x.png");
    expect(out).toContain("data:image/png;base64,AA");
  });
});
