// @vitest-environment jsdom
// bug #1494：配置保存环自持 —— 重载 → 保存 → 重载，~2s 全量覆盖 settings.json。
//
// 环的最后一环在保存侧：applyRustConfig 每次重载都会（哪怕内容相同）刷新
// scrollPositions / embedScrollPositions 引用，App.tsx 的持久化 effect 依赖
// 这两个引用 → 每次重载都 scheduleSave → 500ms 后全量写盘 → Rust watcher
// 检测到 → config-changed → 重载。守卫缺失时，重载后 1s 窗口内的任何
// scheduleSave 都会落盘，环就无法断开。
//
// 契约（本测试锁死）：
//   1. applyRustConfig 之后 1s 窗口内，scheduleSave 不落盘（写配置命令 0 次）。
//   2. 窗口外，用户真实修改触发的 scheduleSave 正常落盘。
//   3. 连续两次内容相同的重载不会各产生一次落盘。
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (p: string) => `asset://localhost/${p}`,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

vi.mock("../../utils/tauri", () => ({ isTauriEnv: () => true }));

import {
  applyRustConfig,
  useConfig,
  __resetEchoScheduler,
  __resetRemoteApplyGuard,
} from "../../hooks/useConfig";

function rustConfig(scrollPositions: Record<string, unknown> | null = null) {
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
    theme: "system",
    sidebarLeftVisible: true,
    sidebarRightVisible: false,
    sidebarLeftWidth: 220,
    sidebarRightWidth: 320,
    horizontalSplitRatio: 0.5,
    verticalSplitRatio: 0.5,
    recentFiles: [],
    scrollPositions,
    embedScrollPositions: null,
  };
}

function saveConfigCalls(): number {
  return invokeMock.mock.calls.filter((c) => c[0] === "save_config").length;
}

describe("配置重载守卫 — 重载后窗口内不落盘（bug #1494）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();
    __resetEchoScheduler();
    __resetRemoteApplyGuard();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "load_config") return Promise.resolve(rustConfig({}));
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applyRustConfig 后 1s 窗口内 scheduleSave 不落盘", () => {
    applyRustConfig(rustConfig({}) as never);

    const { result } = renderHook(() => useConfig());
    result.current.scheduleSave();

    vi.advanceTimersByTime(2000);
    expect(saveConfigCalls()).toBe(0);
  });

  it("窗口外 scheduleSave 正常落盘（用户真实修改不被吞）", () => {
    applyRustConfig(rustConfig({}) as never);

    const { result } = renderHook(() => useConfig());
    // 窗口（1s）过后再调度：应正常落盘
    vi.advanceTimersByTime(1100);
    result.current.scheduleSave();

    vi.advanceTimersByTime(2000);
    expect(saveConfigCalls()).toBe(1);
  });

  it("连续两次内容相同的重载：窗口内调度只产生零次落盘", () => {
    applyRustConfig(rustConfig({ "/a.md": { scrollPos: 10, contentHeight: 900 } }) as never);
    applyRustConfig(rustConfig({ "/a.md": { scrollPos: 10, contentHeight: 900 } }) as never);

    const { result } = renderHook(() => useConfig());
    result.current.scheduleSave();

    vi.advanceTimersByTime(5000);
    expect(saveConfigCalls()).toBe(0);
  });
});
