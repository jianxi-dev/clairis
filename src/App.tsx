import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "./stores/index";
import ContentArea from "./components/Content/ContentArea";
import { getActiveEditorView } from "./editors/editorRef";
import { toggleBold, toggleItalic } from "./editors/keybindings";

// Detect Tauri environment
const isTauri =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== undefined;

function App() {
  const activeTabId = useStore((s) => s.activeTabId);
  const tabs = useStore((s) => s.tabs);
  const activeTab = activeTabId ? tabs[activeTabId] : null;

  // ── File operations ──────────────────────────────────────────

  const handleOpenFile = useCallback(async () => {
    if (!isTauri) return;
    try {
      const result = await invoke<{ content: string; path: string; file_size: number }>("open_file");
      useStore.getState().openFile(result.path, result.content);
    } catch (e) {
      if (String(e) !== "Operation cancelled") {
        console.error("Failed to open file:", e);
      }
    }
  }, []);

  const handleSaveFile = useCallback(async () => {
    if (!isTauri || !activeTab) return;
    if (!activeTab.path) return; // Can't save without a path
    try {
      await invoke("save_file", { path: activeTab.path, content: activeTab.content });
      useStore.getState().markClean();
    } catch (e) {
      console.error("Failed to save file:", e);
    }
  }, [activeTab?.path, activeTab?.content]);

  // ── Auto-save (2s debounce after last change) ────────────────

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeTab?.dirty || !activeTab?.path) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      if (!isTauri || !activeTab?.path) return;
      invoke("save_file", { path: activeTab.path, content: activeTab.content })
        .then(() => {
          useStore.getState().markClean();
        })
        .catch((e: unknown) => {
          console.error("Auto-save failed:", e);
        });
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [activeTab?.dirty, activeTab?.content, activeTab?.path]);

  // ── Reading mode state ───────────────────────────────────────

  const readingMode = useStore((s) => s.readingMode);

  // ── Keyboard shortcuts ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+O: Open file
      if (meta && e.key === "o") {
        e.preventDefault();
        handleOpenFile();
      }

      // Cmd+S: Save (manual trigger, auto-save also runs)
      if (meta && e.key === "s") {
        e.preventDefault();
        handleSaveFile();
      }

      // Cmd+Shift+M: Toggle editor mode (preview ↔ edit ↔ source)
      if (meta && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        const current = activeTab?.editorMode || "preview";
        const next = current === "preview" ? "edit" : current === "edit" ? "source" : "preview";
        useStore.getState().setEditorMode(next);
      }

      // Cmd+B: Bold / Cmd+I: Italic
      if (meta && (e.key === "b" || e.key === "i")) {
        e.preventDefault();
        // macOS WKWebView may intercept Cmd+I before CM6 gets the event.
        // Dispatch directly to the editor view as a fallback.
        const view = getActiveEditorView();
        if (view && activeTab?.editorMode !== "preview") {
          if (e.key === "b") toggleBold(view);
          else toggleItalic(view);
        }
      }

      // Escape: Exit reading mode
      if (e.key === "Escape" && readingMode) {
        useStore.getState().setReadingMode(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpenFile, handleSaveFile, activeTab?.editorMode, readingMode]);

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
            useStore.getState().openFile(result.path, result.content);
          })
          .catch((err: unknown) => {
            console.error("Failed to open dropped file:", err);
          });
      });
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-gray-900">
      {/* Header — hidden in reading mode */}
      {!readingMode && (
        <header className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50 text-sm select-none">
          {isTauri && (
            <>
              <button
                onClick={handleOpenFile}
                className="px-2 py-0.5 rounded hover:bg-gray-200 text-xs"
              >
                打开
              </button>
              <button
                onClick={handleSaveFile}
                className="px-2 py-0.5 rounded hover:bg-gray-200 text-xs"
              >
                保存
              </button>
            </>
          )}
          <span className="text-gray-500 text-xs flex-1 truncate">
            {activeTab?.title || (isTauri ? "Cmd+O 打开文件" : "Web 模式 — 仅展示 UI")}
          </span>

          {/* Mode buttons */}
          {activeTab && (
            <div className="flex gap-1 items-center">
              <ModeButton
                label="预览"
                active={activeTab.editorMode === "preview"}
                onClick={() => useStore.getState().setEditorMode("preview")}
              />
              <ModeButton
                label="编辑"
                active={activeTab.editorMode === "edit"}
                onClick={() => useStore.getState().setEditorMode("edit")}
              />
              <ModeButton
                label="源码"
                active={activeTab.editorMode === "source"}
                onClick={() => useStore.getState().setEditorMode("source")}
              />
              <div className="w-px h-4 bg-gray-300 mx-1" />
              <button
                onClick={() => useStore.getState().setReadingMode(true)}
                className="px-2 py-0.5 rounded hover:bg-gray-200 text-xs"
                title="进入阅读模式 (沉浸全屏)"
              >
                阅读
              </button>
            </div>
          )}
        </header>
      )}

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1">
          <ContentArea />
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs ${
        active ? "bg-blue-100 text-blue-700 font-medium" : "hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

export default App;
