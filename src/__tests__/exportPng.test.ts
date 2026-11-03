import { describe, it, expect, vi } from "vitest";
import {
  blobToBase64,
  exportPngFromMarkdown,
  exportPngMessage,
  measureHtmlHeight,
  pngFileName,
  rasterizeSvgToPng,
  svgFromHtml,
  toWellFormedXhtml,
  PNG_MAX_HEIGHT,
  PNG_TOO_TALL_MESSAGE,
  PNG_WIDTH,
} from "../lib/export/png";

const CSS = ".preview-content { color: red; }";

function fakePngBlob(): Blob {
  // PNG 签名 89 50 4E 47 0D 0A 1A 0A
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new Blob([sig], { type: "image/png" });
}

describe("toWellFormedXhtml", () => {
  it("drops the doctype", () => {
    const out = toWellFormedXhtml(
      "<!doctype html>\n<html><body></body></html>",
    );
    expect(out.toLowerCase()).not.toContain("doctype");
    expect(out).toContain("<html>");
  });

  it("self-closes void elements", () => {
    const out = toWellFormedXhtml('<p><img src="a.png" alt="x"><br><hr></p>');
    expect(out).toContain('<img src="a.png" alt="x"/>');
    expect(out).toContain("<br/>");
    expect(out).toContain("<hr/>");
    expect(out).not.toMatch(/<img[^>]*[^/]>/);
  });

  it("does not double-close an already self-closed void element", () => {
    const out = toWellFormedXhtml('<img src="a.png" />');
    expect(out).not.toContain("/>/>");
    expect(out.match(/<img/g)).toHaveLength(1);
  });

  it("gives bare attributes an empty value", () => {
    const out = toWellFormedXhtml("<div data-x><span hidden>t</span></div>");
    expect(out).toContain('data-x=""');
    expect(out).toContain('hidden=""');
  });

  it("never rewrites words inside quoted attribute values", () => {
    const out = toWellFormedXhtml('<a href="x" title="a b c">t</a>');
    expect(out).toContain('title="a b c"');
    expect(out).not.toContain('c=""');
  });

  it("keeps css untouched inside a CDATA style block", () => {
    const css = "a > b { content: '<&>'; }";
    const out = toWellFormedXhtml(`<style>${css}</style><p>t</p>`);
    expect(out).toContain("<![CDATA[");
    expect(out).toContain(css);
    expect(out).not.toContain("__MDBS__");
  });

  it("splits a ]]> sequence so the CDATA stays well-formed", () => {
    const out = toWellFormedXhtml("<style>a{content:']]>'}</style>");
    expect(out).toContain("]]]]><![CDATA[>");
    expect(out.match(/<!\[CDATA\[/g)).toHaveLength(2);
  });
});

describe("svgFromHtml", () => {
  it("wraps the xhtml in a sized foreignObject with the xhtml namespace", () => {
    const svg = svgFromHtml("<p>正文</p>", { width: 1080, height: 400 });
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="1080" height="400"');
    expect(svg).toContain('<foreignObject width="100%" height="100%">');
    expect(svg).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(svg).toContain("<p>正文</p>");
  });
});

describe("exportPngFromMarkdown", () => {
  it("rejects documents taller than the cap without rasterizing", async () => {
    const toBlob = vi.fn(async () => fakePngBlob());
    const save = vi.fn(async () => "/Users/test/x.png");

    const result = await exportPngFromMarkdown(
      { title: "t.md", markdown: "# t", baseDir: "" },
      {
        measure: async () => PNG_MAX_HEIGHT + 1,
        toBlob,
        save,
        readBase64: async () => null,
      },
    );

    expect(result).toEqual({ status: "error", message: PNG_TOO_TALL_MESSAGE });
    expect(toBlob).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("accepts a document exactly at the cap", async () => {
    const result = await exportPngFromMarkdown(
      { title: "t.md", markdown: "# t", baseDir: "" },
      {
        measure: async () => PNG_MAX_HEIGHT,
        toBlob: async () => fakePngBlob(),
        save: async () => "/Users/test/t.png",
        readBase64: async () => null,
      },
    );
    expect(result).toEqual({ status: "saved", path: "/Users/test/t.png" });
  });

  it("rasterizes through the injected seam and saves base64", async () => {
    let seenSvg = "";
    let savedBase64 = "";
    let savedName = "";

    const result = await exportPngFromMarkdown(
      { title: "我的文档.md", markdown: "# 标题\n\n正文。", baseDir: "" },
      {
        measure: async (_html, width) => {
          expect(width).toBe(PNG_WIDTH);
          return 480;
        },
        toBlob: async (svg) => {
          seenSvg = svg;
          return fakePngBlob();
        },
        save: async (base64, name) => {
          savedBase64 = base64;
          savedName = name;
          return "/Users/test/我的文档.png";
        },
        readBase64: async () => null,
      },
    );

    expect(result).toEqual({
      status: "saved",
      path: "/Users/test/我的文档.png",
    });
    expect(seenSvg).toContain('height="480"');
    expect(seenSvg).toContain("正文。");
    expect(savedBase64.startsWith("iVBORw0KGgo")).toBe(true);
    expect(savedName).toBe("我的文档.png");
  });

  it("returns cancelled when the save dialog is dismissed", async () => {
    const result = await exportPngFromMarkdown(
      { title: "t.md", markdown: "# t", baseDir: "" },
      {
        measure: async () => 100,
        toBlob: async () => fakePngBlob(),
        save: async () => null,
        readBase64: async () => null,
      },
    );
    expect(result).toEqual({ status: "cancelled" });
  });

  it("treats the rust Cancelled error as a cancel, not a failure", async () => {
    const result = await exportPngFromMarkdown(
      { title: "t.md", markdown: "# t", baseDir: "" },
      {
        measure: async () => 100,
        toBlob: async () => fakePngBlob(),
        save: async () => {
          throw new Error("Operation cancelled");
        },
        readBase64: async () => null,
      },
    );
    expect(result).toEqual({ status: "cancelled" });
  });

  it("surfaces a human-readable message when rasterizing fails", async () => {
    const result = await exportPngFromMarkdown(
      { title: "t.md", markdown: "# t", baseDir: "" },
      {
        measure: async () => 100,
        toBlob: async () => {
          throw new Error("PNG 栅格化失败：SVG 图片加载出错");
        },
        save: async () => "/x.png",
        readBase64: async () => null,
      },
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("栅格化失败");
      expect(exportPngMessage(result)).toBe(
        "导出失败：PNG 栅格化失败：SVG 图片加载出错",
      );
    }
  });

  it("refuses an empty document", async () => {
    const result = await exportPngFromMarkdown(
      { title: "t.md", markdown: "   \n\n", baseDir: "" },
      { measure: async () => 100, toBlob: async () => fakePngBlob() },
    );
    expect(result.status).toBe("error");
  });

  it("inlines relative images before measuring", async () => {
    let measuredHtml = "";
    await exportPngFromMarkdown(
      {
        title: "t.md",
        markdown: "![图](pic.png)",
        baseDir: "/docs",
        css: CSS,
      },
      {
        measure: async (html) => {
          measuredHtml = html;
          return 200;
        },
        toBlob: async () => fakePngBlob(),
        save: async () => "/x.png",
        readBase64: async (path) => (path === "/docs/pic.png" ? "QUJD" : null),
      },
    );
    expect(measuredHtml).toContain("data:image/png;base64,QUJD");
  });

  it("inlines a mermaid diagram as SVG and keeps the XHTML well-formed", async () => {
    let seenSvg = "";
    const result = await exportPngFromMarkdown(
      {
        title: "图.md",
        markdown: "```mermaid\nflowchart LR\n  开始 --> 结束\n```",
        baseDir: "",
      },
      {
        measure: async () => 300,
        toBlob: async (svg) => {
          seenSvg = svg;
          return fakePngBlob();
        },
        save: async () => "/Users/test/图.png",
        readBase64: async () => null,
      },
    );

    expect(result).toEqual({ status: "saved", path: "/Users/test/图.png" });
    expect(seenSvg).toContain("<svg");
    expect(seenSvg).toContain("开始");
    expect(seenSvg).toContain("结束");
    expect(seenSvg).toContain('viewBox="0 0 ');
    expect(seenSvg).not.toContain('view=""Box');
    const parsed = new DOMParser().parseFromString(seenSvg, "image/svg+xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
  });

  it("emits no byline or generator signature", async () => {
    let svg = "";
    await exportPngFromMarkdown(
      { title: "t.md", markdown: "# t", baseDir: "" },
      {
        measure: async () => 100,
        toBlob: async (s) => {
          svg = s;
          return fakePngBlob();
        },
        save: async () => "/x.png",
        readBase64: async () => null,
      },
    );
    const lower = svg.toLowerCase();
    expect(lower).not.toContain("byline");
    expect(lower).not.toContain("generated by");
    expect(lower).not.toContain("made with");
  });
});

describe("rasterizeSvgToPng", () => {
  it("uses the injected toBlob seam instead of canvas", async () => {
    const blob = fakePngBlob();
    const out = await rasterizeSvgToPng("<svg/>", {
      width: 10,
      height: 10,
      toBlob: async () => blob,
    });
    expect(out).toBe(blob);
  });
});

describe("measureHtmlHeight", () => {
  it("mounts an offscreen host and removes it afterwards", async () => {
    const before = document.body.childElementCount;
    const height = await measureHtmlHeight("<p>t</p>", 1080);
    // jsdom has no layout engine: scrollHeight is 0, but the host must not leak.
    expect(height).toBe(0);
    expect(document.body.childElementCount).toBe(before);
  });
});

describe("helpers", () => {
  it("derives the file name from the tab title", () => {
    expect(pngFileName("我的文档.md")).toBe("我的文档.png");
    expect(pngFileName("a/b.md")).toBe("a-b.png");
    expect(pngFileName("")).toBe("未命名.png");
  });

  it("strips the data url prefix when encoding", async () => {
    expect(await blobToBase64(fakePngBlob())).toBe("iVBORw0KGgo=");
  });

  it("returns null notice for a cancelled export", () => {
    expect(exportPngMessage({ status: "cancelled" })).toBeNull();
  });
});
