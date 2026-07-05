import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "./stores/index";
import { useEditorStore } from "./stores/editorStore";
import Layout from "./components/Layout";
import Toolbar from "./components/Toolbar";
import SidebarPanel from "./components/SidebarPanel";
import RecentFiles from "./components/Sidebar/RecentFiles";
import FileTree from "./components/Sidebar/FileTree";
import Outline from "./components/Sidebar/Outline";
import ContentSplitView from "./components/Content/ContentSplitView";
import { getActiveEditorView } from "./editors/editorRef";
import { toggleBold, toggleItalic } from "./editors/keybindings";
import { useConfig } from "./hooks/useConfig";
import { log } from "./utils/log";

const isTauri =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== undefined;

function App() {
  const activeTabId = useStore((s) => s.activeTabId);
  const tabs = useStore((s) => s.tabs);
  const activeTab = activeTabId ? tabs[activeTabId] : null;
  const readingMode = useStore((s) => s.readingMode);

  // Init config loading + theme on mount
  const { setTheme, scheduleSave } = useConfig();
  const theme = useEditorStore((s) => s.config.theme ?? "system");

  // ── File operations ──────────────────────────────────────────

  const handleOpenFile = useCallback(async () => {
    if (!isTauri) return;
    try {
      const result = await invoke<{ content: string; path: string; file_size: number }>("open_file");
      const store = useStore.getState();
      store.openFile(result.path, result.content);
      store.addRecentFile(result.path, result.path.split("/").pop() || result.path);
      scheduleSave();
    } catch (e) {
      if (String(e) !== "Operation cancelled") {
        log.error("App", "Failed to open file", e);
      }
    }
  }, [scheduleSave]);

  const handleSaveFile = useCallback(async () => {
    if (!isTauri || !activeTab?.path) return;
    try {
      await invoke("save_file", { path: activeTab.path, content: activeTab.content });
      useStore.getState().markClean();
    } catch (e) {
      log.error("App", "Failed to save file", e);
    }
  }, [activeTab?.path, activeTab?.content]);

  const handleNewFile = useCallback(() => {
    useStore.getState().newTab();
  }, []);

  // ── Auto-save (2s debounce) ──────────────────────────────────

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeTab?.dirty || !activeTab?.path) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      if (!isTauri || !activeTab?.path) return;
      invoke("save_file", { path: activeTab.path, content: activeTab.content })
        .then(() => useStore.getState().markClean())
        .catch((e: unknown) => log.error("App", "Auto-save failed", e));
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [activeTab?.dirty, activeTab?.content, activeTab?.path]);

  // ── Keyboard shortcuts ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const store = useStore.getState();

      // Cmd+O: Open file
      if (meta && e.key === "o") {
        e.preventDefault();
        handleOpenFile();
      }

      // Cmd+S: Save
      if (meta && e.key === "s") {
        e.preventDefault();
        handleSaveFile();
      }

      // Cmd+N: New file
      if (meta && e.key === "n") {
        e.preventDefault();
        store.newTab();
      }

      // Cmd+W: Close active tab
      if (meta && e.key === "w" && activeTabId) {
        e.preventDefault();
        store.closeTab(activeTabId);
      }

      // Cmd+\ : Toggle left sidebar
      if (meta && e.key === "\\") {
        e.preventDefault();
        store.toggleLeftSidebar();
        scheduleSave();
      }

      // Cmd+Shift+\ : Toggle right sidebar
      if (meta && e.shiftKey && e.key === "\\") {
        e.preventDefault();
        store.toggleRightSidebar();
        scheduleSave();
      }

      // Cmd+Shift+S: Stop split (unsplit)
      if (meta && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        store.unsplit();
      }

      // Cmd+Shift+H: Horizontal split (active tab to the right)
      if (meta && e.shiftKey && e.key.toLowerCase() === "h" && activeTabId) {
        e.preventDefault();
        if (store.splitDirection) {
          store.unsplit();
        }
        store.splitTab(activeTabId, "horizontal");
      }

      // Cmd+Shift+V: Vertical split (active tab to the bottom)
      if (meta && e.shiftKey && e.key.toLowerCase() === "v" && activeTabId) {
        e.preventDefault();
        if (store.splitDirection) {
          store.unsplit();
        }
        store.splitTab(activeTabId, "vertical");
      }

      // Cmd+Shift+M: Toggle editor mode
      if (meta && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        const current = activeTab?.editorMode || "preview";
        const next =
          current === "preview" ? "edit" : current === "edit" ? "source" : "preview";
        store.setEditorMode(next);
      }

      // Cmd+B: Bold
      if (meta && e.key === "b") {
        e.preventDefault();
        const view = getActiveEditorView();
        if (view && activeTab?.editorMode !== "preview") {
          toggleBold(view);
        }
      }

      // Cmd+= and Cmd+-: Font size
      if (meta && (e.key === "=" || e.key === "-")) {
        e.preventDefault();
        const editorStore = useEditorStore.getState();
        const delta = e.key === "=" ? 1 : -1;
        const next = Math.max(12, Math.min(32, editorStore.fontSize + delta));
        editorStore.setFontSize(next);
        document.documentElement.style.setProperty("--editor-font-size", `${next}px`);
        scheduleSave();
      }

      // Escape: Exit reading mode
      if (e.key === "Escape" && readingMode) {
        store.setReadingMode(false);
      }
    };

    window.addEventListener("keydown", handler);

    // Capture-phase listener for Cmd+I (macOS WKWebView intercepts it)
    const captureHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        e.stopPropagation();
        const view = getActiveEditorView();
        if (view) toggleItalic(view);
      }
    };
    document.addEventListener("keydown", captureHandler, { capture: true });

    return () => {
      window.removeEventListener("keydown", handler);
      document.removeEventListener("keydown", captureHandler, { capture: true });
    };
  }, [handleOpenFile, handleSaveFile, activeTab?.editorMode, readingMode, activeTabId, scheduleSave]);

  // ── Drag-and-drop (Tauri v2 native event) ────────────────────

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | null = null;

    (async () => {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const path = event.payload.paths[0];
        if (!path) return;

        invoke<{ content: string; path: string; file_size: number }>("open_file_direct", { path })
          .then((result) => {
            const store = useStore.getState();
            store.openFile(result.path, result.content);
            store.addRecentFile(result.path, result.path.split("/").pop() || result.path);
            scheduleSave();
          })
          .catch((err: unknown) => log.error("App", "Failed to open dropped file", err));
      });
    })();

    return () => {
      unlisten?.();
    };
  }, [scheduleSave]);

  // ── Panel width persistence ──────────────────────────────────

  const sidebarLeftWidth = useEditorStore((s) => s.config.sidebarLeftWidth);
  const sidebarRightWidth = useEditorStore((s) => s.config.sidebarRightWidth);

  const handleLeftWidthChange = useCallback(
    (width: number) => {
      const w = Math.round(width);
      useEditorStore.getState().setConfig({ sidebarLeftWidth: w });
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleRightWidthChange = useCallback(
    (width: number) => {
      const w = Math.round(width);
      useEditorStore.getState().setConfig({ sidebarRightWidth: w });
      scheduleSave();
    },
    [scheduleSave],
  );

  // ── Split ratio persistence ──────────────────────────────────

  const horizontalSplitRatio = useStore((s) => s.horizontalSplitRatio);
  const verticalSplitRatio = useStore((s) => s.verticalSplitRatio);

  // Sync split ratios to editorStore.config for persistence (debounced)
  useEffect(() => {
    const es = useEditorStore.getState();
    es.setConfig({ horizontalSplitRatio, verticalSplitRatio });
    scheduleSave();
  }, [horizontalSplitRatio, verticalSplitRatio, scheduleSave]);

  // ── Render ───────────────────────────────────────────────────

  console.info("[JianXi] App render", { readingMode, activeTabId, hasTabs: Object.keys(tabs).length });

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {!readingMode && (
        <Toolbar
          isTauri={isTauri}
          title={activeTab?.title || ""}
          activeTabExists={!!activeTab}
          editorMode={activeTab?.editorMode || "preview"}
          theme={theme}
          onOpenFile={handleOpenFile}
          onSaveFile={handleSaveFile}
          onNewFile={handleNewFile}
          onToggleLeftSidebar={() => {
            useStore.getState().toggleLeftSidebar();
            scheduleSave();
          }}
          onToggleRightSidebar={() => {
            useStore.getState().toggleRightSidebar();
            scheduleSave();
          }}
          onSetMode={(mode) => useStore.getState().setEditorMode(mode)}
          onSetReadingMode={(on) => useStore.getState().setReadingMode(on)}
          onSetTheme={setTheme}
        />
      )}

      <Layout
        initialLeftWidth={sidebarLeftWidth ?? 280}
        initialRightWidth={sidebarRightWidth ?? 320}
        leftSidebar={
          <SidebarPanel
            side="left"
            tabs={[
              { key: "files", label: "文件", content: <FileTree /> },
              { key: "recent", label: "最近", content: <RecentFiles /> },
              { key: "outline", label: "目录", content: <Outline /> },
            ]}
            defaultTab="files"
          />
        }
        center={<ContentSplitView />}
        rightSidebar={
          <SidebarPanel
            side="right"
            tabs={[
              {
                key: "translate",
                label: "翻译",
                content: (
                  <div className="p-3 text-xs text-gray-400 dark:text-gray-500">
                    选中文本后翻译
                  </div>
                ),
              },
            ]}
            defaultTab="translate"
          />
        }
        onLeftWidthChange={handleLeftWidthChange}
        onRightWidthChange={handleRightWidthChange}
      />
    </div>
  );
}

export default App;
