import { describe, expect, it } from "vitest";
import {
  applyAttrPatch,
  applyBlockSplit,
  applyInnerHtml,
  applyNodeMove,
  applyNodeRemove,
  applyStylePatch,
  applyTagReplace,
  applyTextEdit,
  describeNode,
  nodeKindOf,
  toggleDecoration,
} from "../../editors/html/edit";

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

describe("工具条：换标签（E-19）", () => {
  it("换标签保留文本与子树", () => {
    const out = applyTagReplace(DOC, "h1:0", "h2").content;
    expect(out).toContain("<h2>标题</h2>");
    expect(out).not.toContain("<h1");
  });

  it("属性跟着元素走", () => {
    const src = `<!DOCTYPE html><html><body><p class="lead" id="x">文</p></body></html>`;
    const out = applyTagReplace(src, "p:0", "h3").content;
    expect(out).toContain('<h3 class="lead" id="x">文</h3>');
  });

  it("白名单之外的标签原样返回", () => {
    expect(applyTagReplace(DOC, "p:0", "table")).toEqual({
      content: DOC,
      nodeId: "p:0",
    });
    expect(applyTagReplace(DOC, "p:0", "script")).toEqual({
      content: DOC,
      nodeId: "p:0",
    });
  });

  it("同标签不动（避免无意义的整体重排）", () => {
    expect(applyTagReplace(DOC, "p:0", "p")).toEqual({
      content: DOC,
      nodeId: "p:0",
    });
  });

  it("返回新 nodeId——工具条靠它保持选中", () => {
    expect(applyTagReplace(DOC, "h1:0", "h2").nodeId).toBe("h2:0");
    const src = `<!DOCTYPE html><html><body><h2>a</h2><p>x</p><h2>b</h2></body></html>`;
    // 换完夹在两个既有 h2 之间，序号必须是 1（与 annotate 的遍历计数一致）
    expect(applyTagReplace(src, "p:0", "h2").nodeId).toBe("h2:1");
  });

  it("产物无编辑期痕迹", () => {
    const out = applyTagReplace(DOC, "p:0", "div").content;
    expect(out).not.toContain("data-cm-");
    expect(out).not.toContain("cmid");
    expect(out).not.toContain("contenteditable");
  });
});

describe("工具条：改样式（E-19）", () => {
  it("写入 inline style 并保留既有样式", () => {
    const src = `<!DOCTYPE html><html><body><p style="color: red">字</p></body></html>`;
    const out = applyStylePatch(src, "p:0", {
      "font-size": "24px",
      "text-align": "center",
    });
    expect(out).toContain("font-size: 24px");
    expect(out).toContain("text-align: center");
    expect(out).toContain("color: red");
  });

  it("清空某项只删该项，其它保留", () => {
    const src = `<!DOCTYPE html><html><body><p style="font-size: 24px; color: red">字</p></body></html>`;
    const out = applyStylePatch(src, "p:0", { "font-size": null });
    expect(out).not.toContain("font-size");
    expect(out).toContain("color: red");
  });

  it("全部清空后不留空的 style 属性", () => {
    const src = `<!DOCTYPE html><html><body><p style="color: red">字</p></body></html>`;
    const out = applyStylePatch(src, "p:0", { color: null });
    expect(out).not.toContain("style=");
    expect(out).not.toContain("color");
  });

  it("值未变化时原样返回", () => {
    const src = `<!DOCTYPE html><html><body><p style="color: red">字</p></body></html>`;
    expect(applyStylePatch(src, "p:0", { color: "red" })).toBe(src);
  });
});

describe("工具条：改属性（E-19）", () => {
  it("写入 class 与 id", () => {
    const out = applyAttrPatch(DOC, "p:0", { class: "lead", id: "intro" });
    expect(out).toContain('class="lead"');
    expect(out).toContain('id="intro"');
  });

  it("空值删除属性，不留空壳", () => {
    const src = `<!DOCTYPE html><html><body><p class="lead">字</p></body></html>`;
    const out = applyAttrPatch(src, "p:0", { class: "" });
    expect(out).not.toContain("class=");
    expect(out).toContain("<p>字</p>");
  });

  it("非法属性名与编辑期属性被忽略", () => {
    const src = `<!DOCTYPE html><html><body><p>字</p></body></html>`;
    expect(applyAttrPatch(src, "p:0", { "on click": "x" })).toBe(src);
    expect(applyAttrPatch(src, "p:0", { "data-cm-node-id": "x" })).toBe(src);
    expect(applyAttrPatch(src, "p:0", { contenteditable: "true" })).toBe(src);
  });
});

