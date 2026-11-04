import { describe, expect, it } from "vitest";
import { applyBlockSplit, applyTextEdit } from "../../editors/html/edit";

const DOC = `<!DOCTYPE html>
<html><head><style>p{color:red}</style></head>
<body><h1>标题</h1><p>第一段</p></body></html>`;

describe("文本编辑折算回 content（E-16 切片 4）", () => {
  it("改文本只动目标节点，其余内容与结构不变", () => {
    const out = applyTextEdit(DOC, "p:0", "改过了");
    expect(out).toContain("改过了");
    expect(out).not.toContain("第一段");
    expect(out).toContain("标题");
    // 用户样式不能被编辑流程吃掉
    expect(out).toContain("p{color:red}");
  });

  it("输入里的尖括号被转义，不会变成标签", () => {
    const out = applyTextEdit(DOC, "p:0", "<script>alert(1)</script>");
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("编辑结果里没有任何编辑期痕迹", () => {
    const out = applyTextEdit(DOC, "p:0", "x");
    expect(out).not.toContain("data-cm-");
    expect(out).not.toContain("cmid");
    expect(out).not.toContain("contenteditable");
  });

  it("节点不存在时原样返回（不做无根据猜测）", () => {
    expect(applyTextEdit(DOC, "p:99", "x")).toBe(DOC);
  });

  it("Enter 拆块：中间切开，两段都有内容", () => {
    const out = applyBlockSplit(DOC, "p:0", "第一", "段");
    expect((out.match(/<p/g) ?? []).length).toBe(2);
    expect(out).toContain("第一");
    expect(out).toContain("段");
  });

  it("半段为空不拆（光标在首/尾）", () => {
    expect(applyBlockSplit(DOC, "p:0", "", "第一段")).toBe(DOC);
    expect(applyBlockSplit(DOC, "p:0", "第一段", "")).toBe(DOC);
  });

  it("行内元素不拆块", () => {
    const inline = `<!DOCTYPE html><html><body><p>a<span>bc</span></p></body></html>`;
    const out = applyBlockSplit(inline, "span:0", "b", "c");
    expect(out).toBe(inline);
  });
});
