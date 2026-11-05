import { create } from "zustand";
import type {
  Tab,
  EditorMode,
  FileKind,
  RecentFile,
  Scene,
  ScrollPosition,
} from "../types";
import type { FileTypeKind } from "../lib/fileType";
import {
  DEFAULT_RAIL_VIEW_SPEC,
  nextRailState,
  type RailChipKind,
  type RailDensity,
  type RailLayout,
  type RailSection,
  type RailState,
  type RailViewSpec,
} from "../lib/railView";
import { DENSITY_HEIGHT, clampCardHeight } from "../lib/railCards";
import {
  DEFAULT_PREVIEW_SETTINGS,
  type PreviewSettings,
  type PreviewState,
} from "../lib/previewAnchor";
import {
  addTab,
  createLeaf,
  createRootLeaf,
  findLeaf,
  leafOfTab,
  listLeaves,
  mapLeaves,
  moveLeaf,
  moveLeafToRoot,
  removeLeaf,
  reorderLeafTabs,
  serializeLayout,
  setBranchRatio,
  siblingLeafId,
  splitLeaf,
  splitLeafSide,
  swapLeaves,
  updateLeaf,
  type PaneDir,
  type PaneLayout,
  type PaneLeaf,
  type PaneSide,
} from "../lib/paneTree";

/** 门户卡片摘要：取正文前 160 字，压掉多余空白。不是占位文案，是文件真实开头。 */
function excerptOf(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 160);
}

export type SplitDirection = "horizontal" | "vertical";

let nextId = 1;
function generateId(): string {
  return `tab-${nextId++}`;
}

let nextPaneId = 1;
function generatePaneId(): string {
  return `pane-${nextPaneId++}`;
}

const TEXT_EXTENSIONS: Record<string, FileKind> = {
  md: "markdown",
  markdown: "markdown",
  mdown: "markdown",
  mdwn: "markdown",
  html: "html",
  htm: "html",
  css: "css",
  py: "python",
  pyw: "python",
  json: "json",
  jsonc: "json",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "javascript",
  tsx: "javascript",
  yaml: "yaml",
  yml: "yaml",
  csv: "csv",
};

const MEDIA_EXTENSIONS: Record<string, FileKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  svg: "image",
  webp: "image",
  bmp: "image",
  ico: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  m4v: "video",
  mkv: "video",
  avi: "video",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  flac: "audio",
  ogg: "audio",
  pdf: "pdf",
};

const CODE_KINDS: FileKind[] = [
  "css",
  "python",
  "json",
  "javascript",
  "yaml",
  "csv",
];

function detectFileKind(path: string): FileKind {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "text";
  const ext = path.slice(dot + 1).toLowerCase();
  return TEXT_EXTENSIONS[ext] ?? MEDIA_EXTENSIONS[ext] ?? "text";
}

