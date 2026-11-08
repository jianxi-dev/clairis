import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { editorDecorations } from "../../../editors/decorations";
import {
  computeFoldSections,
  createFoldDecorations,
  foldState,
  toggleFold,
} from "../../../editors/decorations/fold";

function createState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown(), editorDecorations()],
  });
}

describe("foldState", () => {
  it("toggleFold 切换行号的折叠态", () => {
    const state = createState("# A\n\ncontent\n");
    const folded = state.update({ effects: toggleFold.of(1) }).state;
    expect(folded.field(foldState)).toEqual(new Set([1]));
    const unfolded = folded.update({ effects: toggleFold.of(1) }).state;
    expect(unfolded.field(foldState)).toEqual(new Set());
  });

  it("整篇替换清空折叠态（切页签场景）", () => {
    const state = createState("# A\n\ncontent\n");
    const folded = state.update({ effects: toggleFold.of(1) }).state;
    const replaced = folded.update({
      changes: { from: 0, to: folded.doc.length, insert: "# B\n\nother\n" },
    }).state;
    expect(replaced.field(foldState).size).toBe(0);
  });

  it("局部编辑只剔除已非标题的行号", () => {
    const state = createState("# A\n\ncontent\n");
    const folded = state.update({ effects: toggleFold.of(1) }).state;
    // 标题行本身被删掉，行号 1 变成正文 → 折叠态被剔除。
    const edited = folded.update({
      changes: { from: 0, to: 3, insert: "" },
    }).state;
    expect(edited.field(foldState).size).toBe(0);
  });
});

describe("computeFoldSections", () => {
  it("只计算有下级内容的 ATX 标题", () => {
    const state = createState(
      "# A\n\ntext\n\n## B\n\nbtext\n\n### C\n\nctext\n\n## D\n\ndtext\n\n# E\n",
    );
    const sections = computeFoldSections(state);
    expect(sections.map((s) => s.headingLine)).toEqual([1, 5, 9, 13]);
  });

  it("末尾无内容的标题不产生章节", () => {
    const state = createState("# A\n\ntext\n\n# B\n");
    expect(computeFoldSections(state).map((s) => s.headingLine)).toEqual([1]);
  });

  it("空行不算下级内容", () => {
    const state = createState("# A\n\n\n# B\n");
    expect(computeFoldSections(state)).toEqual([]);
  });
});

describe("createFoldDecorations", () => {
  it("有下级的标题渲染三角，无下级的标题不渲染", () => {
    const state = createState("# A\n\ntext\n\n# B\n");
    const decorations = createFoldDecorations(state, new Set());
    const widgets = decorations.filter((d) => d.value.spec.widget);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].from).toBe(0);
  });

  it("折叠态为对应范围生成 replace 装饰", () => {
    const state = createState("# A\n\ntext\n\n# B\n");
    const decorations = createFoldDecorations(state, new Set([1]));
    const replace = decorations.find((d) => d.value.spec.widget === undefined);
    expect(replace).toBeDefined();
    expect(replace!.from).toBe(3);
    expect(replace!.to).toBe(11);
  });
});
