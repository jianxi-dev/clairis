// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
const reloadAppConfigMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: async () => () => {},
}));

vi.mock("../utils/tauri", () => ({ isTauriEnv: () => true }));

vi.mock("../hooks/useConfig", () => ({
  reloadAppConfig: (...args: unknown[]) => reloadAppConfigMock(...args),
  saveAppConfig: () => Promise.resolve(),
  WRITE_TOOLS: new Set(["patch_config", "patch_data_surface"]),
}));

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
    reloadAppConfigMock.mockReset();
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

  it("reply 含写工具时 force 重载（bug #1484：写落在 echo 窗口也要生效）", async () => {
    let snapshotCalls = 0;
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_config_snapshots") {
        snapshotCalls += 1;
        // 回合前后快照数一致：走不到 changed 分支，只能靠写工具触发 force
        return Promise.resolve(["settings-2026-01-01T00-00-00-000000Z.json"]);
      }
      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
      if (cmd === "run_agent_turn")
        return Promise.resolve({
          text: "已调整配置。",
          turns: 2,
          tool_calls: ["patch_config"],
        });
      return Promise.resolve(null);
    });

    submitConfirmed("把主题换成深色");

    await vi.waitFor(() => {
      expect(useAiEntryStore.getState().submitting).toBe(false);
    });
    expect(reloadAppConfigMock).toHaveBeenCalledWith(true);
  });

  it("写工具失败（快照未变）时只 force 重载，不进撤销分支", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_config_snapshots")
        return Promise.resolve(["settings-2026-01-01T00-00-00-000000Z.json"]);
      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
      if (cmd === "run_agent_turn")
        return Promise.resolve({
          text: "写入失败。",
          turns: 1,
          tool_calls: ["patch_config"],
        });
      return Promise.resolve(null);
    });

    submitConfirmed("写一个非法补丁");

    await vi.waitFor(() => {
      expect(useAiEntryStore.getState().submitting).toBe(false);
    });
    expect(reloadAppConfigMock).toHaveBeenCalledWith(true);
    // 磁盘未变 → 没有可撤销的东西，undoVisible 必须保持 false
    expect(useAiEntryStore.getState().undoVisible).toBe(false);
    expect(useAiEntryStore.getState().undoTarget).toBeNull();
  });

  it("reply 只有读工具时不 force 重载", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_config_snapshots")
        return Promise.resolve(["settings-2026-01-01T00-00-00-000000Z.json"]);
      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
      if (cmd === "run_agent_turn")
        return Promise.resolve({
          text: "当前是浅色主题。",
          turns: 1,
          tool_calls: ["read_config"],
        });
      return Promise.resolve(null);
    });

    submitConfirmed("现在是什么主题");

    await vi.waitFor(() => {
      expect(useAiEntryStore.getState().submitting).toBe(false);
    });
    expect(reloadAppConfigMock).not.toHaveBeenCalled();
  });

  it("humanizeAgentError 覆盖 provider / turnLimit", () => {
    expect(
      humanizeAgentError({ kind: "provider", status: 0, body: "boom" }),
    ).toBe("连接不上 AI 服务，检查网络和服务地址");
    expect(humanizeAgentError({ kind: "provider", status: 401 })).toBe(
      "AI 服务拒绝了这个密钥，请到设置里重新填写",
    );
    expect(humanizeAgentError({ kind: "provider", status: 402 })).toBe(
      "AI 服务账户余额不足，先充值再试",
    );
    expect(humanizeAgentError({ kind: "provider", status: 429 })).toBe(
      "请求太频繁了，稍后再试",
    );
    expect(
      humanizeAgentError({ kind: "provider", status: 500, body: "boom" }),
    ).toBe("AI 服务暂时不可用，稍后再试");
    expect(humanizeAgentError({ kind: "keyring", message: "denied" })).toBe(
      "读取系统钥匙串失败，请到设置里重新保存密钥",
    );
    expect(humanizeAgentError({ kind: "turnLimit", turns: 8 })).toBe(
      "这次改动太绕，已停下，请拆小一点",
    );
  });
});
