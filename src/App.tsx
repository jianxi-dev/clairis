import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "./stores/index";
import { isMediaKind } from "./stores/index";
import { useEditorStore } from "./stores/editorStore";
import { useCaptureOverlayStore } from "./stores/captureOverlay";
import Toolbar from "./components/Toolbar";
import ImmersivePeekBar from "./components/ImmersivePeekBar";
import TemplatePicker from "./components/TemplatePicker";
import SettingsView from "./components/SettingsView";
import PaneTreeView from "./components/Content/PaneTreeView";
import ReadingRail from "./components/Rail/ReadingRail";
import FloatingPreview from "./components/Preview/FloatingPreview";
import PortalView from "./components/PortalView";
import GridView from "./components/GridView";
import ShortcutOverlay from "./components/ShortcutOverlay";
import QuickOpen from "./components/QuickOpen";
import CaptureOverlay from "./components/CaptureOverlay";
import CommandOverlay from "./components/ai/CommandOverlay";
import UndoBar from "./components/ai/UndoBar";
import SnapshotPanel from "./components/ai/SnapshotPanel";
import SelectionPill from "./components/ai/SelectionPill";
import AiBubble from "./components/ai/AiBubble";
import { useAiEntryStore } from "./hooks/useAiEntry";
import { getActiveEditorView, getPanelScrollEl } from "./editors/editorRef";
import { toggleBold, toggleItalic } from "./editors/keybindings";
import { saveAppConfig, useConfig } from "./hooks/useConfig";
import { nextRailState, RAIL_KIND_ORDER } from "./lib/railView";
import type { FileTypeKind } from "./lib/fileType";
import { log } from "./utils/log";
import { loadExtensionBundle } from "./lib/extensions/bundle";
import type { ExtensionBundle } from "./lib/extensions/bundle";
import {
  applyTemplatePlaceholders,
  todayStamp,
} from "./lib/extensions/templates";
import type { Template } from "./lib/extensions/templates";
import { applyThemeTokens } from "./lib/extensions/theme-tokens";
import type { Scene } from "./types";

const isTauri =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !==
    undefined;

/** 输入态（INPUT/TEXTAREA/SELECT/contenteditable）：此时不触发全局单键快捷键。 */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

/** ⌥1–8 → 八类；⌥0 → null（全部）；非数字键 → undefined。 */
function kindFromDigitCode(code: string): FileTypeKind | null | undefined {
  const m = /^Digit([0-8])$/.exec(code);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n === 0 ? null : RAIL_KIND_ORDER[n - 1];
}

