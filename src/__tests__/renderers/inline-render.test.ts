import { describe, it, expect } from "vitest";
import { renderInlineWithHit } from "../../renderers/inline";

describe("renderInlineWithHit 行内语义", () => {
  it("渲染加粗 / 斜体 / 行内代码为语义标签", () => {
    expect(renderInlineWithHit("**加粗**")).toBe("<b>加粗</b>");
    expect(renderInlineWithHit("*斜体*")).toBe("<i>斜体</i>");
    expect(renderInlineWithHit("`代码`")).toBe("<code>代码</code>");
  });

  it("剥离行首块级源码符号（标题 / 引用 / 列表），不渲染块级", () => {
    expect(renderInlineWithHit("# 标题")).toBe("标题");
    expect(renderInlineWithHit("## 二标题")).toBe("二标题");
    expect(renderInlineWithHit("> 引用")).toBe("引用");
    expect(renderInlineWithHit("- 无序项")).toBe("无序项");
    expect(renderInlineWithHit("1. 有序项")).toBe("有序项");
  });

  it("多行片段逐行剥离块级符号并保留换行", () => {
    expect(renderInlineWithHit("# 标题\n正文 **加粗**")).toBe(
      "标题\n正文 <b>加粗</b>",
    );
  });

  it("输出不含 ** 与 # 源码符号字面量", () => {
    const out = renderInlineWithHit("**加粗**\n# 标题");
    expect(out).toBe("<b>加粗</b>\n标题");
    expect(out).not.toContain("**");
    expect(out).not.toContain("#");
  });
});

describe("renderInlineWithHit 命中区间", () => {
  it("命中在加粗内部时 mark 包裹命中子串", () => {
    // **加粗词** → 索引 4 起为「词」
    expect(renderInlineWithHit("**加粗词**", { from: 4, to: 5 })).toBe(
      "<b>加粗<mark>词</mark></b>",
    );
  });

  it("命中在行内代码内部时 mark 包裹命中子串", () => {
    // `代码词` → 索引 2 起为「码词」
    expect(renderInlineWithHit("`代码词`", { from: 2, to: 4 })).toBe(
      "<code>代<mark>码词</mark></code>",
    );
  });

  it("命中在斜体内部时 mark 包裹命中子串", () => {
    expect(renderInlineWithHit("*斜体词*", { from: 1, to: 3 })).toBe(
      "<i><mark>斜体</mark>词</i>",
    );
  });

  it("命中整个语法块时 mark 在语义标签外层", () => {
    expect(renderInlineWithHit("**加粗**", { from: 2, to: 4 })).toBe(
      "<b><mark>加粗</mark></b>",
    );
  });

  it("命中跨越普通文本与加粗边界时不错位", () => {
    // "前**加粗**后"：命中「加粗」（含 ** 标记内侧文字）
    expect(renderInlineWithHit("前**加粗**后", { from: 3, to: 5 })).toBe(
      "前<b><mark>加粗</mark></b>后",
    );
  });

  it("越界命中被钳制，不产生空 mark", () => {
    expect(renderInlineWithHit("纯文本", { from: 100, to: 200 })).toBe(
      "纯文本",
    );
    expect(renderInlineWithHit("**加粗**", { from: 0, to: 0 })).toBe(
      "<b>加粗</b>",
    );
  });
});

