// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: async () => () => {},
}));

vi.mock("../utils/tauri", () => ({ isTauriEnv: () => true }));

import { useAiEntryStore, __resetAiSession } from "../hooks/useAiEntry";
import { useEditorStore } from "../stores/editorStore";
import { useStore, AI_PANE_ID } from "../stores/index";
import { DEFAULT_VIEW_SPEC } from "../lib/aiViewSpec";
import { findLeaf, leafCount, listLeaves } from "../lib/paneTree";

function setDensity(density: "always" | "session-silent" | "never"): void {
  useEditorStore.getState().setConfig({ aiConfirmDensity: density });
}

function resetAll(): void {
  __resetAiSession();
  useStore.getState().reset();
  useAiEntryStore.setState({
    overlayOpen: false,
    input: "",
    submitting: false,
    messages: [],
    pendingConfirm: null,
    undoVisible: false,
    undoTarget: null,
    undoPreConfig: null,
    undoPreSpec: null,
    panelOpen: false,
    snapshots: [],
    snapshotsLoading: false,
    form: "bubble",
    bubbleOpen: false,
    bubbleRect: null,
  });
  setDensity("session-silent");
}

describe("AI 两形态 —— 形态与对话历史", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    resetAll();
  });

  it("形态切换共享同一对话历史，store 是唯一真相", () => {
    useAiEntryStore
      .getState()
      .executeViewChange({ gridMode: "list" }, "view", "网格视图改为列表");
    const count = useAiEntryStore.getState().messages.length;
    expect(count).toBeGreaterThan(0);

    useAiEntryStore.getState().dock();
    expect(useAiEntryStore.getState().form).toBe("docked");
    expect(useAiEntryStore.getState().bubbleOpen).toBe(false);
    expect(useAiEntryStore.getState().messages.length).toBe(count);
    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)?.kind).toBe("ai");

    useAiEntryStore.getState().undock();
    expect(useAiEntryStore.getState().form).toBe("bubble");
    expect(useAiEntryStore.getState().bubbleOpen).toBe(true);
    expect(useAiEntryStore.getState().messages.length).toBe(count);
    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)).toBeNull();
  });

  it("dockAiPane 复用同一个 AI 格，绝不嵌套第二个", () => {
    useStore.getState().dockAiPane();
    useStore.getState().dockAiPane();
    const aiLeaves = listLeaves(useStore.getState().paneRoot).filter(
      (l) => l.kind === "ai",
    );
    expect(aiLeaves).toHaveLength(1);
    expect(aiLeaves[0].id).toBe(AI_PANE_ID);
  });

  it("closePane 关闭 AI 格 → 宿主回落小窗且无残留", () => {
    useAiEntryStore.getState().dock();
    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)).not.toBeNull();
    useStore.getState().closePane(AI_PANE_ID);
    expect(findLeaf(useStore.getState().paneRoot, AI_PANE_ID)).toBeNull();
    expect(useAiEntryStore.getState().form).toBe("bubble");
    expect(useAiEntryStore.getState().bubbleOpen).toBe(true);
  });
});

