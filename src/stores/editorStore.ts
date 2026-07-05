// @deprecated — 考虑合并到 useStore (src/stores/index.ts)。当前两个 store 分离
// 导致跨 store 操作复杂（config 在 editorStore，tabs 在 useStore）。
// Phase 1a 后评估合并。
import { create } from "zustand";
import type {
  AppConfig,
  EditorMode,
  HeadingColors,
  TranslationState,
  RawMarkdown,
} from "../types";

export interface EditorStore {
  // File state
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  content: string;

  // Editor mode
  editorMode: EditorMode;

  // Font size
  fontSize: number;

  // Heading colors
  headingColors: HeadingColors;

  // Translation
  translation: TranslationState;

  // Dirty flag
  dirty: boolean;

  // Version counter — incremented on external content changes (file open, mode switch)
  // WYSIWYG editor uses this to know when to push content into TipTap
  contentVersion: number;

  // Config
  config: Partial<AppConfig>;

  // Config loading/saving
  configLoaded: boolean;
  configLoading: boolean;

  // Actions
  setContent: (content: string) => void;
  incContentVersion: () => void;
  setFilePath: (path: string | null, name: string | null) => void;
  setFileSize: (size: number | null) => void;
  setEditorMode: (mode: EditorMode) => void;
  setFontSize: (size: number) => void;
  setHeadingColors: (colors: HeadingColors) => void;
  setTranslation: (state: Partial<TranslationState>) => void;
  setDirty: (dirty: boolean) => void;
  setConfig: (config: Partial<AppConfig>) => void;
  setConfigLoaded: (loaded: boolean) => void;
  setConfigLoading: (loading: boolean) => void;
  reset: () => void;
}

const DEFAULT_HEADING_COLORS: HeadingColors = {
  h1: "#d73a49",
  h2: "#6f42c1",
  h3: "#005cc5",
  h4: "#e36209",
  h5: "#24292e",
  h6: "#586069",
};

const initialState = {
  filePath: null as string | null,
  fileName: null as string | null,
  fileSize: null as number | null,
  content: "",
  editorMode: "preview" as EditorMode,
  fontSize: 16,
  headingColors: DEFAULT_HEADING_COLORS,
  translation: {
    active: false,
    requestId: null as string | null,
    text: "",
    loading: false,
    error: null as string | null,
  },
  dirty: false,
  contentVersion: 0,
  config: {},
  configLoaded: false,
  configLoading: false,
};

export const useEditorStore = create<EditorStore>((set) => ({
  ...initialState,

  setContent: (content) =>
    set({ content, dirty: true }),

  incContentVersion: () =>
    set((prev) => ({ contentVersion: prev.contentVersion + 1 })),

  setFilePath: (path, name) =>
    set({ filePath: path, fileName: name, dirty: false }),

  setFileSize: (size) =>
    set({ fileSize: size }),

  setEditorMode: (mode) =>
    set({ editorMode: mode }),

  setFontSize: (size) =>
    set({ fontSize: size }),

  setHeadingColors: (colors) =>
    set({ headingColors: colors }),

  setTranslation: (state) =>
    set((prev) => ({
      translation: { ...prev.translation, ...state },
    })),

  setDirty: (dirty) =>
    set({ dirty }),

  setConfig: (config) =>
    set((prev) => ({
      config: { ...prev.config, ...config },
    })),

  setConfigLoaded: (loaded) =>
    set({ configLoaded: loaded }),

  setConfigLoading: (loading) =>
    set({ configLoading: loading }),

  reset: () => set(initialState),
}));
