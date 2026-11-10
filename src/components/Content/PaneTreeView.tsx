import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { Transaction } from "@codemirror/state";
import { useStore, isMediaKind } from "../../stores";
import { getEditorView, getPanelScrollEl } from "../../editors/editorRef";
import { saveAppConfig } from "../../hooks/useConfig";
import {
  usePaneDragController,
  type DropOverlayState,
} from "../../hooks/usePaneDragController";
import {
  containsLeaf,
  isLeaf,
  MIN_PANE_PX,
  type PaneLayout,
} from "../../lib/paneTree";
import {
  nextPaneMode,
  AI_PANE_MENU_ITEMS,
  PANE_MENU_ITEMS,
  EXPORT_MENU_ITEMS,
  type PaneMenuAction,
  type ExportMenuAction,
} from "../../lib/paneHeaderMenu";
import {
  exportCurrentDocHtml,
  exportMessage,
} from "../../lib/export/exportDocument";
import { exportPngFromMarkdown, exportPngMessage } from "../../lib/export/png";
import { exportDocxDocument, exportDocxMessage } from "../../lib/export/docx";
import {
  exportMdpkgFromMarkdown,
  exportMdpkgMessage,
} from "../../lib/export/mdpkg";
import { exportZipFromMarkdown, exportZipMessage } from "../../lib/export/zip";
import { log } from "../../utils/log";
import type { EditorMode, Tab } from "../../types";
import TabBar from "../TabBar";
import ErrorBoundary from "../ErrorBoundary";
import Icon from "../Icon";
import ContentArea from "./ContentArea";
import MediaPlayerHost from "./MediaPlayerHost";
import PaneDivider from "./PaneDivider";
import AiDockedPane from "../ai/AiDockedPane";

type PaneDragStarter = (leafId: string, e: ReactPointerEvent) => void;
const PaneDragContext = createContext<PaneDragStarter>(() => {});

const ROOT_BAND_PX = 48;

