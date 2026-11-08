import { beforeEach, describe, expect, it } from "vitest";
import { RUNTIME_VERSION, buildEditableDoc } from "../../editors/html/runtime";
import { cleanSnapshot } from "../../editors/html/model";

/**
 * 编辑态文档组装（E-16 切片 2）。
 *
 * CI 不跑 e2e，所以这条安全边界（用户脚本被非白名单机制挡住）必须在单测层
 * 也有断言，否则哪天 CSP 被改宽了没人知道。
 */
describe("buildEditableDoc", () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      convertFileSrc: (p: string) =>
        `asset://localhost/${encodeURIComponent(p)}`,
    };
  });

  it("CSP 用 nonce 白名单，而不是 unsafe-inline 放开脚本", () => {
    const doc = buildEditableDoc("<html><body><p>x</p></body></html>");
    expect(doc).toContain("script-src 'nonce-");
    expect(doc).not.toContain("script-src 'unsafe-inline'");
  });

  it("只有注入的运行时带 nonce，用户自己的 <script> 不带", () => {
    const doc = buildEditableDoc(
      "<html><head><script>evil()</script></head><body><p>x</p></body></html>",
    );
    const nonce = doc.match(/script-src 'nonce-([a-f0-9]{32})'/)?.[1];
    expect(nonce).toBeTruthy();
    // 注入运行时带 nonce
    expect(doc).toContain(`<script nonce="${nonce}"`);
    // 用户脚本原样保留但没有 nonce → 被 CSP 挡下
    expect(doc).toContain("<script>evil()</script>");
    expect(doc).not.toContain(`<script nonce="${nonce}">evil()`);
  });

  it("运行时带版本号与锚点", () => {
    const doc = buildEditableDoc("<html><body><h1>t</h1></body></html>");
    expect(doc).toContain(`const V = ${RUNTIME_VERSION}`);
    expect(doc).toContain('data-cm-node-id="h1:0"');
  });

  it("运行时与内部样式都带 data-cm-internal，可被 cleanSnapshot 剥掉", () => {
    const doc = buildEditableDoc("<html><body><p>x</p></body></html>");
    expect(doc).toContain('data-cm-internal="runtime"');
  });

  it("深色底 + 文档自己没写 color 时补可读兜底色（#327）", () => {
    const doc = buildEditableDoc(
      "<html><head><style>html { background: #0a0a0f; }</style></head>" +
        '<body class="text-[#e4e4e7]"><h1>合同管理</h1></body></html>',
    );
    expect(doc).toContain("body { color: #e8e8ea; }");
  });

  it("文档自己声明了 color 时绝不覆盖（#327）", () => {
    const doc = buildEditableDoc(
      "<html><head><style>html{background:#0a0a0f} body{color:#e4e4e7}</style></head>" +
        "<body><h1>t</h1></body></html>",
    );
    expect(doc).not.toContain("color: #e8e8ea");
  });

  it("浅色底不补兜底色（#327）", () => {
    const doc = buildEditableDoc(
      "<html><head><style>html { background: #ffffff; }</style></head>" +
        "<body><h1>t</h1></body></html>",
    );
    expect(doc).not.toContain("color: #e8e8ea");
  });

  it("兜底样式随编辑期脚手架一起被剥掉，不写回文件（#327）", () => {
    const doc = buildEditableDoc(
      "<html><head><style>html { background: #0a0a0f; }</style></head>" +
        "<body><h1>t</h1></body></html>",
    );
    const saved = cleanSnapshot(doc);
    expect(saved).not.toContain("data-cm-node-id");
    expect(saved).not.toContain("cmid:");
    expect(saved).not.toContain("data-cm-internal");
    expect(saved).not.toContain("color: #e8e8ea");
  });
});
