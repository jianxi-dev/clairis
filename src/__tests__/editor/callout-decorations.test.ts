/**
 * 高亮块卡片装饰测试（移植自 md-bundle `test/decorations-callout.test.ts`，task 3.3）。
 *
 * 测高亮块卡片装饰（引用块式高亮块语法）。装饰只影响视图：文档值永不改变。
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

describe("editorDecorations 高亮块支持", () => {
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

  /** 光标移出高亮块范围，避免选区揭示把它压掉。 */
  function placeCursor(pos: number): void {
    view.dispatch({ selection: { anchor: pos } });
    view.requestMeasure();
  }

  // --- 卡片渲染 -------------------------------------------------------------

  describe("callout card rendering", () => {
    it("合法高亮块语法渲染出卡片", () => {
      view = createEditor("> [!NOTE] 标题\n> 内容");
      placeCursor(view.state.doc.length);

      const widget = view.dom.querySelector(".cm-callout");
      expect(widget).not.toBeNull();
      // #468：徽标/占位已移除——身份挂在元素上。
      expect(widget?.getAttribute("data-callout-type")).toBe("note");
      // 源码里显式写了标题，标题仍渲染。
      expect(widget?.querySelector(".cm-callout-title")?.textContent).toBe(
        "标题",
      );
    });

    it("保留文档值（widget 只影响视图）", () => {
      view = createEditor("> [!NOTE] 标题\n> 内容");
      expect(view.state.doc.toString()).toBe("> [!NOTE] 标题\n> 内容");
    });
  });

  // --- 色调映射 -------------------------------------------------------------

  describe("tone mapping", () => {
    it("不同高亮块类型映射到不同色调", () => {
      const types = ["NOTE", "TIP", "WARNING", "DANGER"];
      const tones = ["blue", "green", "orange", "red"];

      for (let i = 0; i < types.length; i++) {
        view = createEditor(`> [!${types[i]}] 标题\n> 内容`);
        placeCursor(view.state.doc.length);

        const widget = view.dom.querySelector(".cm-callout");
        expect(widget).not.toBeNull();
        expect(widget?.classList.contains(`cm-callout-tone-${tones[i]}`)).toBe(
          true,
        );

        view.destroy();
      }
    });
  });

  // --- 非法类型回落 ---------------------------------------------------------

  describe("invalid callout type fallback", () => {
    it("非法类型 [!FOO] 不加装饰", () => {
      view = createEditor("> [!FOO] xxx\n> 内容");
      placeCursor(view.state.doc.length);

      expect(view.dom.querySelector(".cm-callout")).toBeNull();
      // 回落到普通引用块。
      expect(view.dom.querySelector(".cm-quote")).not.toBeNull();
    });
  });

  // --- 无标题时的类型标签 ---------------------------------------------------

  describe("default title from label", () => {
    it("缺标题时用类型标签", () => {
      view = createEditor("> [!TIP]\n> 内容");
      placeCursor(view.state.doc.length);

      const widget = view.dom.querySelector(".cm-callout");
      expect(widget).not.toBeNull();
      // #468：类型徽标已移除；卡片用 data 暴露类型，头部只留 emoji。
      expect(widget?.getAttribute("data-callout-type")).toBe("tip");
      expect(widget?.querySelector(".cm-callout-badge")).toBeNull();
    });
  });

  // --- 多行高亮块 -----------------------------------------------------------

  describe("multi-line callout", () => {
    it("多行合并成单张卡片", () => {
      view = createEditor("> [!NOTE] 标题\n> 第一行\n> 第二行\n> 第三行");
      placeCursor(view.state.doc.length);

      const widget = view.dom.querySelector(".cm-callout");
      expect(widget).not.toBeNull();
      const text = widget?.textContent ?? "";
      expect(text).toContain("第一行");
      expect(text).toContain("第二行");
      expect(text).toContain("第三行");
    });
  });

  // --- 源码被替换 ---------------------------------------------------------

  describe("source replacement", () => {
    it("显示卡片时隐藏原始 markdown 标记", () => {
      view = createEditor("> [!NOTE] 标题\n> 内容");
      placeCursor(view.state.doc.length);

      expect(view.dom.querySelector(".cm-callout")).not.toBeNull();
      const text = view.dom.querySelector(".cm-content")?.textContent ?? "";
      expect(text).not.toContain("[!NOTE]");
      expect(text).not.toContain("> [!");
    });
  });

  // --- 语义编辑两态 ---------------------------------------------------------

  describe("semantic editing mode", () => {
    it("光标进入块时保持卡片渲染", () => {
      view = createEditor("> [!NOTE] 标题\n> 内容");

      placeCursor(view.state.doc.length);
      expect(view.dom.querySelector(".cm-callout")).not.toBeNull();

      // #333：高亮块绝不塌缩成源码；卡片保持渲染。
      placeCursor(1);
      expect(view.dom.querySelector(".cm-callout")).not.toBeNull();
      expect(
        view.dom.querySelector(".cm-content")?.textContent ?? "",
      ).not.toContain("[!NOTE]");
    });

    it("光标离开块后仍保持卡片渲染", () => {
      view = createEditor("> [!NOTE] 标题\n> 内容");

      placeCursor(1);
      expect(view.dom.querySelector(".cm-callout")).not.toBeNull();

      placeCursor(view.state.doc.length);
      expect(view.dom.querySelector(".cm-callout")).not.toBeNull();
    });
  });
});
