/**
 * 块手柄纯函数测试（md-orchestration 1.2）。
 *
 * `blockHandleIcon` 钉死块型 → 图标名映射；`moveBlock` 钉死前移 / 后移 / 首尾 /
 * 相邻 / 目标在块内 / 空文档的字节结果。无 DOM、无定时器。
 */
import { describe, expect, it } from "vitest";
import {
  blockHandleIcon,
  firstRebuildIndex,
  handleKey,
  handleKeysFor,
  isInSummonZone,
  moveBlock,
  SUMMON_ZONE_RATIO,
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

  it("图片块按首行引用扩展名区分视频 / 音频 / 图片", () => {
    expect(blockHandleIcon("image", "![clip](assets/clip.mp4)")).toBe(
      "VideoOutlined",
    );
    expect(blockHandleIcon("image", "![clip](assets/clip.webm)")).toBe(
      "VideoOutlined",
    );
    expect(blockHandleIcon("image", "![sound](assets/sound.mp3)")).toBe(
      "AudioOutlined",
    );
    expect(blockHandleIcon("image", "![pic](assets/pic.png)")).toBe(
      "ImageOutlined",
    );
    expect(blockHandleIcon("image", "![doc](assets/doc.pdf)")).toBe(
      "ImageOutlined",
    );
    // 没有图片引用时退回图片图标
    expect(blockHandleIcon("image", "纯文本")).toBe("ImageOutlined");
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

describe("isInSummonZone", () => {
  // `.cm-content` 宽 1000px，左缘在 200：召唤区 = [200, 450]。
  const rect = { left: 200, width: 1000 };

  it("左缘 25% 内返回 true", () => {
    expect(SUMMON_ZONE_RATIO).toBe(0.25);
    expect(isInSummonZone(200, rect)).toBe(true);
    expect(isInSummonZone(300, rect)).toBe(true);
    expect(isInSummonZone(450, rect)).toBe(true);
  });

  it("超过左缘 25% 返回 false", () => {
    expect(isInSummonZone(451, rect)).toBe(false);
    expect(isInSummonZone(900, rect)).toBe(false);
    expect(isInSummonZone(1199, rect)).toBe(false);
  });

  it("左缘之外（负坐标）也算召唤区内", () => {
    expect(isInSummonZone(100, rect)).toBe(true);
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

describe("handleKey", () => {
  it("由序号 + 块型 + 图标名组成", () => {
    expect(handleKey(0, "paragraph", "FormatParagraphOutlined")).toBe(
      "0:paragraph:FormatParagraphOutlined",
    );
    expect(handleKey(2, "heading", "H1Outlined")).toBe("2:heading:H1Outlined");
  });
});

describe("handleKeysFor", () => {
  it("纯内容输入 / 删除不改变 key（段落图标与首行文本无关）", () => {
    const before = handleKeysFor([
      { type: "paragraph", firstLine: "第一段" },
      { type: "paragraph", firstLine: "第二段" },
    ]);
    const after = handleKeysFor([
      { type: "paragraph", firstLine: "第一段连续输入十个字" },
      { type: "paragraph", firstLine: "第二段删掉几个字" },
    ]);
    expect(after).toEqual(before);
  });

  it("块型变化改变 key（段落 → 标题）", () => {
    const before = handleKeysFor([{ type: "paragraph", firstLine: "标题" }]);
    const after = handleKeysFor([{ type: "heading", firstLine: "# 标题" }]);
    expect(after).not.toEqual(before);
  });

  it("标题级别 / 列表有序无序 / 图片媒体类型参与 key", () => {
    expect(handleKeysFor([{ type: "heading", firstLine: "# 甲" }])).not.toEqual(
      handleKeysFor([{ type: "heading", firstLine: "## 甲" }]),
    );
    expect(handleKeysFor([{ type: "list", firstLine: "- 甲" }])).not.toEqual(
      handleKeysFor([{ type: "list", firstLine: "1. 甲" }]),
    );
    expect(
      handleKeysFor([{ type: "image", firstLine: "![a](a.png)" }]),
    ).not.toEqual(handleKeysFor([{ type: "image", firstLine: "![a](a.mp4)" }]));
  });

  it("序号参与 key：同型同图标的不同块不共用 key", () => {
    expect(handleKeysFor([{ type: "paragraph", firstLine: "甲" }])[0]).not.toBe(
      handleKeysFor([
        { type: "paragraph", firstLine: "甲" },
        { type: "paragraph", firstLine: "乙" },
      ])[1],
    );
  });
});

describe("firstRebuildIndex", () => {
  const keys = (...list: string[]) => list;

  it("键逐位一致且数量相同返回 -1（纯输入只重算几何）", () => {
    expect(firstRebuildIndex(keys("a", "b", "c"), keys("a", "b", "c"))).toBe(
      -1,
    );
  });

  it("插入：返回插入位置，其后重建", () => {
    expect(
      firstRebuildIndex(keys("a", "b", "c"), keys("a", "x", "b", "c")),
    ).toBe(1);
  });

  it("删除：返回删除位置", () => {
    expect(firstRebuildIndex(keys("a", "b", "c"), keys("a", "c"))).toBe(1);
  });

  it("块型变化：返回该块位置", () => {
    expect(firstRebuildIndex(keys("a", "b", "c"), keys("a", "B", "c"))).toBe(1);
  });

  it("尾部追加：返回旧长度", () => {
    expect(firstRebuildIndex(keys("a", "b"), keys("a", "b", "c"))).toBe(2);
  });

  it("尾部删除：返回新长度", () => {
    expect(firstRebuildIndex(keys("a", "b", "c"), keys("a", "b"))).toBe(2);
  });

  it("空 → 有：从 0 重建", () => {
    expect(firstRebuildIndex(keys(), keys("a"))).toBe(0);
  });
});
