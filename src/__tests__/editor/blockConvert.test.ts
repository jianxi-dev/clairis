import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import {
  blockConvertChanges,
  blockMenuItems,
  convertLine,
  stripBlockMarker,
} from "../../editors/orchestration/block-convert";

function doc(text: string): Text {
  return Text.of(text.split("\n"));
}

function convert(
  text: string,
  target: Parameters<typeof blockConvertChanges>[2],
): string {
  const state = doc(text);
  const changes = blockConvertChanges(
    state,
    { from: 0, to: state.length },
    target,
  );
  let out = text;
  for (const change of [...changes].sort((a, b) => b.from - a.from)) {
    out = out.slice(0, change.from) + change.insert + out.slice(change.to);
  }
  return out;
}

describe("stripBlockMarker", () => {
  it("剥掉标题 / 引用 / 待办 / 无序 / 有序标记", () => {
    expect(stripBlockMarker("## 标题")).toBe("标题");
    expect(stripBlockMarker("> 引用")).toBe("引用");
    expect(stripBlockMarker("- [ ] 待办")).toBe("待办");
    expect(stripBlockMarker("- 列表")).toBe("列表");
    expect(stripBlockMarker("1. 有序")).toBe("有序");
  });

  it("无标记与正文内容原样保留", () => {
    expect(stripBlockMarker("普通段落")).toBe("普通段落");
    expect(stripBlockMarker("  # 缩进的井号不是标题")).toBe(
      "  # 缩进的井号不是标题",
    );
    expect(stripBlockMarker("")).toBe("");
  });
});

describe("convertLine", () => {
  it("段落 → 各级标题只换首行标记", () => {
    expect(convertLine("正文", "h1")).toBe("# 正文");
    expect(convertLine("## 旧标题", "h3")).toBe("### 旧标题");
  });

  it("幂等：已是同类型不重复加前缀", () => {
    expect(convertLine("# 标题", "h1")).toBe("# 标题");
    expect(convertLine("- 列表", "bullet")).toBe("- 列表");
  });

  it("转正文只去标记不动内容", () => {
    expect(convertLine("- [ ] 待办", "paragraph")).toBe("待办");
  });
});

describe("blockConvertChanges", () => {
  it("单行块只改首行范围", () => {
    const state = doc("正文\n第二行");
    const changes = blockConvertChanges(state, { from: 0, to: 5 }, "h2");
    expect(changes).toEqual([{ from: 0, to: 2, insert: "## 正文" }]);
  });

  it("引用 → 列表：逐行剥掉 > 再补前缀", () => {
    expect(convert("> 一\n> 二", "bullet")).toBe("- 一\n- 二");
  });

  it("多行 → 引用：每行加 > ", () => {
    expect(convert("一\n二", "quote")).toBe("> 一\n> 二");
  });

  it("代码块：整块包进围栏", () => {
    expect(convert("const a = 1;", "code")).toBe("```\nconst a = 1;\n```");
  });

  it("高亮：补充 [!NOTE] 并整体引用", () => {
    expect(convert("一\n二", "callout")).toBe("> [!NOTE]\n> 一\n> 二");
  });

  it("已是代码块 / 高亮时返回空变更（幂等）", () => {
    const code = doc("```\nx\n```");
    expect(
      blockConvertChanges(code, { from: 0, to: code.length }, "code"),
    ).toEqual([]);
    const callout = doc("> [!NOTE]\n> x");
    expect(
      blockConvertChanges(callout, { from: 0, to: callout.length }, "callout"),
    ).toEqual([]);
  });

  it("空块返回空变更", () => {
    const empty = doc("");
    expect(blockConvertChanges(empty, { from: 0, to: 0 }, "h1")).toEqual([]);
  });
});

describe("blockMenuItems", () => {
  it("普通段落给出十项", () => {
    expect(blockMenuItems({ type: "paragraph" })).toHaveLength(10);
  });

  it("代码块隐藏「代码」项", () => {
    const items = blockMenuItems({ type: "fencedCode" });
    expect(items).toHaveLength(9);
    expect(items.some((i) => i.target === "code")).toBe(false);
  });

  it("表格等不可转换块型只留「在下方添加」", () => {
    expect(blockMenuItems({ type: "table" })).toEqual([]);
    expect(blockMenuItems({ type: "thematicBreak" })).toEqual([]);
  });
});

describe("同级列表整体转换", () => {
  it("无序列表转有序时自动编号", () => {
    expect(convert("- 甲\n- 乙\n- 丙", "ordered")).toBe("1. 甲\n2. 乙\n3. 丙");
  });

  it("保留同级缩进", () => {
    expect(convert("  - 甲\n  - 乙", "ordered")).toBe("  1. 甲\n  2. 乙");
  });

  it("列表转待办整体加勾选框", () => {
    expect(convert("- 甲\n- 乙", "todo")).toBe("- [ ] 甲\n- [ ] 乙");
  });

  it("非列表块不受影响", () => {
    expect(convert("正文", "ordered")).toBe("1. 正文");
  });
});
