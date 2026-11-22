/* 撤销历史不变量（design D6 / ADR 0012 三原则）。
 *
 * 用确定性伪随机序列驱动真实 EditorView（应用编辑态扩展集）：键入、删除、
 * 结构命令（经 structureTransaction + 真实 dispatch）、偶尔撤销/重做。
 * 断言：undo 全量回到起点、redo 全量回到终点、每步选区合法。
 *
 * 只驱动公共链路（EditorView.dispatch / undo / redo / smart-input 公开函数），
 * 不直接调内部实现做断言。
 */

import { describe, expect, it } from "vitest";
import { Annotation, Transaction } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { isolateHistory, redo, undo } from "@codemirror/commands";
import { createExtensions } from "../../editors/setup";
import {
  demoteHeading,
  promoteHeading,
  smartBackspace,
  smartEnter,
} from "../../editors/smart-input";
import {
  STRUCTURE_USER_EVENT,
  structureTransaction,
} from "../../editors/structure-history";

/** 确定性伪随机（LCG）：同种子同序列，跨平台可复现。 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const START_DOC = "# 标题\n\n- 列表项\n\n正文段落。";
const STEPS = 50;
const ALPHABET = "甲乙丙丁戊己庚辛壬癸";
/** 种子固定并记录，序列可复现（design D6）。 */
const SEED = 0x2f6e2b1;

function createView(): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: START_DOC,
      extensions: createExtensions("markdown"),
    }),
  });
}

function destroyView(view: EditorView): void {
  const parent = view.dom.parentElement;
  view.destroy();
  parent?.remove();
}

function assertSelection(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeLessThanOrEqual(view.state.doc.length);
  expect(from).toBeLessThanOrEqual(to);
}

/** 直接经 structureTransaction 切换当前行标题标记（助手 + 真实 dispatch 路径）。 */
function toggleHeadingMarker(view: EditorView): void {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const match = /^(#{1,6})\s/.exec(line.text);
  const changes = match
    ? { from: line.from, to: line.from + match[0].length, insert: "" }
    : { from: line.from, insert: "## " };
  view.dispatch(
    structureTransaction({ changes, selection: { anchor: line.from } }),
  );
}

function runStructure(view: EditorView, rng: () => number): void {
  switch (Math.floor(rng() * 5)) {
    case 0:
      demoteHeading(view);
      break;
    case 1:
      promoteHeading(view);
      break;
    case 2:
      smartEnter(view);
      break;
    case 3:
      smartBackspace(view);
      break;
    default:
      toggleHeadingMarker(view);
      break;
  }
}

function runSequence(view: EditorView, rng: () => number): void {
  for (let step = 0; step < STEPS; step += 1) {
    const roll = rng();
    // 末步强制前向编辑：新增事件会清空 redo 栈，保证 redo 全量恰好回到终点。
    if (step === STEPS - 1 || roll < 0.5) {
      const head = view.state.selection.main.head;
      const ch = ALPHABET[Math.floor(rng() * ALPHABET.length)]!;
      view.dispatch({
        changes: { from: head, insert: ch },
        selection: { anchor: head + ch.length },
        userEvent: "input.type",
      });
    } else if (roll < 0.7) {
      const head = view.state.selection.main.head;
      if (head > 0) {
        view.dispatch({
          changes: { from: head - 1, to: head },
          selection: { anchor: head - 1 },
          userEvent: "delete",
        });
      }
    } else if (roll < 0.9) {
      runStructure(view, rng);
    } else if (rng() < 0.6) {
      undo(view);
    } else {
      redo(view);
    }
    assertSelection(view);
  }
}

describe("structureTransaction", () => {
  const probe = Annotation.define<number>();

  it("annotations 缺失 / 单个 / 数组三态都保留并追加隔离注解", () => {
    const none = structureTransaction({ changes: { from: 0, insert: "a" } });
    expect(none.userEvent).toBe(STRUCTURE_USER_EVENT);
    expect(none.annotations).toEqual([isolateHistory.of("full")]);

    const single = structureTransaction({
      changes: { from: 0, insert: "a" },
      annotations: probe.of(1),
    });
    expect(single.annotations).toEqual([
      probe.of(1),
      isolateHistory.of("full"),
    ]);

    const many = structureTransaction({
      changes: { from: 0, insert: "a" },
      annotations: [probe.of(1), probe.of(2)],
    });
    expect(many.annotations).toEqual([
      probe.of(1),
      probe.of(2),
      isolateHistory.of("full"),
    ]);
  });

  it("不改动调用方的 addToHistory 注解（不强制 false）", () => {
    const spec = structureTransaction({
      changes: { from: 0, insert: "a" },
      annotations: Transaction.addToHistory.of(true),
    });
    expect(spec.annotations).toEqual([
      Transaction.addToHistory.of(true),
      isolateHistory.of("full"),
    ]);
  });
});

describe("undo 不变量（ADR 0012）", () => {
  it("50 步确定性序列：undo 全量回起点、redo 全量回终点、选区合法", () => {
    const view = createView();
    try {
      const start = view.state.doc.toString();
      runSequence(view, makeRng(SEED));
      const end = view.state.doc.toString();

      let guard = 0;
      while (undo(view)) {
        guard += 1;
        expect(guard).toBeLessThan(1000);
        assertSelection(view);
      }
      expect(view.state.doc.toString()).toBe(start);

      guard = 0;
      while (redo(view)) {
        guard += 1;
        expect(guard).toBeLessThan(1000);
        assertSelection(view);
      }
      expect(view.state.doc.toString()).toBe(end);
    } finally {
      destroyView(view);
    }
  });

  it("连续两次结构命令后一次 undo 只回退最后一次", () => {
    const view = createView();
    try {
      const start = view.state.doc.toString();
      expect(demoteHeading(view)).toBe(true);
      const afterFirst = view.state.doc.toString();
      expect(afterFirst).toBe("## 标题\n\n- 列表项\n\n正文段落。");
      expect(demoteHeading(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(
        "### 标题\n\n- 列表项\n\n正文段落。",
      );

      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(afterFirst);
      expect(view.state.doc.toString()).not.toBe(start);
    } finally {
      destroyView(view);
    }
  });
});
