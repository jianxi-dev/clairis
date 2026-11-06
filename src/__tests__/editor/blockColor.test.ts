import { describe, expect, it } from "vitest";
import {
  applyBlockColor,
  blockColorOf,
  wrapColorLine,
} from "../../editors/orchestration/block-color";

describe("wrapColorLine", () => {
  it("段落整行包裹", () => {
    expect(wrapColorLine("第一段正文", "mdb-color-red")).toBe(
      '<span class="mdb-color-red">第一段正文</span>',
    );
  });

  it("标题标记留在 span 外（否则 marked 当成 HTML 块，# 失效）", () => {
    expect(wrapColorLine("# 标题", "mdb-color-red")).toBe(
      '# <span class="mdb-color-red">标题</span>',
    );
    expect(wrapColorLine("## 二级", "mdb-bg-blue")).toBe(
      '## <span class="mdb-bg-blue">二级</span>',
    );
  });

  it("列表 / 待办 / 引用标记留在 span 外，缩进保留", () => {
    expect(wrapColorLine("- 一项", "mdb-color-red")).toBe(
      '- <span class="mdb-color-red">一项</span>',
    );
    expect(wrapColorLine("1. 有序", "mdb-color-red")).toBe(
      '1. <span class="mdb-color-red">有序</span>',
    );
    expect(wrapColorLine("- [ ] 待办", "mdb-color-red")).toBe(
      '- [ ] <span class="mdb-color-red">待办</span>',
    );
    expect(wrapColorLine("> 引用", "mdb-color-red")).toBe(
      '> <span class="mdb-color-red">引用</span>',
    );
    expect(wrapColorLine("  - 嵌套项", "mdb-color-red")).toBe(
      '  - <span class="mdb-color-red">嵌套项</span>',
    );
  });

  it("空行与纯标记行不包", () => {
    expect(wrapColorLine("", "mdb-color-red")).toBe("");
    expect(wrapColorLine("   ", "mdb-color-red")).toBe("   ");
    expect(wrapColorLine("#", "mdb-color-red")).toBe("#");
  });
});

describe("applyBlockColor 包裹", () => {
  it("段落：整块包一层 span", () => {
    expect(
      applyBlockColor("第一段正文", "paragraph", "mdb-color", "mdb-color-red"),
    ).toBe('<span class="mdb-color-red">第一段正文</span>');
  });

  it("标题：标记在外，内容进 span", () => {
    expect(
      applyBlockColor("# 标题", "heading", "mdb-color", "mdb-color-red"),
    ).toBe('# <span class="mdb-color-red">标题</span>');
  });

  it("多行列表：每行各自包裹", () => {
    expect(
      applyBlockColor("- 一项\n- 二项", "list", "mdb-color", "mdb-color-red"),
    ).toBe(
      '- <span class="mdb-color-red">一项</span>\n- <span class="mdb-color-red">二项</span>',
    );
  });

  it("多行段落：每行各自包裹（软换行语义不变）", () => {
    expect(
      applyBlockColor("第一行\n第二行", "paragraph", "mdb-bg", "mdb-bg-blue"),
    ).toBe(
      '<span class="mdb-bg-blue">第一行</span>\n<span class="mdb-bg-blue">第二行</span>',
    );
  });

  it("背景色与字体色各自独立包裹（异族嵌套，互不影响）", () => {
    const red = applyBlockColor(
      "段落",
      "paragraph",
      "mdb-color",
      "mdb-color-red",
    );
    expect(red).toBe('<span class="mdb-color-red">段落</span>');
    expect(applyBlockColor(red!, "paragraph", "mdb-bg", "mdb-bg-blue")).toBe(
      '<span class="mdb-bg-blue"><span class="mdb-color-red">段落</span></span>',
    );
  });
});

