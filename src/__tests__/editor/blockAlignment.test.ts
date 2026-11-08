import { describe, expect, it } from "vitest";
import {
  blockAlignmentOf,
  clearBlockAlignment,
  clearBlockAlignmentText,
  toggleBlockAlignment,
  toggleBlockAlignmentText,
} from "../../editors/orchestration/block-alignment";

describe("blockAlignmentOf", () => {
  it("读出左/中/右对齐", () => {
    expect(blockAlignmentOf("::: {.align-left}\n正文\n:::")).toBe("left");
    expect(blockAlignmentOf("::: {.align-center}\n正文\n:::")).toBe("center");
    expect(blockAlignmentOf("::: {.align-right}\n正文\n:::")).toBe("right");
  });

  it("容忍开标记后的空白与闭合标记后的空白", () => {
    expect(blockAlignmentOf("::: {.align-center}  \n正文\n:::  ")).toBe(
      "center",
    );
  });

  it("没有对齐标记 / 半截包裹返回 null", () => {
    expect(blockAlignmentOf("正文")).toBeNull();
    expect(blockAlignmentOf("::: {.align-center}\n正文")).toBeNull();
    expect(blockAlignmentOf("::: {.note}\n正文\n:::")).toBeNull();
  });
});

describe("toggleBlockAlignmentText", () => {
  it("无包裹 → 新包一层", () => {
    expect(toggleBlockAlignmentText("正文", "center")).toBe(
      "::: {.align-center}\n正文\n:::",
    );
  });

  it("同对齐 → 拆掉包裹（切换取消）", () => {
    expect(
      toggleBlockAlignmentText("::: {.align-center}\n正文\n:::", "center"),
    ).toBe("正文");
  });

  it("异对齐 → 换类名，内容不变", () => {
    expect(
      toggleBlockAlignmentText("::: {.align-center}\n正文\n:::", "right"),
    ).toBe("::: {.align-right}\n正文\n:::");
  });

  it("多行内容原样保留", () => {
    expect(toggleBlockAlignmentText("第一行\n第二行", "left")).toBe(
      "::: {.align-left}\n第一行\n第二行\n:::",
    );
  });

  it("空块原样返回", () => {
    expect(toggleBlockAlignmentText("", "center")).toBe("");
  });
});

describe("clearBlockAlignmentText", () => {
  it("拆掉包裹", () => {
    expect(clearBlockAlignmentText("::: {.align-right}\n正文\n:::")).toBe(
      "正文",
    );
  });

  it("没有包裹原样返回", () => {
    expect(clearBlockAlignmentText("正文")).toBe("正文");
  });
});

describe("toggleBlockAlignment / clearBlockAlignment（文档级）", () => {
  const DOC = "# 标题\n\n正文段落\n\n结尾\n";

  it("只改目标块，其余字节逐字不变", () => {
    const from = DOC.indexOf("正文段落");
    const to = from + "正文段落".length;
    expect(toggleBlockAlignment(DOC, from, to, "center")).toBe(
      "# 标题\n\n::: {.align-center}\n正文段落\n:::\n\n结尾\n",
    );
  });

  it("往返：应用后再应用同对齐回到原文", () => {
    const from = DOC.indexOf("正文段落");
    const to = from + "正文段落".length;
    const applied = toggleBlockAlignment(DOC, from, to, "center")!;
    const blockFrom = applied.indexOf("::: {.align-center}");
    const blockTo = applied.lastIndexOf(":::") + 3;
    expect(toggleBlockAlignment(applied, blockFrom, blockTo, "center")).toBe(
      DOC,
    );
  });

  it("清除对齐回到原文", () => {
    const from = DOC.indexOf("正文段落");
    const to = from + "正文段落".length;
    const applied = toggleBlockAlignment(DOC, from, to, "center")!;
    const blockFrom = applied.indexOf("::: {.align-center}");
    const blockTo = applied.lastIndexOf(":::") + 3;
    expect(clearBlockAlignment(applied, blockFrom, blockTo)).toBe(DOC);
  });

  it("范围非法 / 空块原样返回", () => {
    expect(toggleBlockAlignment(DOC, 5, 5, "center")).toBe(DOC);
    expect(clearBlockAlignment(DOC, 0, 0)).toBe(DOC);
  });
});
