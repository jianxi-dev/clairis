import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore, isMediaKind } from "../../stores";
import { getPanelScrollEl } from "../../editors/editorRef";
import { saveAppConfig } from "../../hooks/useConfig";
import {
  containsLeaf,
  isLeaf,
  MIN_PANE_PX,
  type PaneLayout,
} from "../../lib/paneTree";
import {
  nextPaneMode,
  PANE_MENU_ITEMS,
  type PaneMenuAction,
} from "../../lib/paneHeaderMenu";
import {
  exportCurrentDocHtml,
  exportMessage,
} from "../../lib/export/exportDocument";
import { log } from "../../utils/log";
import type { EditorMode, Tab } from "../../types";
import TabBar from "../TabBar";
import ErrorBoundary from "../ErrorBoundary";
import Icon from "../Icon";
import ContentArea from "./ContentArea";
import MediaPlayerHost from "./MediaPlayerHost";
import PaneDivider from "./PaneDivider";

function dirOfTabPath(path: string | null): string {
  if (!path) return "";
  return path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    log.warn("PaneHeader", "复制失败", e);
    return false;
  }
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
  const isMedia = activeTab ? isMediaKind(activeTab.fileKind) : false;

  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const id = setTimeout(() => {
      window.addEventListener("mousedown", onDown, true);
      window.addEventListener("keydown", onKey, true);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [menuOpen]);

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

  const setMode = useCallback(
    (m: EditorMode) => useStore.getState().setPaneEditorMode(leafId, m),
    [leafId],
  );

  const runMenu = useCallback(
    (action: PaneMenuAction) => {
      setMenuOpen(false);
      const store = useStore.getState();
      const tab = activeTabId ? store.tabs[activeTabId] : null;
      switch (action) {
        case "export": {
          if (!tab) return;
          void exportCurrentDocHtml({
            title: tab.title,
            markdown: tab.content,
            baseDir: dirOfTabPath(tab.path),
          }).then((result) => {
            const message = exportMessage(result);
            if (result.status === "error") {
              log.error("PaneHeader", "导出 HTML 失败", result.message);
              showNotice(message ?? "导出失败");
            } else if (result.status === "saved") {
              showNotice(message ?? "已导出");
            }
          });
          return;
        }
        case "share": {
          if (!tab) return;
          const text = tab.path ? `${tab.title} ${tab.path}` : tab.content;
          void copyText(text).then((ok) =>
            showNotice(ok ? "分享内容已复制" : "复制失败"),
          );
          return;
        }
        case "splitRight":
          store.splitPane("row");
          return;
        case "splitDown":
          store.splitPane("col");
          return;
        case "source":
          setMode("source");
          return;
        case "locate": {
          if (!tab?.path) {
            showNotice("此页签尚未保存，无路径可定位");
            return;
          }
          void invoke("reveal_in_finder", { path: tab.path }).catch((e) =>
            log.error("PaneHeader", "定位失败", e),
          );
          return;
        }
        case "copyPath": {
          if (!tab?.path) {
            showNotice("此页签尚未保存，无路径可复制");
            return;
          }
          void copyText(tab.path).then((ok) =>
            showNotice(ok ? "路径已复制" : "复制失败"),
          );
          return;
        }
      }
    },
    [activeTabId, setMode, showNotice],
  );

  return (
    <div
      data-testid="pane-header"
      className="app-chrome flex items-center shrink-0 border-b border-gray-100 dark:border-gray-700"
    >
      <div className="flex-1 min-w-0 overflow-hidden">
        <TabBar
          tabs={leafTabs}
          activeTabId={activeTabId}
          onSwitchTab={handleSwitch}
          onCloseTab={handleClose}
          onReorderTabs={(from, to) =>
            useStore.getState().reorderPaneTabs(leafId, from, to)
          }
          alwaysShowClose
        />
      </div>
      {!isMedia && (
        <button
          type="button"
          data-testid="pane-mode"
          data-mode={editorMode}
          title={editorMode === "preview" ? "切换到编辑" : "切换到预览"}
          aria-label={editorMode === "preview" ? "切换到编辑" : "切换到预览"}
          onClick={() => setMode(nextPaneMode(editorMode))}
          className="p-0.5 mx-1 rounded text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 shrink-0"
        >
          <Icon name={editorMode === "preview" ? "eye" : "pencil"} size={18} />
        </button>
      )}
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
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            data-testid="pane-menu-button"
            title="更多操作"
            aria-label="更多操作"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="p-0.5 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <Icon name="more" size={18} />
          </button>
          {menuOpen && (
            <div
              data-testid="pane-menu"
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 min-w-[150px] rounded border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              {PANE_MENU_ITEMS.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  role="menuitem"
                  data-menu-item={item.action}
                  onClick={() => runMenu(item.action)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[2147483000] -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-700/95"
        >
          {notice}
        </div>
      )}
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
