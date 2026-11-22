import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { history, isolateHistory, undo, undoDepth } from "@codemirror/commands";
import { useStore } from "../../stores/index";
import { diffContent } from "../../lib/syncDiff";

/**
 * 回灌协议（#1335 / design D2）的两条不变量：
 *  1. store 侧：内容真变了才推修订号并记写入者；
 *  2. 编辑器侧：程序回灌不进历史（undoDepth 不变），且一次撤销不清空正文。
 *
 * 编辑器侧走真实 `EditorView` + `history()` + 真实 `dispatch`，断言落在
 * `state.doc` / `undoDepth` 这些公共值上。
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

describe("store 内容修订号与写入者", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("新页签的缺省值是 revision 0 / external", () => {
    useStore.getState().openFile("/r/default.md", "正文");
    const tab = Object.values(useStore.getState().tabs)[0];
    expect(tab.contentRevision).toBe(0);
    expect(tab.lastWriter).toBe("external");
  });

  it("updateTabContent 递增修订号并记下写入者", () => {
    useStore.getState().openFile("/r/a.md", "一");
    const id = Object.keys(useStore.getState().tabs)[0];

    const rev = useStore.getState().updateTabContent(id, "二", "main");
    expect(rev).toBe(1);
    expect(useStore.getState().tabs[id].contentRevision).toBe(1);
    expect(useStore.getState().tabs[id].lastWriter).toBe("main");

    const rev2 = useStore.getState().updateTabContent(id, "三", "pane-2");
    expect(rev2).toBe(2);
    expect(useStore.getState().tabs[id].lastWriter).toBe("pane-2");
  });

  it("省略 writer 时按 external 处理", () => {
    useStore.getState().openFile("/r/a.md", "一");
    const id = Object.keys(useStore.getState().tabs)[0];
    useStore.getState().updateTabContent(id, "二");
    expect(useStore.getState().tabs[id].lastWriter).toBe("external");
  });

  it("内容未变时不推修订号（避免订阅者空跑）", () => {
    useStore.getState().openFile("/r/a.md", "一样");
    const id = Object.keys(useStore.getState().tabs)[0];
    const rev = useStore.getState().updateTabContent(id, "一样", "main");
    expect(rev).toBe(0);
    expect(useStore.getState().tabs[id].lastWriter).toBe("external");
  });

  it("updateContent 作用于活动页签并同样记修订号", () => {
    useStore.getState().openFile("/r/a.md", "一");
    const id = useStore.getState().activeTabId!;
    useStore.getState().updateContent("二", "main");
    expect(useStore.getState().tabs[id].contentRevision).toBe(1);
    expect(useStore.getState().tabs[id].lastWriter).toBe("main");
  });

  it("refreshTabContent 记为 external 且回到干净态", () => {
    useStore.getState().openFile("/r/a.md", "一");
    const id = Object.keys(useStore.getState().tabs)[0];
    useStore.getState().updateTabContent(id, "改过", "main");
    useStore.getState().refreshTabContent(id, "磁盘内容", "external");
    const tab = useStore.getState().tabs[id];
    expect(tab.content).toBe("磁盘内容");
    expect(tab.dirty).toBe(false);
    expect(tab.contentRevision).toBe(2);
    expect(tab.lastWriter).toBe("external");
  });

  it("标题改写回写别称键时同样走协议", () => {
    useStore.getState().openFile("/r/t.md", "---\n标题: 旧\n---\n正文");
    const id = Object.keys(useStore.getState().tabs)[0];
    useStore.getState().renameTab(id, "新");
    const tab = useStore.getState().tabs[id];
    expect(tab.content).toContain("新");
    expect(tab.contentRevision).toBe(1);
    expect(tab.lastWriter).toBe("external");
  });
});

describe("回灌事务不进历史", () => {
  let parent: HTMLElement;
  let view: EditorView | undefined;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement("div");
    document.body.appendChild(parent);
  });

  afterEach(() => {
    view?.destroy();
    view = undefined;
    parent.remove();
  });

  function createView(doc: string): EditorView {
    const v = new EditorView({
      parent,
      state: EditorState.create({ doc, extensions: [history()] }),
    });
    view = v;
    return v;
  }

  /** 与 ContentArea 同步 effect 同形的最小 diff 回灌。 */
  function applySync(v: EditorView, target: string): void {
    const current = v.state.doc.toString();
    const diff = diffContent(current, target);
    if (!diff) return;
    const length = current.length;
    v.dispatch({
      changes: {
        from: Math.min(diff.from, length),
        to: Math.min(diff.to, length),
        insert: diff.insert,
      },
      annotations: [
        Transaction.addToHistory.of(false),
        isolateHistory.of("before"),
      ],
    });
  }

  it("外部回灌前后 undoDepth 之差为 0", () => {
    const v = createView("# 标题\n\n正文。");
    const before = undoDepth(v.state);
    applySync(v, "# 标题\n\n正文。追加的句子。");
    expect(undoDepth(v.state)).toBe(before);
    expect(v.state.doc.toString()).toContain("追加的句子");
  });

  it("外部回灌后一次撤销不清空正文（长度 ≥ 1）", () => {
    const v = createView("# 标题\n\n正文。");
    applySync(v, "# 标题\n\n正文。可视化改写后的内容。");
    // 回灌不进历史 → 没有可撤销的步
    expect(undoDepth(v.state)).toBe(0);
    // 走真实 undo 命令（keymap 背后就是它）确认正文仍在
    undo(v);
    expect(v.state.doc.toString().length).toBeGreaterThanOrEqual(1);
    expect(v.state.doc.toString()).toContain("可视化改写后的内容");
  });

  it("回灌与用户编辑的分组被切断：先回灌再输入，撤销只退输入", () => {
    const v = createView("起点");
    applySync(v, "回灌后");
    // 用户接着输入（真实事务）
    v.dispatch({
      changes: { from: v.state.doc.length, insert: "用户" },
      userEvent: "input",
    });
    expect(v.state.doc.toString()).toBe("回灌后用户");
    undo(v);
    expect(v.state.doc.toString()).toBe("回灌后");
  });
});
