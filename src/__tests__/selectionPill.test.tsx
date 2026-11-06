// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const { editorViewFake } = vi.hoisted(() => ({
  editorViewFake: {
    current: null as null | {
      dom: HTMLElement;
      posAtDOM: (node: Node, offset: number) => number;
    },
  },
}));

vi.mock("../editors/editorRef", () => ({
  getActiveEditorView: () => editorViewFake.current,
}));

import SelectionPill from "../components/ai/SelectionPill";
import { useAiEntryStore } from "../hooks/useAiEntry";

const RECT: DOMRect = {
  left: 100,
  top: 200,
  width: 80,
  height: 20,
  right: 180,
  bottom: 220,
  x: 100,
  y: 200,
  toJSON: () => ({}),
} as DOMRect;

function mockSelection(text: string, anchor: Node, focus: Node): Selection {
  const range = {
    getBoundingClientRect: () => RECT,
  } as Range;
  return {
    isCollapsed: false,
    rangeCount: 1,
    anchorNode: anchor,
    focusNode: focus,
    anchorOffset: 0,
    focusOffset: 0,
    toString: () => text,
    getRangeAt: () => range,
  } as unknown as Selection;
}

function collapsedSelection(): Selection {
  return {
    isCollapsed: true,
    rangeCount: 0,
    anchorNode: null,
    focusNode: null,
    toString: () => "",
    getRangeAt: () => {
      throw new Error("no range");
    },
  } as unknown as Selection;
}

function textNodeOf(el: HTMLElement): Text {
  const node = el.firstChild;
  if (!(node instanceof Text)) throw new Error("缺少文本节点");
  return node;
}

function fireSelectionChange(): void {
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });
}

function pillLabels(): string[] {
  const pill = document.querySelector<HTMLElement>("[data-selection-pill]");
  if (!pill) throw new Error("选区胶囊未渲染");
  return Array.from(pill.querySelectorAll("button")).map(
    (b) => b.textContent ?? "",
  );
}

function makePreview(text: string): HTMLElement {
  const preview = document.createElement("div");
  preview.className = "preview-content";
  const p = document.createElement("p");
  p.textContent = text;
  preview.appendChild(p);
  document.body.appendChild(preview);
  return p;
}

