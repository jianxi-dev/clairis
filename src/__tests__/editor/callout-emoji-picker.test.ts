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
import { CALLOUT_EMOJI_CHOICES } from "../../editors/callout-types";

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
    localStorage.clear();
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

    // 契约变化（#1657）：新库是全局搜索，结果可含其它带 rocket 关键词的
    // emoji（如 🚀 之外的火箭/发射类），所以断言「包含 🚀」而非「仅 🚀」。
    const visible = Array.from(
      view.dom.querySelectorAll<HTMLButtonElement>(
        '[data-testid="cm-callout-emoji-option"]',
      ),
    );
    expect(visible.map((btn) => btn.getAttribute("data-emoji"))).toContain(
      "🚀",
    );
  });

  it("页签恰 8 个且顺序正确", async () => {
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();

    const tabs = Array.from(
      view.dom.querySelectorAll<HTMLButtonElement>(
        '[data-testid="cm-callout-emoji-tab"]',
      ),
    );
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "最近",
      "表情符号",
      "动物",
      "食物",
      "活动",
      "地点",
      "物件",
      "符号",
    ]);
  });

  it("「最近」页签的「常用」段项数与 CALLOUT_EMOJI_CHOICES 一致", async () => {
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();

    const sections = Array.from(
      view.dom.querySelectorAll<HTMLElement>(
        ".cm-callout-emoji-section",
      ),
    );
    const frequent = sections.find((section) =>
      section.querySelector(".cm-callout-emoji-section-title")?.textContent ===
      "常用",
    );
    expect(frequent).toBeDefined();
    const freqGrid = frequent?.querySelector(".cm-callout-emoji-grid");
    expect(freqGrid).toBeDefined();
    expect(
      freqGrid?.querySelectorAll('[data-testid="cm-callout-emoji-option"]')
        .length,
    ).toBe(CALLOUT_EMOJI_CHOICES.length);
  });

  it("点击 emoji 后写入最近，重开「最近」段出现且最新在前", async () => {
    localStorage.clear();
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();

    const rocket = optionByEmoji("🚀");
    expect(rocket).not.toBeNull();
    rocket?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(localStorage.getItem("biaoyue.callout-emoji.recent.v1")).toContain(
      "🚀",
    );

    // 重开取色器：最近段应出现 🚀。
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    const sections = Array.from(
      view.dom.querySelectorAll<HTMLElement>(
        ".cm-callout-emoji-section",
      ),
    );
    const recent = sections.find((section) =>
      section.querySelector(".cm-callout-emoji-section-title")?.textContent ===
      "最近",
    );
    expect(recent).toBeDefined();
    const recentChars = Array.from(
      recent?.querySelectorAll<HTMLButtonElement>(
        '[data-testid="cm-callout-emoji-option"]',
      ) ?? [],
    ).map((btn) => btn.getAttribute("data-emoji"));
    expect(recentChars[0]).toBe("🚀");
  });

  it("重复选择不重复写入最近", async () => {
    localStorage.clear();
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    for (let i = 0; i < 2; i += 1) {
      optionByEmoji("🎉")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      if (i === 0) {
        icon().dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
        );
        await nextFrame();
      }
    }
    const stored = JSON.parse(
      localStorage.getItem("biaoyue.callout-emoji.recent.v1") ?? "[]",
    ) as string[];
    expect(stored.filter((char) => char === "🎉").length).toBe(1);
  });

  it("清空 localStorage 后最近段不渲染", async () => {
    localStorage.clear();
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    const sections = Array.from(
      view.dom.querySelectorAll<HTMLElement>(
        ".cm-callout-emoji-section",
      ),
    );
    expect(
      sections.some(
        (section) =>
          section.querySelector(".cm-callout-emoji-section-title")
            ?.textContent === "最近",
      ),
    ).toBe(false);
  });

  it("点「随机」后卡片 emoji 变化且取色器仍在", async () => {
    localStorage.clear();
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    const before = card().getAttribute("data-callout-emoji");

    view.dom
      .querySelector<HTMLButtonElement>(
        '[data-testid="cm-callout-emoji-random"]',
      )
      ?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );

    const after = card().getAttribute("data-callout-emoji");
    expect(after).not.toBe(before);
    expect(
      view.dom.querySelector('[data-testid="cm-callout-emoji-picker"]'),
    ).not.toBeNull();
  });

  it("类型切换后显示新类型默认图标", async () => {
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    optionByEmoji("🎯")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(card().getAttribute("data-callout-emoji")).toBe("🎯");

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: "> [!TIP]\n> callout body",
      },
    });
    view.requestMeasure();
    expect(card().getAttribute("data-callout-type")).toBe("tip");
    expect(card().getAttribute("data-callout-emoji")).toBe("💡");
  });

  it("document 级 Esc 关闭取色器（焦点不在取色器内部）", async () => {
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();
    expect(
      view.dom.querySelector('[data-testid="cm-callout-emoji-picker"]'),
    ).not.toBeNull();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(
      view.dom.querySelector('[data-testid="cm-callout-emoji-picker"]'),
    ).toBeNull();
  });

  it("「最近」页签连抽两次后最近段出现且最新在前", async () => {
    localStorage.clear();
    icon().dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await nextFrame();

    const randomBtn = view.dom.querySelector<HTMLButtonElement>(
      '[data-testid="cm-callout-emoji-random"]',
    );
    expect(randomBtn).not.toBeNull();
    for (let i = 0; i < 2; i += 1) {
      randomBtn?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    }

    const currentEmoji = card().getAttribute("data-callout-emoji");
    const sections = Array.from(
      view.dom.querySelectorAll<HTMLElement>(".cm-callout-emoji-section"),
    );
    const recent = sections.find(
      (section) =>
        section.querySelector(".cm-callout-emoji-section-title")?.textContent ===
        "最近",
    );
    expect(recent).toBeDefined();
    const recentChars = Array.from(
      recent?.querySelectorAll<HTMLButtonElement>(
        '[data-testid="cm-callout-emoji-option"]',
      ) ?? [],
    ).map((btn) => btn.getAttribute("data-emoji"));
    expect(recentChars.length).toBeGreaterThanOrEqual(2);
    expect(recentChars[0]).toBe(currentEmoji);
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
