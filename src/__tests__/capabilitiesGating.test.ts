import { beforeEach, describe, expect, it } from "vitest";
import {
  disableCapability,
  enableCapability,
  resetCapabilities,
} from "../lib/capabilities";
import { renderMarkdown } from "../renderers/markdown";
import { clearMermaid, renderMermaid } from "../renderers/mermaid";

beforeEach(() => {
  resetCapabilities();
});

describe("数学公式门控", () => {
  const doc = "$$\na^2 + b^2\n$$\n";

  it("开启时渲染成 katex", () => {
    expect(renderMarkdown(doc)).toContain("katex");
  });

  it("关闭后显示为原文，不产生 katex 节点", () => {
    disableCapability("math");
    const html = renderMarkdown(doc);
    expect(html).not.toContain("katex");
    expect(html).toContain("a^2 + b^2");
  });

  it("重新开启后恢复渲染", () => {
    disableCapability("math");
    expect(renderMarkdown(doc)).not.toContain("katex");
    enableCapability("math");
    expect(renderMarkdown(doc)).toContain("katex");
  });
});

describe("代码高亮门控", () => {
  const doc = "```js\nconst a = 1;\n```\n";

  it("开启时输出 token 样式", () => {
    expect(renderMarkdown(doc)).toContain("tok-");
  });

  it("关闭后回退为朴素代码块（源码仍可见）", () => {
    disableCapability("code-highlight");
    const html = renderMarkdown(doc);
    expect(html).not.toContain("tok-");
    expect(html).toContain("const a = 1;");
  });
});

describe("图表水合门控", () => {
  function container(): HTMLElement {
    const el = document.createElement("div");
    el.innerHTML = '<pre class="mermaid">graph TD; A-->B</pre>';
    return el;
  }

  it("关闭时不水合，源码块保持可见", async () => {
    disableCapability("mermaid");
    const el = container();

    await renderMermaid(el);

    expect(el.querySelector(".mermaid-view")).toBeNull();
    expect(el.querySelector<HTMLElement>("pre.mermaid")?.hidden).toBe(false);
  });

  it("clearMermaid 移除已挂的视图并恢复源码显示", () => {
    const el = container();
    const view = document.createElement("div");
    view.className = "mermaid-view";
    el.appendChild(view);
    const src = el.querySelector<HTMLElement>("pre.mermaid")!;
    src.hidden = true;

    clearMermaid(el);

    expect(el.querySelector(".mermaid-view")).toBeNull();
    expect(src.hidden).toBe(false);
    expect(el.textContent).toContain("graph TD");
  });

  it("关闭能力会清理已渲染的容器，重新开启不重复挂 DOM", async () => {
    const el = container();
    document.body.appendChild(el);
    await renderMermaid(el);

    disableCapability("mermaid");
    expect(el.querySelector(".mermaid-view")).toBeNull();

    enableCapability("mermaid");
    await renderMermaid(el);

    expect(el.querySelectorAll(".mermaid-view").length).toBeLessThanOrEqual(1);
    el.remove();
  });
});