describe("AI 两形态 —— 确认卡三档", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    resetAll();
  });

  it("session-silent：首次同类弹卡，确认后本会话同类静默", () => {
    setDensity("session-silent");

    useAiEntryStore.getState().requestApplyPreset("grid-list");
    const pending = useAiEntryStore.getState().pendingConfirm;
    expect(pending).not.toBeNull();
    expect(pending?.summary).toContain("网格视图改为列表");
    // 未确认 → 规格不动
    expect(useStore.getState().viewSpec.gridMode).toBe("grid");

    useAiEntryStore.getState().confirmPendingSubmit();
    expect(useAiEntryStore.getState().pendingConfirm).toBeNull();
    expect(useStore.getState().viewSpec.gridMode).toBe("list");

    // 同类第二次：静默执行，无确认卡
    useAiEntryStore.getState().requestApplyPreset("unread-filter");
    expect(useAiEntryStore.getState().pendingConfirm).toBeNull();
    expect(useStore.getState().viewSpec.unreadOnly).toBe(true);
  });

  it("always：每次都弹卡", () => {
    setDensity("always");
    useAiEntryStore.getState().requestApplyPreset("grid-list");
    expect(useAiEntryStore.getState().pendingConfirm).not.toBeNull();
    useAiEntryStore.getState().confirmPendingSubmit();
    useAiEntryStore.getState().requestApplyPreset("grid-group-type");
    expect(useAiEntryStore.getState().pendingConfirm).not.toBeNull();
  });

  it("never：从不弹卡，立即执行", () => {
    setDensity("never");
    useAiEntryStore.getState().requestApplyPreset("grid-list");
    expect(useAiEntryStore.getState().pendingConfirm).toBeNull();
    expect(useStore.getState().viewSpec.gridMode).toBe("list");
  });

  it("取消确认：规格保持 deep-equal（无半写状态）", () => {
    setDensity("always");
    const before = { ...useStore.getState().viewSpec };
    useAiEntryStore.getState().requestApplyPreset("grid-list");
    expect(useAiEntryStore.getState().pendingConfirm).not.toBeNull();
    useAiEntryStore.getState().cancelPendingSubmit();
    expect(useAiEntryStore.getState().pendingConfirm).toBeNull();
    expect(useStore.getState().viewSpec).toEqual(before);
    expect(useStore.getState().viewSpec).toEqual(DEFAULT_VIEW_SPEC);
  });

  it("手动改视图后再跑预设：现场值不被旧规格回滚", () => {
    setDensity("never");
    useStore.getState().setRailDensity("compact");
    useStore.getState().setPreviewSettings({ enabled: false });

    // 现场值经 captureViewSpec 合并（viewSpec 存储字段仍是旧的 card/true）
    const live = useStore.getState().captureViewSpec();
    expect(live.railDensity).toBe("compact");
    expect(live.previewEnabled).toBe(false);

    useAiEntryStore.getState().requestApplyPreset("grid-list");

    expect(useStore.getState().viewSpec.gridMode).toBe("list");
    expect(useStore.getState().viewSpec.railDensity).toBe("compact");
    expect(useStore.getState().viewSpec.previewEnabled).toBe(false);
    // 手动选择未被回滚
    expect(useStore.getState().railDensity).toBe("compact");
    expect(useStore.getState().previewSettings.enabled).toBe(false);
    expect(useStore.getState().captureViewSpec()).toEqual(
      useStore.getState().viewSpec,
    );
  });
});

describe("AI 两形态 —— 撤销与快照", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    resetAll();
  });

  it("撤销后视图规格与改写前严格相等", async () => {
    setDensity("never");
    const before = { ...useStore.getState().viewSpec };
    useAiEntryStore.getState().requestApplyPreset("grid-list");
    expect(useStore.getState().viewSpec.gridMode).toBe("list");
    expect(useAiEntryStore.getState().undoVisible).toBe(true);

    await useAiEntryStore.getState().runUndo();
    expect(useStore.getState().viewSpec).toEqual(before);
    expect(useAiEntryStore.getState().undoPreSpec).toBeNull();
  });

  it("快照列表最多 10 份", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_config_snapshots") {
        return Promise.resolve(
          Array.from({ length: 15 }, (_, i) => `settings-snap-${i}.json`),
        );
      }
      return Promise.resolve(null);
    });
    await useAiEntryStore.getState().loadSnapshots();
    expect(useAiEntryStore.getState().snapshots.length).toBe(10);
  });
});

describe("AI 两形态 —— 停靠后布局可序列化/恢复", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    resetAll();
  });

  it("AI 格序列化带 kind，恢复后保留", () => {
    useStore.getState().openFile("/tmp/ai/a.md", "a");
    useStore.getState().dockAiPane();
    const json = useStore.getState().paneLayoutJson();
    expect(json).toContain('"kind":"ai"');
    expect(leafCount(useStore.getState().paneRoot)).toBe(2);
  });
});
