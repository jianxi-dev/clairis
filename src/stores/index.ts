import { create } from "zustand";
import type { Tab, EditorMode, FileKind } from "../types";

let nextId = 1;
function generateId(): string {
  return `tab-${nextId++}`;
}

function detectFileKind(path: string): FileKind {
  if (path.endsWith(".md") || path.endsWith(".markdown")) return "markdown";
  if (path.endsWith(".html") || path.endsWith(".htm")) return "html";
  return "text";
}

function extractFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

interface AppStore {
  activeTabId: string | null;
  tabs: Record<string, Tab>;
  sidebarOpen: boolean;
  readingMode: boolean;

  reset: () => void;
  openFile: (path: string, content: string) => void;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  updateContent: (content: string) => void;
  setEditorMode: (mode: EditorMode) => void;
  setReadingMode: (on: boolean) => void;
  markClean: () => void;
}

const initialState = {
  activeTabId: null as string | null,
  tabs: {} as Record<string, Tab>,
  sidebarOpen: true,
  readingMode: false,
};

export const useStore = create<AppStore>((set, get) => ({
  ...initialState,

  reset: () => set(initialState),

  openFile: (path: string, content: string) => {
    const state = get();

    // Check if tab for this path already exists
    const existing = Object.values(state.tabs).find((t) => t.path === path);
    if (existing) {
      set({
        tabs: {
          ...state.tabs,
          [existing.id]: {
            ...existing,
            content,
            dirty: false,
          },
        },
        activeTabId: existing.id,
      });
      return;
    }

    const fileKind = detectFileKind(path);
    const title = extractFileName(path);
    const id = generateId();

    const tab: Tab = {
      id,
      title,
      path,
      fileKind,
      content,
      dirty: false,
      editorMode: "preview",
      scrollPos: 0,
    };

    set({
      tabs: { ...state.tabs, [id]: tab },
      activeTabId: id,
    });
  },

  switchTab: (id: string) => {
    set({ activeTabId: id });
  },

  closeTab: (id: string) => {
    const state = get();
    const { [id]: _removed, ...remaining } = state.tabs;

    let activeTabId = state.activeTabId;
    if (activeTabId === id) {
      const remainingIds = Object.keys(remaining);
      activeTabId = remainingIds.length > 0 ? remainingIds[0] : null;
    }

    set({ tabs: remaining, activeTabId });
  },

  updateContent: (content: string) => {
    const state = get();
    const { activeTabId, tabs } = state;
    if (!activeTabId) return;

    const tab = tabs[activeTabId];
    if (!tab) return;

    set({
      tabs: {
        ...tabs,
        [activeTabId]: { ...tab, content, dirty: true },
      },
    });
  },

  setEditorMode: (mode: EditorMode) => {
    const state = get();
    const { activeTabId, tabs } = state;
    if (!activeTabId) return;

    const tab = tabs[activeTabId];
    if (!tab) return;

    set({
      tabs: {
        ...tabs,
        [activeTabId]: { ...tab, editorMode: mode },
      },
    });
  },

  setReadingMode: (on: boolean) => {
    set({ readingMode: on });
  },

  markClean: () => {
    const state = get();
    const { activeTabId, tabs } = state;
    if (!activeTabId) return;
    const tab = tabs[activeTabId];
    if (!tab) return;
    set({
      tabs: {
        ...tabs,
        [activeTabId]: { ...tab, dirty: false },
      },
    });
  },
}));
