/**
 * 文档级撤销栈（#321）。
 *
 * 可视化编辑没有 CM6 历史：每次提交都是整篇 content 字符串。这里保存
 * 「每次改动前的 content」，撤销 = 取回上一条，重做 = 取回撤销时压栈的那条。
 * 新编辑会清空重做栈——分叉之后旧分支不再可达，这是标准语义。
 *

 * 纯函数、无 DOM：容量与配对逻辑都在这里，便于单测覆盖（e2e 只跑链路）。
 */

export interface UndoStack {
  /** 待撤销的历史内容，最近一条在末尾。 */
  undo: string[];
  /** 待重做内容，最近一条在末尾。 */
  redo: string[];
}

/** 撤销栈容量上限：超出后丢弃最旧的一条。 */
export const UNDO_STACK_CAPACITY = 100;

export function createUndoStack(): UndoStack {
  return { undo: [], redo: [] };
}

/** 新编辑：把改动前的 content 压入撤销栈，并清空重做栈。 */
export function recordEdit(
  stack: UndoStack,
  previousContent: string,
): UndoStack {
  const undo = [...stack.undo, previousContent];
  if (undo.length > UNDO_STACK_CAPACITY) undo.shift();
  return { undo, redo: [] };
}

/**
 * 撤销：取回栈顶的历史 content，把当前 content 压入重做栈。
 * 栈空时返回 `content: null`（没有可撤销的步）。
 */
export function undo(
  stack: UndoStack,
  currentContent: string,
): { stack: UndoStack; content: string | null } {
  const content = stack.undo[stack.undo.length - 1];
  if (content === undefined) return { stack, content: null };
  return {
    stack: {
      undo: stack.undo.slice(0, -1),
      redo: [...stack.redo, currentContent],
    },
    content,
  };
}

/** 重做：取回栈顶的待重做 content，把当前 content 压回撤销栈。 */
export function redo(
  stack: UndoStack,
  currentContent: string,
): { stack: UndoStack; content: string | null } {
  const content = stack.redo[stack.redo.length - 1];
  if (content === undefined) return { stack, content: null };
  const undo = [...stack.undo, currentContent];
  if (undo.length > UNDO_STACK_CAPACITY) undo.shift();
  return {
    stack: { undo, redo: stack.redo.slice(0, -1) },
    content,
  };
}
