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
import { humanizeAgentError } from "../lib/aiErrors";
import { useEditorStore } from "../stores/editorStore";

function rustConfig(theme: string) {
  return {
    fontSize: 17,
    headingColors: null,
    readerFontSize: 17,
    readerWidth: 1080,
    readerSkin: "paper",
    ollamaEndpoint: "http://localhost:11434",
    openaiEndpoint: "https://api.openai.com",
    openaiModel: "gpt-4o-mini",
    translationProvider: "ollama",
    sourceLang: "en",
    targetLang: "zh-CN",
    theme,
    aiConfirmDensity: "session-silent",
    sidebarLeftVisible: true,
    sidebarRightVisible: false,
    sidebarLeftWidth: 220,
    sidebarRightWidth: 320,
    horizontalSplitRatio: 0.5,
    verticalSplitRatio: 0.5,
    recentFiles: [],
    scrollPositions: {},
  };
}

function resetState() {
  __resetAiSession();
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
  useEditorStore.getState().setConfig({ aiConfirmDensity: "session-silent" });
}

/** session-silent 首次同类提交会弹确认卡；本测试统一走「确认后提交」。 */
function submitConfirmed(text: string): void {
  useAiEntryStore.getState().requestSubmit(text);
  useAiEntryStore.getState().confirmPendingSubmit();
}

describe("useAiEntry — 撤销指向提交前最后一个快照", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    resetState();
  });

  it("提交前已有快照时，撤销指向最后一份", async () => {
    let snapshotCalls = 0;
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_config_snapshots") {
        snapshotCalls += 1;
        return Promise.resolve(
          snapshotCalls === 1
            ? [
                "settings-2026-01-01T00-00-00-000000Z.json",
                "settings-2026-01-02T00-00-00-000000Z.json",
              ]
            : [
                "settings-2026-01-01T00-00-00-000000Z.json",
                "settings-2026-01-02T00-00-00-000000Z.json",
                "settings-2026-11-02T01-00-00-000000Z.json",
              ],
        );
      }
      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
      if (cmd === "run_agent_turn")
        return Promise.resolve({
          text: "已切换到深色主题。",
          turns: 2,
          tool_calls: ["patch_config"],
        });
      return Promise.resolve(null);
    });

    submitConfirmed("换成深色主题");

    await vi.waitFor(() => {
      expect(useAiEntryStore.getState().undoTarget).toBe(
        "settings-2026-01-02T00-00-00-000000Z.json",
      );
    });
    const state = useAiEntryStore.getState();
    expect(state.undoVisible).toBe(true);
    const last = state.messages.at(-1);
    expect(last?.role).toBe("assistant");
    expect(last?.changed).toBe(true);
  });

  it("提交前没有快照时，撤销回退到提交前的完整配置", async () => {
    let snapshotCalls = 0;
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_config_snapshots") {
        snapshotCalls += 1;
        return Promise.resolve(
          snapshotCalls === 1 ? [] : ["settings-new.json"],
        );
      }
      if (cmd === "load_config") return Promise.resolve(rustConfig("system"));
      if (cmd === "run_agent_turn")
        return Promise.resolve({
          text: "已切换到深色主题。",
          turns: 2,
          tool_calls: ["patch_config"],
        });
      return Promise.resolve(rustConfig("system"));
    });

    submitConfirmed("换成深色主题");

    await vi.waitFor(() => {
      expect(useAiEntryStore.getState().undoVisible).toBe(true);
    });
    const state = useAiEntryStore.getState();
    expect(state.undoTarget).toBeNull();
    expect(state.undoPreConfig).toEqual(rustConfig("system"));

    await useAiEntryStore.getState().runUndo();
    const saveCall = invokeMock.mock.calls.find((c) => c[0] === "save_config");
    expect(saveCall).toBeTruthy();
    expect(saveCall?.[1]).toEqual({ config: rustConfig("system") });
    const last = useAiEntryStore.getState().messages.at(-1);
    expect(last?.content).toBe("已恢复默认。");
  });

  it("校验错误映射成人话且不出现字段名", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_config_snapshots") return Promise.resolve([]);
      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
      if (cmd === "run_agent_turn")
        return Promise.reject({
          kind: "validation",
          field: "fontSize",
          message: "200 超出范围 8–96",
        });
      return Promise.resolve(null);
    });

    submitConfirmed("字号调到 200");

    await vi.waitFor(() => {
      expect(useAiEntryStore.getState().messages.length).toBe(2);
    });
    const last = useAiEntryStore.getState().messages.at(-1);
    expect(last?.isError).toBe(true);
    expect(last?.content).toBe("字号需要在 8–96 之间");
    expect(last?.content).not.toContain("fontSize");
    expect(last?.content).not.toContain("{");
  });

  it("humanizeAgentError 覆盖 provider / turnLimit", () => {
    expect(
      humanizeAgentError({ kind: "provider", status: 500, body: "boom" }),
    ).toBe("连接不上 AI 服务，检查服务设置");
    expect(humanizeAgentError({ kind: "turnLimit", turns: 8 })).toBe(
      "这次改动太绕，已停下，请拆小一点",
    );
  });
});
