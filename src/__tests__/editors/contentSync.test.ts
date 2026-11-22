import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  CONTENT_SYNC_DEBOUNCE_MS,
  CONTENT_SYNC_MAX_DELAY_MS,
  cancelContentSync,
  flushAllContent,
  flushTabContent,
  scheduleContentSync,
} from "../../editors/contentSync";
import { useStore } from "../../stores/index";

/**
 * 输入节流（#1336 / ADR 0003 + design D3）。
 *
 * 时间是被测对象，故用 fake timers（只伪造 setTimeout/clearTimeout，不动 rAF，
 * 免得 CM6 的测量回调被卷进来）。断言落在 store 的 contentRevision 与 content：
 * 修订号是「写了几次」的单调计数，正好用来数快照写入次数。
 */

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
  if (typeof globalThis.ResizeObserver === "function") return;
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

function typeChar(view: EditorView, text: string): void {
  view.dispatch({
    changes: { from: view.state.doc.length, insert: text },
    userEvent: "input",
  });
}

describe("内容节流调度", () => {
  let parent: HTMLElement;
  let view: EditorView;
  let tabId: string;

  beforeEach(() => {
    installPolyfills();
    useStore.getState().reset();
    useStore.getState().openFile("/r/throttle.md", "起点");
    tabId = Object.keys(useStore.getState().tabs)[0];
    parent = document.createElement("div");
    document.body.appendChild(parent);
    view = new EditorView({
      parent,
      state: EditorState.create({ doc: "起点" }),
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    cancelContentSync(tabId);
    vi.useRealTimers();
    view.destroy();
    parent.remove();
  });

  it("200ms 内 10 次键入：防抖窗口内不写，trailing 300ms 只写一次", () => {
    const text = "abcdefghij";
    for (let i = 0; i < 10; i++) {
      typeChar(view, text[i]);
      scheduleContentSync(view, tabId, "main");
      vi.advanceTimersByTime(20);
    }
    // 窗口内一次都没写。
    expect(useStore.getState().tabs[tabId].contentRevision).toBe(0);
    expect(useStore.getState().tabs[tabId].content).toBe("起点");

    vi.advanceTimersByTime(CONTENT_SYNC_DEBOUNCE_MS);
    expect(useStore.getState().tabs[tabId].contentRevision).toBe(1);
    expect(useStore.getState().tabs[tabId].content).toBe(`起点${text}`);

    // 过了截止也不会有第二次写入。
    vi.advanceTimersByTime(CONTENT_SYNC_MAX_DELAY_MS);
    expect(useStore.getState().tabs[tabId].contentRevision).toBe(1);
  });

  it("连续键入：首个待写变更起 2000ms 硬截止，落一次即收敛", () => {
    let typed = "";
    const typeOne = (): void => {
      const ch = String(typed.length % 10);
      typeChar(view, ch);
      typed += ch;
      scheduleContentSync(view, tabId, "main");
    };

    // 20 次键入落在 0–1900ms：防抖被反复重置，截止仍在 2000ms。
    for (let i = 0; i < 20; i++) {
      typeOne();
      vi.advanceTimersByTime(100);
    }
    // t=2000：硬截止触发，落一次。
    expect(useStore.getState().tabs[tabId].contentRevision).toBe(1);
    expect(useStore.getState().tabs[tabId].content).toBe(`起点${typed}`);

    // 截止后又键入 5 次（2000–2400ms）：不会立刻再写，等下一轮防抖。
    for (let i = 0; i < 5; i++) {
      typeOne();
      vi.advanceTimersByTime(100);
    }
    expect(useStore.getState().tabs[tabId].contentRevision).toBe(1);
  });

  it("flushTabContent 立即写 live 全文并取消待写计时器", () => {
    typeChar(view, "未落盘的字");
    scheduleContentSync(view, tabId, "main");
    expect(useStore.getState().tabs[tabId].contentRevision).toBe(0);

    const revision = flushTabContent(tabId);
    expect(revision).toBe(1);
    expect(useStore.getState().tabs[tabId].content).toBe("起点未落盘的字");

    // 计时器已取消：再往前走也不会重复写。
    vi.advanceTimersByTime(
      CONTENT_SYNC_DEBOUNCE_MS + CONTENT_SYNC_MAX_DELAY_MS,
    );
    expect(useStore.getState().tabs[tabId].contentRevision).toBe(1);
  });

  it("flushAllContent 收敛所有已登记页签", () => {
    useStore.getState().openFile("/r/second.md", "第二篇");
    const secondId = Object.keys(useStore.getState().tabs).find(
      (id) => id !== tabId,
    )!;
    typeChar(view, "甲");
    scheduleContentSync(view, tabId, "main");

    const parent2 = document.createElement("div");
    document.body.appendChild(parent2);
    const view2 = new EditorView({
      parent: parent2,
      state: EditorState.create({ doc: "第二篇" }),
    });
    typeChar(view2, "乙");
    scheduleContentSync(view2, secondId, "split");

    flushAllContent();
    expect(useStore.getState().tabs[tabId].content).toBe("起点甲");
    expect(useStore.getState().tabs[secondId].content).toBe("第二篇乙");

    view2.destroy();
    parent2.remove();
  });

  it("cancelContentSync（卸载路径）注销后不再写", () => {
    typeChar(view, "丢弃的字");
    scheduleContentSync(view, tabId, "main");
    cancelContentSync(tabId);

    vi.advanceTimersByTime(
      CONTENT_SYNC_DEBOUNCE_MS + CONTENT_SYNC_MAX_DELAY_MS,
    );
    expect(useStore.getState().tabs[tabId].contentRevision).toBe(0);
    expect(useStore.getState().tabs[tabId].content).toBe("起点");
  });
});

describe("markTabDirty", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("首键立即置脏，但不推修订号、不改写入者", () => {
    useStore.getState().openFile("/r/dirty.md", "正文");
    const id = Object.keys(useStore.getState().tabs)[0];

    useStore.getState().markTabDirty(id);
    const tab = useStore.getState().tabs[id];
    expect(tab.dirty).toBe(true);
    expect(tab.contentRevision).toBe(0);
    expect(tab.lastWriter).toBe("external");

    // 幂等：已脏时返回原对象，订阅者不空跑。
    useStore.getState().markTabDirty(id);
    expect(useStore.getState().tabs[id]).toBe(tab);
  });

  it("不存在的页签是 no-op", () => {
    expect(() => useStore.getState().markTabDirty("missing")).not.toThrow();
  });
});
