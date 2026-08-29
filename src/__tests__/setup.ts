import "@testing-library/jest-dom";
import { vi } from "vitest";

// jsdom polyfills for browser APIs used by react-resizable-panels and useConfig
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.matchMedia === "undefined") {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Mock Tauri invoke for jsdom
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (cmd: string) => {
    if (cmd === "read_file_base64") {
      return "AAECAwQ=";
    }
    if (cmd === "load_config") {
      return {
        fontSize: 17,
        headingColors: null,
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
        recentFiles: [],
      };
    }
    return null;
  },
  convertFileSrc: (path: string) => `asset://localhost${path}`,
}));

// Mock Tauri webview API
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: () => Promise.resolve(() => {}),
  }),
}));
