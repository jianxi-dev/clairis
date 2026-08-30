// Regression: ISSUE-001 — useConfig 在非 Tauri 环境（无 __TAURI_INTERNALS__）无条件调用
// invoke 致控制台报错、配置持久化失败。修复后应直接落默认配置且不抛错。
// Found by /qa on 2026-08-30
// Report: .gstack/qa-reports/qa-report-localhost-1420-2026-08-30.md
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { useConfig, saveAppConfig } from "../hooks/useConfig";
import { useEditorStore } from "../stores/editorStore";

const INTERNALS_KEY = "__TAURI_INTERNALS__" as keyof Window & string;

function Probe() {
  useConfig();
  return null;
}

describe("useConfig 非 Tauri 环境（浏览器 dev / 无 mock e2e）", () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>)[INTERNALS_KEY];
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    Object.defineProperty(window, INTERNALS_KEY, {
      writable: true,
      configurable: true,
      value: {},
    });
  });

  it("载入分支直接落默认配置且 configLoaded 置位", () => {
    render(<Probe />);
    const es = useEditorStore.getState();
    expect(es.configLoaded).toBe(true);
    expect(es.configLoading).toBe(false);
    expect(es.config.readerFontSize).toBe(17);
    expect(es.config.readerWidth).toBe(1080);
    expect(es.config.readerSkin).toBe("paper");
    expect(es.config.theme).toBe("system");
    expect(es.config.recentFiles).toEqual([]);
    expect(document.documentElement.dataset.skin).toBe("paper");
  });

  it("saveAppConfig 非 Tauri 早退不抛错", async () => {
    await expect(saveAppConfig()).resolves.toBeUndefined();
  });
});
