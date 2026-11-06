import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../renderers/markdown";

/**
 * 复刻真实文件 /Users/mason/Desktop/AI学习/overview-design-liyy/SKILL.md 的结构：
 * YAML frontmatter → 独占一行的未知结构标签 → 紧接的标题 / 表格。
 *
 * 未知结构标签（objective / essential_principles / routing …）不是可渲染 HTML
 * 标签，整行只有它时不该被 marked 当成 CommonMark type-7 HTML block 吞掉后续
 * markdown 语法。
 */
const STRUCTURAL_DOC = `---
name: overview-design-liyy
description: 从客户需求文档自动生成 OA 系统概要设计说明书。
---

<objective>
将客户提供的需求文档自动转换为标准化的概要设计说明书。
</objective>

<essential_principles>
## 核心原则

**1. 大文档处理**
- 检测到文档超过 50 页时自动启用分块模式

| 用户选择 | 路由到 |
|----------|--------|
| 生成 | workflows/generate-overview.md |
| 审查 | workflows/review-output.md |
</essential_principles>

## 正常标题

| 文件 | 用途 |
|------|------|
| template-structure.md | 模板章节结构详解 |
`;

describe("renderMarkdown 未知结构标签", () => {
  it("未知结构标签独占行被清理，后续标题渲染为 h2 而非字面文本", () => {
    const html = renderMarkdown(STRUCTURAL_DOC);
    expect(html).toContain("<h2");
    expect(html).toContain("核心原则");
    expect(html).not.toContain("## 核心原则");
    expect(html).not.toContain("essential_principles");
  });

  it("未知结构标签后的表格渲染为 table，而非被吞成字面源文本", () => {
    const html = renderMarkdown(STRUCTURAL_DOC);
    expect(html).toContain("<table>");
    expect(html).toContain("workflows/generate-overview.md");
    expect(html).not.toContain("|----------|--------|");
    expect(html).not.toContain("| 用户选择 | 路由到 |");
  });

  it("标签行紧随表格时表格不被吞（复刻真实 <routing> 结构）", () => {
    const html = renderMarkdown(
      "<routing>\n| 用户选择 | 路由到 |\n|----------|--------|\n| 生成 | workflows/generate-overview.md |\n</routing>",
    );
    expect(html).toContain("<table>");
    expect(html).toContain("workflows/generate-overview.md");
    expect(html).not.toContain("|----------|--------|");
    expect(html).not.toContain("| 用户选择 | 路由到 |");
  });

  it("开闭标签都算：闭合标签独占行同样被清理", () => {
    const html = renderMarkdown("<objective>\n内容\n</objective>\n\n后续");
    expect(html).not.toContain("objective");
    expect(html).toContain("内容");
    expect(html).toContain("后续");
  });

  it("保留已知 HTML 块标签（div 卡片）不回归", () => {
    const html = renderMarkdown(
      '<div class="card">\n卡片内容\n</div>\n\n后续内容',
    );
    expect(html).toContain('class="card"');
    expect(html).toContain("卡片内容");
    expect(html).toContain("后续内容");
  });

  it("行内未知标签（非独占行）不被误删，正文保留", () => {
    const html = renderMarkdown(
      "这是 <objective>行内标签</objective> 的句子。",
    );
    expect(html).toContain("行内标签");
    expect(html).toContain("的句子");
  });
});
