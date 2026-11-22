import { describe, expect, it } from "vitest";
import {
  isDisplayMath,
  renderMathHtml,
  renderMathInvalidPlaceholder,
  MATH_EMPTY_PLACEHOLDER,
  MATH_INVALID_PLACEHOLDER,
} from "../../lib/math";

describe("isDisplayMath", () => {
  it("含换行为块级", () => {
    expect(isDisplayMath("a\nb")).toBe(true);
  });

  it("含 \\tag 为块级", () => {
    expect(isDisplayMath("a \\tag{1}")).toBe(true);
    expect(isDisplayMath("\\tag{1}")).toBe(true);
  });

  it("以块级环境开头为块级", () => {
    for (const env of [
      "equation",
      "align",
      "gather",
      "split",
      "alignat",
      "CD",
    ]) {
      expect(isDisplayMath(`\\begin{${env}}x\\end{${env}}`)).toBe(true);
    }
  });

  it("前导空白不影响块级环境判定", () => {
    expect(isDisplayMath("  \\begin{align}x\\end{align}")).toBe(true);
  });

  it("\\begin{align*} 不是块级", () => {
    expect(isDisplayMath("\\begin{align*}x\\end{align*}")).toBe(false);
  });

  it("\\begin{equation*} 不是块级", () => {
    expect(isDisplayMath("\\begin{equation*}x\\end{equation*}")).toBe(false);
  });

  it("普通行内 tex 不是块级", () => {
    expect(isDisplayMath("E=mc^2")).toBe(false);
    expect(isDisplayMath("\\frac{1}{2}")).toBe(false);
  });
});

describe("renderMathHtml", () => {
  it("空 tex 显示「添加 LaTeX 公式」且只有一个占位", () => {
    const html = renderMathHtml("", false);
    expect(html).toContain(MATH_EMPTY_PLACEHOLDER);
    expect(html).not.toContain("katex-error");
    expect(html.match(/math-placeholder/g)).toHaveLength(1);
  });

  it("空白 tex 视为空", () => {
    expect(renderMathHtml("   \n  ", true)).toContain(
      MATH_EMPTY_PLACEHOLDER,
    );
  });

  it("无效 tex 显示「无效公式」且无 katex-error 残渣", () => {
    const html = renderMathHtml("\\frac{1}", false);
    expect(html).toContain(MATH_INVALID_PLACEHOLDER);
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("katex");
    expect(html.match(/math-placeholder/g)).toHaveLength(1);
  });

  it("行内公式渲染为 katex", () => {
    const html = renderMathHtml("E=mc^2", false);
    expect(html).toContain("katex");
    expect(html).not.toContain("katex-display");
  });

  it("块级公式渲染为 katex-display", () => {
    const html = renderMathHtml("E=mc^2", true);
    expect(html).toContain("katex-display");
  });

  it("renderMathInvalidPlaceholder 文本严格等于「无效公式」", () => {
    const html = renderMathInvalidPlaceholder();
    expect(html).toContain(MATH_INVALID_PLACEHOLDER);
    expect(html).not.toContain("katex-error");
  });
});
