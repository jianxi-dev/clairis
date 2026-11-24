import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  editorDecorations,
  getDecorationBuildCount,
  resetDecorationGuards,
} from "../../editors/decorations";

function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== "function") {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(
        () => cb(performance.now()),
        16,
      )) as unknown as typeof requestAnimationFrame;
  }
  if (typeof globalThis.ResizeObserver !== "function") {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
}

function mount(doc: string): { view: EditorView; destroy: () => void } {
  installPolyfills();
  resetDecorationGuards();
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [markdown(), editorDecorations()],
    }),
  });
  return {
    view,
    destroy: () => {
      view.destroy();
      parent.remove();
      resetDecorationGuards();
    },
  };
}

function type(view: EditorView, from: number): void {
  view.dispatch({
    changes: { from, insert: "字" },
    selection: { anchor: from + 1 },
    userEvent: "input.type",
  });
}

describe("大文档键入快路径", () => {
  it("≥50k 文档逐字键入只映射，延迟补一次全量重建", async () => {
    const big = `${"段落内容足够长以跨过阈值。".repeat(6)}\n`.repeat(1800);
    expect(big.length).toBeGreaterThan(50_000);
    const { view, destroy } = mount(big);
    const base = getDecorationBuildCount();
    expect(base).toBe(1);

    let pos = view.state.doc.line(1).to;
    for (let i = 0; i < 10; i += 1) {
      type(view, pos);
      pos += 1;
    }
    expect(getDecorationBuildCount()).toBe(base);

    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(getDecorationBuildCount()).toBe(base + 1);
    destroy();
  });

  it("小文档仍逐键全量重建", () => {
    const { view, destroy } = mount("正文\n");
    const base = getDecorationBuildCount();
    for (let i = 0; i < 6; i += 1) type(view, 1 + i);
    expect(getDecorationBuildCount()).toBe(base + 6);
    destroy();
  });

  it("组合期文档变更映射而不重建，组合结束补建", () => {
    const { view, destroy } = mount("开头\n\n> [!NOTE]\n> 内容\n");
    const base = getDecorationBuildCount();
    view.contentDOM.dispatchEvent(
      new Event("compositionstart", { bubbles: true }),
    );
    view.dispatch({
      changes: { from: 2, insert: "组合" },
      userEvent: "input.type.compose",
    });
    expect(getDecorationBuildCount()).toBe(base);
    expect(view.state.doc.toString()).toContain("组合");
    view.contentDOM.dispatchEvent(
      new Event("compositionend", { bubbles: true }),
    );
    expect(getDecorationBuildCount()).toBe(base + 1);
    destroy();
  });
});
