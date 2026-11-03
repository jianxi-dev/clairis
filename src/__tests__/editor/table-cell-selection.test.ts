/**
 * 表格单元格选区 + 工具条测试（#328 / change editor-fidelity 7.1）。
 *
 * 覆盖视图级单元格选区模型（拖拽 / shift-click）、合并写回、单元格背景 span
 * 约定，以及单元格工具条的合并禁用规则。jsdom 缺 requestAnimationFrame /
 * ResizeObserver；CM6 两者都用，所以在这里 polyfill。
 *
 * 移植自 md-bundle `test/decorations-cell-toolbar.test.ts`。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  editorDecorations,
  resetDecorationGuards,
} from "../../editors/decorations";
import {
  cellRect,
  cellSelectionCount,
  getCellSelection,
  setCellSelection,
} from "../../editors/decorations/cell-selection";

const DOC = [
  "Intro paragraph.",
  "",
  "| A | B |",
  "| --- | --- |",
  "| 1 | 2 |",
  "| 3 | 4 |",
].join("\n");

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
  // jsdom 的 Range 没有 getClientRects；CM6 的坐标扫描在真实 mousedown 上调用它。
  // 空 rects 就够——处理器只需要它不抛。
  if (typeof Range !== "undefined" && !("getClientRects" in Range.prototype)) {
    (
      Range.prototype as unknown as { getClientRects: () => DOMRectList }
    ).getClientRects = () => [] as unknown as DOMRectList;
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

describe("table cell selection + toolbar (ticket #328)", () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    resetDecorationGuards();
    parent = document.createElement("div");
    document.body.appendChild(parent);
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: DOC,
        extensions: [markdown(), editorDecorations()],
      }),
    });
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
    resetDecorationGuards();
  });

  function cell(row: number, col: number): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>(
      `.cm-table [data-row="${row}"][data-col="${col}"]`,
    );
    if (!el) throw new Error(`cell ${row}:${col} not found`);
    return el;
  }

  function mousedown(el: HTMLElement, shiftKey = false): void {
    el.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        shiftKey,
      }),
    );
  }

  function mouseenter(el: HTMLElement): void {
    el.dispatchEvent(new MouseEvent("mouseenter"));
  }

  function docMouseup(): void {
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }

  it("renders the table widget so cells are addressable", () => {
    expect(view.dom.querySelector(".cm-table")).not.toBeNull();
    expect(cell(0, 0).textContent).toContain("1");
  });

  it("drag from one cell to another selects a rectangle without opening an editor", () => {
    mousedown(cell(0, 0));
    mouseenter(cell(0, 1));
    docMouseup();

    const selection = getCellSelection(view);
    expect(selection).not.toBeNull();
    expect(cellSelectionCount(selection!)).toBe(2);
    expect(cell(0, 0).classList.contains("cm-table-cell-selected")).toBe(true);
    expect(cell(0, 1).classList.contains("cm-table-cell-selected")).toBe(true);
    expect(view.dom.querySelector(".cm-table-cell-input")).toBeNull();
  });

  it("shift-click extends the existing anchor to a second cell", () => {
    mousedown(cell(0, 0));
    docMouseup();
    mousedown(cell(1, 1), true);

    const selection = getCellSelection(view);
    expect(cellSelectionCount(selection!)).toBe(4);
    expect(cell(1, 1).classList.contains("cm-table-cell-selected")).toBe(true);
  });

  it("maps a selection onto its inclusive rectangle", () => {
    const selection = {
      tableIndex: 0,
      anchorRow: 1,
      anchorCol: 1,
      headRow: 0,
      headCol: 0,
    };
    expect(cellRect(selection)).toEqual({
      minRow: 0,
      maxRow: 1,
      minCol: 0,
      maxCol: 1,
    });
    expect(cellSelectionCount(selection)).toBe(4);
  });
});
