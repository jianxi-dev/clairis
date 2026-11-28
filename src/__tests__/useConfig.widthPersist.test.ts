// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useEditorStore } from "../stores/editorStore";

const invokeMock = vi.fn();
let listenHandler: (() => void) | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: async (_event: string, handler: () => void) => {
    listenHandler = handler;
    return () => {};
  },
}));

vi.mock("../utils/tauri", () => ({ isTauriEnv: () => true }));

import {
  useConfig,
  beginConfigInteraction,
  endConfigInteraction,
  __resetEchoScheduler,
  __resetRemoteApplyGuard,
} from "../hooks/useConfig";

function rustConfig(readerWidth: number) {
  return {
    fontSize: 17,
    headingColors: null,
    readerFontSize: 17,
    readerWidth,
    readerSkin: "paper",
    ollamaEndpoint: "http://localhost:11434",
    openaiEndpoint: "https://api.openai.com",
    openaiModel: "gpt-4o-mini",
    translationProvider: "ollama",
    sourceLang: "en",
    targetLang: "zh-CN",
    theme: "light",
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

/** 取最后一次 save_config 的载荷。 */
function lastSavedWidth(): number | undefined {
  const calls = invokeMock.mock.calls.filter((c) => c[0] === "save_config");
  const last = calls[calls.length - 1];
  return (last?.[1] as { config?: { readerWidth?: number } } | undefined)?.config
    ?.readerWidth;
}

describe("配置保存：重载守卫不得吞掉用户的宽度调整（#1748）", () => {
  beforeEach(() => {
    listenHandler = null;
    invokeMock.mockReset();
    __resetEchoScheduler();
    __resetRemoteApplyGuard();
    useEditorStore.getState().setConfig({ readerWidth: 1080 });
  });

  it("reload 刚落地后的守卫窗口内，用户的宽度调整仍然要落盘", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "load_config") return Promise.resolve(rustConfig(1080));
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(listenHandler).not.toBeNull());
    await waitFor(() =>
      expect(useEditorStore.getState().config.readerWidth).toBe(1080),
    );

    // 模拟「外部写入 → config-changed → 重载落地」：applyRustConfig 会 stamp 守卫时间戳
    act(() => listenHandler?.());
    await waitFor(() =>
      expect(useEditorStore.getState().config.readerWidth).toBe(1080),
    );

    // 用户在守卫窗口内调整宽度（状态栏档位/滑块的真实路径）
    act(() => {
      useEditorStore.getState().setConfig({ readerWidth: 1400 });
      result.current.scheduleSave();
    });

    await waitFor(
      () => {
        expect(lastSavedWidth()).toBe(1400);
      },
      { timeout: 2000 },
    );
  });

  it("拖动滑块期间落地的重载不得把宽度打回旧值", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "load_config") return Promise.resolve(rustConfig(1080));
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(listenHandler).not.toBeNull());
    await waitFor(() =>
      expect(useEditorStore.getState().config.readerWidth).toBe(1080),
    );

    // 用户按下滑块（交互开始），把宽度拖到 1400
    act(() => {
      beginConfigInteraction();
      useEditorStore.getState().setConfig({ readerWidth: 1400 });
    });

    // 拖动途中，外部重载事件到达（来自上一次保存的 echo）——必须被丢弃
    act(() => listenHandler?.());
    await new Promise((r) => setTimeout(r, 50));
    expect(useEditorStore.getState().config.readerWidth).toBe(1400);

    // 松手：交互结束，本地值正常落盘
    act(() => {
      endConfigInteraction();
      result.current.scheduleSave();
    });
    await waitFor(() => expect(lastSavedWidth()).toBe(1400), { timeout: 2000 });
  });
});
