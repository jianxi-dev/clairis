/**
 * #361（change editor-fidelity-2 / 2.6）—— 高亮块头部 emoji 取色器。
 *
 * 驱动真实 jsdom DOM：点头部 emoji → 取色器打开 → 选一个 emoji →
 * `data-callout-emoji` 与可见字形更新。另覆盖 恢复默认 与可选搜索过滤。
 *
 * 注：本仓库 jsdom 的 `querySelector` 不支持非 ASCII 属性选择器
 * （`[data-emoji="🎉"]` 恒为 null），按属性值过滤而非属性选择器。
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

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 30));

describe("#361 高亮块 emoji 取色器", () => {
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
        doc: "> [!NOTE]\n> callout body",
        extensions: [markdown(), editorDecorations()],
      }),
    });
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();
  });

  afterEach(() => {
    view?.destroy();
    parent?.remove();
    resetDecorationGuards();
  });

  function card(): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>(".cm-callout");
    if (!el) throw new Error("callout card not rendered");
    return el;
  }

  function icon(): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>(".cm-callout-icon");
    if (!el) throw new Error("callout icon not rendered");
    return el;
  }

  /** 按 data-emoji 值找按钮（jsdom 不支持非 ASCII 属性选择器）。 */
  function optionByEmoji(emoji: string): HTMLButtonElement | null {
    return (
      Array.from(
        view.dom.querySelectorAll<HTMLButtonElement>(
          '[data-testid="cm-callout-emoji-option"]',
        ),
      ).find((btn) => btn.getAttribute("data-emoji") === emoji) ?? null
    );
  }

  it("卡片用类型默认渲染 data-callout-emoji", () => {
    expect(card().getAttribute("data-callout-emoji")).toBe("📝");
    expect(icon().textContent).toBe("📝");
  });

  it("按头部 emoji 打开取色器并在选择后关闭", async () => {
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();

    const picker = view.dom.querySelector<HTMLElement>(
      '[data-testid="cm-callout-emoji-picker"]',
    );
    expect(picker).not.toBeNull();

    const option = optionByEmoji("🎉");
    expect(option).not.toBeNull();
    option?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(card().getAttribute("data-callout-emoji")).toBe("🎉");
    expect(icon().textContent).toBe("🎉");
    expect(
      view.dom.querySelector('[data-testid="cm-callout-emoji-picker"]'),
    ).toBeNull();
  });

  it("通过 恢复默认 回到类型默认", async () => {
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    optionByEmoji("🔥")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(icon().textContent).toBe("🔥");

    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    view.dom
      .querySelector<HTMLButtonElement>(
        '[data-testid="cm-callout-emoji-reset"]',
      )
      ?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );

    expect(card().getAttribute("data-callout-emoji")).toBe("📝");
    expect(icon().textContent).toBe("📝");
  });

  it("按外部关闭取色器", async () => {
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    expect(
      view.dom.querySelector('[data-testid="cm-callout-emoji-picker"]'),
    ).not.toBeNull();

    document.body.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    expect(
      view.dom.querySelector('[data-testid="cm-callout-emoji-picker"]'),
    ).toBeNull();
  });

  it("搜索框过滤网格", async () => {
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();

    const search = view.dom.querySelector<HTMLInputElement>(
      '[data-testid="cm-callout-emoji-search"]',
    );
    if (!search) throw new Error("search box missing");
    search.value = "rocket";
    search.dispatchEvent(new Event("input", { bubbles: true }));

    const visible = Array.from(
      view.dom.querySelectorAll<HTMLButtonElement>(
        '[data-testid="cm-callout-emoji-option"]',
      ),
    ).filter((btn) => btn.style.display !== "none");
    expect(visible.map((btn) => btn.getAttribute("data-emoji"))).toEqual([
      "🚀",
    ]);
  });

  it("文档编辑后 widget 重建仍保留所选 emoji", async () => {
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    optionByEmoji("🎯")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(icon().textContent).toBe("🎯");

    // 文档编辑从源码重建装饰（markdown 里没有 emoji）；会话覆盖必须活下来。
    view.dispatch({
      changes: { from: view.state.doc.length, insert: " more" },
    });
    view.requestMeasure();
    expect(card().getAttribute("data-callout-emoji")).toBe("🎯");
    expect(icon().textContent).toBe("🎯");
  });
});
