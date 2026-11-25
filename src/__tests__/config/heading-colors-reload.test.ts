// @vitest-environment jsdom
// bug #1482：headingColors 补丁写盘成功但 UI 不生效——applyRustConfig 桥接断裂。
// 写边界（T1）把 headingColors 落到 Rust 配置；重载路径 applyRustConfig 只合并
// config 子对象，从不调 setHeadingColors，而渲染消费端（PreviewView / ContentArea）
// 读的是 store 顶层 s.headingColors → 永远停留 DEFAULT_HEADING_COLORS。
// 本测试直接驱动 applyRustConfig，锁死「有值映射 / 缺失回落默认」两态。
import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (p: string) => `asset://localhost/${p}`,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

// applyRustConfig 本体不调 invoke（只有 reloadAppConfig 调），但 restorePaneLayout
// 在 paneLayout 非空时会走 open_file_direct；测试不传 paneLayout，仍显式声明
// Tauri 环境以贴近真实重载路径。
vi.mock("../../utils/tauri", () => ({ isTauriEnv: () => true }));

import { applyRustConfig } from "../../hooks/useConfig";
import {
  DEFAULT_HEADING_COLORS,
  useEditorStore,
} from "../../stores/editorStore";

function rustConfig(headingColors: Record<string, string> | null) {
  return {
    fontSize: 17,
    headingColors,
    readerFontSize: 17,
    readerWidth: 1080,
    readerSkin: "paper",
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

describe("applyRustConfig — headingColors 桥接（bug #1482）", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useEditorStore.getState().reset();
  });

  it("raw.headingColors 有值时同步到 store 顶层 headingColors", () => {
    const colors = {
      h1: "#0b3d91",
      h2: "#6f42c1",
      h3: "#005cc5",
      h4: "#e36209",
      h5: "#24292e",
      h6: "#586069",
    };
    applyRustConfig(rustConfig(colors) as never);

    expect(useEditorStore.getState().headingColors.h1).toBe("#0b3d91");
    // 消费端读的就是这个顶层字段（PreviewView.tsx:144 / ContentArea.tsx:557）
    expect(useEditorStore.getState().headingColors).toEqual(colors);
  });

  it("raw.headingColors 缺失时回落 DEFAULT_HEADING_COLORS", () => {
    applyRustConfig(rustConfig(null) as never);

    expect(useEditorStore.getState().headingColors).toEqual(
      DEFAULT_HEADING_COLORS,
    );
    expect(useEditorStore.getState().headingColors.h1).toBe("#d73a49");
  });

  it("重载会把上一轮的自定义色覆盖掉（不留残值）", () => {
    const custom = {
      h1: "#0b3d91",
      h2: "#6f42c1",
      h3: "#005cc5",
      h4: "#e36209",
      h5: "#24292e",
      h6: "#586069",
    };
    applyRustConfig(rustConfig(custom) as never);
    expect(useEditorStore.getState().headingColors.h1).toBe("#0b3d91");

    // 配置里该字段被删掉后重载：必须回到默认，而不是保留上一轮的颜色
    applyRustConfig(rustConfig(null) as never);
    expect(useEditorStore.getState().headingColors.h1).toBe(
      DEFAULT_HEADING_COLORS.h1,
    );
  });
});