/** 落区指示层（layout-portal 5.1）：只做视觉反馈，pointer-events:none 不挡命中判定。 */
function PaneDropIndicators({ overlay }: { overlay: DropOverlayState }) {
  if (typeof document === "undefined") return null;
  let node = null;
  if (overlay.rootZone && overlay.viewport) {
    const { width, height } = overlay.viewport;
    const top = overlay.rootZone === "root-top";
    const bottom = overlay.rootZone === "root-bottom";
    const style: CSSProperties = {
      position: "fixed",
      top: top ? 0 : bottom ? height - ROOT_BAND_PX : 0,
      left:
        top || bottom
          ? 0
          : overlay.rootZone === "root-left"
            ? 0
            : width - ROOT_BAND_PX,
      width: top || bottom ? width : ROOT_BAND_PX,
      height: top || bottom ? ROOT_BAND_PX : height,
    };
    node = (
      <div
        data-testid="root-drop-indicator"
        data-drop-zone={overlay.rootZone}
        className="pane-root-drop"
        style={style}
      />
    );
  } else if (overlay.zone && overlay.rect) {
    const { x, y, width, height } = overlay.rect;
    const zone = overlay.zone;
    const inner: CSSProperties =
      zone === "left"
        ? { left: 0, top: 0, width: "50%", height: "100%" }
        : zone === "right"
          ? { right: 0, top: 0, width: "50%", height: "100%" }
          : zone === "top"
            ? { left: 0, top: 0, width: "100%", height: "50%" }
            : zone === "bottom"
              ? { left: 0, bottom: 0, width: "100%", height: "50%" }
              : { inset: 0 };
    node = (
      <div
        data-testid="pane-drop-indicator"
        data-drop-zone={zone}
        className="pane-drop-overlay"
        style={{ position: "fixed", left: x, top: y, width, height }}
      >
        <div
          className={zone === "center" ? "pane-drop-center" : "pane-drop-zone"}
          style={inner}
        />
      </div>
    );
  }
  if (!node) return null;
  return createPortal(node, document.body);
}

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
  const readingMode = useStore((s) => s.readingMode);
  const peekPaneId = useStore((s) => s.immersivePeekPaneId);

  if (isLeaf(node)) {
    const hidden = fullscreenId !== null && fullscreenId !== node.id;
    const fullscreen = fullscreenId !== null && fullscreenId === node.id;
    const isAi = node.kind === "ai";
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
        data-pane-kind={isAi ? "ai" : "tabs"}
        data-focused={focusedPaneId === node.id ? "true" : "false"}
        data-fullscreen={fullscreen ? "true" : "false"}
        data-immersive-peek={
          readingMode && peekPaneId === node.id ? "true" : undefined
        }
        onMouseDownCapture={() => useStore.getState().focusPane(node.id)}
      >
        <div
          onPointerLeave={() => {
            if (!readingMode) return;
            window.setTimeout(() => {
              const st = useStore.getState();
              if (st.tabDragActive) return;
              if (st.immersivePeekPaneId === node.id) {
                st.setImmersivePeekPaneId(null);
              }
            }, 400);
          }}
        >
          {isAi ? (
            <AiPaneHeader leafId={node.id} />
          ) : (
            <PaneHeader
              leafId={node.id}
              tabs={node.tabs}
              activeTabId={node.activeTabId}
              editorMode={node.editorMode}
              showFullscreen={true}
              showClosePane={!rootIsLeaf}
              paneFocused={focusedPaneId === node.id}
            />
          )}
        </div>
        <div className="relative flex-1 overflow-hidden">
          {readingMode && (
            <div
              data-testid="pane-tab-hotzone"
              data-pane-hotzone={node.id}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: 16,
                zIndex: 20,
              }}
              onPointerEnter={() =>
                useStore.getState().setImmersivePeekPaneId(node.id)
              }
            />
          )}
          {isAi ? (
            <AiDockedPane />
          ) : (
            <ErrorBoundary panelId={node.id}>
              <PaneBody
                leafId={node.id}
                activeTabId={node.activeTabId}
                editorMode={node.editorMode}
              />
            </ErrorBoundary>
          )}
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
  showFullscreen,
  showClosePane,
  paneFocused,
}: {
  leafId: string;
  tabs: string[];
  activeTabId: string | null;
  editorMode: EditorMode;
  showFullscreen: boolean;
  paneFocused: boolean;
  showClosePane: boolean;
}) {
  const allTabs = useStore((s) => s.tabs);
  const fullscreenPaneId = useStore((s) => s.fullscreenPaneId);
  const leafTabs: Record<string, Tab> = {};
  for (const id of tabs) {
    if (allTabs[id]) leafTabs[id] = allTabs[id];
  }
  const activeTab = activeTabId ? allTabs[activeTabId] : null;
  const isMedia = activeTab ? isMediaKind(activeTab.fileKind) : false;

  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpen = (): void => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setMenuOpen(true), 120);
  };
  const hoverClose = (): void => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setMenuOpen(false);
      setExportOpen(false);
    }, 240);
  };
  const cancelExportClose = (): void => {
    if (exportCloseTimer.current) {
      clearTimeout(exportCloseTimer.current);
      exportCloseTimer.current = null;
    }
  };
  const scheduleExportClose = (): void => {
    cancelExportClose();
    exportCloseTimer.current = setTimeout(() => setExportOpen(false), 150);
  };
  const startPaneDrag = useContext(PaneDragContext);

  const onHeaderPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("button, [data-tab-id], input, select, a")) return;
      startPaneDrag(leafId, e);
    },
    [startPaneDrag, leafId],
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        cancelExportClose();
        setMenuOpen(false);
        setExportOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelExportClose();
        setMenuOpen(false);
        setExportOpen(false);
      }
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

  useEffect(
    () => () => {
      if (exportCloseTimer.current) clearTimeout(exportCloseTimer.current);
    },
    [],
  );

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
      setExportOpen(false);
      const store = useStore.getState();
      const tab = activeTabId ? store.tabs[activeTabId] : null;
      switch (action) {
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
        case "refresh": {
          if (!tab?.path) {
            showNotice("此页签尚未保存，无法刷新");
            return;
          }
          void invoke<{ path: string; content: string }>("open_file_direct", {
            path: tab.path,
          })
            .then((result) => {
              const store = useStore.getState();
              const view = getEditorView(leafId);
              if (view && view.state.doc.toString() !== result.content) {
                view.dispatch({
                  changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: result.content,
                  },
                  // 刷新是磁盘内容覆盖，不是用户编辑：与 ContentArea 的内容
                  // 同步同一约定，不进撤销历史（#321）。
                  annotations: Transaction.addToHistory.of(false),
                });
              }
              store.refreshTabContent(tab.id, result.content);
              showNotice("已刷新");
            })
            .catch((e) => {
              log.error("PaneHeader", "刷新失败", e);
              showNotice("刷新失败");
            });
          return;
        }
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
        case "openFolder": {
          if (!tab?.path) {
            showNotice("此页签尚未保存，无文件夹可打开");
            return;
          }
          void invoke("reveal_in_finder", { path: tab.path }).catch((e) =>
            log.error("PaneHeader", "打开文件夹失败", e),
          );
          return;
        }
      }
    },
    [activeTabId, leafId, setMode, showNotice],
  );

  const runExport = useCallback(
    (action: ExportMenuAction) => {
      setMenuOpen(false);
      setExportOpen(false);
      const tab = activeTabId ? useStore.getState().tabs[activeTabId] : null;
      if (!tab) return;
      const baseDir = dirOfTabPath(tab.path);
      if (action === "exportHtml") {
        void exportCurrentDocHtml({
          title: tab.title,
          markdown: tab.content,
          baseDir,
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
      const run = async <R extends { status: string; message?: string }>(
        exportFn: () => Promise<R>,
        messageFn: (result: R) => string | null,
        pending: string,
        label: string,
      ) => {
        showNotice(pending);
        let message: string | null = null;
        try {
          const result = await exportFn();
          if (result.status === "error") {
            log.error("PaneHeader", `${label}失败`, result.message);
          }
          message = messageFn(result);
        } catch (e) {
          log.error("PaneHeader", `${label}失败`, String(e));
          message = `导出失败：${e instanceof Error ? e.message : String(e)}`;
        }
        if (message) showNotice(message);
      };
      if (action === "exportPng") {
        void run(
          () =>
            exportPngFromMarkdown({
              title: tab.title,
              markdown: tab.content,
              baseDir,
            }),
          exportPngMessage,
          "正在生成图片…",
          "导出图片",
        );
        return;
      }
      if (action === "exportDocx") {
        void run(
          () =>
            exportDocxDocument({
              title: tab.title,
              markdown: tab.content,
              baseDir,
            }),
          exportDocxMessage,
          "正在生成 Word…",
          "导出 Word",
        );
        return;
      }
      if (action === "exportMdpkg") {
        void run(
          () =>
            exportMdpkgFromMarkdown({
              title: tab.title,
              markdown: tab.content,
              baseDir,
            }),
          exportMdpkgMessage,
          "正在打包 .mdpkg…",
          "导出 .mdpkg",
        );
        return;
      }
      if (action === "exportZip") {
        void run(
          () =>
            exportZipFromMarkdown({
              title: tab.title,
              markdown: tab.content,
              baseDir,
            }),
          exportZipMessage,
          "正在打包 ZIP…",
          "导出 ZIP",
        );
      }
    },
    [activeTabId, showNotice],
  );

  return (
    <div
      data-testid="pane-header"
      onPointerDown={onHeaderPointerDown}
      className="app-chrome flex items-center shrink-0 border-b border-[var(--app-border)]"
    >
      <div className="flex-1 min-w-0 overflow-hidden">
        <TabBar
          tabs={leafTabs}
          activeTabId={activeTabId}
          onSwitchTab={handleSwitch}
          onCloseTab={handleClose}
          paneId={leafId}
          onReorderTabs={(from, to) =>
            useStore.getState().reorderPaneTabs(leafId, from, to)
          }
          onMoveToPane={(tabId, targetLeafId) =>
            useStore.getState().moveTabToPane(tabId, targetLeafId)
          }
          paneFocused={paneFocused}
        />
      </div>
      <div
        className="pane-actions"
        data-open={menuOpen || exportOpen ? "true" : undefined}
      >
        {!isMedia && (
          <button
            type="button"
            data-testid="pane-mode"
            data-mode={editorMode}
            title={
              editorMode === "preview"
                ? "切换到编辑（⌘⇧M）"
                : "切换到预览（⌘⇧M）"
            }
            aria-label={editorMode === "preview" ? "切换到编辑" : "切换到预览"}
            onClick={() => setMode(nextPaneMode(editorMode))}
            className="p-0.5 mx-1 rounded text-[var(--app-chrome-rest)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-chrome-hover)] shrink-0"
          >
            <Icon
              name={editorMode === "preview" ? "eye" : "pencil"}
              size={18}
            />
          </button>
        )}
        <div className="flex items-center gap-0.5 px-1 shrink-0">
          {showFullscreen && (
            <button
              type="button"
              data-testid="pane-fullscreen"
              title={
                fullscreenPaneId === leafId
                  ? "退出全屏（Esc）"
                  : "全屏当前格 (⌘⇧↵)"
              }
              aria-label={
                fullscreenPaneId === leafId ? "退出全屏" : "全屏当前格"
              }
              aria-pressed={fullscreenPaneId === leafId}
              data-fullscreen={fullscreenPaneId === leafId ? "true" : "false"}
              onClick={() => {
                useStore.getState().focusPane(leafId);
                useStore.getState().toggleFullscreenPane();
              }}
              className="pane-fullscreen-button p-0.5 rounded text-[var(--app-chrome-rest)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-chrome-hover)]"
            >
              <Icon
                name={fullscreenPaneId === leafId ? "collapse" : "expand"}
                size={18}
              />
            </button>
          )}
          <div
            className="relative"
            ref={menuRef}
            onPointerEnter={hoverOpen}
            onPointerLeave={hoverClose}
          >
            <button
              type="button"
              data-testid="pane-menu-button"
              title="更多操作"
              aria-label="更多操作"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => {
                setExportOpen(false);
                setMenuOpen((v) => !v);
              }}
              className="p-0.5 rounded text-[var(--app-chrome-rest)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-chrome-hover)]"
            >
              <Icon name="more" size={18} />
            </button>
            {menuOpen && (
              <div
                data-testid="pane-menu"
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 min-w-[132px] rounded border py-1 text-xs shadow-lg"
                style={{
                  background: "var(--app-surface)",
                  borderColor: "var(--app-border)",
                  color: "var(--app-text-2)",
                }}
              >
                {PANE_MENU_ITEMS.map((item) => (
                  <div
                    key={item.action}
                    className="relative"
                    onPointerEnter={() => {
                      if (item.action === "export") {
                        cancelExportClose();
                        setExportOpen(true);
                      }
                    }}
                    onPointerLeave={() => {
                      if (item.action === "export") scheduleExportClose();
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      data-menu-item={item.action}
                      aria-haspopup={
                        item.action === "export" ? "menu" : undefined
                      }
                      aria-expanded={
                        item.action === "export" ? exportOpen : undefined
                      }
                      onClick={() => {
                        if (item.action === "export") {
                          setExportOpen(true);
                          return;
                        }
                        runMenu(item.action);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)]"
                    >
                      <Icon name={item.icon} size={18} />
                      <span>{item.label}</span>
                      {item.action === "export" && (
                        <span
                          className="ml-auto h-0 w-0 border-y-4 border-l-4 border-y-transparent border-l-[var(--app-text-3)]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                    {item.action === "export" && exportOpen && (
                      <>
                        <div
                          aria-hidden="true"
                          className="absolute right-full top-0 h-full w-1"
                          onPointerEnter={cancelExportClose}
                          onPointerLeave={scheduleExportClose}
                        />
                        <div
                          data-testid="pane-export-submenu"
                          role="menu"
                          onPointerEnter={cancelExportClose}
                          onPointerLeave={scheduleExportClose}
                          className="absolute right-full top-0 mr-1 min-w-[132px] rounded border py-1 text-xs shadow-lg"
                          style={{
                            background: "var(--app-surface)",
                            borderColor: "var(--app-border)",
                            color: "var(--app-text-2)",
                          }}
                        >
                          {EXPORT_MENU_ITEMS.map((sub) => (
                            <button
                              key={sub.action}
                              type="button"
                              role="menuitem"
                              data-export-item={sub.action}
                              disabled={sub.disabled}
                              title={sub.title}
                              onClick={() => runExport(sub.action)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Icon name={sub.icon} size={18} />
                              <span>{sub.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {showClosePane && (
            <button
              type="button"
              data-testid="pane-close"
              title="关闭此格"
              aria-label="关闭此格"
              onClick={() => useStore.getState().closePane(leafId)}
              className="p-0.5 rounded text-[var(--app-chrome-rest)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-chrome-hover)]"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </div>
      {notice && (
        <div
          role="status"
          data-export-notice
          className="fixed bottom-6 left-1/2 z-[2147483000] -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-700/95"
        >
          {notice}
        </div>
      )}
    </div>
  );
}

/** 停靠态 AI 格的头部（layout-portal 9.1）：标题 + ⋯ 菜单 + 关闭。 */
function AiPaneHeader({ leafId }: { leafId: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [menuOpen]);

  const run = (action: PaneMenuAction) => {
    setMenuOpen(false);
    if (action === "undockAi" || action === "closePane") {
      useStore.getState().closePane(leafId);
    }
  };

  return (
    <div
      data-testid="ai-pane-header"
      className="app-chrome flex items-center shrink-0 border-b border-[var(--app-border)] px-2 py-1"
    >
      <Icon name="sparkle" size={18} color="var(--app-accent)" />
      <span className="ml-1.5 text-xs font-medium text-[var(--app-text)]">
        AI
      </span>
      <div className="ml-auto flex items-center gap-0.5">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            data-testid="ai-pane-menu-button"
            title="更多操作"
            aria-label="更多操作"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="p-0.5 rounded text-[var(--app-chrome-rest)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-chrome-hover)]"
          >
            <Icon name="more" size={18} />
          </button>
          {menuOpen && (
            <div
              data-testid="ai-pane-menu"
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 min-w-[150px] rounded border border-[var(--app-border)] bg-[var(--app-surface)] py-1 text-xs shadow-lg"
            >
              {AI_PANE_MENU_ITEMS.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  role="menuitem"
                  data-ai-menu-item={item.action}
                  onClick={() => run(item.action)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)]"
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          data-testid="ai-pane-close"
          title="关闭"
          aria-label="关闭 AI 窗格"
          onClick={() => useStore.getState().closePane(leafId)}
          className="p-0.5 rounded text-[var(--app-chrome-rest)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-chrome-hover)]"
        >
          <Icon name="close" size={18} />
        </button>
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
  const { startPaneDrag, overlay } = usePaneDragController();

  return (
    <PaneDragContext.Provider value={startPaneDrag}>
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
      <PaneDropIndicators overlay={overlay} />
    </PaneDragContext.Provider>
  );
}
