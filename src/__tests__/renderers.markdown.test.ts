import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../renderers/markdown";

describe("renderMarkdown — GFM 任务列表 & sanitize", () => {
  it("任务列表已完成项渲染为 checked checkbox", () => {
    const html = renderMarkdown("- [x] 已完成事项");
    expect(html).toContain("<input");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
    expect(html).toContain("disabled");
    expect(html).toContain("已完成事项");
  });

  it("任务列表未完成项渲染为未勾选 checkbox", () => {
    const html = renderMarkdown("- [ ] 待办事项");
    expect(html).toContain("<input");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain("checked");
    expect(html).toContain("disabled");
  });

  it("恶意 input 属性被剥离（仅 checkbox+disabled 放行）", () => {
    const html = renderMarkdown(
      '<input type="text" name="x" onerror="alert(1)">\n\nplain',
    );
    // sanitize 后 type/name/onerror 均不在 input 上
    expect(html).not.toContain('type="text"');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain('name="x"');
  });

  it("script 依旧被剥离", () => {
    const html = renderMarkdown("<script>alert(1)</script>safe");
    expect(html).not.toContain("<script");
    expect(html).toContain("safe");
  });
});
