// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useEditorStore } from "../stores/editorStore";
import { useStore } from "../stores/index";

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

import { useConfig } from "../hooks/useConfig";

function rustConfig(theme: "light" | "dark") {
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

describe("useConfig — config-changed hot apply (C2)", () => {
  beforeEach(() => {
    listenHandler = null;
    invokeMock.mockReset();
    document.documentElement.classList.remove("dark");
    useEditorStore.getState().setConfig({ theme: "light" });
  });

  it("registers a config-changed listener and applies the reloaded config", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
      return Promise.resolve(null);
    });

    renderHook(() => useConfig());

    await waitFor(() => expect(listenHandler).not.toBeNull());
    await waitFor(() =>
      expect(useEditorStore.getState().config.theme).toBe("light"),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "load_config") return Promise.resolve(rustConfig("dark"));
      return Promise.resolve(null);
    });

    act(() => listenHandler?.());

    await waitFor(() =>
      expect(useEditorStore.getState().config.theme).toBe("dark"),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("keeps editor content untouched when config reloads", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "load_config") return Promise.resolve(rustConfig("light"));
      return Promise.resolve(null);
    });

    renderHook(() => useConfig());
    await waitFor(() => expect(listenHandler).not.toBeNull());

    useStore.getState().openFile("/virtual/keep.md", "# 保留内容");
    const before = Object.values(useStore.getState().tabs).find(
      (t) => t.path === "/virtual/keep.md",
    );

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "load_config") return Promise.resolve(rustConfig("dark"));
      return Promise.resolve(null);
    });

    act(() => listenHandler?.());

    await waitFor(() =>
      expect(useEditorStore.getState().config.theme).toBe("dark"),
    );
    const after = Object.values(useStore.getState().tabs).find(
      (t) => t.path === "/virtual/keep.md",
    );
    expect(after?.content).toBe(before?.content);
  });
});