describe("describeNode：工具条显示真值（E-19）", () => {
  it("读出标签、属性与内联样式", () => {
    const src = `<!DOCTYPE html><html><body><p class="lead" style="font-size: 24px; color: red">字</p></body></html>`;
    const info = describeNode(src, "p:0");
    expect(info?.tag).toBe("p");
    expect(info?.attrs.class).toBe("lead");
    expect(info?.style["font-size"]).toBe("24px");
    expect(info?.style.color).toBe("red");
    // 锚点属性不算用户属性
    expect(
      Object.keys(info?.attrs ?? {}).some((k) => k.startsWith("data-cm-")),
    ).toBe(false);
  });

  it("节点不存在返回 null", () => {
    expect(describeNode(DOC, "p:99")).toBeNull();
  });
});

describe("拖拽移动（E-20）", () => {
  const TWO = `<!DOCTYPE html><html><body><section><p>第一段</p><p>第二段</p></section></body></html>`;

  it("挪到目标之前：顺序真的换了", () => {
    const out = applyNodeMove(TWO, "p:1", "p:0", "before");
    expect(out.indexOf("第二段")).toBeLessThan(out.indexOf("第一段"));
    expect((out.match(/<p>/g) ?? []).length).toBe(2);
    expect(out).toContain("<section>");
  });

  it("挪到目标之后", () => {
    const out = applyNodeMove(TWO, "p:0", "p:1", "after");
    expect(out.indexOf("第一段")).toBeGreaterThan(out.indexOf("第二段"));
  });

  it("拒绝把容器拖进自己的子树（否则整棵子树消失）", () => {
    const nested = `<!DOCTYPE html><html><body><div><p>里面</p></div></body></html>`;
    expect(applyNodeMove(nested, "div:0", "p:0", "before")).toBe(nested);
    expect(applyNodeMove(nested, "div:0", "div:0", "after")).toBe(nested);
  });

  it("目标不存在时原样返回", () => {
    expect(applyNodeMove(TWO, "p:0", "p:99", "before")).toBe(TWO);
  });

  it("产物无编辑期痕迹", () => {
    const out = applyNodeMove(TWO, "p:1", "p:0", "before");
    expect(out).not.toContain("data-cm-");
    expect(out).not.toContain("cmid");
  });
});

describe("工具条按节点类型分化（E-22）", () => {
  it("文本标签归 text，容器归 block，未知按文本", () => {
    for (const tag of ["p", "h2", "span", "li", "blockquote", "td"]) {
      expect(nodeKindOf(tag)).toBe("text");
    }
    for (const tag of ["div", "section", "article", "ul", "figure", "table"]) {
      expect(nodeKindOf(tag)).toBe("block");
    }
    expect(nodeKindOf("custom-thing")).toBe("text");
    expect(nodeKindOf("DIV")).toBe("block");
  });

  it("下划线与删除线共享 text-decoration，不互相覆盖", () => {
    expect(toggleDecoration(undefined, "underline")).toBe("underline");
    expect(toggleDecoration("underline", "line-through")).toBe(
      "underline line-through",
    );
    expect(toggleDecoration("underline line-through", "underline")).toBe(
      "line-through",
    );
    expect(toggleDecoration("underline", "underline")).toBeNull();
    // `none` 是初值，不能被当成一个 token 留下来
    expect(toggleDecoration("none", "underline")).toBe("underline");
  });

  it("文字选区格式化只替换目标节点的 innerHTML", () => {
    const out = applyInnerHtml(
      DOC,
      "p:0",
      '<span style="font-weight:bold">第一段</span>',
    );
    expect(out).toContain('<span style="font-weight:bold">第一段</span>');
    expect(out).toContain("<h1>标题</h1>");
    expect(out).not.toContain("data-cm-");
    expect(out).not.toContain("contenteditable");
  });

  it("删除节点连同子树", () => {
    const src = `<!DOCTYPE html><html><body><div id="a"><p>x</p></div><p>留</p></body></html>`;
    const out = applyNodeRemove(src, "div:0");
    expect(out).not.toContain('id="a"');
    expect(out).toContain("留");
  });

  it("不删 html / body——那等于清空整篇文档", () => {
    const src = `<!DOCTYPE html><html><body><p>x</p></body></html>`;
    expect(applyNodeRemove(src, "body:0")).toBe(src);
    expect(applyNodeRemove(src, "html:0")).toBe(src);
  });

  it("删除后无编辑期痕迹", () => {
    const out = applyNodeRemove(DOC, "p:0");
    expect(out).not.toContain("data-cm-");
    expect(out).not.toContain("cmid:");
  });
});
