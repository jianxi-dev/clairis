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
  applyReaderSkin: (skin: string) => {
    document.documentElement.dataset.skin = skin || "paper";
  },
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
  delete document.documentElement.dataset.skin;
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

  it("阅读空间区：行宽三档与配色四项就位，点击写入配置并应用皮肤", () => {
    render(<SettingsView onClose={() => {}} />);
    fireEvent.click(screen.getAllByTestId("settings-nav-item")[2]);

    const widths = screen
      .getAllByTestId(/^reader-width-/)
      .filter((el) => el.tagName === "BUTTON");
    expect(widths).toHaveLength(3);
    expect(widths.map((el) => el.textContent)).toEqual([
      "紧凑",
      "标准",
      "宽松",
    ]);
    const tones = screen.getAllByTestId(/^reader-tone-/);
    expect(tones).toHaveLength(4);
    expect(tones.map((el) => el.textContent)).toEqual([
      "纸墨",
      "靛青",
      "松绿",
      "赭石",
    ]);

    fireEvent.click(screen.getByTestId("reader-width-720"));
    expect(useEditorStore.getState().config.readerWidth).toBe(720);

    // 连续滑块（#274）：480–2400，实时写配置与数值展示
    const range = screen.getByTestId("reader-width-range") as HTMLInputElement;
    expect(range.min).toBe("480");
    expect(range.max).toBe("2400");
    expect(screen.getByTestId("reader-width-value").textContent).toBe("720px");
    fireEvent.change(range, { target: { value: "1400" } });
    expect(useEditorStore.getState().config.readerWidth).toBe(1400);
    expect(screen.getByTestId("reader-width-value").textContent).toBe("1400px");

    fireEvent.click(screen.getByTestId("reader-tone-indigo"));
    expect(useEditorStore.getState().config.readerSkin).toBe("indigo");
    expect(document.documentElement.dataset.skin).toBe("indigo");
  });

  it("外观区保留阅读字号入口，点击写入 readerFontSize", () => {
    render(<SettingsView onClose={() => {}} />);

    expect(screen.getAllByTestId(/^font-size-/)).toHaveLength(6);
    fireEvent.click(screen.getByTestId("font-size-19"));
    expect(useEditorStore.getState().config.readerFontSize).toBe(19);
  });

  it("设置窗自适应：根容器裁剪，内容区与导航各自可滚动", () => {
    render(<SettingsView onClose={() => {}} />);

    const scene = screen.getByTestId("settings-scene");
    expect(scene.className).toContain("min-h-0");
    expect(scene.className).toContain("overflow-hidden");

    const nav = screen.getByTestId("settings-nav");
    expect(nav.className).toContain("overflow-y-auto");
    expect(nav.className).toContain("min-h-0");

    const content = scene.querySelector(".overflow-y-auto");
    expect(content?.className).toContain("min-h-0");
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
