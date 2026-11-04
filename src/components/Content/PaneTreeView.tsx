import { useCallback, useRef, type CSSProperties } from "react";
import { useStore, isMediaKind } from "../../stores";
import { getPanelScrollEl } from "../../editors/editorRef";
import { saveAppConfig } from "../../hooks/useConfig";
import {
  containsLeaf,
  isLeaf,
  MIN_PANE_PX,
  type PaneLayout,
} from "../../lib/paneTree";
import type { EditorMode, Tab } from "../../types";
import TabBar from "../TabBar";
import ErrorBoundary from "../ErrorBoundary";
import Icon from "../Icon";
import ContentArea from "./ContentArea";
import MediaPlayerHost from "./MediaPlayerHost";
import PaneDivider from "./PaneDivider";

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

function ModeButtons({
  editorMode,
  isMedia,
  onChange,
}: {
  editorMode: EditorMode;
  isMedia: boolean;
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

interface PaneNodeProps {
  node: PaneLayout;
  style?: CSSProperties;
  fullscreenId: string | null;
  /** 整棵树的根就是这一个 leaf 时，它的关闭按钮不出现。 */
  rootIsLeaf: boolean;
  focusedPaneId: string;
}

function PaneNode({
  node,
  style,
  fullscreenId,
  rootIsLeaf,
  focusedPaneId,
}: PaneNodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (isLeaf(node)) {
    const hidden = fullscreenId !== null && fullscreenId !== node.id;
    const fullscreen = fullscreenId !== null && fullscreenId === node.id;
    const leafStyle: CSSProperties = {
      ...style,
      // 内联兜底：父级传下来的 minWidth:0 会盖过 CSS 类的 240px，这里显式再压一次
      minWidth: MIN_PANE_PX,
      minHeight: MIN_PANE_PX,
      ...(hidden ? { display: "none" } : null),
      ...(fullscreen ? { position: "absolute", inset: 0, zIndex: 30 } : null),
    };
    return (
      <div
        ref={containerRef}
        style={leafStyle}
        className="pane-leaf flex flex-col min-w-0 min-h-0 overflow-hidden"
        data-pane-id={node.id}
        data-focused={focusedPaneId === node.id ? "true" : "false"}
        data-fullscreen={fullscreen ? "true" : "false"}
        onMouseDownCapture={() => useStore.getState().focusPane(node.id)}
      >
        <PaneHeader
          leafId={node.id}
          tabs={node.tabs}
          activeTabId={node.activeTabId}
          editorMode={node.editorMode}
          showClose={!rootIsLeaf}
        />
        <div className="relative flex-1 overflow-hidden">
          <ErrorBoundary panelId={node.id}>
            <PaneBody
              leafId={node.id}
              activeTabId={node.activeTabId}
              editorMode={node.editorMode}
            />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  const isRow = node.dir === "row";
  // 全屏时：不在这条路径上的子树整体隐藏（保持挂载，只 display:none）
  const onPath = fullscreenId === null || containsLeaf(node, fullscreenId);
  if (!onPath) {
    return (
      <div
        style={{ ...style, display: "none" }}
        className={`pane-branch flex ${isRow ? "flex-row" : "flex-col"} min-w-0 min-h-0 overflow-hidden`}
        data-pane-branch={node.id}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      style={style}
      className={`pane-branch flex ${isRow ? "flex-row" : "flex-col"} min-w-0 min-h-0 overflow-hidden`}
      data-pane-branch={node.id}
    >
      <PaneNode
        key={node.children[0].id}
        node={node.children[0]}
        style={{ flex: `${node.ratio} 1 0%`, minWidth: 0, minHeight: 0 }}
        fullscreenId={fullscreenId}
        rootIsLeaf={rootIsLeaf}
        focusedPaneId={focusedPaneId}
      />
      {fullscreenId === null && (
        <PaneDivider branch={node} containerRef={containerRef} />
      )}
      <PaneNode
        key={node.children[1].id}
        node={node.children[1]}
        style={{ flex: `${1 - node.ratio} 1 0%`, minWidth: 0, minHeight: 0 }}
        fullscreenId={fullscreenId}
        rootIsLeaf={rootIsLeaf}
        focusedPaneId={focusedPaneId}
      />
    </div>
  );
}

function PaneHeader({
  leafId,
  tabs,
  activeTabId,
  editorMode,
  showClose,
}: {
  leafId: string;
  tabs: string[];
  activeTabId: string | null;
  editorMode: EditorMode;
  showClose: boolean;
}) {
  const allTabs = useStore((s) => s.tabs);
  const leafTabs: Record<string, Tab> = {};
  for (const id of tabs) {
    if (allTabs[id]) leafTabs[id] = allTabs[id];
  }
  const activeTab = activeTabId ? allTabs[activeTabId] : null;

  const captureScroll = useCallback(() => {
    const store = useStore.getState();
    const tabId = store.tabs[activeTabId ?? ""] ? activeTabId : null;
    if (!tabId) return;
    const el = getPanelScrollEl(leafId);
    if (!el) return;
    store.updateScrollPos(tabId, el.scrollTop, el.scrollHeight);
    void saveAppConfig();
  }, [leafId, activeTabId]);

  const handleSwitch = useCallback(
    (id: string) => {
      captureScroll();
      useStore.getState().switchTab(id);
    },
    [captureScroll],
  );

  const handleClose = useCallback(
    (id: string) => {
      captureScroll();
      useStore.getState().closeTab(id);
    },
    [captureScroll],
  );

  return (
    <div className="app-chrome flex items-center shrink-0 border-b border-gray-100 dark:border-gray-700">
      <div className="flex-1 min-w-0 overflow-hidden">
        <TabBar
          tabs={leafTabs}
          activeTabId={activeTabId}
          onSwitchTab={handleSwitch}
          onCloseTab={handleClose}
        />
      </div>
      <ModeButtons
        editorMode={activeTab?.editorMode ?? editorMode}
        isMedia={activeTab ? isMediaKind(activeTab.fileKind) : false}
        onChange={(m) => useStore.getState().setPaneEditorMode(leafId, m)}
      />
      <div className="flex items-center gap-0.5 px-1 shrink-0">
        <button
          type="button"
          data-testid="pane-fullscreen"
          title="全屏当前格 (⌘⇧↵)"
          aria-label="全屏当前格"
          onClick={() => useStore.getState().toggleFullscreenPane()}
          className="p-0.5 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <Icon name="expand" size={18} />
        </button>
        {showClose && (
          <button
            type="button"
            data-testid="pane-close"
            title="关闭此格"
            aria-label="关闭此格"
            onClick={() => useStore.getState().closePane(leafId)}
            className="p-0.5 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function PaneBody({
  leafId,
  activeTabId,
  editorMode,
}: {
  leafId: string;
  activeTabId: string | null;
  editorMode: EditorMode;
}) {
  const allTabs = useStore((s) => s.tabs);
  const activeTab = activeTabId ? (allTabs[activeTabId] ?? null) : null;
  return (
    <ContentArea
      panelId={leafId}
      tabOverride={activeTab}
      modeOverride={editorMode}
    />
  );
}

export default function PaneTreeView() {
  const paneRoot = useStore((s) => s.paneRoot);
  const focusedPaneId = useStore((s) => s.focusedPaneId);
  const fullscreenPaneId = useStore((s) => s.fullscreenPaneId);
  const rootIsLeaf = paneRoot.type === "leaf";

  return (
    <div className="relative h-full w-full overflow-hidden">
      <PaneNode
        node={paneRoot}
        style={{ width: "100%", height: "100%" }}
        fullscreenId={fullscreenPaneId}
        rootIsLeaf={rootIsLeaf}
        focusedPaneId={focusedPaneId}
      />
      <MediaPlayerHost />
    </div>
  );
}