function App() {
  const activeTabId = useStore((s) => s.activeTabId);
  const tabs = useStore((s) => s.tabs);
  const activeTab = activeTabId ? tabs[activeTabId] : null;
  const readingMode = useStore((s) => s.readingMode);
  const immersiveChromeVisible = useStore((s) => s.immersiveChromeVisible);
  const tabDragActive = useStore((s) => s.tabDragActive);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekInsideRef = useRef(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const settingsReturnRef = useRef<Scene>("workspace");

  // 拖拽结束后若指针已在热区外，补上被抑制的 2s 收起。
  useEffect(() => {
    if (tabDragActive || peekInsideRef.current) return;
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      useStore.getState().setImmersiveChromeVisible(false);
    }, 2000);
  }, [tabDragActive]);

  // Init config loading + theme on mount
  const { setTheme, scheduleSave } = useConfig();
  const theme = useEditorStore((s) => s.config.theme ?? "system");
  const scene = useStore((s) => s.scene);

  const openSettings = useCallback(() => {
    const st = useStore.getState();
    if (st.scene !== "settings") {
      settingsReturnRef.current = st.scene;
    }
    st.setScene("settings");
  }, []);

  const closeSettings = useCallback(() => {
    const target = settingsReturnRef.current ?? "workspace";
    settingsReturnRef.current = "workspace";
    useStore.getState().setScene(target);
  }, []);

  // ── File operations ──────────────────────────────────────────

  const handleOpenFile = useCallback(async () => {
    if (!isTauri) return;
    try {
      const result = await invoke<{
        content: string;
        path: string;
        file_size: number;
      }>("open_file");
      const store = useStore.getState();
      store.openFile(result.path, result.content);
      scheduleSave();
    } catch (e) {
      if (String(e) !== "Operation cancelled") {
        log.error("App", "Failed to open file", e);
      }
    }
  }, [scheduleSave]);

  /** 按路径打开（门户 hero / 最近卡 / 网格条目用；表格里没有页签时走这条） */
  const handleOpenPath = useCallback(
    async (path: string) => {
      try {
        const result = await invoke<{
          content: string;
          path: string;
          file_size: number;
        }>("open_file_direct", { path });
        const store = useStore.getState();
        store.openFile(result.path, result.content);
        scheduleSave();
      } catch (e) {
        log.error("App", "Failed to open recent file", e);
      }
    },
    [scheduleSave],
  );

  const handleSaveFile = useCallback(async () => {
    if (!isTauri || !activeTab?.path) return;
    if (isMediaKind(activeTab.fileKind)) return;
    try {
      await invoke("save_file", {
        path: activeTab.path,
        content: activeTab.content,
      });
      useStore.getState().markClean();
    } catch (e) {
      log.error("App", "Failed to save file", e);
    }
  }, [activeTab?.path, activeTab?.content, activeTab?.fileKind]);

  const handleNewFile = useCallback(() => {
    if (templates.length > 0) {
      setPickerOpen(true);
      return;
    }
    useStore.getState().newTab();
  }, [templates]);

  // 启动时读一次扩展 bundle：模板供新建页选择，theme token 覆盖内置变量。
  // 加载失败静默（空 bundle → 无模板选择器、无 token 覆盖）。
  useEffect(() => {
    void loadExtensionBundle(invoke).then((bundle: ExtensionBundle) => {
      setTemplates(bundle.templates);
      applyThemeTokens(bundle.themeTokens);
    });
  }, []);

  // 原生顶栏跟随主题：system 传 null 交回系统（Tauri 语义），非 Tauri 环境跳过。
  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        if (cancelled) return;
        const native = theme === "dark" ? "dark" : "light";
        return getCurrentWindow()
          .setTheme(theme === "system" ? null : native)
          .catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [theme]);

  // 原生菜单「设置…」与 Cmd+, 走同一入口；无常驻按钮。
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    listen("open-settings", () => openSettings())
      .then((un) => {
        unlisten = un;
      })
      .catch((e) => log.warn("App", "Settings listener unavailable", e));
    return () => unlisten?.();
  }, [openSettings]);

  const handleTemplateSelect = useCallback((template: Template) => {
    useStore.getState().newTabWith(
      template.name,
      applyTemplatePlaceholders(template.body, {
        title: template.name,
        date: todayStamp(),
      }),
    );
    setPickerOpen(false);
  }, []);

  const handleBlankSelect = useCallback(() => {
    useStore.getState().newTab();
    setPickerOpen(false);
  }, []);

  // ── Capture Overlay — Cmd+Shift+. global shortcut ─────────────────

  useEffect(() => {
    const captureOverlayStore = useCaptureOverlayStore.getState();

    (window as unknown as Record<string, unknown>).__biaoyue_toggle_capture__ =
      () => {
        captureOverlayStore.toggle();
      };

    const capturePeriodHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ".") {
        e.preventDefault();
        e.stopPropagation();
        captureOverlayStore.toggle();
      }
    };

    document.addEventListener("keydown", capturePeriodHandler, {
      capture: true,
    });

    return () => {
      document.removeEventListener("keydown", capturePeriodHandler, {
        capture: true,
      });
      delete (window as unknown as Record<string, unknown>)
        .__biaoyue_toggle_capture__;
    };
  }, []);

  // ── Auto-save (2s debounce) ──────────────────────────────────

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeTab?.dirty || !activeTab?.path) return;
    if (isMediaKind(activeTab.fileKind)) return;
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
  }, [
    activeTab?.dirty,
    activeTab?.content,
    activeTab?.path,
    activeTab?.fileKind,
  ]);

  // ── Keyboard shortcuts ───────────────────────────────────────

  // 缩放统一入口：Cmd/Ctrl+=/-/0 由键盘（Ctrl）或原生菜单（Cmd，macOS 菜单拦截）驱动，
  // 分流到字号（markdown/文本/编辑态）或预览帧缩放（图片/HTML/PDF）。
  const handleScaleDelta = useCallback(
    (delta: number) => {
      const tab = useStore.getState().activeTabId
        ? useStore.getState().tabs[useStore.getState().activeTabId!]
        : null;

      // PDF 缩放由查看器自带控件/缩放菜单处理（T5 实测可用）；App 层不干预，
      // 避免 preview-scale 事件无人消费、或误落字号分支改动全局字号。
      if (tab?.fileKind === "pdf") return;

      const viewportPreview =
        tab?.editorMode === "preview" &&
        (tab.fileKind === "image" || tab.fileKind === "html");
      if (viewportPreview) {
        window.dispatchEvent(
          new CustomEvent("preview-scale", { detail: delta }),
        );
        return;
      }
      const editorStore = useEditorStore.getState();
      // 编辑态与阅读态共用一个字号：readerFontSize 驱动 --type-font-size，
      // 编辑器的纸面排版也读它，Cmd+/- 因此不会在编辑态失效。
      const applied =
        delta === 0
          ? 17
          : Math.max(12, Math.min(32, editorStore.fontSize + delta));
      editorStore.setFontSize(applied);
      editorStore.setConfig({ readerFontSize: applied });
      document.documentElement.style.setProperty(
        "--editor-font-size",
        `${applied}px`,
      );
      scheduleSave();
    },
    [scheduleSave],
  );

  // 打开网格概览：清空筛选与选中后切场景。键盘 ⌘⇧\ 与顶栏入口共用同一动作。
  const openGridOverview = useCallback(() => {
    const store = useStore.getState();
    store.setGridTypeFilter(null);
    store.setGridSelectedPath(null);
    store.setScene("grid");
  }, []);

  // 快速打开回调保持引用稳定，避免 QuickOpen 的键盘 effect 每帧重订阅。
  const handleQuickOpenClose = useCallback(() => setQuickOpenOpen(false), []);
  const handleQuickOpenTab = useCallback((tabId: string) => {
    useStore.getState().switchTab(tabId);
    useStore.getState().setScene("workspace");
    setQuickOpenOpen(false);
  }, []);
  const handleQuickOpenPath = useCallback(
    (path: string) => {
      setQuickOpenOpen(false);
      void handleOpenPath(path);
    },
    [handleOpenPath],
  );
  const handleQuickOpenGrid = useCallback(() => {
    setQuickOpenOpen(false);
    openGridOverview();
  }, [openGridOverview]);
  const handleQuickOpenSettings = useCallback(() => {
    setQuickOpenOpen(false);
    openSettings();
  }, [openSettings]);

  // macOS 原生菜单（Cmd+=/-/0）拦截键盘，由 Rust 侧菜单项转发为 preview-scale 事件
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    listen<number>("preview-scale", (e) => handleScaleDelta(e.payload))
      .then((un) => {
        unlisten = un;
      })
      .catch(() => {});
    return () => {
      unlisten?.();
    };
  }, [handleScaleDelta]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const store = useStore.getState();

      // Cmd/Ctrl+P：阻止浏览器原生打印，改为打开快速打开（页签/最近文件/命令）。
      // 已打开时再按一次关闭；输入法组合态（e.isComposing）不拦截，避免打断上屏。
      if (
        meta &&
        !e.shiftKey &&
        e.key.toLowerCase() === "p" &&
        !e.isComposing
      ) {
        e.preventDefault();
        setQuickOpenQuery("");
        setQuickOpenOpen((v) => !v);
        return;
      }

      // 快速打开打开时，其余全局快捷键让位（Esc/↑↓/Enter 由 QuickOpen 自行拦截）。
      if (quickOpenOpen) return;

      const questionKey = e.key === "?" || (e.key === "/" && e.shiftKey);
      if (questionKey && !meta && !e.altKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      if (e.altKey && !meta && !e.shiftKey) {
        if (isEditableTarget(e.target)) return;
        const kind = kindFromDigitCode(e.code);
        if (kind !== undefined) {
          e.preventDefault();
          if (store.scene === "grid") {
            store.setGridTypeFilter(kind);
          } else if (store.scene === "workspace") {
            store.setRailChip(kind ?? "all");
            store.setRailSection("category");
            if (store.railState === "collapsed") store.setRailState("hover");
          }
          return;
        }
      }

      // Cmd+Shift+\ : 打开网格概览（任意场景可用，门户里也能直接进）
      if (meta && e.shiftKey && (e.key === "\\" || e.key === "|")) {
        e.preventDefault();
        openGridOverview();
        return;
      }

      // 门户/网格是覆盖层：底下的编辑器不可见，快捷键作用上去用户看不见后果
      // （⌘W 关掉隐藏页签、⌘B 改隐藏文档……）。这里只放行不触碰隐藏状态的键。
      if (store.scene !== "workspace") {
        if (!meta) return;
        const k = e.key.toLowerCase();
        if (!["o", "n", ",", "p", "k", "a"].includes(k)) return;
      }

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
        handleNewFile();
      }

      // Cmd+T: New tab in the focused pane
      if (meta && !e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        store.newTab();
      }

      // Cmd+W: Close active tab
      if (meta && e.key === "w" && activeTabId) {
        e.preventDefault();
        store.closeTab(activeTabId);
      }

      // Cmd+\ : 阅读空间栏（layout-portal 6.1）与沉浸阅读（A-5）共用此键。
      // 栏已展开（钉住/悬停）时收/钉栏；折叠态时不抢键，仍是沉浸阅读切换。
      if (meta && e.key === "\\") {
        e.preventDefault();
        if (store.railState === "pinned" || store.railState === "hover") {
          store.setRailState(
            nextRailState(store.railState, { type: "toggle-key" }),
          );
        } else {
          store.setReadingMode(!store.readingMode);
        }
      }

      // Cmd+Shift+T : Toggle chrome visibility inside immersive mode — A-5
      // 沉浸态保留旧语义；非沉浸态让位给 AI 翻译（layout-portal 15.1 裁定）。
      if (
        meta &&
        e.shiftKey &&
        e.key.toLowerCase() === "t" &&
        store.readingMode
      ) {
        e.preventDefault();
        store.setImmersiveChromeVisible(!store.immersiveChromeVisible);
      }

      if (
        meta &&
        e.shiftKey &&
        e.key.toLowerCase() === "t" &&
        !store.readingMode
      ) {
        e.preventDefault();
        store.setScene("workspace");
        const ai = useAiEntryStore.getState();
        ai.setInput("翻译选中的内容");
        ai.openOverlay();
      }

      // Cmd+Shift+E: 生成学习页（layout-portal 15.1）
      if (meta && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        store.setScene("workspace");
        const ai = useAiEntryStore.getState();
        ai.setInput("把这篇文档整理成一份学习页：要点、例子、自测题。");
        ai.openOverlay();
      }

      // Cmd+Shift+S: collapse panes back to a single root leaf
      if (meta && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        store.collapsePanes();
      }

      // Cmd+Shift+H: split the focused pane right
      if (meta && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        store.splitPane("row");
      }

      // Cmd+Shift+V: 悬浮预览总开关（layout-portal 8.1）。
      // 旧「向下分屏」的 ⌘⇧V 已移除——它与 ⌘⌥↓ 语义重复，让位给预览开关。
      if (meta && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        store.togglePreviewEnabled();
      }

      // Cmd+Shift+F: 沉浸阅读开关（layout-portal 15.1）
      if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        store.setReadingMode(!store.readingMode);
      }

      // Cmd+Shift+P: 收藏当前文件（layout-portal 15.1）
      if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        const tab = store.activeTabId ? store.tabs[store.activeTabId] : null;
        if (tab?.path) store.togglePinnedPath(tab.path);
      }

      // Cmd+Alt+Right / Cmd+Alt+Down: split the focused pane (layout-portal 3.1)
      if (meta && e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        store.splitPane("row");
      }
      if (meta && e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        store.splitPane("col");
      }

      // Cmd+Shift+Enter: fullscreen the focused pane
      if (meta && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        store.toggleFullscreenPane();
      }

      // Cmd+Shift+M: Toggle editor mode
      if (meta && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        const current = activeTab?.editorMode || "preview";
        const next =
          current === "preview"
            ? "edit"
            : current === "edit"
              ? "source"
              : "preview";
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

      // Cmd/Ctrl+= / - / 0：markdown/文本/编辑态走字号，图片/HTML/PDF 预览走帧缩放
      if (meta && (e.key === "=" || e.key === "-" || e.key === "0")) {
        e.preventDefault();
        const delta = e.key === "0" ? 0 : e.key === "=" ? 1 : -1;
        handleScaleDelta(delta);
      }

      // Cmd+,: 打开设置场景
      if (meta && e.key === ",") {
        e.preventDefault();
        openSettings();
        return;
      }

      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useAiEntryStore.getState().toggleOverlay();
      }

      // Cmd+Shift+A: 切换 AI 小窗 ⇄ 停靠窗格
      if (meta && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        useAiEntryStore.getState().toggleForm();
      }

      // Escape: 待确认改动 → 取消；否则按形态关闭 AI；再否则退回全屏/阅读态
      if (e.key === "Escape") {
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          return;
        }
        const ai = useAiEntryStore.getState();
        if (ai.pendingConfirm) {
          ai.cancelPendingSubmit();
        } else if (ai.form === "docked") {
          ai.undock();
          ai.closeBubble();
        } else if (ai.bubbleOpen) {
          ai.closeBubble();
        } else if (store.fullscreenPaneId) {
          store.toggleFullscreenPane();
        } else if (readingMode) {
          store.setReadingMode(false);
        }
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
      document.removeEventListener("keydown", captureHandler, {
        capture: true,
      });
    };
  }, [
    handleOpenFile,
    handleSaveFile,
    handleNewFile,
    activeTab?.editorMode,
    readingMode,
    activeTabId,
    handleScaleDelta,
    openGridOverview,
    openSettings,
    shortcutsOpen,
    quickOpenOpen,
  ]);

  // ── Drag-and-drop (Tauri v2 native event) ────────────────────

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | null = null;

    (async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
          if (useStore.getState().scene === "settings") return;
          if (event.payload.type !== "drop") return;
          const path = event.payload.paths[0];
          if (!path) return;

          invoke<{ content: string; path: string; file_size: number }>(
            "open_file_direct",
            { path },
          )
            .then((result) => {
              const store = useStore.getState();
              store.openFile(result.path, result.content);
              scheduleSave();
            })
            .catch((err: unknown) =>
              log.error("App", "Failed to open dropped file", err),
            );
        });
      } catch (e) {
        log.warn("App", "Drag-drop listener unavailable", e);
      }
    })();

    return () => {
      unlisten?.();
    };
  }, [scheduleSave]);

  // ── Split ratio persistence ──────────────────────────────────

  const horizontalSplitRatio = useStore((s) => s.horizontalSplitRatio);
  const verticalSplitRatio = useStore((s) => s.verticalSplitRatio);

  // Sync split ratios to editorStore.config for persistence (debounced)
  useEffect(() => {
    const es = useEditorStore.getState();
    es.setConfig({ horizontalSplitRatio, verticalSplitRatio });
    scheduleSave();
  }, [horizontalSplitRatio, verticalSplitRatio, scheduleSave]);

  // Persist pane layout whenever the tree or focus changes (debounced)
  const paneRoot = useStore((s) => s.paneRoot);
  const focusedPaneId = useStore((s) => s.focusedPaneId);
  useEffect(() => {
    scheduleSave();
  }, [paneRoot, focusedPaneId, scheduleSave]);

  // Persist scroll positions after each update (A-9; switch/close flushes via saveAppConfig)
  const scrollPositions = useStore((s) => s.scrollPositions);
  useEffect(() => {
    scheduleSave();
  }, [scrollPositions, scheduleSave]);

  // ── Window close: capture scroll positions and flush config before close (A-9) ──

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        unlisten = await win.onCloseRequested(async (event) => {
          event.preventDefault();
          const store = useStore.getState();
          const capture = (panelId: string, tabId: string | null) => {
            if (!tabId) return;
            const el = getPanelScrollEl(panelId);
            if (!el) return;
            store.updateScrollPos(tabId, el.scrollTop, el.scrollHeight);
          };
          capture("main", store.activeTabId);
          capture("split", store.splitActiveTabId);
          await saveAppConfig();
          await win.destroy();
        });
      } catch (e) {
        log.warn("App", "Window close listener unavailable", e);
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────

  const rootClass = [
    "h-screen w-screen flex flex-col bg-[var(--app-bg)] text-[var(--app-text)]",
    readingMode ? "immersive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <Toolbar
        theme={theme}
        readingMode={readingMode}
        onSetReadingMode={(on) => useStore.getState().setReadingMode(on)}
        onSetTheme={setTheme}
        onOpenGrid={openGridOverview}
      />

      <div className="relative flex-1 flex min-w-0 overflow-hidden">
        <ReadingRail onOpenPath={handleOpenPath} />
        <div
          className="flex-1 min-w-0 flex overflow-hidden"
          data-testid="workspace-body"
        >
          <PaneTreeView />
        </div>
      </div>
      <CaptureOverlay />
      <SelectionPill />
      <CommandOverlay />
      <UndoBar />
      <SnapshotPanel />
      <AiBubble />
      <FloatingPreview onOpenPath={handleOpenPath} />
      {scene === "portal" && (
        <div className="fixed inset-0 z-40 bg-[var(--app-surface)]">
          <PortalView
            onOpenFile={handleOpenFile}
            onNewFile={handleNewFile}
            onOpenPath={handleOpenPath}
            onAiCommand={() => {
              useStore.getState().setScene("workspace");
              useAiEntryStore.getState().openOverlay();
            }}
            onStudyPage={() => {
              useStore.getState().setScene("workspace");
              useAiEntryStore
                .getState()
                .setInput("把这篇文档整理成一份学习页：要点、例子、自测题。");
              useAiEntryStore.getState().openOverlay();
            }}
          />
        </div>
      )}
      {scene === "grid" && (
        <div className="fixed inset-0 z-40 bg-[var(--app-surface)]">
          <GridView onOpenPath={handleOpenPath} />
        </div>
      )}
      {scene === "settings" && (
        <div className="fixed inset-0 z-50">
          <SettingsView onClose={closeSettings} />
        </div>
      )}
      {pickerOpen && templates.length > 0 && (
        <TemplatePicker
          templates={templates}
          onSelect={handleTemplateSelect}
          onBlank={handleBlankSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
      <ShortcutOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <QuickOpen
        open={quickOpenOpen}
        query={quickOpenQuery}
        onQueryChange={setQuickOpenQuery}
        onClose={handleQuickOpenClose}
        onOpenTab={handleQuickOpenTab}
        onOpenPath={handleQuickOpenPath}
        onOpenGrid={handleQuickOpenGrid}
        onOpenSettings={handleQuickOpenSettings}
      />
      {readingMode && (
        <div
          className="immersive-peek-zone"
          data-testid="immersive-peek-zone"
          onMouseEnter={() => {
            peekInsideRef.current = true;
            if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
            peekTimerRef.current = setTimeout(() => {
              useStore.getState().setImmersiveChromeVisible(true);
            }, 400);
          }}
          onMouseLeave={() => {
            peekInsideRef.current = false;
            if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
            // 拖拽页签期间不收起：浮层卸载会中断进行中的拖拽。
            if (useStore.getState().tabDragActive) return;
            peekTimerRef.current = setTimeout(() => {
              useStore.getState().setImmersiveChromeVisible(false);
            }, 2000);
          }}
        >
          <div className="immersive-peek-trigger" />
          {immersiveChromeVisible && <ImmersivePeekBar />}
        </div>
      )}
    </div>
  );
}

export default App;
