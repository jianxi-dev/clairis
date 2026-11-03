import { describe, expect, it } from "vitest";
import {
  calloutKeyOf,
  changeCalloutType,
  computeBlockDelete,
  computeBlockDuplicate,
  indentBlock,
  outdentBlock,
} from "../../editors/orchestration/block-actions";

const DOC = "第一段\n\n第二段\n\n第三段\n";

describe("computeBlockDuplicate", () => {
  it("在块后就地复制一份，其余字节不变", () => {
    const from = DOC.indexOf("第二段");
    const to = from + "第二段".length;
    expect(computeBlockDuplicate(DOC, from, to)).toBe(
      "第一段\n\n第二段\n\n第二段\n\n第三段\n",
    );
  });

  it("空块不产生副本", () => {
    expect(computeBlockDuplicate("a\n\n\n\nb", 3, 3)).toBe("a\n\n\n\nb");
  });

  it("文档结尾换行保持原状", () => {
    const out = computeBlockDuplicate("只有一段\n", 0, 4);
    expect(out.endsWith("\n")).toBe(true);
    expect(out).toBe("只有一段\n\n只有一段\n");
  });
});

describe("computeBlockDelete", () => {
  it("删掉目标块，接缝处只留一个空行", () => {
    const from = DOC.indexOf("第二段");
    const to = from + "第二段".length;
    expect(computeBlockDelete(DOC, from, to)).toBe("第一段\n\n第三段\n");
  });

  it("删掉唯一一块得到空文档", () => {
    expect(computeBlockDelete("唯一\n", 0, 2)).toBe("");
  });

  it("范围非法时原样返回", () => {
    expect(computeBlockDelete(DOC, 5, 5)).toBe(DOC);
  });
});

describe("缩进", () => {
  it("每行加两个空格，空行不加", () => {
    expect(indentBlock("a\n\nb")).toBe("  a\n\n  b");
  });

  it("减少缩进最多剥两个空格", () => {
    expect(outdentBlock("    a\n  b\nc")).toBe("  a\nb\nc");
  });

  it("缩进后再减缩进回到原样", () => {
    expect(outdentBlock(indentBlock("a\nb"))).toBe("a\nb");
  });
});

describe("高亮块类型", () => {
  const CALLOUT = "> [!note] 标题\n> 正文一行\n";

  it("识别当前类型", () => {
    expect(calloutKeyOf(CALLOUT)).toBe("note");
    expect(calloutKeyOf("普通段落")).toBeNull();
  });

  it("只改类型标记，正文逐字保留", () => {
    expect(changeCalloutType(CALLOUT, "tip")).toBe(
      "> [!tip] 标题\n> 正文一行\n",
    );
  });

  it("非高亮块原样返回", () => {
    expect(changeCalloutType("普通段落\n", "tip")).toBe("普通段落\n");
  });
});
