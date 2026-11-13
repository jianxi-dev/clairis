import { invoke } from "@tauri-apps/api/core";
import Icon from "./Icon";
import { colorOfType, fileTypeOf, iconOfType } from "../lib/fileType";
import { useState, useCallback, useEffect, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../stores";
import {
  isMediaMuted,
  subscribeMediaMute,
  toggleMediaMuted,
} from "./Content/mediaMute";
import { popOverlay, pushOverlay } from "../lib/overlayGate";
import { isTauriEnv } from "../utils/tauri";
import type { Tab } from "../types";

interface TabBarProps {
  tabs: Record<string, Tab>;
  activeTabId: string | null;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  /** 提供时启用页签指针拖拽换位；缺省（legacy 分栏）不启用以保持原行为。 */
  onReorderTabs?: (from: number, to: number) => void;
  /** 所在格 id；与 onMoveToPane 一起启用跨格拖放命中判定。 */
  paneId?: string;
  /** 把页签搬到目标格（跨格拖放落点）。 */
  onMoveToPane?: (tabId: string, targetLeafId: string) => void;
  /** 缺省时关闭 × 悬停/聚焦才显示；传 true 则始终显示。 */
  alwaysShowClose?: boolean;
  paneFocused?: boolean;
}

/** 指针移动超过该像素才算拖拽，以下视为点击切签。 */
const DRAG_THRESHOLD_PX = 4;

interface CtxMenu {
  x: number;
  y: number;
  tabId: string;
}

function paneIdAt(x: number, y: number): string | null {
  if (typeof document === "undefined") return null;
  if (typeof document.elementFromPoint !== "function") return null;
  const el = document.elementFromPoint(x, y);
  if (!(el instanceof Element)) return null;
  return (
    el.closest<HTMLElement>("[data-pane-id]")?.getAttribute("data-pane-id") ??
    null
  );
}

/** 页签喇叭：按文件路径独立订阅与切换，多个媒体页签互不影响（#669）。 */
function TabMuteButton({ tabId, path }: { tabId: string; path: string }) {
  const [muted, setMuted] = useState(() => isMediaMuted(path));
  useEffect(() => {
    const apply = (key: string, m: boolean) => {
      if (key === path) setMuted(m);
    };
    apply(path, isMediaMuted(path));
    return subscribeMediaMute(apply);
  }, [path]);
  return (
    <button
      type="button"
      data-testid={`tab-mute-${tabId}`}
      aria-pressed={muted}
      title={muted ? "取消静音" : "静音"}
      onClick={(e) => {
        e.stopPropagation();
        toggleMediaMuted(path);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="shrink-0 rounded px-0.5 text-[var(--app-text-3)] hover:text-[var(--app-text-2)]"
    >
      <Icon name={muted ? "volumeMute" : "volume"} size={14} />
    </button>
  );
}

export default function TabBar({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onReorderTabs,
  paneId,
  onMoveToPane,
  alwaysShowClose,
  paneFocused = true,
}: TabBarProps) {
  const tabIds = Object.keys(tabs);

  const stripRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    from: number;
    tabId: string;
    startX: number;
    active: boolean;
    /** 捕获指针的元素与 id：指针越过正文 iframe 时仍能收到 move/up。 */
    el: HTMLElement;
    pointerId: number;
  } | null>(null);
  const dragGapRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragGap, setDragGap] = useState<number | null>(null);
  const [overPaneId, setOverPaneId] = useState<string | null>(null);
  // 跟手 ghost 的指针位置（视口坐标）；仅在拖拽激活后有值。
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const cancelRenameRef = useRef(false);
  const commitRename = useCallback(
    (id: string, fallback: string) => {
      if (cancelRenameRef.current) {
        cancelRenameRef.current = false;
        setEditingId(null);
        return;
      }
      useStore.getState().renameTab(id, editValue.trim() || fallback);
      setEditingId(null);
    },
    [editValue],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const target = overPaneId
      ? document.querySelector<HTMLElement>(`[data-pane-id="${overPaneId}"]`)
      : null;
    target?.setAttribute("data-tab-drop", "true");
    return () => target?.removeAttribute("data-tab-drop");
  }, [overPaneId]);

  const dragEnabled = Boolean(onReorderTabs || onMoveToPane);

  useEffect(() => {
    if (!dragEnabled) return;
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.active) {
        if (Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD_PX) return;
        drag.active = true;
        document.documentElement.dataset.tabDrag = "true";
        setDragFrom(drag.from);
      }
      setDragPos({ x: e.clientX, y: e.clientY });
      const strip = stripRef.current;
      if (strip) {
        const els = Array.from(
          strip.querySelectorAll<HTMLElement>("[data-tab-id]"),
        );
        let gap = els.length;
        for (let i = 0; i < els.length; i++) {
          const r = els[i].getBoundingClientRect();
          if (e.clientX < r.left + r.width / 2) {
            gap = i;
            break;
          }
        }
        dragGapRef.current = gap;
        setDragGap(gap);
      }
      const over = paneId ? paneIdAt(e.clientX, e.clientY) : null;
      setOverPaneId(over && over !== paneId ? over : null);
    };
    const finish = (commit: boolean, e?: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      delete document.documentElement.dataset.tabDrag;
      useStore.getState().setTabDragActive(false);
      if (drag.el.hasPointerCapture?.(drag.pointerId)) {
        drag.el.releasePointerCapture(drag.pointerId);
      }
      if (drag.active) {
        // 拖拽结束后的那次 click 是拖拽的尾巴，不能当作切签
        suppressClickRef.current = true;
        const targetPaneId =
          paneId && e ? paneIdAt(e.clientX, e.clientY) : null;
        if (targetPaneId && targetPaneId !== paneId && onMoveToPane) {
          onMoveToPane(drag.tabId, targetPaneId);
        } else if (commit && onReorderTabs) {
          const gap = dragGapRef.current ?? drag.from;
          const target = gap > drag.from ? gap - 1 : gap;
          if (target !== drag.from) onReorderTabs(drag.from, target);
        }
      }
      dragRef.current = null;
      dragGapRef.current = null;
      setDragFrom(null);
      setDragGap(null);
      setOverPaneId(null);
      setDragPos(null);
    };
    const onUp = (e: PointerEvent) => finish(true, e);
    const onCancel = () => finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    return () => {
      delete document.documentElement.dataset.tabDrag;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [dragEnabled, onReorderTabs, paneId, onMoveToPane]);

  const [menu, setMenu] = useState<CtxMenu | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, tabId });
    },
    [],
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    pushOverlay();
    return () => popOverlay();
  }, [menu]);

  // 菜单关闭协议（editor-surface-batch17 D1）：外点 / Esc / 失焦 / 滚动四条来源。
  // 内部判定用菜单自身的 data-tab-menu 标记，而不是 .fixed.z-50 类名——
  // 任何 z-50 浮层都会被误判成「菜单内部」。
  useEffect(() => {
    if (!menu) return;
    const insideMenu = (target: EventTarget | null): boolean =>
      target instanceof Element && target.closest("[data-tab-menu]") !== null;

    const onPointerDown = (e: PointerEvent) => {
      if (insideMenu(e.target)) return;
      setMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setMenu(null);
    };
    const onBlur = () => setMenu(null);
    const onScrollOrResize = () => setMenu(null);

    // 右键 contextmenu 打开菜单时，那次的 pointerdown 已先于本 effect 触发，
    // 因此同步注册即可，不需要 setTimeout 跳过首个事件。
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onBlur);
    // capture：内层滚动容器的 scroll 不冒泡，但会经过 window 捕获阶段。
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [menu]);

  const placeholder =
    dragGap === null ? null : (
      <div
        data-testid="tab-drag-placeholder"
        className="drag-placeholder shrink-0 rounded-sm"
        style={{
          width: 4,
          alignSelf: "stretch",
          margin: "3px 1px",
          borderRadius: 2,
          background: "var(--app-accent)",
          boxShadow: "0 0 0 1px var(--app-accent-soft)",
        }}
      />
    );

  const ghostTab = dragFrom !== null ? tabs[tabIds[dragFrom]] : undefined;
  const ghostKind = ghostTab
    ? ghostTab.path
      ? fileTypeOf(ghostTab.path)
      : "markdown"
    : "text";

  return (
    <>
      <div
        ref={stripRef}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-tab-id], button, input"))
            return;
          // 双击空白是窗口级动作：切换最大化/还原，不再新建文档（D15）。
          if (!isTauriEnv()) return;
          void import("@tauri-apps/api/window")
            .then(({ getCurrentWindow }) => getCurrentWindow().toggleMaximize())
            .catch(() => {});
        }}
        className="tab-strip flex min-h-[26px] w-full items-center gap-1 shrink-0 select-none overflow-x-auto px-1"
        style={{
          // 底边只由栏目头（pane-header）画一次；页签条再画一遍会叠成加深双线（#1/#23）。
          background: "transparent",
        }}
      >
        {tabIds.map((id, index) => {
          const tab = tabs[id];
          const isActive = id === activeTabId;
          const tabKind = tab.path ? fileTypeOf(tab.path) : "markdown";
          const typeColor = colorOfType(tabKind);
          const iconColor =
            isActive && paneFocused ? typeColor : "var(--app-chrome-rest)";
          const isDragged = dragFrom === index;
          return (
            <Fragment key={id}>
              {dragGap === index && placeholder}
              <div
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  onSwitchTab(id);
                }}
                onPointerDown={
                  dragEnabled
                    ? (e) => {
                        if (e.button !== 0) return;
                        // 关闭按钮等子控件自己处理点击：不要捕获指针，
                        // 否则 click 会被重定向到页签本体，关闭按钮失效。
                        if ((e.target as HTMLElement).closest("button, input"))
                          return;
                        suppressClickRef.current = false;
                        useStore.getState().setTabDragActive(true);
                        // 捕获指针：拖过正文 iframe 时 pointermove/pointerup
                        // 仍冒泡到 window，轨迹与落点不会中断。
                        const el = e.currentTarget;
                        el.setPointerCapture?.(e.pointerId);
                        dragRef.current = {
                          from: index,
                          tabId: id,
                          startX: e.clientX,
                          active: false,
                          el,
                          pointerId: e.pointerId,
                        };
                      }
                    : undefined
                }
                data-tab-id={id}
                role="tab"
                aria-selected={isActive}
                data-tab-color={typeColor}
                style={{
                  ...(isDragged
                    ? {
                        opacity: 0.5,
                        outline: "2px dashed var(--app-accent)",
                        outlineOffset: 2,
                        zIndex: 1,
                      }
                    : null),
                }}
                title={tab.title}
                onContextMenu={(e) => handleContextMenu(e, id)}
                onDoubleClick={(e) => {
                  if ((e.target as HTMLElement).closest("button, input"))
                    return;
                  setEditingId(id);
                  setEditValue(tab.title);
                }}
                className={`group flex min-w-0 items-center gap-1.5 px-2.5 py-1 text-xs cursor-pointer transition-colors whitespace-nowrap outline-none focus:outline-none focus-visible:outline-none ${
                  isActive
                    ? "tab-capsule rounded-full bg-[var(--app-accent-soft)] font-medium text-[var(--app-text-strong)]"
                    : "rounded-none bg-transparent text-[var(--app-chrome-rest)] hover:rounded-full hover:bg-[var(--app-sunken)] hover:text-[var(--app-chrome-hover)]"
                }`}
              >
                <Icon
                  name={iconOfType(tabKind)}
                  size={18}
                  color={iconColor}
                  className="mr-0.5"
                />
                {editingId === id ? (
                  <input
                    data-testid="tab-title-input"
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(id, tab.title);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRenameRef.current = true;
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => commitRename(id, tab.title)}
                    className="w-32 min-w-0 rounded border bg-transparent px-1 text-xs outline-none"
                    style={{
                      width: "24ch",
                      minWidth: "12ch",
                      borderColor: "var(--app-border)",
                      color: "var(--app-text)",
                    }}
                  />
                ) : (
                  <span className="max-w-44 truncate">{tab.title}</span>
                )}
                {tab.dirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                )}
                {(tabKind === "video" || tabKind === "audio") && tab.path && (
                  <TabMuteButton tabId={id} path={tab.path} />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(id);
                  }}
                  className={`ml-1 px-1 rounded shrink-0 transition-opacity ${
                    alwaysShowClose
                      ? "text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
                      : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text-2)]"
                  }`}
                  title="关闭 (Cmd+W)"
                >
                  ×
                </button>
              </div>
            </Fragment>
          );
        })}
        {dragGap === tabIds.length && placeholder}
      </div>

      {ghostTab &&
        dragPos &&
        createPortal(
          <div
            data-testid="tab-drag-ghost"
            className="fixed z-50 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shadow-lg"
            style={{
              left: dragPos.x + 8,
              top: dragPos.y + 8,
              pointerEvents: "none",
              background: "var(--app-surface)",
              borderColor: "var(--app-border)",
              color: "var(--app-text-2)",
            }}
          >
            <Icon
              name={iconOfType(ghostKind)}
              size={18}
              color={colorOfType(ghostKind)}
              className="mr-0.5"
            />
            <span className="max-w-44 truncate">{ghostTab.title}</span>
          </div>,
          document.body,
        )}

      {/* Context menu */}
      {menu && (
        <div
          data-tab-menu
          className="fixed z-50 w-[132px] rounded border py-1 text-xs shadow-lg"
          style={{
            left: menu.x,
            top: menu.y,
            background: "var(--app-surface)",
            borderColor: "var(--app-border)",
            color: "var(--app-text-2)",
          }}
        >
          <button
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!tabs[menu.tabId]?.path}
            title={
              tabs[menu.tabId]?.path
                ? "悬浮小窗"
                : "此页签尚未保存，无路径可预览"
            }
            onClick={() => {
              const tab = tabs[menu.tabId];
              const path = tab?.path;
              const el = stripRef.current?.querySelector<HTMLElement>(
                `[data-tab-id="${menu.tabId}"]`,
              );
              if (!path || !el) {
                closeMenu();
                return;
              }
              const rect = el.getBoundingClientRect();
              const w = 320;
              const h = 360;
              useStore.getState().openPreview({
                path,
                title: tab.title,
                x: Math.max(
                  8,
                  Math.min(rect.right + 12, window.innerWidth - w - 8),
                ),
                y: Math.max(8, Math.min(rect.top, window.innerHeight - h - 8)),
                w,
                h,
                flippedX: false,
                flippedY: false,
                source: "tab",
              });
              closeMenu();
            }}
          >
            <Icon name="pip" size={18} />
            悬浮小窗
          </button>
          <button
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)]"
            onClick={() => {
              // 右键分栏 = 把当前文件分到那边，而不是新建一个空栏（#272）。
              useStore.getState().splitPaneWithTab("row", menu.tabId);
              closeMenu();
            }}
          >
            <Icon name="splitRight" size={18} />
            向右分栏
          </button>
          <button
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)]"
            onClick={() => {
              useStore.getState().splitPaneWithTab("col", menu.tabId);
              closeMenu();
            }}
          >
            <Icon name="splitDown" size={18} />
            向下分栏
          </button>
          <div
            className="h-px my-1"
            style={{ background: "var(--app-border)" }}
          />
          <button
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!tabs[menu.tabId]?.path}
            title={
              tabs[menu.tabId]?.path
                ? "复制路径"
                : "此页签尚未保存，无路径可复制"
            }
            onClick={() => {
              const path = tabs[menu.tabId]?.path;
              if (!path) {
                closeMenu();
                return;
              }
              void navigator.clipboard.writeText(path).catch(() => undefined);
              closeMenu();
            }}
          >
            <Icon name="copyPath" size={18} />
            复制路径
          </button>
          <button
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!tabs[menu.tabId]?.path}
            title={
              tabs[menu.tabId]?.path ? "移动到…" : "此页签尚未保存，无法移动"
            }
            onClick={() => {
              const tab = tabs[menu.tabId];
              const path = tab?.path;
              closeMenu();
              if (!path) return;
              void (async () => {
                try {
                  const dir = await invoke<string>("pick_folder");
                  if (!dir) return;
                  const next = await invoke<string>("move_file", {
                    from: path,
                    toDir: dir,
                  });
                  useStore.getState().setTabPath(menu.tabId, next);
                } catch {
                  // 取消选择或移动失败：保持原路径不变
                }
              })();
            }}
          >
            <Icon name="locate" size={18} />
            移动到…
          </button>
          <button
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)]"
            onClick={() => {
              onCloseTab(menu.tabId);
              closeMenu();
            }}
          >
            <Icon name="close" size={18} />
            关闭
          </button>
          <button
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)]"
            onClick={() => {
              const ids = Object.keys(tabs).filter((id) => id !== menu.tabId);
              ids.forEach((id) => onCloseTab(id));
              closeMenu();
            }}
          >
            <Icon name="closeOthers" size={18} />
            关闭其他
          </button>
        </div>
      )}
    </>
  );
}
