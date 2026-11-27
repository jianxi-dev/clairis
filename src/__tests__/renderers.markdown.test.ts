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

describe("renderMarkdown — callout 三色属性", () => {
  it("把首行属性块写成卡片 CSS 变量", () => {
    const html = renderMarkdown(
      "> [!NOTE]{bg=green border=red text=gray} 标题\n> 正文",
    );
    expect(html).toContain(
      "--callout-bg: color-mix(in srgb, #419e34 10%, transparent)",
    );
    expect(html).toContain("--callout-border: #f0000e");
    expect(html).toContain("--callout-text: #8b8f96");
  });

  it("纯高亮块无标题栏、带 emoji 覆盖位、不印「纯高亮」", () => {
    const html = renderMarkdown("> [!HIGHLIGHT]\n> 正文");
    expect(html).toContain('data-callout="highlight"');
    expect(html).toContain("callout-mark");
    expect(html).toContain('data-callout-emoji="🖍️"');
    expect(html).not.toContain("纯高亮");
    // 纯高亮不建标题槽（图标由 emoji 内联承担）。
    expect(html).not.toContain("callout-title");
  });

  it("空标题的标注块不补默认名，只留空标题槽", () => {
    const html = renderMarkdown("> [!NOTE]\n> 正文");
    expect(html).toContain('data-callout="note"');
    expect(html).toContain("callout-title");
    expect(html).not.toContain("注释");
  });

  it("旧语法不产生属性变量", () => {
    const html = renderMarkdown("> [!NOTE] 标题");
    expect(html).not.toContain("--callout-bg");
    expect(html).not.toContain("--callout-border");
    expect(html).not.toContain("--callout-text");
  });
});
