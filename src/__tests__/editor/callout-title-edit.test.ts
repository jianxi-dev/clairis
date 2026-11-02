/**
 * 高亮块标题行内编辑测试（移植自 md-bundle `test/callout-title-edit.test.ts`，issue #395）。
 *
 * 真实 EditorView 路径：按标题开一个行内 input，提交经暂存/flush 写回源码，
 * 首行变成 `> [!TYPE] <新标题>`。#395 发现这条写回路径缺失——标题当时是惰性 textContent。
 *
 * jsdom 缺 requestAnimationFrame / ResizeObserver，CM6 两者都用。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  editorDecorations,
  resetDecorationGuards,
} from "../../editors/decorations";

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

/** 等 widget 的延后 `requestAnimationFrame(open)` 跑完。 */
const frame = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 40));

describe("高亮块标题行内编辑（#395）", () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    resetDecorationGuards();
    parent = document.createElement("div");
    document.body.appendChild(parent);
  });

  afterEach(() => {
    view?.destroy();
    parent?.remove();
    resetDecorationGuards();
  });

  function mount(value: string): void {
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: value,
        extensions: [markdown(), editorDecorations()],
      }),
    });
    // 光标在高亮块外，卡片 widget 才渲染。
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();
  }

  function titleEl(): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>(".cm-callout-title");
    if (!el) throw new Error("callout title not rendered");
    return el;
  }

  /** 真实路径：按标题，等 widget 的下一帧打开。 */
  async function pressTitle(): Promise<void> {
    titleEl().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await frame();
  }

  function titleInput(): HTMLInputElement | null {
    return view.dom.querySelector<HTMLInputElement>(".cm-callout-title-editor");
  }

  it("按标题打开行内标题编辑器", async () => {
    mount("> [!NOTE] 旧标题\n> 内容");
    await pressTitle();

    const input = titleInput();
    expect(input).not.toBeNull();
    expect(input?.value).toBe("旧标题");
  });

  it("编辑后的标题写回源码首行", async () => {
    mount("> [!NOTE] 旧标题\n> 内容");
    await pressTitle();

    const input = titleInput();
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = "自定义标题";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(view.state.doc.toString()).toBe("> [!NOTE] 自定义标题\n> 内容");
  });

  it("清空标题回落到类型默认（源码无标题）", async () => {
    mount("> [!TIP] 自定义\n> 内容");
    await pressTitle();

    const input = titleInput();
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(view.state.doc.toString()).toBe("> [!TIP]\n> 内容");
  });

  it("Escape 取消标题编辑且不动源码", async () => {
    mount("> [!NOTE] 旧标题\n> 内容");
    await pressTitle();

    const input = titleInput();
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = "不该保存";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(view.state.doc.toString()).toBe("> [!NOTE] 旧标题\n> 内容");
  });
});
