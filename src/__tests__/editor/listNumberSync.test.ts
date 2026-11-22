import { afterEach, describe, expect, it } from "vitest";
import { EditorState, type TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { history, undo } from "@codemirror/commands";
import { smartEnter, smartInput } from "../../editors/smart-input";
import { shouldSyncOrderedNumbers } from "../../editors/list-number";

let view: EditorView;
let parent: HTMLDivElement;

function boot(doc: string): void {
  parent = document.createElement("div");
  document.body.appendChild(parent);
  view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [markdown(), smartInput(), history()],
    }),
  });
}

afterEach(() => {
  view.destroy();
  parent.remove();
});

describe("有序编号源码同步", () => {
  it("回车插入中间项后编号重算，一次 undo 回到插入前", () => {
    boot("1. 甲\n2. 乙");
    view.dispatch({ selection: { anchor: 4 } });
    expect(smartEnter(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("1. 甲\n2. \n3. 乙");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("1. 甲\n2. 乙");
  });

  it("删除中间项后剩余项重算，一次 undo 回到删除前", () => {
    boot("1. 甲\n2. 乙\n3. 丙");
    const line2 = view.state.doc.line(2);
    const line3 = view.state.doc.line(3);
    view.dispatch({
      changes: { from: line2.from, to: line3.from, insert: "" },
      selection: { anchor: line2.from },
    });
    expect(view.state.doc.toString()).toBe("1. 甲\n2. 丙");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("1. 甲\n2. 乙\n3. 丙");
  });

  it("缩进一项后两段各自从 1 重排，一次 undo 还原", () => {
    boot("1. 甲\n2. 乙\n3. 丙");
    const line2 = view.state.doc.line(2);
    view.dispatch({
      changes: { from: line2.from, insert: "  " },
      selection: { anchor: line2.from + 2 },
    });
    expect(view.state.doc.toString()).toBe("1. 甲\n  1. 乙\n2. 丙");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("1. 甲\n2. 乙\n3. 丙");
  });

  it("无序/任务项不参与编号、不被改写", () => {
    boot("- 无序\n1. 甲\n- [ ] 任务\n2. 乙");
    const end = view.state.doc.length;
    view.dispatch({
      changes: { from: end, insert: "x" },
      selection: { anchor: end + 1 },
    });
    expect(view.state.doc.toString()).toBe("- 无序\n1. 甲\n- [ ] 任务\n1. 乙x");
  });

  it("键入的偏离编号被计算值覆盖", () => {
    boot("1. 甲\n2. 乙");
    const line2 = view.state.doc.line(2);
    view.dispatch({
      changes: { from: line2.from, to: line2.from + 1, insert: "9" },
    });
    expect(view.state.doc.toString()).toBe("1. 甲\n2. 乙");
  });
});

// Transaction 构造器私有，用 transactionFilter 捕获真实事务来测门本身。
function decide(doc: string, spec: TransactionSpec): boolean {
  parent = document.createElement("div");
  document.body.appendChild(parent);
  let decision = false;
  const capture = EditorState.transactionFilter.of((tr) => {
    decision = shouldSyncOrderedNumbers(tr);
    return tr;
  });
  view = new EditorView({
    parent,
    state: EditorState.create({ doc, extensions: [markdown(), capture] }),
  });
  view.dispatch(spec);
  return decision;
}

describe("shouldSyncOrderedNumbers", () => {
  it("普通逐字键入且行数不变 → 不同步", () => {
    expect(
      decide("1. 甲\n2. 乙", {
        changes: { from: 0, insert: "x" },
        userEvent: "input.type",
      }),
    ).toBe(false);
  });

  it("回车 / 删除行（行数变化）→ 同步", () => {
    expect(
      decide("1. 甲\n2. 乙", {
        changes: { from: 0, insert: "\n" },
        userEvent: "input.type",
      }),
    ).toBe(true);
    expect(
      decide("1. 甲\n2. 乙\n3. 丙", {
        changes: { from: 5, to: 10, insert: "" },
        userEvent: "delete.backward",
      }),
    ).toBe(true);
  });

  it("结构命令（行数不变）→ 同步", () => {
    expect(
      decide("1. 甲\n2. 乙", {
        changes: { from: 0, insert: "  " },
        userEvent: "app.structure",
      }),
    ).toBe(true);
  });

  it("删除路径 delete.cut（行数不变）→ 同步", () => {
    expect(
      decide("1. 甲\n2. 乙", {
        changes: { from: 0, to: 1, insert: "" },
        userEvent: "delete.cut",
      }),
    ).toBe(true);
  });
});
