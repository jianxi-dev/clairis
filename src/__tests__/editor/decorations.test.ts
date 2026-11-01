/**
 * 活源码装饰装配测试（移植自 md-bundle packages/editor/test/decorations.test.ts）。
 *
 * 覆盖五个基础装饰模块（标题 / 加粗斜体 / 列表 / 引用 / 行内代码）的两态渲染、
 * 光标进出块的语义揭示、IME 组合守卫与指针冻结守卫。装饰只影响视图：
 * 文档值在任何用例里都不得改变（红线 5：显示 = 源码）。
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

describe("editorDecorations", () => {
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

  /** 建一个挂了装饰扩展的 markdown 编辑器。 */
  function createEditor(doc: string): EditorView {
    return new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown(), editorDecorations()],
      }),
    });
  }

  /** 把光标移到 `pos` 并等一次测量，让装饰重算落到 DOM。 */
  function placeCursor(pos: number): void {
    view.dispatch({ selection: { anchor: pos } });
    view.requestMeasure();
  }

  // --- 标题 ---

  describe("heading decoration", () => {
    it("hides the `# ` marker when the cursor is outside the heading", () => {
      view = createEditor("# Title\n\nParagraph");
      placeCursor(10);

      const marker = view.dom.querySelector(".cm-heading-marker");
      expect(marker).not.toBeNull();
      expect(marker?.textContent).toBe("# ");
      expect(marker?.classList.contains("cm-heading-marker-active")).toBe(
        false,
      );
    });

    it("reveals the marker at low opacity when the cursor enters the heading", () => {
      view = createEditor("# Title");
      placeCursor(1);

      const marker = view.dom.querySelector(".cm-heading-marker-active");
      expect(marker).not.toBeNull();
      expect(marker?.textContent).toBe("# ");
    });

    it("treats a cursor at the end of the heading line as inside the block", () => {
      // 光标停在行末（刚打完 `## 标题`）时 getBlockAt 的 [from, to) 判定不命中，
      // 装配层回退到「包含该位置」的块，否则行尾光标永远看不到结构标记。
      view = createEditor("## 标题");
      placeCursor(5);

      expect(
        view.dom.querySelector(".cm-heading-marker-active"),
      ).not.toBeNull();
      expect(
        view.dom.querySelector(".cm-heading.cm-h2.cm-block-active"),
      ).not.toBeNull();
    });

    it("scales the heading text by level", () => {
      view = createEditor("## Section");
      placeCursor(0);

      const heading = view.dom.querySelector(".cm-heading.cm-h2");
      expect(heading).not.toBeNull();
      expect(heading?.textContent).toBe("Section");
    });

    it("preserves the document value (marker is view-only)", () => {
      view = createEditor("# Title");
      expect(view.state.doc.toString()).toBe("# Title");
    });

    it("does not throw on an empty heading and keeps typing possible", () => {
      // 斜杠菜单插入 `# ` 后的瞬间：正文范围宽度为 0，CM6 拒绝空 mark。
      view = createEditor("# ");
      expect(() => placeCursor(2)).not.toThrow();
      expect(view.dom.querySelector(".cm-heading-marker")).not.toBeNull();

      view.dispatch({ changes: { from: 2, insert: "标题" } });
      expect(view.state.doc.toString()).toBe("# 标题");
      expect(view.dom.querySelector(".cm-heading.cm-h1")?.textContent).toBe(
        "标题",
      );
    });
  });

  // --- 加粗 / 斜体 ---

  describe("boldItalic decoration", () => {
    it("hides `**` and applies the strong class", () => {
      view = createEditor("A **bold** B");
      placeCursor(0);

      const strong = view.dom.querySelector(".cm-strong");
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe("bold");
      expect(view.dom.querySelector(".cm-content")?.textContent).not.toContain(
        "**",
      );
    });

    it("hides `*` and applies the em class", () => {
      view = createEditor("A *italic* B");
      placeCursor(0);

      const em = view.dom.querySelector(".cm-em");
      expect(em).not.toBeNull();
      expect(em?.textContent).toBe("italic");
    });

    it("keeps the strong class when the cursor enters the bold range", () => {
      view = createEditor("A **bold** B");
      placeCursor(4);

      const strong = view.dom.querySelector(".cm-strong");
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe("bold");
    });

    it("hides mdb-bg-* span tags and applies the cm-bg-* class", () => {
      const value = 'A <span class="mdb-bg-blue">tinted</span> B';
      view = createEditor(value);

      const tinted = view.dom.querySelector(".cm-bg-blue");
      expect(tinted).not.toBeNull();
      expect(tinted?.textContent).toBe("tinted");
      expect(view.state.doc.toString()).toBe(value);
    });

    it("nested <u> inside a color span renders underline instead of raw tags (#467)", () => {
      const value = '正文<span class="mdb-color-red"><u>段落</u></span>。';
      view = createEditor(value);

      expect(view.dom.querySelector(".cm-color-red")?.textContent).toBe("段落");
      expect(view.dom.querySelector(".cm-underline")?.textContent).toBe("段落");
      expect(view.dom.textContent).not.toContain("<u>");
      expect(view.dom.textContent).not.toContain("<span");
      expect(view.state.doc.toString()).toBe(value);
    });
  });

  // --- 列表 ---

  describe("list decoration", () => {
    it("hides `- ` and applies the list class", () => {
      view = createEditor("- item one");
      placeCursor(0);

      expect(view.dom.querySelector(".cm-list")).not.toBeNull();
      expect(view.dom.querySelector(".cm-content")?.textContent).not.toContain(
        "- ",
      );
    });

    it("keeps the `- ` marker hidden when the cursor enters the list line (#235)", () => {
      view = createEditor("- item one");
      placeCursor(1);

      const content = view.dom.querySelector(".cm-content");
      expect(content?.textContent).not.toContain("- ");
      expect(content?.textContent).toContain("item one");
      expect(view.dom.querySelector(".cm-list")).not.toBeNull();
    });

    it("renders ordered markers as text, never as a bullet (#176)", () => {
      view = createEditor("1. first\n2. second");
      placeCursor(0);

      expect(view.dom.querySelectorAll(".cm-list-ordered")).toHaveLength(2);
      const content = view.dom.querySelector(".cm-content");
      expect(content?.textContent).toContain("1. ");
      expect(content?.textContent).toContain("2. ");
    });

    it("applies task-done / task-pending classes", () => {
      view = createEditor("- [x] done\n- [ ] pending");
      placeCursor(0);

      expect(view.dom.querySelector(".cm-task-done")).not.toBeNull();
      expect(view.dom.querySelector(".cm-task-pending")).not.toBeNull();
    });

    it("renders a clickable checkbox that writes back to the source", () => {
      view = createEditor("- [ ] pending");
      placeCursor(0);

      const box = view.dom.querySelector(
        ".cm-task-checkbox",
      ) as HTMLElement | null;
      expect(box).not.toBeNull();
      expect(box?.getAttribute("aria-checked")).toBe("false");

      box!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(view.state.doc.toString()).toBe("- [x] pending");
    });

    it("preserves the document value", () => {
      const text = "- item one\n1. first\n- [x] done\n- [ ] pending";
      view = createEditor(text);
      expect(view.state.doc.toString()).toBe(text);
    });
  });

  // --- 引用 ---

  describe("quote decoration", () => {
    it("hides `> ` and applies the quote class", () => {
      // 光标放在引用块外的段落上：光标停在块首时 CM6 会保留一个 widget buffer
      // 承载光标，替换装饰因此让位。
      view = createEditor("> quoted text\n\nParagraph");
      placeCursor(17);

      expect(view.dom.querySelector(".cm-quote")).not.toBeNull();
      expect(view.dom.querySelector(".cm-quote-marker-active")).toBeNull();
      expect(view.dom.querySelector(".cm-content")?.textContent).not.toContain(
        "> ",
      );
    });

    it("shows the raw `> ` when the cursor enters the quote line", () => {
      view = createEditor("> quoted text");
      placeCursor(1);

      expect(view.dom.querySelector(".cm-quote")).not.toBeNull();
      expect(view.dom.querySelector(".cm-quote-marker-active")).not.toBeNull();
      expect(view.dom.querySelector(".cm-content")?.textContent).toContain(
        "> ",
      );
    });

    it("preserves the document value", () => {
      view = createEditor("> quoted text");
      expect(view.state.doc.toString()).toBe("> quoted text");
    });
  });

  // --- 行内代码 ---

  describe("inline code decoration", () => {
    it("hides backticks and applies the inline-code class", () => {
      view = createEditor("Use `code` here\n\nParagraph");
      placeCursor(20);

      const code = view.dom.querySelector(".cm-inline-code");
      expect(code).not.toBeNull();
      expect(code?.textContent).toBe("code");
      expect(view.dom.querySelector(".cm-content")?.textContent).not.toContain(
        "`",
      );
    });

    it("reveals faint backticks when the cursor enters the code range", () => {
      view = createEditor("Use `code` here");
      placeCursor(5);

      expect(
        view.dom.querySelector(".cm-inline-code.cm-block-active"),
      ).not.toBeNull();
      expect(view.dom.querySelectorAll(".cm-code-marker-active")).toHaveLength(
        2,
      );
    });

    it("preserves the document value", () => {
      view = createEditor("Use `code` here");
      expect(view.state.doc.toString()).toBe("Use `code` here");
    });
  });

  // --- 光标离开后恢复 ---

  describe("cursor leaving the block restores the rendered state", () => {
    it("re-hides the heading marker after the cursor moves to another block", () => {
      view = createEditor("# Title\n\nParagraph");
      placeCursor(1);
      expect(
        view.dom.querySelector(".cm-heading-marker-active"),
      ).not.toBeNull();

      placeCursor(10);
      expect(view.dom.querySelector(".cm-heading-marker-active")).toBeNull();
      expect(view.dom.querySelector(".cm-heading-marker")).not.toBeNull();
    });

    it("restores the hidden `> ` after the cursor leaves the quote", () => {
      view = createEditor("> quoted text\n\nParagraph");
      placeCursor(1);
      expect(view.dom.querySelector(".cm-quote-marker-active")).not.toBeNull();

      placeCursor(17);
      expect(view.dom.querySelector(".cm-quote-marker-active")).toBeNull();
      expect(view.dom.querySelector(".cm-content")?.textContent).not.toContain(
        "> ",
      );
    });
  });

  // --- IME 组合守卫 ---

  describe("IME composition guard", () => {
    it("skips the rebuild while composing and catches up on compositionend", () => {
      view = createEditor("# Hello");
      placeCursor(7);
      expect(view.dom.querySelectorAll(".cm-heading-marker")).toHaveLength(1);

      // CM6 把 ViewPlugin 的 eventHandlers 挂在 .cm-content 上，不是 .cm-editor。
      const contentDOM = view.dom.querySelector(".cm-content")!;
      contentDOM.dispatchEvent(
        new Event("compositionstart", { bubbles: true }),
      );

      // 组合期间插入 "X" 打断标题模式：无守卫会立刻重建（标记数掉到 0）。
      view.dispatch({
        changes: { from: 0, insert: "X" },
        selection: { anchor: 7 },
      });
      expect(view.dom.querySelectorAll(".cm-heading-marker")).toHaveLength(1);

      // 组合结束：补建，装饰追上最终文本。
      contentDOM.dispatchEvent(new Event("compositionend", { bubbles: true }));
      view.requestMeasure();
      expect(view.dom.querySelectorAll(".cm-heading-marker")).toHaveLength(0);
      expect(view.state.doc.toString()).toBe("X# Hello");
    });
  });

  // --- 指针冻结守卫 ---

  describe("pointerdown freeze", () => {
    it("skips a selection-only rebuild while frozen but still rebuilds on doc change", () => {
      view = createEditor("# Title\n\nParagraph");
      placeCursor(10);
      expect(view.dom.querySelector(".cm-heading-marker-active")).toBeNull();

      // 冻结：pointerdown 后 100ms 内只跳过纯选区事务。
      view.dom
        .querySelector(".cm-content")!
        .dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      placeCursor(1);
      // 冻结期内的选区变化不揭示标记。
      expect(view.dom.querySelector(".cm-heading-marker-active")).toBeNull();

      // 冻结期内文档变更必须重建——旧 DecorationSet 的范围按旧文档算，
      // 套到新文本上会让可见层落后于源码（#226）。
      view.dispatch({ changes: { from: 7, insert: "\n\n# Second" } });
      expect(view.dom.querySelectorAll(".cm-heading-marker")).toHaveLength(2);
    });

    it("rebuilds once the freeze lifts", async () => {
      view = createEditor("# Title\n\nParagraph");
      placeCursor(10);

      view.dom
        .querySelector(".cm-content")!
        .dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      placeCursor(1);
      expect(view.dom.querySelector(".cm-heading-marker-active")).toBeNull();

      // 100ms 冻结结束后派发 unfreezeRebuild，装饰补建到当前选区。
      await new Promise((resolve) => setTimeout(resolve, 150));
      view.requestMeasure();
      expect(
        view.dom.querySelector(".cm-heading-marker-active"),
      ).not.toBeNull();
    });
  });

  // --- 文档值不变量 ---

  describe("document value invariant", () => {
    it("never changes the doc value across all decoration types combined", () => {
      const original = [
        "# Heading",
        "",
        "A **bold** and *italic* sentence.",
        "",
        "- list item",
        "1. ordered item",
        "- [x] done",
        "- [ ] todo",
        "",
        "> blockquote",
        "",
        "Inline `code` here",
      ].join("\n");

      view = createEditor(original);
      expect(view.state.doc.toString()).toBe(original);
    });
  });
});
