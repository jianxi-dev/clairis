import { describe, expect, it, vi } from "vitest";
import {
  MenuStack,
  type MenuEntry,
} from "../../editors/orchestration/menu-stack";

function el(): HTMLElement {
  return document.createElement("div");
}

function entry(
  id: string,
  scope: object | undefined,
  onClose: () => void = vi.fn(),
  element = el(),
): MenuEntry {
  return { id, owner: null, element, scope, onClose };
}

describe("MenuStack 作用域", () => {
  it("不同作用域互不阻塞（分栏两个面板各开一层）", () => {
    const stack = new MenuStack();
    const a = {};
    const b = {};

    expect(stack.push(entry("a", a))).not.toBeNull();
    expect(stack.push(entry("b", b))).not.toBeNull();
    expect(stack.size()).toBe(2);
    expect(stack.top(a)?.id).toBe("a");
    expect(stack.top(b)?.id).toBe("b");
  });

  it("同作用域内换块 push 返回 null（不 retarget）", () => {
    const stack = new MenuStack();
    const scope = {};
    stack.push({
      id: "a",
      owner: { blockFrom: 0, blockTo: 1 },
      element: el(),
      scope,
      onClose: () => {},
    });

    expect(
      stack.push({
        id: "b",
        owner: { blockFrom: 2, blockTo: 3 },
        element: el(),
        scope,
        onClose: () => {},
      }),
    ).toBeNull();
  });

  it("closeScope 只收指定作用域", () => {
    const stack = new MenuStack();
    const a = {};
    const b = {};
    const closedA = vi.fn();
    const closedB = vi.fn();
    stack.push(entry("a", a, closedA));
    stack.push(entry("b", b, closedB));

    stack.closeScope(a, "scroll");

    expect(closedA).toHaveBeenCalledWith("scroll");
    expect(closedB).not.toHaveBeenCalled();
    expect(stack.size()).toBe(1);
    expect(stack.top()?.id).toBe("b");
  });
});

describe("MenuStack containsElement", () => {
  it("命中自身与子节点，未命中返回 false", () => {
    const stack = new MenuStack();
    const root = el();
    const child = document.createElement("span");
    root.appendChild(child);
    stack.push(entry("a", {}, () => {}, root));

    expect(stack.containsElement(root)).toBe(true);
    expect(stack.containsElement(child)).toBe(true);
    expect(stack.containsElement(document.body)).toBe(false);
    expect(stack.containsElement(null)).toBe(false);
  });
});

describe("MenuStack closeAll 谓词", () => {
  it("只关闭命中的层，其余保留且不重复 onClose", () => {
    const stack = new MenuStack();
    const keep = vi.fn();
    const drop = vi.fn();
    stack.push(entry("keep", {}, keep));
    stack.push(entry("drop", {}, drop));

    stack.closeAll("test", (e) => e.id === "drop");

    expect(drop).toHaveBeenCalledTimes(1);
    expect(keep).not.toHaveBeenCalled();
    expect(stack.size()).toBe(1);
  });

  it("无匹配时不触发任何 onClose", () => {
    const stack = new MenuStack();
    const cb = vi.fn();
    stack.push(entry("a", {}, cb));

    stack.closeAll("test", () => false);

    expect(cb).not.toHaveBeenCalled();
    expect(stack.size()).toBe(1);
  });
});
