import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildAssetUrl } from "../renderers/html";

// convertFileSrc mock：与 Tauri 2.11.3 core.js 行为一致（整个路径 encodeURIComponent）
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (filePath: string) =>
    `asset://localhost/${encodeURIComponent(filePath)}`,
}));

describe("buildAssetUrl", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("macOS 路径：前导 %2F 保留绝对路径语义，段编码、斜杠保留", () => {
    const url = buildAssetUrl(
      "/Users/mason/Downloads/AI-doc/Opencode-study/五大工具系统化融合指南.html",
    );
    expect(url).toBe(
      "asset://localhost/%2FUsers/mason/Downloads/AI-doc/Opencode-study/%E4%BA%94%E5%A4%A7%E5%B7%A5%E5%85%B7%E7%B3%BB%E7%BB%9F%E5%8C%96%E8%9E%8D%E5%90%88%E6%8C%87%E5%8D%97.html",
    );
  });

  it("页面内相对引用（指南数据.js）能解析回真实文件位置——回归本 bug", () => {
    const pageUrl = buildAssetUrl(
      "/Users/mason/Downloads/AI-doc/Opencode-study/五大工具系统化融合指南.html",
    );
    // 文档内相对引用按 RFC 3986 相对 base 解析
    const resolved = new URL("指南数据.js", pageUrl).href;
    const expected = buildAssetUrl(
      "/Users/mason/Downloads/AI-doc/Opencode-study/指南数据.js",
    );
    expect(resolved).toBe(expected);
  });

  it("convertFileSrc 塌缩路径下相对引用解析错位——证明旧行为有 bug", () => {
    // 旧行为：convertFileSrc 整个路径编码成一个 segment，base 目录结构塌缩
    const oldStyle = new URL(
      "指南数据.js",
      `asset://localhost/${encodeURIComponent(
        "/Users/mason/Downloads/AI-doc/Opencode-study/五大工具系统化融合指南.html",
      )}`,
    ).href;
    // 解析到根级相对路径，与真实文件位置不符
    expect(oldStyle).toBe(
      "asset://localhost/%E6%8C%87%E5%8D%97%E6%95%B0%E6%8D%AE.js",
    );
    expect(oldStyle).not.toBe(
      buildAssetUrl("/Users/mason/Downloads/AI-doc/Opencode-study/指南数据.js"),
    );
  });

  it("含空格与特殊字符的段被编码", () => {
    const url = buildAssetUrl("/Users/test/My Docs/a#b?.html");
    expect(url).toBe("asset://localhost/%2FUsers/test/My%20Docs/a%23b%3F.html");
  });

  it("Windows 反斜杠路径规范化为正斜杠（盘符冒号编码）", () => {
    const url = buildAssetUrl("C:\\Users\\test\\page.html");
    // 冒号被 encodeURIComponent 编码为 %3A，handler 解码后还原为 C:/Users/test/page.html
    expect(url).toBe("asset://localhost/%2FC%3A/Users/test/page.html");
  });

  it("相对引用 ./ 与 ../ 解析正常", () => {
    const pageUrl = buildAssetUrl("/Users/test/sub/page.html");
    expect(new URL("../img.png", pageUrl).href).toBe(
      buildAssetUrl("/Users/test/img.png"),
    );
    expect(new URL("./css/site.css", pageUrl).href).toBe(
      buildAssetUrl("/Users/test/sub/css/site.css"),
    );
  });
});
