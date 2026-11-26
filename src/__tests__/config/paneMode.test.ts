// @vitest-environment jsdom
// pane-presets-v1 / G-9：paneMode 从 Rust 配置桥接到 <html> 的 data-pane-mode。
// 锁死三档映射、缺省回落 standard、非法值归一化、重载不留残值。
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (p: string) => `asset://localhost/${p}`,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

vi.mock("../../utils/tauri", () => ({ isTauriEnv: () => true }));

import { applyRustConfig, applyPaneMode } from "../../hooks/useConfig";
import { useEditorStore } from "../../stores/editorStore";

function rustConfig(paneMode: string | null) {
  return {
    fontSize: 17,
    headingColors: null,
    readerFontSize: 17,
    readerWidth: 1080,
    readerSkin: "paper",
    paneMode,
    ollamaEndpoint: "http://localhost:11434",
    openaiEndpoint: "https://api.openai.com",
    openaiModel: "gpt-4o-mini",
    translationProvider: "ollama",
    sourceLang: "en",
    targetLang: "zh-CN",
    theme: "system",
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

describe("applyRustConfig — paneMode 桥接（G-9）", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useEditorStore.getState().reset();
    delete document.documentElement.dataset.paneMode;
  });

  afterEach(() => {
    delete document.documentElement.dataset.paneMode;
  });

  it("三档各自映射到 data-pane-mode 与 store", () => {
    for (const mode of ["simple", "standard", "hardcore"] as const) {
      applyRustConfig(rustConfig(mode) as never);
      expect(useEditorStore.getState().config.paneMode).toBe(mode);
      expect(document.documentElement.dataset.paneMode).toBe(mode);
    }
  });

  it("缺省（键缺失）回落 standard", () => {
    applyRustConfig(rustConfig(null) as never);
    expect(useEditorStore.getState().config.paneMode).toBe("standard");
    expect(document.documentElement.dataset.paneMode).toBe("standard");
  });

  it("非法值归一化为 standard（不写进 store 的非法态）", () => {
    applyRustConfig(rustConfig("ultra") as never);
    expect(useEditorStore.getState().config.paneMode).toBe("standard");
    expect(document.documentElement.dataset.paneMode).toBe("standard");
  });

  it("重载会覆盖上一轮档位，不留残值", () => {
    applyRustConfig(rustConfig("hardcore") as never);
    expect(document.documentElement.dataset.paneMode).toBe("hardcore");

    applyRustConfig(rustConfig("simple") as never);
    expect(document.documentElement.dataset.paneMode).toBe("simple");
  });
});

describe("applyPaneMode — 单档应用", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.paneMode;
  });

  afterEach(() => {
    delete document.documentElement.dataset.paneMode;
  });

  it("合法档写入属性；非法值回落 standard", () => {
    applyPaneMode("hardcore");
    expect(document.documentElement.dataset.paneMode).toBe("hardcore");
    applyPaneMode("nonsense");
    expect(document.documentElement.dataset.paneMode).toBe("standard");
  });
});
