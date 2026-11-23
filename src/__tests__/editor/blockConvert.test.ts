import { describe, expect, it } from "vitest";
import { EditorState, Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import {
  blockConvertChanges,
  blockMenuItems,
  convertLine,
  convertLineWithChildren,
  dispatchLineConvert,
  lineSubtreeRange,
  stripBlockMarker,
  wrapListInCallout,
} from "../../editors/orchestration/block-convert";
import { createExtensions } from "../../editors/setup";

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

function convertLineText(
  text: string,
  lineNumber: number,
  target: Parameters<typeof convertLineWithChildren>[2],
  options?: Parameters<typeof convertLineWithChildren>[3],
): string {
  const state = doc(text);
  const line = state.line(lineNumber);
  const changes = convertLineWithChildren(
    state,
    { from: line.from, to: line.to },
    target,
    options,
  );
  let out = text;
  for (const change of [...changes].sort((a, b) => b.from - a.from)) {
    out = out.slice(0, change.from) + change.insert + out.slice(change.to);
  }
  return out;
}

describe("lineSubtreeRange", () => {
  it("列表行取自身 + 嵌套更深的连续子级", () => {
    const state = doc("- 甲\n  - 甲一\n  - 甲二\n- 乙\n  - 乙一");
    expect(lineSubtreeRange(state, 0, 3)).toEqual({
      from: 0,
      to: 17,
      lines: ["- 甲", "  - 甲一", "  - 甲二"],
    });
  });

  it("同缩进兄弟与更浅行立即停止", () => {
    const state = doc("- 甲\n- 乙\n  - 乙一");
    expect(lineSubtreeRange(state, 0, 3).lines).toEqual(["- 甲"]);
    expect(lineSubtreeRange(state, 4, 7).lines).toEqual(["- 乙", "  - 乙一"]);
  });

  it("叶子行只取自身；非列表行也只取自身", () => {
    const state = doc("- 甲\n  - 甲一\n  - 甲二\n- 乙");
    expect(lineSubtreeRange(state, 4, 10).lines).toEqual(["  - 甲一"]);
    const para = doc("正文\n第二行");
    expect(lineSubtreeRange(para, 0, 2)).toEqual({
      from: 0,
      to: 2,
      lines: ["正文"],
    });
  });
});

describe("convertLineWithChildren", () => {
  it("上级行联动子树：2 层无序转有序，2 级从 1 起连续", () => {
    const text = "- 甲\n  - 甲一\n  - 甲二\n- 乙\n  - 乙一";
    expect(convertLineText(text, 1, "ordered")).toBe(
      "1. 甲\n  1. 甲一\n  2. 甲二\n- 乙\n  - 乙一",
    );
  });

  it("末级行只转当前行：兄弟与上级零变化", () => {
    const text = "- 甲\n  - 甲一\n  - 甲二\n- 乙";
    expect(convertLineText(text, 2, "ordered")).toBe(
      "- 甲\n  1. 甲一\n  - 甲二\n- 乙",
    );
  });

  it("子树转待办 / 无序保留层级缩进", () => {
    const text = "- 甲\n  - 甲一\n- 乙";
    expect(convertLineText(text, 1, "todo")).toBe(
      "- [ ] 甲\n  - [ ] 甲一\n- 乙",
    );
    expect(convertLineText(text, 1, "bullet")).toBe("- 甲\n  - 甲一\n- 乙");
  });

  it("非列表行退化为该行自身的块转换", () => {
    expect(convertLineText("正文\n第二行", 2, "h1")).toBe("正文\n# 第二行");
  });

  it("列表转高亮：外套 callout，列表标记与缩进保留", () => {
    const text = "- 甲\n  - 甲一\n- 乙";
    expect(convertLineText(text, 1, "callout")).toBe(
      "> [!NOTE]\n> - 甲\n>   - 甲一\n- 乙",
    );
    expect(convertLineText(text, 1, "callout", { calloutKind: "tip" })).toBe(
      "> [!tip]\n> - 甲\n>   - 甲一\n- 乙",
    );
  });
});

describe("wrapListInCallout", () => {
  it("每行补 > 前缀，列表标记不变", () => {
    expect(wrapListInCallout(["- 甲", "  - 甲一"])).toBe(
      "> [!NOTE]\n> - 甲\n>   - 甲一",
    );
    expect(wrapListInCallout(["1. 甲", "2. 乙"], "info")).toBe(
      "> [!info]\n> 1. 甲\n> 2. 乙",
    );
  });
});

describe("dispatchLineConvert 撤销一步", () => {
  it("一次转换一个 undo 步（structureTransaction）", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "- 甲\n  - 甲一\n  - 甲二\n- 乙",
        extensions: createExtensions("markdown"),
      }),
    });
    try {
      const start = view.state.doc.toString();
      const line = view.state.doc.line(1);
      dispatchLineConvert(view, { from: line.from, to: line.to }, "ordered");
      expect(view.state.doc.toString()).toBe(
        "1. 甲\n  1. 甲一\n  2. 甲二\n- 乙",
      );
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(start);
    } finally {
      view.destroy();
      parent.remove();
    }
  });
});
