import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EditorView } from "@codemirror/view";
import {
  isSlashMenuOpen,
  openSlashMenuAtCursor,
  slashMenuApply,
  slashMenuClose,
  slashMenuSelectNext,
} from "../../editors/slash";
import {
  menuStack,
  resetMenuStack,
} from "../../editors/orchestration/menu-stack";
import { createTestEditor } from "./testEditor";

function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== "function") {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(
        () => cb(performance.now()),
        16,
      )) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
  }
  if (typeof globalThis.ResizeObserver !== "function") {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
}

describe("菜单栈接线（E1b 1.3）", () => {
  let view: EditorView;
  let destroy: () => void;

  beforeEach(() => {
    installPolyfills();
    resetMenuStack();
    const editor = createTestEditor("hello\n");
    view = editor.view;
    destroy = editor.destroy;
  });

  afterEach(() => {
    slashMenuClose(view);
    destroy();
    resetMenuStack();
  });

  it("打开菜单即入栈，关闭即出栈", () => {
    openSlashMenuAtCursor(view);
    expect(isSlashMenuOpen(view)).toBe(true);
    expect(menuStack.size()).toBe(1);
    expect(menuStack.top(view)?.element.className).toContain("mdb-slash-menu");

    expect(slashMenuClose(view)).toBe(true);
    expect(menuStack.size()).toBe(0);
    expect(isSlashMenuOpen(view)).toBe(false);
  });

  it("栈空时 keymap 一律返回 false（不吞事件）", () => {
    expect(slashMenuSelectNext(view)).toBe(false);
    expect(slashMenuApply(view)).toBe(false);
    expect(slashMenuClose(view)).toBe(false);
  });

  it("别的层压在上面时 keymap 让位", () => {
    openSlashMenuAtCursor(view);
    expect(slashMenuSelectNext(view)).toBe(true);

    const foreign = document.createElement("div");
    document.body.appendChild(foreign);
    menuStack.push({
      id: "foreign",
      owner: null,
      element: foreign,
      scope: view,
      onClose: () => {},
    });

    expect(slashMenuSelectNext(view)).toBe(false);
    expect(slashMenuApply(view)).toBe(false);
    // Escape 也不能被非栈顶菜单吞掉
    expect(slashMenuClose(view)).toBe(false);

    foreign.remove();
  });

  it("滚动即收：编辑器滚动容器触发后菜单关闭", () => {
    openSlashMenuAtCursor(view);
    expect(menuStack.size()).toBe(1);

    view.scrollDOM.dispatchEvent(new Event("scroll"));

    expect(isSlashMenuOpen(view)).toBe(false);
    expect(menuStack.size()).toBe(0);
  });

  it("重复关闭是幂等的，不重复触发造成异常", () => {
    openSlashMenuAtCursor(view);
    slashMenuClose(view);
    expect(slashMenuClose(view)).toBe(false);
    expect(menuStack.size()).toBe(0);
  });
});
