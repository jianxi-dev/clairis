import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsView from "../../components/SettingsView";
import { useEditorStore } from "../../stores/editorStore";
import { useStore } from "../../stores/index";
import { resetCapabilities } from "../../lib/capabilities";

vi.mock("../../hooks/useConfig", () => ({
  saveAppConfig: () => Promise.resolve(),
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
});
