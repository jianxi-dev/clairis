import { describe, expect, it } from "vitest";
import {
  createUndoStack,
  recordEdit,
  undo,
  redo,
  UNDO_STACK_CAPACITY,
} from "../../editors/html/undoStack";

/**
 * 文档级撤销栈（#321）。
 *
 * e2e 只跑「打字 → 撤销/重做」的链路；这里的纯函数测试覆盖 e2e 够不到的分支：
 * 空栈、重做清空、容量上限。
 */
describe("HTML 可视化撤销栈（#321）", () => {
  it("编辑压栈，撤销逐步取回上一条", () => {
    let s = createUndoStack();
    s = recordEdit(s, "A");
    s = recordEdit(s, "AB");

    const u1 = undo(s, "ABC");
    expect(u1.content).toBe("AB");
    const u2 = undo(u1.stack, "AB");
    expect(u2.content).toBe("A");
    expect(undo(u2.stack, "A").content).toBeNull();
  });

  it("撤销把当前内容压入重做栈，重做再取回", () => {
    let s = createUndoStack();
    s = recordEdit(s, "A");
    s = recordEdit(s, "AB");

    const u = undo(s, "ABC");
    expect(u.content).toBe("AB");
    expect(u.stack.redo).toEqual(["ABC"]);

    if (u.content === null) throw new Error("expected undoable step");
    const r = redo(u.stack, u.content);
    expect(r.content).toBe("ABC");
    expect(r.stack.undo).toEqual(["A", "AB"]);
  });

  it("新编辑清空重做栈", () => {
    let s = createUndoStack();
    s = recordEdit(s, "A");
    const u = undo(s, "AB");
    expect(u.stack.redo).toEqual(["AB"]);

    const s2 = recordEdit(u.stack, "A");
    expect(s2.redo).toEqual([]);
  });

  it("栈容量有上限，超出丢弃最旧的一条", () => {
    let s = createUndoStack();
    for (let i = 0; i < UNDO_STACK_CAPACITY + 20; i += 1) {
      s = recordEdit(s, `c${i}`);
    }
    expect(s.undo).toHaveLength(UNDO_STACK_CAPACITY);
    expect(s.undo[0]).toBe("c20");
    expect(s.undo[s.undo.length - 1]).toBe(`c${UNDO_STACK_CAPACITY + 19}`);
  });
});
