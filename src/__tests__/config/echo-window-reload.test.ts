// @vitest-environment jsdom
// bug #1484：AI/外部写入在 echo 窗口被整包丢弃——patch 提示成功但 UI 永不应用。
//
// 根因：reloadAppConfig 命中 SAVE_ECHO_WINDOW_MS(1500) 时直接 return（整包丢弃，
// 无 trailing 兜底）。AI 密集写（1-2s 间隔）+ 一次前端保存 → lastLocalSaveAt 被
// 刷新 → 后续 config-changed 事件全被吞掉，直到用户再手动保存为止。
//
// 修复语义：echo 判定从「丢弃」改为「延迟」——窗口内事件合并为一次 trailing 补
// reload；force 路径（AI 回合内发生写工具调用）立即执行并清掉 pending。
// 本测试用 fake timers 驱动 scheduleExternalReload，锁死这四条契约。
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

import {
  scheduleExternalReload,
  reloadAppConfig,
  saveAppConfig,
  __resetEchoScheduler,
  SAVE_ECHO_WINDOW_MS,
} from "../../hooks/useConfig";

describe("scheduleExternalReload — echo 窗口延迟兜底（bug #1484）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();
    __resetEchoScheduler();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "load_config") {
        return Promise.resolve({
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
          theme: "light",
          sidebarLeftVisible: true,
          sidebarRightVisible: false,
          sidebarLeftWidth: 220,
          sidebarRightWidth: 320,
          horizontalSplitRatio: 0.5,
          verticalSplitRatio: 0.5,
          recentFiles: [],
          scrollPositions: {},
        });
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 本地保存一次，把 lastLocalSaveAt 顶到当前 fake 时间。 */
  async function localSave(): Promise<void> {
    await saveAppConfig();
  }

  function loadConfigCalls(): number {
    return invokeMock.mock.calls.filter((c) => c[0] === "load_config").length;
  }

  /** fake timers 下 waitFor 不推进定时器，直接注入时间戳并 flush 微任务即可观察。 */
  async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  it("本地保存后 100ms 的外部事件：不立即 reload，窗口结束后补一次", async () => {
    await localSave();
    expect(loadConfigCalls()).toBe(0);

    scheduleExternalReload(Date.now());
    // 窗口内：整包丢弃的旧行为会在这里什么都不做；修复后也不该立即 reload
    expect(loadConfigCalls()).toBe(0);

    vi.advanceTimersByTime(SAVE_ECHO_WINDOW_MS);
    await flushMicrotasks();
    expect(loadConfigCalls()).toBe(1);
  });

  it("窗口内多次外部事件合并为一次补 reload", async () => {
    await localSave();

    scheduleExternalReload(Date.now());
    vi.advanceTimersByTime(400);
    scheduleExternalReload(Date.now());
    vi.advanceTimersByTime(400);
    scheduleExternalReload(Date.now());
    vi.advanceTimersByTime(SAVE_ECHO_WINDOW_MS);
    await flushMicrotasks();

    // 合并语义：多事件只补一次，不叠加
    expect(loadConfigCalls()).toBe(1);
  });

  it("force 调用：立即 reload 且清掉 pending 与其 timer", async () => {
    await localSave();

    scheduleExternalReload(Date.now());
    expect(loadConfigCalls()).toBe(0);

    // force 越过 echo 窗口，立即发出 load_config
    reloadAppConfig(true);
    await flushMicrotasks();
    expect(loadConfigCalls()).toBe(1);

    // pending 的 trailing 补 reload 必须被清掉：窗口走完不再多打一次
    vi.advanceTimersByTime(SAVE_ECHO_WINDOW_MS * 2);
    expect(loadConfigCalls()).toBe(1);
  });

  it("无本地保存时外部事件：立即 reload（既有行为保持）", async () => {
    scheduleExternalReload(Date.now());
    await flushMicrotasks();
    expect(loadConfigCalls()).toBe(1);
  });

  it("reloadAppConfig 非 force 且命中窗口：不立即 reload，窗口后补一次", async () => {
    await localSave();

    // 走公开入口（config-changed 监听调的就是它），语义与调度器一致
    reloadAppConfig();
    expect(loadConfigCalls()).toBe(0);

    vi.advanceTimersByTime(SAVE_ECHO_WINDOW_MS);
    await flushMicrotasks();
    expect(loadConfigCalls()).toBe(1);
  });
});
