import { useCallback, useRef } from "react";
import { useStore, isMediaKind } from "../../stores";
import { getPanelScrollEl } from "../../editors/editorRef";
import { saveAppConfig } from "../../hooks/useConfig";
import TabBar from "../TabBar";
import ContentArea from "./ContentArea";
import MediaPlayerHost from "./MediaPlayerHost";
import SplitResizeHandle from "./SplitResizeHandle";
import ErrorBoundary from "../ErrorBoundary";
import type { EditorMode, Tab } from "../../types";

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
      className={`px-1.5 py-0.5 rounded text-xs ${
        active
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium"
          : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
      }`}
    >
      {label}
    </button>
  );
}

export default function ContentSplitView() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const splitDirection = useStore((s) => s.splitDirection);
  const splitTabIds = useStore((s) => s.splitTabIds);
  const splitActiveTabId = useStore((s) => s.splitActiveTabId);
  const splitEditorMode = useStore((s) => s.splitEditorMode);
  const horizontalSplitRatio = useStore((s) => s.horizontalSplitRatio);
  const verticalSplitRatio = useStore((s) => s.verticalSplitRatio);

  const splitContainerRef = useRef<HTMLDivElement>(null);

  const activeTab = activeTabId ? tabs[activeTabId] : null;
  const tabIds = Object.keys(tabs);

  // Main panel tabs = all tabs NOT in split panel
  const mainTabIds = splitDirection
    ? tabIds.filter((id) => !splitTabIds.includes(id))
    : tabIds;
  const mainTabs: Record<string, Tab> = {};
  for (const id of mainTabIds) mainTabs[id] = tabs[id];

  // Split panel tabs
  const splitTabs: Record<string, Tab> = {};
  for (const id of splitTabIds) {
    if (tabs[id]) splitTabs[id] = tabs[id];
  }
  const splitTab = splitActiveTabId ? tabs[splitActiveTabId] : null;

  const captureScrollNow = useCallback((panelId: string) => {
    const store = useStore.getState();
    const tabId =
      panelId === "split" ? store.splitActiveTabId : store.activeTabId;
    if (!tabId) return;
    const el = getPanelScrollEl(panelId);
    if (!el) return;
    store.updateScrollPos(tabId, el.scrollTop, el.scrollHeight);
    void saveAppConfig();
  }, []);

  const handleMainSwitch = useCallback(
    (id: string) => {
      captureScrollNow("main");
      useStore.getState().switchTab(id);
    },
    [captureScrollNow],
  );

  const handleMainClose = useCallback(
    (id: string) => {
      captureScrollNow("main");
      useStore.getState().closeTab(id);
    },
    [captureScrollNow],
  );

  const handleSplitSwitch = useCallback(
    (id: string) => {
      captureScrollNow("split");
      useStore.getState().setSplitActiveTab(id);
    },
    [captureScrollNow],
  );

  const handleSplitClose = useCallback(
    (id: string) => {
      captureScrollNow("split");
      const store = useStore.getState();
      store.closeTab(id);
      // If that was the last split tab, unsplit
      const remaining = store.splitTabIds.filter(
        (tid) => tid !== id && store.tabs[tid],
      );
      if (remaining.length === 0) {
        store.unsplit();
      }
    },
    [captureScrollNow],
  );

  const isHorizontal = splitDirection === "horizontal";
  const currentRatio = isHorizontal ? horizontalSplitRatio : verticalSplitRatio;

  const handleSplitRatioChange = useCallback(
    (ratio: number) => {
      if (splitDirection) {
        useStore.getState().setSplitRatio(splitDirection, ratio);
      }
    },
    [splitDirection],
  );

  const handleSplitRatioReset = useCallback(() => {
    if (splitDirection) {
      useStore.getState().setSplitRatio(splitDirection, 0.5);
    }
  }, [splitDirection]);

  // ── Single panel (no split) ──
  if (!splitDirection || splitTabIds.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitchTab={handleMainSwitch}
          onCloseTab={handleMainClose}
        />
        <div className="relative flex-1 overflow-hidden">
          <ContentArea panelId="main" />
          <MediaPlayerHost />
        </div>
      </div>
    );
  }

  // ── Split mode ──
  return (
    <div
      ref={splitContainerRef}
      className={`relative h-full flex ${isHorizontal ? "" : "flex-col"} overflow-hidden`}
    >
      {/* Panel A — tabs NOT in split */}
      <div
        className="flex flex-col overflow-hidden min-w-0"
        style={{ flex: `${currentRatio} 1 0%` }}
      >
        <div className="app-chrome flex items-center shrink-0 border-b border-gray-100 dark:border-gray-700">
          <TabBar
            tabs={mainTabs}
            activeTabId={activeTabId}
            onSwitchTab={handleMainSwitch}
            onCloseTab={handleMainClose}
          />
          <ModeButtons
            editorMode={activeTab?.editorMode || "preview"}
            isMedia={activeTab ? isMediaKind(activeTab.fileKind) : false}
            onChange={(m) => useStore.getState().setEditorMode(m)}
          />
        </div>
        <ErrorBoundary panelId="main">
          <div className="relative flex-1 overflow-hidden">
            <ContentArea
              panelId="main"
              tabOverride={activeTab}
              modeOverride={activeTab?.editorMode}
            />
          </div>
        </ErrorBoundary>
      </div>

      {/* Split resize handle */}
      <SplitResizeHandle
        direction={splitDirection}
        onRatioChange={handleSplitRatioChange}
        onReset={handleSplitRatioReset}
        containerRef={splitContainerRef}
      />

      {/* Panel B — tabs IN split */}
      <div
        className="flex flex-col overflow-hidden min-w-0"
        style={{ flex: `${1 - currentRatio} 1 0%` }}
      >
        <div className="app-chrome flex items-center shrink-0 border-b border-gray-100 dark:border-gray-700">
          <TabBar
            tabs={splitTabs}
            activeTabId={splitActiveTabId}
            onSwitchTab={handleSplitSwitch}
            onCloseTab={handleSplitClose}
          />
          <ModeButtons
            editorMode={splitEditorMode}
            isMedia={splitTab ? isMediaKind(splitTab.fileKind) : false}
            onChange={(m) => useStore.getState().setSplitEditorMode(m)}
          />
        </div>
        <ErrorBoundary panelId="split">
          <ContentArea
            panelId="split"
            tabOverride={splitTab}
            modeOverride={splitEditorMode}
          />
        </ErrorBoundary>
      </div>
      <MediaPlayerHost />
    </div>
  );
}

function ModeButtons({
  editorMode,
  isMedia = false,
  onChange,
}: {
  editorMode: EditorMode;
  isMedia?: boolean;
  onChange: (m: EditorMode) => void;
}) {
  if (isMedia) return null;
  return (
    <div className="flex gap-0.5 px-2 shrink-0">
      <ModeButton
        label="预览"
        active={editorMode === "preview"}
        onClick={() => onChange("preview")}
      />
      <ModeButton
        label="编辑"
        active={editorMode === "edit"}
        onClick={() => onChange("edit")}
      />
      <ModeButton
        label="源码"
        active={editorMode === "source"}
        onClick={() => onChange("source")}
      />
    </div>
  );
}
