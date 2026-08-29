import { describe, it, expect, vi } from "vitest";
import { rewriteHtmlPaths, rewriteSrcsetAttr } from "../renderers/html";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://localhost${path}`,
}));

const FILE = "/Users/test/page.html";
const DIR = "/Users/test";

describe("rewriteSrcsetAttr", () => {
  const resolve = (url: string) =>
    /^(https?:|data:|#|asset:)/i.test(url) ? url : `/resolved/${url}`;

  it("单候选带密度描述符", () => {
    expect(rewriteSrcsetAttr("a.png 1x", resolve)).toBe("/resolved/a.png 1x");
  });

  it("多候选混合宽度/密度描述符保持顺序", () => {
    const input = "a.png 1x, b.png 2x, c.png 480w, d.png 800w";
    expect(rewriteSrcsetAttr(input, resolve)).toBe(
      "/resolved/a.png 1x, /resolved/b.png 2x, /resolved/c.png 480w, /resolved/d.png 800w",
    );
  });

  it("无描述符候选原样拼接", () => {
    expect(rewriteSrcsetAttr("a.png, b.png", resolve)).toBe(
      "/resolved/a.png, /resolved/b.png",
    );
  });

  it("data: 整体跳过不拆分", () => {
    const data = "data:image/png;base64,AAAA,BBBB 1x";
    expect(rewriteSrcsetAttr(data, resolve)).toBe(data);
  });

  it("http/https 外部候选跳过", () => {
    expect(
      rewriteSrcsetAttr("https://x.com/a.png 1x, local.png 2x", resolve),
    ).toBe("https://x.com/a.png 1x, /resolved/local.png 2x");
  });

  it("resolve 未变时保持候选原样", () => {
    expect(rewriteSrcsetAttr("a.png 1x", () => "a.png")).toBe("a.png 1x");
  });

  it("空值与畸形输入不崩", () => {
    expect(rewriteSrcsetAttr("", resolve)).toBe("");
    expect(rewriteSrcsetAttr("  ,  ,", resolve)).toBe("  ,  ,");
  });
});

describe("rewriteHtmlPaths — srcset/@import", () => {
  it("img srcset 相对路径全部重写为 asset URL", () => {
    const html = `<img src="fallback.png" srcset="a.png 1x, ../shared/b.png 2x">`;
    const out = rewriteHtmlPaths(html, FILE);
    expect(out).toContain(`src="asset://localhost${DIR}/fallback.png"`);
    expect(out).toContain(
      `srcset="asset://localhost${DIR}/a.png 1x, asset://localhost/Users/shared/b.png 2x"`,
    );
  });

  it("picture source srcset 重写", () => {
    const html = `<picture><source srcset="wide.png 1000w, narrow.png 500w" media="(min-width: 800px)"><img src="def.png"></picture>`;
    const out = rewriteHtmlPaths(html, FILE);
    expect(out).toContain(
      `srcset="asset://localhost${DIR}/wide.png 1000w, asset://localhost${DIR}/narrow.png 500w"`,
    );
  });

  it('@import "path" 无 url() 形式重写', () => {
    const html = `<style>@import "theme.css"; body { color: red; }</style>`;
    const out = rewriteHtmlPaths(html, FILE);
    expect(out).toContain(`@import "asset://localhost${DIR}/theme.css"`);
  });

  it("@import url(...) 形式由既有规则覆盖", () => {
    const html = `<style>@import url(theme.css);</style>`;
    const out = rewriteHtmlPaths(html, FILE);
    expect(out).toContain(`@import url('asset://localhost${DIR}/theme.css')`);
  });

  it("外部 URL 与 data URI 不被重写", () => {
    const html = `<style>@import "https://cdn.example.com/x.css"; .bg { background: url(data:image/png;base64,AAAA); }</style>`;
    const out = rewriteHtmlPaths(html, FILE);
    expect(out).toContain(`@import "https://cdn.example.com/x.css"`);
    expect(out).toContain("data:image/png;base64,AAAA");
  });

  it("既有 src/href/poster 重写回归", () => {
    const html = `<link rel="stylesheet" href="css/main.css"><script src="app.js"></script><img poster="p.png">`;
    const out = rewriteHtmlPaths(html, FILE);
    expect(out).toContain(`href="asset://localhost${DIR}/css/main.css"`);
    expect(out).toContain(`src="asset://localhost${DIR}/app.js"`);
    expect(out).toContain(`poster="asset://localhost${DIR}/p.png"`);
  });

  it("空内容与无路径不重写", () => {
    expect(rewriteHtmlPaths("", FILE)).toBe("");
    const html = `<img src="a.png">`;
    expect(rewriteHtmlPaths(html, null)).toBe(html);
  });
});