describe("renderInlineWithHit 转义安全", () => {
  it("<script> 不被激活", () => {
    const out = renderInlineWithHit("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("<img onerror> 不被激活", () => {
    const out = renderInlineWithHit("<img src=x onerror=alert(1)>");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });

  it("命中区间内的尖括号同样先转义", () => {
    const out = renderInlineWithHit("a <b> c", { from: 2, to: 3 });
    expect(out).toBe("a <mark>&lt;</mark>b&gt; c");
  });

  it("占位符字符与原文碰撞时被实体化，不产生伪 mark", () => {
    const out = renderInlineWithHit("\uE000普通\uE001");
    expect(out).not.toContain("<mark>");
    expect(out).toContain("&#xE000;");
    expect(out).toContain("&#xE001;");
  });
});

describe("renderInlineWithHit 命中与行内分隔符重叠", () => {
  it("命中边界落进 ** 分隔符内部：钳制到内容区间，不产生非法嵌套", () => {
    expect(renderInlineWithHit("**加粗**", { from: 1, to: 4 })).toBe(
      "<b><mark>加粗</mark></b>",
    );
    expect(renderInlineWithHit("**加粗**", { from: 2, to: 6 })).toBe(
      "<b><mark>加粗</mark></b>",
    );
  });

  it("命中边界落进 ` 分隔符内部：钳制到内容区间", () => {
    expect(renderInlineWithHit("`code`", { from: 0, to: 3 })).toBe(
      "<code><mark>co</mark>de</code>",
    );
  });

  it("命中完全落在分隔符上（查询 **）：token 正常渲染，不产 mark", () => {
    const out = renderInlineWithHit("**加粗**", { from: 0, to: 2 });
    expect(out).toBe("<b>加粗</b>");
    expect(out).not.toContain("<mark>");
  });

  it("命中跨纯文本与 token 内容：两段各自 mark，嵌套合法", () => {
    expect(renderInlineWithHit("a**b**c", { from: 0, to: 4 })).toBe(
      "<mark>a</mark><b><mark>b</mark></b>c",
    );
  });
});

describe("renderInlineWithHit 块级符号命中边界", () => {
  it("命中完全落在被剥离的行首块级符号内：无 mark 且无源码符号", () => {
    const out = renderInlineWithHit("# 标题", { from: 0, to: 1 });
    expect(out).toBe("标题");
    expect(out).not.toContain("<mark>");
    expect(out).not.toContain("#");
  });
});

describe("renderInlineWithHit 预览态扩展构造", () => {
  it("链接 / 图片只留语义文本，括号与 URL 不出现", () => {
    expect(renderInlineWithHit("[命中的链接](https://example.com)")).toBe(
      '<span class="sf-link">命中的链接</span>',
    );
    expect(renderInlineWithHit("![命中的图片](a.png)")).toBe(
      '<span class="sf-media">命中的图片</span>',
    );
    expect(renderInlineWithHit("![](a.png)")).toBe(
      '<span class="sf-media">图片</span>',
    );
  });

  it("删除线 / 脚注引用按语义呈现", () => {
    expect(renderInlineWithHit("~~命中的删除~~")).toBe("<del>命中的删除</del>");
    expect(renderInlineWithHit("命中的脚注[^1]")).toBe(
      '命中的脚注<sup class="sf-footnote">1</sup>',
    );
    expect(renderInlineWithHit("[^1]: 脚注说明")).toBe("脚注说明");
  });

  it("任务复选框剥成预览态方框，选中态填色", () => {
    expect(renderInlineWithHit("- [ ] 命中的任务")).toBe(
      '<span class="sf-task" aria-hidden="true"><span class="sf-check"></span></span>命中的任务',
    );
    expect(renderInlineWithHit("- [x] 命中的任务")).toBe(
      '<span class="sf-task" aria-hidden="true"><span class="sf-check on"></span></span>命中的任务',
    );
  });

  it("表格渲染为 table：对齐行丢弃、竖线消失、表头仅一行", () => {
    const out = renderInlineWithHit(
      ["| 列A | 列B |", "| --- | --- |", "| 命中的单元格 | 值 |"].join("\n"),
    );
    expect(out).toBe(
      "<table><thead><tr><th>列A</th><th>列B</th></tr></thead>" +
        "<tbody><tr><td>命中的单元格</td><td>值</td></tr></tbody></table>",
    );
    expect(out).not.toContain("|");
    expect(out).not.toContain("---");
  });

  it("命中落进链接 / 删除线 / 表格单元格时 mark 包裹命中子串", () => {
    expect(renderInlineWithHit("[命中的链接](u)", { from: 1, to: 3 })).toBe(
      '<span class="sf-link"><mark>命中</mark>的链接</span>',
    );
    expect(renderInlineWithHit("~~命中的删除~~", { from: 2, to: 4 })).toBe(
      "<del><mark>命中</mark>的删除</del>",
    );
    expect(
      renderInlineWithHit("| 命中 | 值 |\n| --- | --- |\n| 甲 | 乙 |", {
        from: 2,
        to: 4,
      }),
    ).toContain("<th><mark>命中</mark></th>");
  });

  it("围栏内的竖线行不按表格处理", () => {
    const out = renderInlineWithHit("```\n| a | b |\n```");
    expect(out).not.toContain("<table>");
    expect(out).not.toContain("```");
  });

  it("多行片段：命中落在后续行的加粗内仍包裹命中子串", () => {
    // 第 2 行「正文 **加粗命中**」中「命中」的绝对偏移为 12..14
    expect(
      renderInlineWithHit("# 标题\n正文 **加粗命中**", { from: 12, to: 14 }),
    ).toBe("标题\n正文 <b>加粗<mark>命中</mark></b>");
  });
});
