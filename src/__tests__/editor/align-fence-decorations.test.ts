/**
 * #668：编辑态隐藏块对齐围栏（`::: {.align-*}` … `:::`）的装饰回归。
 *
 * 只隐藏完整配对的两行（整行含换行），保留块外空行；代码块内的 `:::` 是代码
 * 内容不隐藏；缺结束行的半截包裹保守不隐藏。
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

const DOC = "# 标题\n\n::: {.align-center}\n第一段正文\n:::\n\n第二段正文\n";

function lineTexts(view: EditorView): string[] {
  return Array.from(view.dom.querySelectorAll(".cm-line")).map(
    (line) => line.textContent ?? "",
  );
}

describe("align fence decorations", () => {
  let parent: HTMLElement;
  let view: EditorView | undefined;

  beforeEach(() => {
    installPolyfills();
    resetDecorationGuards();
    parent = document.createElement("div");
    document.body.appendChild(parent);
  });

  afterEach(() => {
    view?.destroy();
    parent.remove();
    resetDecorationGuards();
  });

  function createEditor(doc: string): EditorView {
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown(), editorDecorations()],
      }),
    });
    return view;
  }

  it("隐藏围栏整行，保留块外空行", () => {
    const editor = createEditor(DOC);
    expect(lineTexts(editor)).toEqual([
      "# 标题",
      "",
      "第一段正文",
      "",
      "第二段正文",
      "",
    ]);
    expect(editor.state.doc.toString()).toBe(DOC);
  });

  it("多组围栏都隐藏", () => {
    const editor = createEditor(
      "::: {.align-center}\n甲\n:::\n\n::: {.align-right}\n乙\n:::\n",
    );
    expect(lineTexts(editor)).toEqual(["甲", "", "乙", ""]);
  });

  it("围栏代码块内的 ::: 是代码内容，不隐藏", () => {
    const editor = createEditor(
      "```text\n::: {.align-center}\n代码\n:::\n```\n\n正文\n",
    );
    expect(lineTexts(editor)).toContain("::: {.align-center}");
    expect(lineTexts(editor)).toContain("代码");
  });

  it("缺结束行的半截包裹保守不隐藏", () => {
    const editor = createEditor("::: {.align-center}\n正文\n");
    expect(lineTexts(editor)).toContain("::: {.align-center}");
  });

  it("光标可落在正文行首与行尾", () => {
    const editor = createEditor(DOC);
    const lineStart = DOC.indexOf("第一段正文");
    const lineEnd = lineStart + "第一段正文".length;
    editor.dispatch({ selection: { anchor: lineStart } });
    expect(editor.state.selection.main.head).toBe(lineStart);
    editor.dispatch({ selection: { anchor: lineEnd } });
    expect(editor.state.selection.main.head).toBe(lineEnd);
  });
});
