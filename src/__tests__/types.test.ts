import { describe, it, expect } from "vitest";
import type {
  EditorMode,
  HeadingColors,
  AppConfig,
  TranslationState,
} from "../types";

describe("types", () => {
  it("EditorMode accepts valid values", () => {
    const modes: EditorMode[] = ["preview", "edit", "source"];
    expect(modes).toHaveLength(3);
  });

  it("HeadingColors has all 6 levels", () => {
    const colors: HeadingColors = {
      h1: "#000",
      h2: "#000",
      h3: "#000",
      h4: "#000",
      h5: "#000",
      h6: "#000",
    };
    expect(Object.keys(colors)).toHaveLength(6);
  });

  it("AppConfig has required fields", () => {
    const config: AppConfig = {
      fontSize: 17,
      headingColors: { h1: "", h2: "", h3: "", h4: "", h5: "", h6: "" },
      readerFontSize: 17,
      readerWidth: 1080,
      readerSkin: "paper",
      ollamaEndpoint: "",
      openaiEndpoint: "",
      openaiModel: "",
      translationProvider: "ollama",
      langPair: { source: "en", target: "zh-CN" },
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
    expect(config.translationProvider).toBe("ollama");
    expect(config.fontSize).toBe(17);
  });

  it("TranslationState has correct structure", () => {
    const state: TranslationState = {
      active: true,
      requestId: "abc",
      text: "hello",
      loading: false,
      error: null,
    };
    expect(state.active).toBe(true);
    expect(state.requestId).toBe("abc");
  });
});
