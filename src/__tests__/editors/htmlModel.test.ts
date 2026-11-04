import { describe, expect, it } from "vitest";
import {
  ANCHOR_ATTR,
  annotate,
  cleanSnapshot,
  listNodes,
} from "../../editors/html/model";

const DOC = `<!DOCTYPE html>
<html><head><style>body{color:red}</style></head>
<body><h1>标题</h1><p>第一段</p><p>第二段</p><img src="a.png"></body></html>`;

describe("HTML 可视化编辑模型（E-16 切片 1）", () => {
  it("同一份 content 解析出的 id 可复现", () => {
    const a = listNodes(DOC);
    const b = listNodes(DOC);
    expect(a).toEqual(b);
    // 同名标签按出现顺序编号，tag:index 稳定
    expect(a.filter((n) => n.tag === "p").map((n) => n.id)).toEqual([
      "p:0",
      "p:1",
    ]);
    expect(a.some((n) => n.id === "h1:0")).toBe(true);
  });

  it("打锚点后每个元素都带 id", () => {
    const out = annotate(DOC);
    expect(out).toContain(`${ANCHOR_ATTR}="h1:0"`);
    expect(out).toContain(`${ANCHOR_ATTR}="p:1"`);
    // 文本节点也有锚点注释
    expect(out).toContain("<!--cmid:t:p:0-->");
  });

  it("纯空白文本不产生锚点", () => {
    const out = annotate("<div>\n  <span>x</span>\n</div>");
    const anchorCount = (out.match(/<!--cmid:/g) ?? []).length;
    // 只有 "x" 一处，缩进空白不锚定
    expect(anchorCount).toBe(2);
  });

  it("清洗后不再有任何编辑期痕迹", () => {
    const dirty = `${annotate(DOC).replace(
      "<body",
      '<body contenteditable="true"',
    )}`.replace(
      "</html>",
      '<style data-cm-internal="1">.x{}</style><script data-cm-internal="1">1</script></html>',
    );
    const clean = cleanSnapshot(dirty);

    expect(clean).not.toContain("data-cm-");
    expect(clean).not.toContain("cmid");
    expect(clean).not.toContain("contenteditable");
    expect(clean).not.toContain("spellcheck");
    // 用户内容本身必须保住
    expect(clean).toContain("标题");
    expect(clean).toContain("第一段");
    expect(clean).toContain("a.png");
  });

  it("清洗是幂等的", () => {
    const once = cleanSnapshot(annotate(DOC));
    expect(cleanSnapshot(once)).toBe(once);
  });
});

describe("raw-text 元素不锚定（回归：CSS 被污染）", () => {
  it("<style> 内容不被插入锚点注释", () => {
    const out = annotate(
      "<html><head><style>body > p { color: red }</style></head><body><p>x</p></body></html>",
    );
    // style 里一个 cmid 都不许有
    const stylePart = out.slice(out.indexOf("<style"), out.indexOf("</style>"));
    expect(stylePart).not.toContain("cmid");
    expect(stylePart).toContain("body > p { color: red }");
  });

  it("<script> 内容不被插入锚点注释", () => {
    const out = annotate(
      "<html><body><script>const a = 1 < 2;</script></body></html>",
    );
    const scriptPart = out.slice(
      out.indexOf("<script>"),
      out.indexOf("</script>"),
    );
    expect(scriptPart).not.toContain("cmid");
  });
});
