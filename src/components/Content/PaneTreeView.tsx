import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useStore, isMediaKind } from "../../stores";
import { getPanelScrollEl } from "../../editors/editorRef";
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
  type PaneMenuAction,
} from "../../lib/paneHeaderMenu";
import { log } from "../../utils/log";
import { popOverlay, pushOverlay } from "../../lib/overlayGate";
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

/**
 * macOS 红黄绿灯簇避让宽度：本机实测三枚 14px 按钮、间距 9px、左起 9px，
 * 簇右缘 69px；保留区取 78px（含 9px 右余量）。数值出处见设计台账
 * 「macOS 红黄绿灯簇宽度 → 页签条避让保留区」。
 */
const WINDOW_CONTROLS_RESERVE_PX = 78;

/** 窗口按钮位于窗口左上角，仅最左上那一格的页签条需要避让。 */
function topLeftLeafId(node: PaneLayout): string {
  let current = node;
  while (!isLeaf(current)) current = current.children[0];
  return current.id;
}

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
  /** 窗口左上角那一格的 leaf id；只有它需要为原生窗口按钮避让。 */
  topLeftId: string;
}

function PaneNode({
  node,
  style,
  fullscreenId,
  rootIsLeaf,
  focusedPaneId,
  topLeftId,
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
              topLeft={node.id === topLeftId}
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
        topLeftId={topLeftId}
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
        topLeftId={topLeftId}
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
  topLeft,
}: {
  leafId: string;
  tabs: string[];
  activeTabId: string | null;
  editorMode: EditorMode;
  showFullscreen: boolean;
  paneFocused: boolean;
  showClosePane: boolean;
  topLeft: boolean;
}) {
  const allTabs = useStore((s) => s.tabs);
  const fullscreenPaneId = useStore((s) => s.fullscreenPaneId);
  const railPinned = useStore((s) => s.railPinned);
  const leafTabs: Record<string, Tab> = {};
  for (const id of tabs) {
    if (allTabs[id]) leafTabs[id] = allTabs[id];
  }
  const activeTab = activeTabId ? allTabs[activeTabId] : null;
  const isMedia = activeTab ? isMediaKind(activeTab.fileKind) : false;

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpen = (): void => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setMenuOpen(true), 120);
  };
  const hoverClose = (): void => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setMenuOpen(false), 240);
  };
  const startPaneDrag = useContext(PaneDragContext);

  const onHeaderPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      // 页签本体有自己的拖拽语义；空白页签条与格头留白一样是格拖拽入口
      // （D15 只占双击：未过 4px 阈值的按下仍按点击处理）。
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
    pushOverlay();
    return () => popOverlay();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
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

  /**
   * 栏目「更多操作」菜单落位（ui-polish-batch15 11.1）：默认中心对齐按钮；
   * 水平方向右缘越出视口时左移、左缘越出时右移，垂直方向下方放不下时向上
   * 展开，两轴各自独立判定并夹进 8px 边距。菜单容器（.relative）是定位基准，
   * 视口坐标需减去容器 rect 后再写成 left/top。
   */
  const measureMenu = useCallback(() => {
    const box = menuRef.current?.getBoundingClientRect();
    const btn = menuButtonRef.current?.getBoundingClientRect();
    const panel = menuPanelRef.current;
    if (!box || !btn || !panel) return;
    const margin = 8;
    const menuW = panel.offsetWidth;
    const menuH = panel.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // 水平：中心对齐按钮，越界则夹进视口
    const centre = btn.left + btn.width / 2 - menuW / 2;
    const left = Math.max(margin, Math.min(centre, vw - margin - menuW));
    // 垂直：默认按钮下方 4px，下方放不下则翻到按钮上方 4px
    let top = box.height + 4;
    if (box.bottom + 4 + menuH > vh - margin) top = -menuH - 4;
    const topViewport = Math.max(
      margin,
      Math.min(box.top + top, vh - margin - menuH),
    );
    setMenuPos({ left: left - box.left, top: topViewport - box.top });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    measureMenu();
  }, [menuOpen, measureMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measureMenu);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen, measureMenu]);

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
        case "new-file":
          store.newTab();
          return;
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
      }
    },
    [activeTabId, leafId, setMode, showNotice],
  );

  return (
    <div
      data-testid="pane-header"
      onPointerDown={onHeaderPointerDown}
      className="app-chrome flex items-center shrink-0 border-b border-[var(--app-border)]"
    >
      {topLeft && !railPinned && (
        <div
          data-testid="window-controls-reserve"
          style={{ width: WINDOW_CONTROLS_RESERVE_PX }}
          className="self-stretch shrink-0"
        />
      )}
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
      <div className="pane-actions" data-open={menuOpen ? "true" : undefined}>
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
              ref={menuButtonRef}
              data-testid="pane-menu-button"
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
                data-testid="pane-menu"
                role="menu"
                ref={menuPanelRef}
                className="absolute z-50 min-w-[132px] rounded border py-1 text-xs shadow-lg"
                style={{
                  ...(menuPos
                    ? {
                        left: menuPos.left,
                        top: menuPos.top,
                        transform: "none",
                      }
                    : {
                        left: "50%",
                        top: "100%",
                        marginTop: 4,
                        transform: "translateX(-50%)",
                      }),
                  background: "var(--app-surface)",
                  borderColor: "var(--app-border)",
                  color: "var(--app-text-2)",
                }}
              >
                {PANE_MENU_ITEMS.map((item) => (
                  <button
                    key={item.action}
                    type="button"
                    role="menuitem"
                    data-menu-item={item.action}
                    onClick={() => runMenu(item.action)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)]"
                  >
                    <Icon name={item.icon} size={18} />
                    <span>{item.label}</span>
                  </button>
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
    pushOverlay();
    return () => popOverlay();
  }, [menuOpen]);

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
  const topLeftId = fullscreenPaneId ?? topLeftLeafId(paneRoot);

  return (
    <PaneDragContext.Provider value={startPaneDrag}>
      <div className="relative h-full w-full overflow-hidden pane-tree">
        <PaneNode
          node={paneRoot}
          style={{ width: "100%", height: "100%" }}
          fullscreenId={fullscreenPaneId}
          rootIsLeaf={rootIsLeaf}
          focusedPaneId={focusedPaneId}
          topLeftId={topLeftId}
        />
        <MediaPlayerHost />
      </div>
      <PaneDropIndicators overlay={overlay} />
    </PaneDragContext.Provider>
  );
}
