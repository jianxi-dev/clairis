import { useCallback, useRef, useEffect } from "react";
import { useStore } from "../../stores";
import TabBar from "../TabBar";
import ContentArea from "./ContentArea";
import SplitResizeHandle from "./SplitResizeHandle";
import ErrorBoundary from "../ErrorBoundary";
import type { EditorMode, Tab } from "../../types";

function ModeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

  const handleMainSwitch = useCallback((id: string) => {
    useStore.getState().switchTab(id);
  }, []);

  const handleMainClose = useCallback((id: string) => {
    useStore.getState().closeTab(id);
  }, []);

  const handleSplitSwitch = useCallback((id: string) => {
    useStore.getState().setSplitActiveTab(id);
  }, []);

  const handleSplitClose = useCallback((id: string) => {
    const store = useStore.getState();
    store.closeTab(id);
    // If that was the last split tab, unsplit
    const remaining = store.splitTabIds.filter((tid) => tid !== id && store.tabs[tid]);
    if (remaining.length === 0) {
      store.unsplit();
    }
  }, []);

  // ── Single panel (no split) ──
  if (!splitDirection || splitTabIds.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <TabBar tabs={tabs} activeTabId={activeTabId} onSwitchTab={handleMainSwitch} onCloseTab={handleMainClose} />
        <ContentArea panelId="main" />
      </div>
    );
  }

  // ── Split mode ──
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

  return (
    <div
      ref={splitContainerRef}
      className={`h-full flex ${isHorizontal ? "" : "flex-col"} overflow-hidden`}
    >
      {/* Panel A — tabs NOT in split */}
      <div
        className="flex flex-col overflow-hidden min-w-0"
        style={{ flex: `${currentRatio} 1 0%` }}
      >
        <div className="flex items-center shrink-0 border-b border-gray-100 dark:border-gray-700">
          <TabBar
            tabs={mainTabs}
            activeTabId={activeTabId}
            onSwitchTab={handleMainSwitch}
            onCloseTab={handleMainClose}
          />
          <ModeButtons editorMode={activeTab?.editorMode || "preview"} onChange={(m) => useStore.getState().setEditorMode(m)} />
        </div>
        <ErrorBoundary panelId="main">
          <ContentArea
            panelId="main"
            tabOverride={activeTab}
            modeOverride={activeTab?.editorMode}
          />
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
        <div className="flex items-center shrink-0 border-b border-gray-100 dark:border-gray-700">
          <TabBar
            tabs={splitTabs}
            activeTabId={splitActiveTabId}
            onSwitchTab={handleSplitSwitch}
            onCloseTab={handleSplitClose}
          />
          <ModeButtons editorMode={splitEditorMode} onChange={(m) => useStore.getState().setSplitEditorMode(m)} />
        </div>
        <ErrorBoundary panelId="split">
          <ContentArea
            panelId="split"
            tabOverride={splitTab}
            modeOverride={splitEditorMode}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

function ModeButtons({ editorMode, onChange }: { editorMode: EditorMode; onChange: (m: EditorMode) => void }) {
  return (
    <div className="flex gap-0.5 px-2 shrink-0">
      <ModeButton label="预览" active={editorMode === "preview"} onClick={() => onChange("preview")} />
      <ModeButton label="编辑" active={editorMode === "edit"} onClick={() => onChange("edit")} />
      <ModeButton label="源码" active={editorMode === "source"} onClick={() => onChange("source")} />
    </div>
  );
}