async function clickButton(label: string): Promise<void> {
  const pill = document.querySelector<HTMLElement>("[data-selection-pill]");
  if (!pill) throw new Error("选区胶囊未渲染");
  const btn = Array.from(pill.querySelectorAll("button")).find(
    (b) => b.textContent === label,
  );
  if (!btn) throw new Error(`缺少动作按钮：${label}`);
  await act(async () => {
    btn.click();
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ text: "这是 AI 返回的结果。" });
  editorViewFake.current = null;
  vi.spyOn(window, "getSelection");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  useAiEntryStore.setState({
    overlayOpen: false,
    input: "",
    submitting: false,
    messages: [],
    pendingConfirm: null,
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("SelectionPill 阅读态（.preview-content 选区）", () => {
  it("选区落在预览渲染区时出现胶囊，动作恰好 复制/解释/翻译 三个", () => {
    const p = makePreview("这是预览正文");
    vi.mocked(window.getSelection).mockReturnValue(
      mockSelection("这是预览正文", textNodeOf(p), textNodeOf(p)),
    );
    render(<SelectionPill />);
    fireSelectionChange();

    const pill = document.querySelector<HTMLElement>("[data-selection-pill]");
    expect(pill).not.toBeNull();
    expect(pill!.getAttribute("data-selection-pill-mode")).toBe("preview");
    expect(pillLabels()).toEqual(["复制", "解释", "翻译"]);
  });

  it("点复制把选区文本写进剪贴板并关闭胶囊", async () => {
    const p = makePreview("这是预览正文");
    vi.mocked(window.getSelection).mockReturnValue(
      mockSelection("这是预览正文", textNodeOf(p), textNodeOf(p)),
    );
    render(<SelectionPill />);
    fireSelectionChange();

    await clickButton("复制");

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("这是预览正文");
    expect(document.querySelector("[data-selection-pill]")).toBeNull();
  });

  it("点解释打开 AI 浮层并预填选区文本", async () => {
    const p = makePreview("这是预览正文");
    vi.mocked(window.getSelection).mockReturnValue(
      mockSelection("这是预览正文", textNodeOf(p), textNodeOf(p)),
    );
    render(<SelectionPill />);
    fireSelectionChange();

    await clickButton("解释");

    const ai = useAiEntryStore.getState();
    expect(ai.overlayOpen).toBe(true);
    expect(ai.input).toContain("这是预览正文");
    expect(document.querySelector("[data-selection-pill]")).toBeNull();
  });

  it("点翻译打开 AI 浮层并预填选区文本", async () => {
    const p = makePreview("这是预览正文");
    vi.mocked(window.getSelection).mockReturnValue(
      mockSelection("这是预览正文", textNodeOf(p), textNodeOf(p)),
    );
    render(<SelectionPill />);
    fireSelectionChange();

    await clickButton("翻译");

    const ai = useAiEntryStore.getState();
    expect(ai.overlayOpen).toBe(true);
    expect(ai.input).toContain("这是预览正文");
  });
});

describe("SelectionPill 编辑态（不回归）", () => {
  it("选区落在编辑器内时动作仍为 改写/翻译/润色 三个", () => {
    const cm = document.createElement("div");
    cm.className = "cm-content";
    cm.textContent = "这是编辑区文本";
    document.body.appendChild(cm);
    editorViewFake.current = { dom: cm, posAtDOM: () => 0 };

    vi.mocked(window.getSelection).mockReturnValue(
      mockSelection("这是编辑区文本", textNodeOf(cm), textNodeOf(cm)),
    );
    render(<SelectionPill />);
    fireSelectionChange();

    const pill = document.querySelector<HTMLElement>("[data-selection-pill]");
    expect(pill).not.toBeNull();
    expect(pill!.getAttribute("data-selection-pill-mode")).toBe("edit");
    expect(pillLabels()).toEqual(["改写", "翻译", "润色"]);
  });

  it("编辑态动作仍走 run_agent_turn 并给出结果面板", async () => {
    const cm = document.createElement("div");
    cm.className = "cm-content";
    cm.textContent = "这是编辑区文本";
    document.body.appendChild(cm);
    editorViewFake.current = { dom: cm, posAtDOM: () => 0 };

    vi.mocked(window.getSelection).mockReturnValue(
      mockSelection("这是编辑区文本", textNodeOf(cm), textNodeOf(cm)),
    );
    render(<SelectionPill />);
    fireSelectionChange();

    await clickButton("改写");

    expect(invokeMock).toHaveBeenCalledWith("run_agent_turn", {
      messages: [
        { role: "user", content: expect.stringContaining("这是编辑区文本") },
      ],
    });
    expect(
      document.querySelector<HTMLElement>("[data-selection-diff]"),
    ).not.toBeNull();
  });
});

describe("SelectionPill 无效选区与无残留", () => {
  it("选区跨越编辑区与预览区时不显示胶囊", () => {
    const cm = document.createElement("div");
    cm.className = "cm-content";
    cm.textContent = "编辑区文本";
    document.body.appendChild(cm);
    const p = makePreview("预览正文");
    editorViewFake.current = { dom: cm, posAtDOM: () => 0 };

    vi.mocked(window.getSelection).mockReturnValue(
      mockSelection("编辑区文本预览正文", textNodeOf(cm), textNodeOf(p)),
    );
    render(<SelectionPill />);
    fireSelectionChange();

    expect(document.querySelector("[data-selection-pill]")).toBeNull();
  });

  it("选区收缩后胶囊消失", () => {
    const p = makePreview("这是预览正文");
    vi.mocked(window.getSelection).mockReturnValue(
      mockSelection("这是预览正文", textNodeOf(p), textNodeOf(p)),
    );
    render(<SelectionPill />);
    fireSelectionChange();
    expect(document.querySelector("[data-selection-pill]")).not.toBeNull();

    vi.mocked(window.getSelection).mockReturnValue(collapsedSelection());
    fireSelectionChange();
    expect(document.querySelector("[data-selection-pill]")).toBeNull();
  });

  it("按 Escape 后胶囊消失", () => {
    const p = makePreview("这是预览正文");
    vi.mocked(window.getSelection).mockReturnValue(
      mockSelection("这是预览正文", textNodeOf(p), textNodeOf(p)),
    );
    render(<SelectionPill />);
    fireSelectionChange();
    expect(document.querySelector("[data-selection-pill]")).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(document.querySelector("[data-selection-pill]")).toBeNull();
  });
});
