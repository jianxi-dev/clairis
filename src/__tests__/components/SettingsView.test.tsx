import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SettingsView from "../../components/SettingsView";
import { useEditorStore } from "../../stores/editorStore";
import { useStore } from "../../stores/index";
import { resetCapabilities } from "../../lib/capabilities";

vi.mock("../../hooks/useConfig", () => ({
  saveAppConfig: () => Promise.resolve(),
  reloadAppConfig: vi.fn(),
  applyTheme: vi.fn(),
}));

const NAV_LABELS = [
  "外观",
  "编辑器",
  "阅读空间",
  "网格概览",
  "悬浮预览",
  "AI 服务",
  "扩展",
  "快捷键",
  "数据与备份",
  "关于",
];

beforeEach(() => {
  useStore.getState().reset();
  useEditorStore.getState().reset();
  resetCapabilities();
  document.documentElement.classList.remove("dark", "warm");
});

afterEach(() => {
  useStore.getState().reset();
  useEditorStore.getState().reset();
  resetCapabilities();
  document.documentElement.classList.remove("dark", "warm");
});

describe("SettingsView", () => {
  it("渲染设置场景：10 个分区且顺序严格相等", () => {
    render(<SettingsView onClose={() => {}} />);

    expect(screen.getByTestId("settings-scene")).toBeTruthy();
    const items = screen.getAllByTestId("settings-nav-item");
    expect(items).toHaveLength(10);
    expect(items.map((item) => item.textContent)).toEqual(NAV_LABELS);
  });

  it("外观区恰好 3 个主题选项", () => {
    render(<SettingsView onClose={() => {}} />);

    expect(screen.getAllByTestId(/^theme-option-/)).toHaveLength(3);
    expect(screen.getByTestId("theme-option-light").textContent).toBe("浅色");
    expect(screen.getByTestId("theme-option-dark").textContent).toBe("深色");
    expect(screen.getByTestId("theme-option-warm").textContent).toBe("暖色");
  });

  it("阅读空间与网格概览：默认控件就位", () => {
    render(<SettingsView onClose={() => {}} />);

    fireEvent.click(screen.getAllByTestId("settings-nav-item")[2]);
    expect(screen.getByTestId("rail-default-layout-stacked")).toBeTruthy();
    expect(screen.getByTestId("rail-default-layout-tabs")).toBeTruthy();
    expect(screen.getByTestId("rail-default-density-compact")).toBeTruthy();
    expect(screen.getByTestId("rail-default-density-comfortable")).toBeTruthy();
    expect(screen.getByTestId("rail-default-density-card")).toBeTruthy();
    expect(screen.getByTestId("rail-default-card-height")).toBeTruthy();

    fireEvent.click(screen.getAllByTestId("settings-nav-item")[3]);
    expect(screen.getByTestId("grid-default-group-time")).toBeTruthy();
    expect(screen.getByTestId("grid-default-group-type")).toBeTruthy();
    expect(screen.getByTestId("grid-default-group-theme")).toBeTruthy();
    expect(screen.getByTestId("grid-default-group-none")).toBeTruthy();
    expect(screen.getByTestId("grid-default-sort-recent")).toBeTruthy();
    expect(screen.getByTestId("grid-default-sort-name")).toBeTruthy();
    expect(screen.getByTestId("grid-default-sort-type")).toBeTruthy();
    expect(screen.getByTestId("grid-default-mode-grid")).toBeTruthy();
    expect(screen.getByTestId("grid-default-mode-list")).toBeTruthy();
  });

  it("扩展区：浏览器预览显示不可用提示", () => {
    const w = window as unknown as {
      __TAURI_INTERNALS__?: Record<string, unknown>;
    };
    const internals = w.__TAURI_INTERNALS__;
    delete w.__TAURI_INTERNALS__;
    try {
      render(<SettingsView onClose={() => {}} />);

      fireEvent.click(screen.getAllByTestId("settings-nav-item")[6]);
      expect(screen.getByTestId("extensions-disabled-note")).toBeTruthy();
      expect(
        screen.getByTestId("extensions-disabled-note").textContent,
      ).toContain("浏览器预览不可用");
    } finally {
      w.__TAURI_INTERNALS__ = internals;
    }
  });

  it("AI 服务区：8 个提供方与 2 个规划中条目", () => {
    render(<SettingsView onClose={() => {}} />);

    fireEvent.click(screen.getAllByTestId("settings-nav-item")[5]);
    expect(screen.getAllByTestId("ai-provider")).toHaveLength(8);
    expect(screen.getAllByTestId("ai-planned")).toHaveLength(2);
    expect(screen.getAllByTestId("ai-planned")[0].textContent).toContain(
      "本地 LLM（Ollama）",
    );
    expect(screen.getAllByTestId("ai-planned")[1].textContent).toContain(
      "多 agent 协同",
    );
    for (const planned of screen.getAllByTestId("ai-planned")) {
      expect(planned.textContent).toContain("规划中");
    }
  });
});
