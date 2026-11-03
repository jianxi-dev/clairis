/**
 * 块手柄纯函数测试（md-orchestration 1.2）。
 *
 * `blockHandleIcon` 钉死块型 → 图标名映射；`moveBlock` 钉死前移 / 后移 / 首尾 /
 * 相邻 / 目标在块内 / 空文档的字节结果。无 DOM、无定时器。
 */
import { describe, expect, it } from "vitest";
import {
  blockHandleIcon,
  moveBlock,
} from "../../editors/orchestration/block-handle";

describe("blockHandleIcon", () => {
  it("映射表格 / 列表 / 高亮 / 代码 / 图片 / 引用 / 段落 / 分割线 / 任务", () => {
    expect(blockHandleIcon("table")).toBe("DataSheetOutlined");
    expect(blockHandleIcon("list")).toBe("DisorderListOutlined");
    expect(blockHandleIcon("callout")).toBe("CalloutOutlined");
    expect(blockHandleIcon("fencedCode")).toBe("CodeblockOutlined");
    expect(blockHandleIcon("codeBlock")).toBe("CodeblockOutlined");
    expect(blockHandleIcon("image")).toBe("ImageOutlined");
    expect(blockHandleIcon("blockquote")).toBe("ReferenceOutlined");
    expect(blockHandleIcon("paragraph")).toBe("FormatParagraphOutlined");
    expect(blockHandleIcon("thematicBreak")).toBe("DividerOutlined");
    expect(blockHandleIcon("task")).toBe("TodoOutlined");
  });

  it("标题按首行级别取 H1–H6，不退化成一个把手", () => {
    for (let level = 1; level <= 6; level += 1) {
      const firstLine = `${"#".repeat(level)} 标题`;
      expect(blockHandleIcon("heading", firstLine)).toBe(`H${level}Outlined`);
    }
    // 拿不到首行时不猜
    expect(blockHandleIcon("heading")).toBe("DragHandleOutlined");
  });

  it("列表按首行区分有序 / 无序", () => {
    expect(blockHandleIcon("list", "1. 第一项")).toBe("OrderListOutlined");
    expect(blockHandleIcon("list", "  12. 缩进项")).toBe("OrderListOutlined");
    expect(blockHandleIcon("list", "- 无序项")).toBe("DisorderListOutlined");
  });

  it("仍无对应图标的块型退化为拖拽把手", () => {
    for (const type of ["htmlBlock", "yamlFrontMatter", "", "unknown"]) {
      expect(blockHandleIcon(type)).toBe("DragHandleOutlined");
    }
  });
});

describe("moveBlock", () => {
  // "A\n\nB\n\nC"：A=[0,1) B=[3,4) C=[6,7)
  const DOC = "A\n\nB\n\nC";

  it("前移：把最后一块移到最前", () => {
    expect(moveBlock(DOC, { from: 6, to: 7 }, { from: 0 })).toBe("C\n\nA\n\nB");
  });

  it("后移：把第一块移到最后", () => {
    expect(moveBlock(DOC, { from: 0, to: 1 }, { from: DOC.length })).toBe(
      "B\n\nC\n\nA",
    );
  });

  it("首尾：第一块与最后一块互换", () => {
    expect(moveBlock(DOC, { from: 0, to: 1 }, { from: DOC.length })).toBe(
      "B\n\nC\n\nA",
    );
    expect(moveBlock(DOC, { from: 6, to: 7 }, { from: 0 })).toBe("C\n\nA\n\nB");
  });

  it("相邻：移到紧邻块之前不改变顺序", () => {
    // A 移到 B 之前：A 本就在 B 之前。
    expect(moveBlock(DOC, { from: 0, to: 1 }, { from: 3 })).toBe(DOC);
    // C 移到 B 之前：C 本就在 B 之后。
    expect(moveBlock(DOC, { from: 6, to: 7 }, { from: 3 })).toBe("A\n\nC\n\nB");
  });

  it("目标在块内返回原文", () => {
    expect(moveBlock(DOC, { from: 3, to: 4 }, { from: 3 })).toBe(DOC);
    expect(moveBlock(DOC, { from: 0, to: 1 }, { from: 0 })).toBe(DOC);
  });

  it("空文档返回空串", () => {
    expect(moveBlock("", { from: 0, to: 0 }, { from: 0 })).toBe("");
  });

  it("空块返回原文", () => {
    expect(moveBlock(DOC, { from: 2, to: 2 }, { from: 0 })).toBe(DOC);
  });

  it("目标越界时夹到文档末尾", () => {
    expect(moveBlock(DOC, { from: 0, to: 1 }, { from: 999 })).toBe(
      "B\n\nC\n\nA",
    );
  });

  it("两段交换：第二段移到第一段之前", () => {
    const doc = "第一段\n\n第二段";
    expect(moveBlock(doc, { from: 5, to: 8 }, { from: 0 })).toBe(
      "第二段\n\n第一段",
    );
  });

  it("保留块内多行与其它块的内容", () => {
    const doc = "one\ntwo\n\nthree";
    // "one\ntwo" = [0,7)，"three" = [9,14)
    expect(moveBlock(doc, { from: 9, to: 14 }, { from: 0 })).toBe(
      "three\n\none\ntwo",
    );
  });
});
