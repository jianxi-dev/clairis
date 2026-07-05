import { create } from "zustand";
import type { Tab, EditorMode, FileKind, RecentFile } from "../types";

export type SplitDirection = "horizontal" | "vertical";

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
  sidebarLeftVisible: boolean;
  sidebarRightVisible: boolean;
  readingMode: boolean;
  recentFiles: RecentFile[];
  // Split panel — each panel holds its own tab refs
  splitDirection: SplitDirection | null;
  splitTabIds: string[];
  splitActiveTabId: string | null;
  splitEditorMode: EditorMode;
  horizontalSplitRatio: number;
  verticalSplitRatio: number;

  reset: () => void;
  openFile: (path: string, content: string) => void;
  newTab: () => void;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  updateContent: (content: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  setEditorMode: (mode: EditorMode) => void;
  setReadingMode: (on: boolean) => void;
  markClean: () => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setSidebarLeftVisible: (v: boolean) => void;
  setSidebarRightVisible: (v: boolean) => void;
  addRecentFile: (path: string, title: string) => void;
  clearRecentFiles: () => void;
  // Split actions
  splitTab: (tabId: string, direction: SplitDirection) => void;
  unsplit: () => void;
  moveTabToSplit: (tabId: string) => void;
  moveTabToMain: (tabId: string) => void;
  setSplitEditorMode: (mode: EditorMode) => void;
  setSplitActiveTab: (id: string) => void;
  setSplitRatio: (direction: SplitDirection, ratio: number) => void;
  setSplitRatios: (ratios: { horizontal?: number; vertical?: number }) => void;
}

const initialState = {
  activeTabId: null as string | null,
  tabs: {} as Record<string, Tab>,
  sidebarLeftVisible: true,
  sidebarRightVisible: false,
  readingMode: false,
  recentFiles: [] as RecentFile[],
  splitDirection: null as SplitDirection | null,
  splitTabIds: [] as string[],
  splitActiveTabId: null as string | null,
  splitEditorMode: "preview" as EditorMode,
  horizontalSplitRatio: 0.5,
  verticalSplitRatio: 0.5,
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

  updateTabContent: (tabId: string, content: string) => {
    const { tabs } = get();
    const tab = tabs[tabId];
    if (!tab) return;
    set({
      tabs: {
        ...tabs,
        [tabId]: { ...tab, content, dirty: true },
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

  newTab: () => {
    const id = generateId();
    const tab: Tab = {
      id,
      title: "未命名",
      path: null,
      fileKind: "markdown",
      content: "",
      dirty: false,
      editorMode: "edit",
      scrollPos: 0,
    };
    set((s) => ({
      tabs: { ...s.tabs, [id]: tab },
      activeTabId: id,
    }));
  },

  toggleLeftSidebar: () =>
    set((s) => ({ sidebarLeftVisible: !s.sidebarLeftVisible })),

  toggleRightSidebar: () =>
    set((s) => ({ sidebarRightVisible: !s.sidebarRightVisible })),

  setSidebarLeftVisible: (v: boolean) => set({ sidebarLeftVisible: v }),
  setSidebarRightVisible: (v: boolean) => set({ sidebarRightVisible: v }),

  addRecentFile: (path: string, title: string) => {
    set((s) => {
      const filtered = s.recentFiles.filter((f) => f.path !== path);
      const entry: RecentFile = { path, title, openedAt: new Date().toISOString() };
      return { recentFiles: [entry, ...filtered].slice(0, 10) };
    });
  },

  clearRecentFiles: () => set({ recentFiles: [] }),

  // ── Split panel actions ──
  splitTab: (tabId: string, direction: SplitDirection) =>
    set((s) => {
      // Move the tab to the split panel
      const newSplitIds = [tabId];
      // Keep any existing split tabs that are still valid
      for (const id of s.splitTabIds) {
        if (id !== tabId && s.tabs[id] && !newSplitIds.includes(id)) {
          newSplitIds.push(id);
        }
      }
      return {
        splitDirection: direction,
        splitTabIds: newSplitIds,
        splitActiveTabId: tabId,
        // If the split tab was the main active tab, switch main to another tab
        activeTabId: s.activeTabId === tabId
          ? Object.keys(s.tabs).find((id) => id !== tabId && !newSplitIds.includes(id)) || null
          : s.activeTabId,
      };
    }),

  unsplit: () =>
    set({
      splitDirection: null,
      splitTabIds: [],
      splitActiveTabId: null,
    }),

  moveTabToSplit: (tabId: string) =>
    set((s) => {
      if (s.splitTabIds.includes(tabId)) return {};
      return {
        splitTabIds: [...s.splitTabIds, tabId],
        splitActiveTabId: tabId,
        activeTabId: s.activeTabId === tabId
          ? Object.keys(s.tabs).find((id) => id !== tabId && !s.splitTabIds.includes(id)) || null
          : s.activeTabId,
      };
    }),

  moveTabToMain: (tabId: string) =>
    set((s) => ({
      splitTabIds: s.splitTabIds.filter((id) => id !== tabId),
      splitActiveTabId: s.splitActiveTabId === tabId
        ? s.splitTabIds.find((id) => id !== tabId) || null
        : s.splitActiveTabId,
      activeTabId: tabId,
    })),

  setSplitEditorMode: (mode: EditorMode) => set({ splitEditorMode: mode }),

  setSplitActiveTab: (id: string) => set({ splitActiveTabId: id }),

  setSplitRatio: (direction: SplitDirection, ratio: number) => {
    const clamped = Math.max(0.1, Math.min(0.9, ratio));
    if (direction === "horizontal") {
      set({ horizontalSplitRatio: clamped });
    } else {
      set({ verticalSplitRatio: clamped });
    }
  },

  setSplitRatios: (ratios) => {
    const patch: Partial<Pick<AppStore, "horizontalSplitRatio" | "verticalSplitRatio">> = {};
    if (ratios.horizontal !== undefined) {
      patch.horizontalSplitRatio = Math.max(0.1, Math.min(0.9, ratios.horizontal));
    }
    if (ratios.vertical !== undefined) {
      patch.verticalSplitRatio = Math.max(0.1, Math.min(0.9, ratios.vertical));
    }
    set(patch as Partial<AppStore>);
  },
}));

// Expose store for E2E testing (Tauri Mock bridge)
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__jianxi_store__ = useStore;
}