describe("applyBlockColor 换色与幂等", () => {
  it("同族异色：换类名，包裹结构不变", () => {
    const red = '<span class="mdb-color-red">段落</span>';
    expect(
      applyBlockColor(red, "paragraph", "mdb-color", "mdb-color-blue"),
    ).toBe('<span class="mdb-color-blue">段落</span>');
  });

  it("同族同色：返回 null（幂等，不产生事务）", () => {
    const red = '<span class="mdb-color-red">段落</span>';
    expect(
      applyBlockColor(red, "paragraph", "mdb-color", "mdb-color-red"),
    ).toBeNull();
  });

  it("换标题色：只换开口标签，标记不动", () => {
    const red = '# <span class="mdb-color-red">标题</span>';
    expect(applyBlockColor(red, "heading", "mdb-color", "mdb-color-blue")).toBe(
      '# <span class="mdb-color-blue">标题</span>',
    );
  });

  it("异族换色不影响已包裹的另一族", () => {
    const both =
      '<span class="mdb-bg-blue"><span class="mdb-color-red">段落</span></span>';
    expect(
      applyBlockColor(both, "paragraph", "mdb-color", "mdb-color-green"),
    ).toBe(
      '<span class="mdb-bg-blue"><span class="mdb-color-green">段落</span></span>',
    );
  });
});

describe("applyBlockColor 清除", () => {
  it("空 className 剥掉该族包裹", () => {
    expect(
      applyBlockColor(
        '<span class="mdb-color-red">段落</span>',
        "paragraph",
        "mdb-color",
        "",
      ),
    ).toBe("段落");
  });

  it("清除多行列表的每一行包裹", () => {
    const wrapped =
      '- <span class="mdb-color-red">一项</span>\n- <span class="mdb-color-red">二项</span>';
    expect(applyBlockColor(wrapped, "list", "mdb-color", "")).toBe(
      "- 一项\n- 二项",
    );
  });

  it("清除标题色保留 # 标记", () => {
    expect(
      applyBlockColor(
        '# <span class="mdb-color-red">标题</span>',
        "heading",
        "mdb-color",
        "",
      ),
    ).toBe("# 标题");
  });

  it("没有该族包裹时清除返回 null", () => {
    expect(applyBlockColor("段落", "paragraph", "mdb-color", "")).toBeNull();
  });

  it("清字体色保留背景色包裹", () => {
    const both =
      '<span class="mdb-bg-blue"><span class="mdb-color-red">段落</span></span>';
    expect(applyBlockColor(both, "paragraph", "mdb-color", "")).toBe(
      '<span class="mdb-bg-blue">段落</span>',
    );
  });
});

describe("applyBlockColor 结构块跳过", () => {
  it("代码块 / 表格 / 分割线不包裹，返回 null", () => {
    const code = "```js\ncode()\n```";
    expect(
      applyBlockColor(code, "fencedCode", "mdb-color", "mdb-color-red"),
    ).toBeNull();
    const table = "| a | b |\n| - | - |\n| 1 | 2 |";
    expect(applyBlockColor(table, "table", "mdb-bg", "mdb-bg-blue")).toBeNull();
    expect(
      applyBlockColor("---", "thematicBreak", "mdb-color", "mdb-color-red"),
    ).toBeNull();
  });

  it("空块返回 null", () => {
    expect(
      applyBlockColor("", "paragraph", "mdb-color", "mdb-color-red"),
    ).toBeNull();
  });
});

describe("blockColorOf", () => {
  it("读出已有类名", () => {
    expect(
      blockColorOf('<span class="mdb-color-red">段落</span>', "mdb-color"),
    ).toBe("mdb-color-red");
    expect(
      blockColorOf('- <span class="mdb-bg-blue">项</span>', "mdb-bg"),
    ).toBe("mdb-bg-blue");
  });

  it("没有对应包裹返回 null", () => {
    expect(blockColorOf("段落", "mdb-color")).toBeNull();
    expect(
      blockColorOf('<span class="mdb-color-red">段落</span>', "mdb-bg"),
    ).toBeNull();
  });
});
