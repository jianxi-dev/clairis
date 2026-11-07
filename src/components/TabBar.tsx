import Icon from "./Icon";
import { colorOfType, fileTypeOf, iconOfType } from "../lib/fileType";
import { useState, useCallback, useEffect, useRef, Fragment } from "react";
import { useStore } from "../stores";
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

export default function TabBar({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onReorderTabs,
  paneId,
  onMoveToPane,
  alwaysShowClose,
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
        setDragFrom(drag.from);
      }
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

  // Close menu on any click outside the menu itself
  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the context menu
      if (target.closest(".fixed.z-50")) return;
      setMenu(null);
    };
    // Delay adding listener so the current right-click doesn't close it
    const id = setTimeout(() => {
      window.addEventListener("click", handler, true);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("click", handler, true);
    };
  }, [menu]);

  if (tabIds.length === 0) return null;

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

  return (
    <>
      <div
        ref={stripRef}
        className="flex items-center gap-1 shrink-0 select-none overflow-x-auto px-1"
        style={{
          borderBottom: "1px solid var(--app-border)",
          background: "var(--app-surface)",
        }}
      >
        {tabIds.map((id, index) => {
          const tab = tabs[id];
          const isActive = id === activeTabId;
          const typeColor = colorOfType(fileTypeOf(tab.path));
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
                        if ((e.target as HTMLElement).closest("button")) return;
                        suppressClickRef.current = false;
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
                data-tab-color={typeColor}
                style={{
                  borderRight: "1px solid var(--app-border)",
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
                className={`group flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs cursor-pointer transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-[var(--app-accent-soft)] font-medium text-[var(--app-accent)] shadow-sm"
                    : "bg-[var(--app-sunken)] text-[var(--app-text-2)] hover:brightness-[0.98]"
                }`}
              >
                <Icon
                  name={iconOfType(fileTypeOf(tab.path))}
                  size={18}
                  color={typeColor}
                  className="mr-0.5"
                />
                <span className="max-w-44 truncate">{tab.title}</span>
                {tab.dirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
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
            className="w-full text-left px-3 py-1.5 hover:bg-[var(--app-sunken)]"
            onClick={() => {
              // 右键分栏 = 把当前文件分到那边，而不是新建一个空栏（#272）。
              useStore.getState().splitPaneWithTab("row", menu.tabId);
              closeMenu();
            }}
          >
            向右分栏
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-[var(--app-sunken)]"
            onClick={() => {
              useStore.getState().splitPaneWithTab("col", menu.tabId);
              closeMenu();
            }}
          >
            向下分栏
          </button>
          <div
            className="h-px my-1"
            style={{ background: "var(--app-border)" }}
          />
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-[var(--app-sunken)]"
            onClick={() => {
              onCloseTab(menu.tabId);
              closeMenu();
            }}
          >
            关闭
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-[var(--app-sunken)]"
            onClick={() => {
              const ids = Object.keys(tabs).filter((id) => id !== menu.tabId);
              ids.forEach((id) => onCloseTab(id));
              closeMenu();
            }}
          >
            关闭其他
          </button>
        </div>
      )}
    </>
  );
}
