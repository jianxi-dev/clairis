// @vitest-environment jsdom
// pane-presets-v1 / CF-8：paneScale 从 Rust 配置桥接到 <html> 的 data-pane-scale。
// 锁死三档映射、缺省回落 medium、非法值归一化、重载不留残值。
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

import { applyRustConfig, applyPaneScale } from "../../hooks/useConfig";
import { useEditorStore } from "../../stores/editorStore";

function rustConfig(paneScale: string | null) {
  return {
    fontSize: 17,
    headingColors: null,
    readerFontSize: 17,
    readerWidth: 1080,
    readerSkin: "paper",
    paneMode: "standard",
    paneScale,
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

describe("applyRustConfig — paneScale 桥接（CF-8）", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useEditorStore.getState().reset();
    delete document.documentElement.dataset.paneScale;
  });

  afterEach(() => {
    delete document.documentElement.dataset.paneScale;
  });

  it("三档各自映射到 data-pane-scale 与 store", () => {
    for (const scale of ["small", "medium", "large"] as const) {
      applyRustConfig(rustConfig(scale) as never);
      expect(useEditorStore.getState().config.paneScale).toBe(scale);
      expect(document.documentElement.dataset.paneScale).toBe(scale);
    }
  });

  it("缺省（键缺失）回落 medium", () => {
    applyRustConfig(rustConfig(null) as never);
    expect(useEditorStore.getState().config.paneScale).toBe("medium");
    expect(document.documentElement.dataset.paneScale).toBe("medium");
  });

  it("非法值归一化为 medium（不写进 store 的非法态）", () => {
    applyRustConfig(rustConfig("huge") as never);
    expect(useEditorStore.getState().config.paneScale).toBe("medium");
    expect(document.documentElement.dataset.paneScale).toBe("medium");
  });

  it("重载会覆盖上一轮档位，不留残值", () => {
    applyRustConfig(rustConfig("large") as never);
    expect(document.documentElement.dataset.paneScale).toBe("large");

    applyRustConfig(rustConfig("small") as never);
    expect(document.documentElement.dataset.paneScale).toBe("small");
  });
});

describe("applyPaneScale — 单档应用", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.paneScale;
  });

  afterEach(() => {
    delete document.documentElement.dataset.paneScale;
  });

  it("合法档写入属性；非法值回落 medium", () => {
    applyPaneScale("large");
    expect(document.documentElement.dataset.paneScale).toBe("large");
    applyPaneScale("nonsense");
    expect(document.documentElement.dataset.paneScale).toBe("medium");
  });
});