export function isMediaKind(kind: FileKind): boolean {
  return (
    kind === "image" || kind === "video" || kind === "audio" || kind === "pdf"
  );
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
  immersiveChromeVisible: boolean;
  scrollPositions: Record<string, ScrollPosition>;
  recentFiles: RecentFile[];
  /** 当前场景：门户 / 工作区 / 网格 / 设置（Layout Portal §1） */
  scene: Scene;
  /** 网格按类型过滤（门户分类磁贴点击后带入） */
  gridTypeFilter: FileTypeKind | null;
  // Split panel — each panel holds its own tab refs
  splitDirection: SplitDirection | null;
  splitTabIds: string[];
  splitActiveTabId: string | null;
  splitEditorMode: EditorMode;
  horizontalSplitRatio: number;
  verticalSplitRatio: number;

  // ── Pane 递归树（change layout-portal / 3.1）──
  /** 工作区分栏树。根 leaf id 固定 `"main"`。 */
  paneRoot: PaneLayout;
  /** 当前聚焦的 leaf id（⌘⌥→ / ⌘⌥↓ 作用于此格）。 */
  focusedPaneId: string;
  /** 全屏格 id；null = 正常多格布局。 */
  fullscreenPaneId: string | null;
  /** 正在被拖拽的格 id；仅 UI 预览，不持久化。 */
  dragPaneSourceId: string | null;
  /** 正在被拖拽的文件路径；仅 UI 预览，不持久化。 */
  draggingFilePath: string | null;

  // ── 阅读空间竖排栏（change layout-portal / 6.1）──
  /** 栏三态：折叠 / 悬停浮层 / 钉住。瞬态，不持久化。 */
  railState: RailState;
  /** 是否钉住（= railState === 'pinned' 的镜像）。 */
  railPinned: boolean;
  /** 栏内布局：段叠放 / 分段页签。 */
  railLayout: RailLayout;
  /** 栏内密度：紧凑 / 舒适 / 卡片。 */
  railDensity: RailDensity;
  /** 卡片档高度（88–160，默认 112）；只影响卡片密度。 */
  railCardHeight: number;
  /** 顶部搜索是否处于展开（聚焦）状态。 */
  railSearchOpen: boolean;
  /** 栏内搜索词；与网格搜索完全独立。 */
  railQuery: string;
  /** 当前段（标签布局下的活动签 / 堆叠布局下无强约束）。 */
  railSection: RailSection;
  /** 分类段的活动 chip。 */
  railChip: RailChipKind;
  /** 「设为默认」保存的视图规格，持久化到 Rust `rail_view_spec`。 */
  railViewSpec: RailViewSpec;

  reset: () => void;
  openFile: (path: string, content: string) => void;
  newTab: () => void;
  newTabWith: (title: string, content: string) => void;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  updateContent: (content: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  setEditorMode: (mode: EditorMode) => void;
  setReadingMode: (on: boolean) => void;
  setImmersiveChromeVisible: (v: boolean) => void;
  updateScrollPos: (
    tabId: string,
    scrollPos: number,
    contentHeight: number,
  ) => void;
  setScrollPositions: (positions: Record<string, ScrollPosition>) => void;
  markClean: () => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setSidebarLeftVisible: (v: boolean) => void;
  setSidebarRightVisible: (v: boolean) => void;
  addRecentFile: (path: string, title: string, excerpt?: string) => void;
  setScene: (scene: Scene) => void;
  setGridTypeFilter: (kind: FileTypeKind | null) => void;
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
  // Pane 递归树 actions（layout-portal 3.1）
  splitPane: (dir: PaneDir) => void;
  closePane: (leafId: string) => void;
  focusPane: (id: string) => void;
  toggleFullscreenPane: () => void;
  setPaneRatio: (branchId: string, ratio: number) => void;
  setPaneEditorMode: (leafId: string, mode: EditorMode) => void;
  reorderPaneTabs: (leafId: string, from: number, to: number) => void;
  restorePaneLayout: (root: PaneLayout, focusedId: string) => void;
  collapsePanes: () => void;
  paneLayoutJson: () => string;
  // 拖拽换位 actions（layout-portal 5.1）
  swapPanes: (a: string, b: string) => void;
  movePane: (sourceId: string, targetId: string, side: PaneSide) => void;
  movePaneToRoot: (sourceId: string, side: PaneSide) => void;
  dropFileOnPane: (
    path: string,
    content: string,
    targetLeafId: string,
    side: PaneSide,
  ) => void;
  setDragPaneSource: (id: string | null) => void;
  setDraggingFilePath: (path: string | null) => void;
  // 阅读空间栏 actions（layout-portal 6.1）
  setRailState: (state: RailState) => void;
  toggleRailPin: () => void;
  setRailLayout: (layout: RailLayout) => void;
  setRailDensity: (density: RailDensity) => void;
  setRailCardHeight: (height: number) => void;
  openRailSearch: () => void;
  closeRailSearch: () => void;
  setRailQuery: (query: string) => void;
  setRailSection: (section: RailSection) => void;
  setRailChip: (chip: RailChipKind) => void;
  saveRailViewSpec: () => void;

  // ── 悬浮预览窗（change layout-portal / 8.1）──
  /** 当前悬浮预览窗；null = 不显示。瞬态，不持久化（重开回默认锚定）。 */
  preview: PreviewState | null;
  /** 双轨开关：阅读空间悬停 / 网格触发方式 / 总开关。持久化到 Rust `preview_settings`。 */
  previewSettings: PreviewSettings;
  openPreview: (payload: Omit<PreviewState, "pinned">) => void;
  closePreview: () => void;
  movePreview: (
    x: number,
    y: number,
    flippedX: boolean,
    flippedY: boolean,
  ) => void;
  resizePreviewTo: (
    rect: { x: number; y: number; w: number; h: number },
    flippedX: boolean,
    flippedY: boolean,
  ) => void;
  togglePreviewPin: () => void;
  setPreviewSettings: (patch: Partial<PreviewSettings>) => void;
  togglePreviewEnabled: () => void;
}

const initialState = {
  activeTabId: null as string | null,
  tabs: {} as Record<string, Tab>,
  sidebarLeftVisible: true,
  sidebarRightVisible: false,
  readingMode: false,
  immersiveChromeVisible: false,
  scrollPositions: {} as Record<string, ScrollPosition>,
  recentFiles: [] as RecentFile[],
  scene: "portal" as Scene,
  gridTypeFilter: null as FileTypeKind | null,
  splitDirection: null as SplitDirection | null,
  splitTabIds: [] as string[],
  splitActiveTabId: null as string | null,
  splitEditorMode: "preview" as EditorMode,
  horizontalSplitRatio: 0.5,
  verticalSplitRatio: 0.5,
  paneRoot: createRootLeaf() as PaneLayout,
  focusedPaneId: "main",
  fullscreenPaneId: null as string | null,
  dragPaneSourceId: null as string | null,
  draggingFilePath: null as string | null,
  railState: "collapsed" as RailState,
  railPinned: false,
  railLayout: DEFAULT_RAIL_VIEW_SPEC.layout,
  railDensity: DEFAULT_RAIL_VIEW_SPEC.density,
  railCardHeight: DEFAULT_RAIL_VIEW_SPEC.cardHeight ?? DENSITY_HEIGHT.card,
  railSearchOpen: false,
  railQuery: "",
  railSection: "recent" as RailSection,
  railChip: "all" as RailChipKind,
  railViewSpec: { ...DEFAULT_RAIL_VIEW_SPEC },
  preview: null as PreviewState | null,
  previewSettings: { ...DEFAULT_PREVIEW_SETTINGS },
};

export const useStore = create<AppStore>((set, get) => ({
  ...initialState,

  reset: () => set(initialState),
  openFile: (path: string, content: string) => {
    const state = get();

    // Check if tab for this path already exists
    const existing = Object.values(state.tabs).find((t) => t.path === path);
    if (existing) {
      const hostLeaf =
        leafOfTab(state.paneRoot, existing.id) ??
        findLeaf(state.paneRoot, state.focusedPaneId);
      const paneRoot = hostLeaf
        ? updateLeaf(state.paneRoot, hostLeaf.id, {
            tabs: hostLeaf.tabs.includes(existing.id)
              ? hostLeaf.tabs
              : [...hostLeaf.tabs, existing.id],
            activeTabId: existing.id,
            editorMode: existing.editorMode,
          })
        : state.paneRoot;
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
        focusedPaneId: hostLeaf?.id ?? state.focusedPaneId,
        paneRoot,
        scene: "workspace",
        // 重开已存在的文件也要把它顶到最近列表最前：否则"最近"会停留在很久以前
        recentFiles: [
          {
            path,
            title: existing.title,
            openedAt: new Date().toISOString(),
            excerpt: excerptOf(content),
          },
          ...state.recentFiles.filter((f) => f.path !== path),
        ].slice(0, 10),
      });
      return;
    }

    const fileKind = detectFileKind(path);
    const title = extractFileName(path);
    const id = generateId();

    // 代码类默认编辑模式（C-1 源码打开）；媒体类恒预览；阅读类保持预览
    const defaultEditorMode: EditorMode = CODE_KINDS.includes(fileKind)
      ? "edit"
      : "preview";

    const tab: Tab = {
      id,
      title,
      path,
      fileKind,
      content,
      dirty: false,
      editorMode: defaultEditorMode,
      scrollPos: 0,
      contentHeight: 0,
    };

    // 新页签落进当前聚焦格（无有效聚焦格时退回第一个 leaf）
    const hostLeaf =
      findLeaf(state.paneRoot, state.focusedPaneId) ??
      listLeaves(state.paneRoot)[0] ??
      null;
    let paneRoot = state.paneRoot;
    if (hostLeaf) {
      paneRoot = updateLeaf(state.paneRoot, hostLeaf.id, {
        editorMode: defaultEditorMode,
      });
      paneRoot = addTab(paneRoot, hostLeaf.id, id);
    }

    set({
      tabs: { ...state.tabs, [id]: tab },
      activeTabId: id,
      focusedPaneId: hostLeaf?.id ?? state.focusedPaneId,
      paneRoot,
      // 打开文件即离开门户（Layout Portal §1 场景图）
      scene: "workspace",
      recentFiles: [
        {
          path,
          title,
          openedAt: new Date().toISOString(),
          excerpt: excerptOf(content),
        },
        ...state.recentFiles.filter((f) => f.path !== path),
      ].slice(0, 10),
    });
  },

  switchTab: (id: string) => {
    const state = get();
    const leaf = leafOfTab(state.paneRoot, id);
    if (!leaf) {
      set({ activeTabId: id });
      return;
    }
    const tab = state.tabs[id];
    set({
      activeTabId: id,
      focusedPaneId: leaf.id,
      paneRoot: updateLeaf(state.paneRoot, leaf.id, {
        activeTabId: id,
        editorMode: tab ? tab.editorMode : leaf.editorMode,
      }),
    });
  },

  closeTab: (id: string) => {
    const state = get();
    const { [id]: _removed, ...remaining } = state.tabs;
    const leaf = leafOfTab(state.paneRoot, id);

    // 页签不在任何格（历史遗留）：只处理 tabs / activeTabId
    if (!leaf) {
      let activeTabId = state.activeTabId;
      if (activeTabId === id) {
        const remainingIds = Object.keys(remaining);
        activeTabId = remainingIds.length > 0 ? remainingIds[0] : null;
      }
      set({ tabs: remaining, activeTabId });
      return;
    }

    const newTabs = leaf.tabs.filter((t) => t !== id);
    let paneRoot: PaneLayout;
    let focusedPaneId = state.focusedPaneId;

    if (newTabs.length === 0 && state.paneRoot.type !== "leaf") {
      // 关掉该格最后一签：删格，兄弟扩展，焦点移到兄弟
      const sibling = siblingLeafId(state.paneRoot, leaf.id);
      const { root } = removeLeaf(state.paneRoot, leaf.id);
      paneRoot = root;
      focusedPaneId =
        state.focusedPaneId === leaf.id
          ? (sibling ?? listLeaves(root)[0]?.id ?? "main")
          : state.focusedPaneId;
    } else {
      let activeTabId = leaf.activeTabId;
      if (activeTabId === id) activeTabId = newTabs[0] ?? null;
      paneRoot = updateLeaf(state.paneRoot, leaf.id, {
        tabs: newTabs,
        activeTabId,
      });
    }

    // 扁平 activeTabId 始终镜像聚焦格
    const activeTabId = findLeaf(paneRoot, focusedPaneId)?.activeTabId ?? null;
    set({ tabs: remaining, activeTabId, paneRoot, focusedPaneId });
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
    if (isMediaKind(tab.fileKind)) return;

    const leaf = findLeaf(state.paneRoot, state.focusedPaneId);
    const paneRoot =
      leaf && leaf.activeTabId === activeTabId
        ? updateLeaf(state.paneRoot, leaf.id, { editorMode: mode })
        : state.paneRoot;

    set({
      tabs: {
        ...tabs,
        [activeTabId]: { ...tab, editorMode: mode },
      },
      paneRoot,
    });
  },

  setReadingMode: (on: boolean) => {
    set({
      readingMode: on,
      immersiveChromeVisible: false,
    });
  },

  setImmersiveChromeVisible: (v: boolean) => {
    set({ immersiveChromeVisible: v });
  },

  updateScrollPos: (
    tabId: string,
    scrollPos: number,
    contentHeight: number,
  ) => {
    const { tabs, scrollPositions } = get();
    const tab = tabs[tabId];
    if (!tab) return;

    const patch: Record<string, Tab> = {
      [tabId]: { ...tab, scrollPos, contentHeight },
    };
    const scrollPatch: Record<string, ScrollPosition> = {};
    if (tab.path) {
      scrollPatch[tab.path] = { scrollPos, contentHeight };
    }
    set({
      tabs: { ...tabs, ...patch },
      scrollPositions: { ...scrollPositions, ...scrollPatch },
    });
  },

  setScrollPositions: (positions: Record<string, ScrollPosition>) => {
    set({ scrollPositions: positions });
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

  newTab: () => get().newTabWith("未命名", ""),

  newTabWith: (title: string, content: string) => {
    const state = get();
    const id = generateId();
    const tab: Tab = {
      id,
      title,
      path: null,
      fileKind: "markdown",
      content,
      dirty: false,
      editorMode: "edit",
      scrollPos: 0,
      contentHeight: 0,
    };
    const hostLeaf =
      findLeaf(state.paneRoot, state.focusedPaneId) ??
      listLeaves(state.paneRoot)[0] ??
      null;
    let paneRoot = state.paneRoot;
    if (hostLeaf) {
      paneRoot = updateLeaf(state.paneRoot, hostLeaf.id, {
        editorMode: "edit",
      });
      paneRoot = addTab(paneRoot, hostLeaf.id, id);
    }
    set({
      tabs: { ...state.tabs, [id]: tab },
      activeTabId: id,
      focusedPaneId: hostLeaf?.id ?? state.focusedPaneId,
      paneRoot,
    });
  },

  toggleLeftSidebar: () =>
    set((s) => ({ sidebarLeftVisible: !s.sidebarLeftVisible })),

  toggleRightSidebar: () =>
    set((s) => ({ sidebarRightVisible: !s.sidebarRightVisible })),

  setSidebarLeftVisible: (v: boolean) => set({ sidebarLeftVisible: v }),
  setSidebarRightVisible: (v: boolean) => set({ sidebarRightVisible: v }),

  setScene: (scene: Scene) => set({ scene }),
  setGridTypeFilter: (kind: FileTypeKind | null) =>
    set({ gridTypeFilter: kind }),

  addRecentFile: (path: string, title: string, excerpt?: string) => {
    set((s) => {
      const prev = s.recentFiles.find((f) => f.path === path);
      const filtered = s.recentFiles.filter((f) => f.path !== path);
      const entry: RecentFile = {
        path,
        title,
        openedAt: new Date().toISOString(),
        // 没带摘要时沿用已有的：调用点常常只有路径与标题，
        // 直接覆盖会把 openFile 时截下的真摘要抹掉
        excerpt: excerpt?.slice(0, 160) ?? prev?.excerpt,
      };
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
        activeTabId:
          s.activeTabId === tabId
            ? Object.keys(s.tabs).find(
                (id) => id !== tabId && !newSplitIds.includes(id),
              ) || null
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
        activeTabId:
          s.activeTabId === tabId
            ? Object.keys(s.tabs).find(
                (id) => id !== tabId && !s.splitTabIds.includes(id),
              ) || null
            : s.activeTabId,
      };
    }),

  moveTabToMain: (tabId: string) =>
    set((s) => ({
      splitTabIds: s.splitTabIds.filter((id) => id !== tabId),
      splitActiveTabId:
        s.splitActiveTabId === tabId
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
    const patch: Partial<
      Pick<AppStore, "horizontalSplitRatio" | "verticalSplitRatio">
    > = {};
    if (ratios.horizontal !== undefined) {
      patch.horizontalSplitRatio = Math.max(
        0.1,
        Math.min(0.9, ratios.horizontal),
      );
    }
    if (ratios.vertical !== undefined) {
      patch.verticalSplitRatio = Math.max(0.1, Math.min(0.9, ratios.vertical));
    }
    set(patch as Partial<AppStore>);
  },

  // ── Pane 递归树 actions（layout-portal 3.1）──

  splitPane: (dir) => {
    const state = get();
    if (!findLeaf(state.paneRoot, state.focusedPaneId)) return;
    const newLeaf = createLeaf(generatePaneId());
    // 新格为空并获得焦点 → 扁平 activeTabId 同步为 null（镜像聚焦格）
    set({
      paneRoot: splitLeaf(state.paneRoot, state.focusedPaneId, dir, newLeaf),
      focusedPaneId: newLeaf.id,
      activeTabId: newLeaf.activeTabId,
      fullscreenPaneId: null,
    });
  },

  closePane: (leafId) => {
    const state = get();
    if (state.paneRoot.type === "leaf") return;
    const leaf = findLeaf(state.paneRoot, leafId);
    if (!leaf) return;
    const sibling = siblingLeafId(state.paneRoot, leafId);
    const { root, removed } = removeLeaf(state.paneRoot, leafId);
    if (!removed) return;

    // 关格连带关掉它的页签（页签是全局记录）
    const tabs = { ...state.tabs };
    for (const t of leaf.tabs) delete tabs[t];

    const focusedPaneId =
      state.focusedPaneId === leafId
        ? (sibling ?? listLeaves(root)[0]?.id ?? "main")
        : state.focusedPaneId;
    const activeTabId = findLeaf(root, focusedPaneId)?.activeTabId ?? null;
    set({
      paneRoot: root,
      tabs,
      focusedPaneId,
      activeTabId,
      fullscreenPaneId:
        state.fullscreenPaneId === leafId ? null : state.fullscreenPaneId,
    });
  },

  focusPane: (id) => {
    const state = get();
    const leaf = findLeaf(state.paneRoot, id);
    if (!leaf) return;
    set({ focusedPaneId: id, activeTabId: leaf.activeTabId });
  },

  toggleFullscreenPane: () => {
    const state = get();
    set({
      fullscreenPaneId: state.fullscreenPaneId ? null : state.focusedPaneId,
    });
  },

  setPaneRatio: (branchId, ratio) => {
    const state = get();
    set({ paneRoot: setBranchRatio(state.paneRoot, branchId, ratio) });
  },

  setPaneEditorMode: (leafId, mode) => {
    const state = get();
    const leaf = findLeaf(state.paneRoot, leafId);
    if (!leaf) return;
    const activeTab = leaf.activeTabId ? state.tabs[leaf.activeTabId] : null;
    if (activeTab && isMediaKind(activeTab.fileKind)) return;
    const tabs = activeTab
      ? { ...state.tabs, [activeTab.id]: { ...activeTab, editorMode: mode } }
      : state.tabs;
    set({
      paneRoot: updateLeaf(state.paneRoot, leafId, { editorMode: mode }),
      tabs,
    });
  },

  reorderPaneTabs: (leafId, from, to) => {
    const state = get();
    const paneRoot = reorderLeafTabs(state.paneRoot, leafId, from, to);
    if (paneRoot !== state.paneRoot) set({ paneRoot });
  },

  restorePaneLayout: (root, focusedId) => {
    const leaf = findLeaf(root, focusedId);
    set({
      paneRoot: root,
      focusedPaneId: focusedId,
      fullscreenPaneId: null,
      activeTabId: leaf?.activeTabId ?? null,
    });
  },

  collapsePanes: () => {
    const state = get();
    const activeTab = state.activeTabId ? state.tabs[state.activeTabId] : null;
    const root: PaneLayout = {
      ...createRootLeaf(),
      tabs: Object.keys(state.tabs),
      activeTabId: state.activeTabId,
      editorMode: activeTab ? activeTab.editorMode : "preview",
    };
    set({ paneRoot: root, focusedPaneId: "main", fullscreenPaneId: null });
  },

  paneLayoutJson: () => {
    const { paneRoot, focusedPaneId, tabs } = get();
    const pathOf = (tabId: string | null) =>
      tabId && tabs[tabId]?.path ? tabs[tabId].path : null;
    return JSON.stringify(serializeLayout(paneRoot, focusedPaneId, pathOf));
  },

  // ── 拖拽换位 actions（layout-portal 5.1）──

  swapPanes: (a, b) => {
    const state = get();
    const paneRoot = swapLeaves(state.paneRoot, a, b);
    if (paneRoot !== state.paneRoot) set({ paneRoot });
  },

  movePane: (sourceId, targetId, side) => {
    const state = get();
    const paneRoot = moveLeaf(state.paneRoot, sourceId, targetId, side);
    if (paneRoot === state.paneRoot) return;
    set({ paneRoot, focusedPaneId: sourceId, fullscreenPaneId: null });
  },

  movePaneToRoot: (sourceId, side) => {
    const state = get();
    const paneRoot = moveLeafToRoot(state.paneRoot, sourceId, side);
    if (paneRoot === state.paneRoot) return;
    set({ paneRoot, focusedPaneId: sourceId, fullscreenPaneId: null });
  },

  dropFileOnPane: (path, content, targetLeafId, side) => {
    const state = get();
    if (!findLeaf(state.paneRoot, targetLeafId)) return;

    // 去重：该文件若已在其它格打开，先整体移除，保证只出现在新格
    const existing = Object.values(state.tabs).find((t) => t.path === path);
    const tabId = existing ? existing.id : generateId();
    const fileKind = existing?.fileKind ?? detectFileKind(path);
    const title = existing?.title ?? extractFileName(path);
    const editorMode: EditorMode =
      existing?.editorMode ??
      (CODE_KINDS.includes(fileKind) ? "edit" : "preview");
    const tab: Tab = existing
      ? { ...existing, content, dirty: false }
      : {
          id: tabId,
          title,
          path,
          fileKind,
          content,
          dirty: false,
          editorMode,
          scrollPos: 0,
          contentHeight: 0,
        };

    let root = mapLeaves(state.paneRoot, (leaf) => {
      if (!leaf.tabs.includes(tabId)) return leaf;
      const tabs = leaf.tabs.filter((t) => t !== tabId);
      const activeTabId =
        leaf.activeTabId === tabId ? (tabs[0] ?? null) : leaf.activeTabId;
      return { ...leaf, tabs, activeTabId };
    });

    const newLeaf: PaneLeaf = {
      type: "leaf",
      id: generatePaneId(),
      tabs: [tabId],
      activeTabId: tabId,
      editorMode,
    };
    root = splitLeafSide(root, targetLeafId, side, newLeaf);

    set({
      tabs: { ...state.tabs, [tabId]: tab },
      paneRoot: root,
      focusedPaneId: newLeaf.id,
      activeTabId: tabId,
      scene: "workspace",
      fullscreenPaneId: null,
      recentFiles: [
        {
          path,
          title,
          openedAt: new Date().toISOString(),
          excerpt: excerptOf(content),
        },
        ...state.recentFiles.filter((f) => f.path !== path),
      ].slice(0, 10),
    });
  },

  setDragPaneSource: (id) => set({ dragPaneSourceId: id }),

  setDraggingFilePath: (path) => set({ draggingFilePath: path }),

  // ── 阅读空间栏 actions（layout-portal 6.1）──

  setRailState: (state) =>
    set({ railState: state, railPinned: state === "pinned" }),

  toggleRailPin: () => {
    const { railState } = get();
    const next = nextRailState(railState, { type: "toggle-pin" });
    set({ railState: next, railPinned: next === "pinned" });
  },

  setRailLayout: (layout) => set({ railLayout: layout }),

  setRailDensity: (density) => set({ railDensity: density }),

  setRailCardHeight: (height) =>
    set({ railCardHeight: clampCardHeight(height) }),

  openRailSearch: () => set({ railSearchOpen: true }),

  closeRailSearch: () => set({ railSearchOpen: false, railQuery: "" }),

  setRailQuery: (query) => set({ railQuery: query, railSearchOpen: true }),

  setRailSection: (section) => set({ railSection: section }),

  setRailChip: (chip) => set({ railChip: chip }),

  saveRailViewSpec: () => {
    const { railLayout, railDensity, railCardHeight } = get();
    // 卡片高度只在卡片档有意义；紧凑/舒适档不写这个字段，保持 6.1 旧规格形状
    const railViewSpec: RailViewSpec =
      railDensity === "card"
        ? {
            layout: railLayout,
            density: railDensity,
            cardHeight: clampCardHeight(railCardHeight),
          }
        : { layout: railLayout, density: railDensity };
    set({ railViewSpec });
    // 动态导入避免 stores ↔ useConfig 的静态循环依赖（useConfig 依赖本模块）
    void import("../hooks/useConfig").then((m) => m.saveAppConfig());
  },

  // ── 悬浮预览窗 actions（layout-portal 8.1）──

  openPreview: (payload) =>
    set((s) => ({
      // 再次锚定（换行）时保留钉住态；位置恒取新锚点，绝不沿用拖动后的旧坐标
      preview: { ...payload, pinned: s.preview?.pinned ?? false },
    })),

  closePreview: () => set({ preview: null }),

  movePreview: (x, y, flippedX, flippedY) =>
    set((s) =>
      s.preview ? { preview: { ...s.preview, x, y, flippedX, flippedY } } : {},
    ),

  resizePreviewTo: (rect, flippedX, flippedY) =>
    set((s) =>
      s.preview
        ? {
            preview: {
              ...s.preview,
              x: rect.x,
              y: rect.y,
              w: rect.w,
              h: rect.h,
              flippedX,
              flippedY,
            },
          }
        : {},
    ),

  togglePreviewPin: () =>
    set((s) =>
      s.preview ? { preview: { ...s.preview, pinned: !s.preview.pinned } } : {},
    ),

  setPreviewSettings: (patch) =>
    set((s) => ({ previewSettings: { ...s.previewSettings, ...patch } })),

  togglePreviewEnabled: () =>
    set((s) => {
      const enabled = !s.previewSettings.enabled;
      return {
        previewSettings: { ...s.previewSettings, enabled },
        preview: enabled ? s.preview : null,
      };
    }),
}));

// Expose store for E2E testing (Tauri Mock bridge)
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__biaoyue_store__ = useStore;
}

// Re-export capture overlay store
export { useCaptureOverlayStore } from "./captureOverlay";
export type { CaptureOverlayStore } from "./captureOverlay";
