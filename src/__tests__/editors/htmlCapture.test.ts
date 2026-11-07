import { describe, expect, it } from "vitest";
import {
  buildCaptureParts,
  buildCaptureSvg,
  captureFileName,
  captureRegionToPng,
  isRegionValid,
} from "../../editors/html/capture";

const DOC = `<!DOCTYPE html>
<html><head><style>body{margin:0;font-family:serif}p{color:red}</style></head>
<body><h1>标题</h1><p>第一段</p></body></html>`;

describe("区域截图（E-21）", () => {
  it("取出内联样式与 body 内容，不带 style 标签进 body", () => {
    const parts = buildCaptureParts(DOC);
    expect(parts.styles).toContain("font-family:serif");
    expect(parts.body).toContain("<h1>标题</h1>");
    expect(parts.body).not.toContain("<style");
  });

  it("SVG 窗口尺寸等于选区，内层按负偏移定位", () => {
    const svg = buildCaptureSvg(
      buildCaptureParts(DOC),
      { x: 20, y: 30, width: 200, height: 100 },
      { viewportWidth: 800 },
    );
    expect(svg).toContain('width="200" height="100"');
    expect(svg).toContain("left:-20px");
    expect(svg).toContain("top:-30px");
    expect(svg).toContain("width:800px");
    expect(svg).toContain("overflow:hidden");
  });

  it("body 级样式被复制到包装层，只认白名单键", () => {
    const svg = buildCaptureSvg(
      buildCaptureParts(DOC),
      { x: 0, y: 0, width: 10, height: 10 },
      {
        viewportWidth: 400,
        bodyStyle: {
          "background-color": "rgb(1, 2, 3)",
          "font-size": "16px",
          onclick: "alert(1)",
        },
      },
    );
    expect(svg).toContain("background-color: rgb(1, 2, 3)");
    expect(svg).toContain("font-size: 16px");
    expect(svg).not.toContain("onclick");
  });

  it("样式进 CDATA，CSS 里的尖括号不会破坏 XML", () => {
    const styled = `<!DOCTYPE html><html><head><style>p::after{content:"<x>"}</style></head><body><p>a</p></body></html>`;
    const svg = buildCaptureSvg(
      buildCaptureParts(styled),
      { x: 0, y: 0, width: 10, height: 10 },
      { viewportWidth: 400 },
    );
    expect(svg).toContain("<![CDATA[");
    expect(svg).toContain("]]>");
  });

  it("选区无效（0 宽高）不产出文件", async () => {
    expect(isRegionValid({ x: 0, y: 0, width: 0, height: 10 })).toBe(false);
    const result = await captureRegionToPng({
      content: DOC,
      region: { x: 0, y: 0, width: 0, height: 10 },
      viewportWidth: 800,
    });
    expect(result.status).toBe("error");
  });

  it("走注入的栅格化与落盘，产出保存路径", async () => {
    let savedName = "";
    const result = await captureRegionToPng(
      {
        content: DOC,
        region: { x: 0, y: 0, width: 120, height: 60 },
        viewportWidth: 800,
      },
      {
        toBlob: async () => new Blob(["png"], { type: "image/png" }),
        save: async (_base64, name) => {
          savedName = name;
          return `/tmp/${name}`;
        },
      },
    );
    expect(result).toEqual({ status: "saved", path: "/tmp/选区-截图.png" });
    expect(savedName).toBe("选区-截图.png");
  });

  it("用户取消保存时返回 cancelled", async () => {
    const result = await captureRegionToPng(
      {
        content: DOC,
        region: { x: 0, y: 0, width: 120, height: 60 },
        viewportWidth: 800,
      },
      {
        toBlob: async () => new Blob(["png"], { type: "image/png" }),
        save: async () => null,
      },
    );
    expect(result).toEqual({ status: "cancelled" });
  });

  it("文件名带文档名后缀，去掉原扩展名", () => {
    expect(captureFileName("/tmp/a/doc.html")).toBe("doc-截图.png");
    expect(captureFileName(null)).toBe("选区-截图.png");
  });

  it("空文档不产出文件", async () => {
    const result = await captureRegionToPng({
      content: "<!DOCTYPE html><html><body></body></html>",
      region: { x: 0, y: 0, width: 10, height: 10 },
      viewportWidth: 800,
    });
    expect(result.status).toBe("error");
  });
});
