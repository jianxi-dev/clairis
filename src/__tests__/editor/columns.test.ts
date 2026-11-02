/**
 * 分栏布局装饰测试（移植自 md-bundle `src/decorations/columns.ts`，无独立上游测试）。
 *
 * 覆盖：`::: {.col-N}` 渲染成多栏 widget、原始 `:::` 标记隐藏、`cols:` 宽度、
 * 空块仍渲染 N 个占位栏、点击栏正文开就地编辑器并写回源码。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  editorDecorations,
  resetDecorationGuards,
} from "../../editors/decorations";
import { createColumnsDecorations } from "../../editors/decorations/columns";

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

interface WidgetLike {
  toDOM(): HTMLElement;
}

function widgetOf(deco: { value: Decoration }): WidgetLike {
  return deco.value.spec.widget as unknown as WidgetLike;
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 30));

describe("columns decoration", () => {
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

  function createEditor(doc: string): EditorView {
    return new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown(), editorDecorations()],
      }),
    });
  }

  function placeCursor(pos: number): void {
    view.dispatch({ selection: { anchor: pos } });
    view.requestMeasure();
  }

  it("把 `::: {.col-2}` 渲染成两栏 widget", () => {
    const doc = "::: {.col-2}\n左\n\n右\n:::";
    view = createEditor(doc);
    placeCursor(doc.length);

    const columns = view.dom.querySelector('[data-testid="cm-columns"]');
    expect(columns).not.toBeNull();
    expect(columns?.classList.contains("cm-columns-2")).toBe(true);
    expect(columns?.querySelectorAll(".cm-column")).toHaveLength(2);
  });

  it("非活跃块隐藏原始 `:::` 标记", () => {
    const doc = "::: {.col-2}\n左\n\n右\n:::";
    view = createEditor(doc);
    placeCursor(doc.length);

    const text = view.dom.querySelector(".cm-content")?.textContent ?? "";
    expect(text).not.toContain(":::");
    expect(text).not.toContain("{.col-2}");
    expect(text).toContain("左");
    expect(text).toContain("右");
  });

  it("空块也渲染 N 个占位栏", () => {
    const doc = "::: {.col-3}\n:::";
    view = createEditor(doc);
    placeCursor(doc.length);

    const columns = view.dom.querySelector('[data-testid="cm-columns"]');
    expect(columns?.querySelectorAll(".cm-column")).toHaveLength(3);
  });

  it("声明 cols: 时按百分比分配栏宽", () => {
    const doc = "::: {.col-2 cols:40,60}\n左\n\n右\n:::";
    const decos = createColumnsDecorations(doc);
    expect(decos).toHaveLength(1);
    const dom = widgetOf(decos[0]).toDOM();
    const cols = dom.querySelectorAll<HTMLElement>(".cm-column");
    expect(cols[0]?.style.flex).toBe("0 0 calc(40% - 8px)");
    expect(cols[1]?.style.flex).toBe("0 0 calc(60% - 8px)");
  });

  it("未声明 cols: 时等分", () => {
    const doc = "::: {.col-2}\n左\n\n右\n:::";
    const decos = createColumnsDecorations(doc);
    const dom = widgetOf(decos[0]).toDOM();
    const cols = dom.querySelectorAll<HTMLElement>(".cm-column");
    expect(cols[0]?.style.flex).toBe("0 0 calc(50% - 8px)");
    expect(cols[1]?.style.flex).toBe("0 0 calc(50% - 8px)");
  });

  it("忽略没有 .col-N 的围栏 div", () => {
    expect(createColumnsDecorations("::: {.note}\n内容\n:::").length).toBe(0);
    expect(createColumnsDecorations("普通段落").length).toBe(0);
    // 未闭合的围栏不渲染。
    expect(createColumnsDecorations("::: {.col-2}\n左").length).toBe(0);
  });

  it("保留文档值（widget 只影响视图）", () => {
    const doc = "::: {.col-2}\n左\n\n右\n:::";
    view = createEditor(doc);
    expect(view.state.doc.toString()).toBe(doc);
  });

  it("点击栏正文开就地编辑器，提交写回源码", async () => {
    const doc = "::: {.col-2}\n左\n\n右\n:::";
    view = createEditor(doc);
    placeCursor(doc.length);

    const body = view.dom.querySelector<HTMLElement>(
      '.cm-column[data-col="0"] .cm-column-body',
    );
    expect(body).not.toBeNull();
    body?.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );

    const area = view.dom.querySelector<HTMLTextAreaElement>(
      '[data-testid="cm-column-editor"]',
    );
    expect(area).not.toBeNull();
    expect(area?.value).toBe("左");

    if (!area) return;
    area.value = "新左";
    area.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await nextFrame();

    expect(view.state.doc.toString()).toContain("新左");
  });
});
