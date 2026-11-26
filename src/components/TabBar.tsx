import { invoke } from "@tauri-apps/api/core";
import Icon from "./Icon";
import { colorOfType, fileTypeOf, iconOfType } from "../lib/fileType";
import { joinStemExt, splitStemExt } from "../lib/pathName";
import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  Fragment,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useStore } from "../stores";
import TabInfoPopover from "./TabInfoPopover";
import {
  isMediaMuted,
  subscribeMediaMute,
  toggleMediaMuted,
} from "./Content/mediaMute";
import { popOverlay, pushOverlay } from "../lib/overlayGate";
import { noticeDurationMs } from "../hooks/useConfig";
import { useEditorStore } from "../stores/editorStore";
import { useDocPropertyPanelStore } from "../stores/docPropertyPanel";
import { revealInFinder } from "../lib/finder";
import { runExportAction } from "../lib/exportActions";
import { printMarkdownPreview } from "../lib/printPreview";
import { flushTabContent } from "../editors/contentSync";
import { getMenuItems } from "../lib/dataSurfaces/store";
import type { ExportMenuAction } from "../lib/paneHeaderMenu";
import { menuShortcut } from "../lib/menu-shortcuts";
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

/** 页签右键菜单中依赖「页签已保存（有路径）」的动作。 */
const PATH_GATED = new Set([
  "previewTab",
  "export",
  "print",
  "copyPath",
  "reveal",
  "moveTo",
  "reload",
]);

/** 双击判定窗口（ms）：窗口内的第二记按下不启动窗口拖动。 */
const DOUBLE_CLICK_MS = 400;
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
      const { stem, ext } = splitStemExt(fallback);
      // 改名要回写 frontmatter 标题，先 flush 让 renameTab 读到 live 全文。
      flushTabContent(id);
      useStore
        .getState()
        .renameTab(id, joinStemExt(editValue.trim() || stem, ext));
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

  const blankDownRef = useRef<{ t: number; x: number; y: number } | null>(null);

  const [menu, setMenu] = useState<CtxMenu | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportCloseTimer = useRef<number | null>(null);
  const [submenuSide, setSubmenuSide] = useState<"left" | "right">("right");
  const [submenuAlignTop, setSubmenuAlignTop] = useState(true);
  const exportSubmenuRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  // 页签名信息窗：滑入满 260ms 弹出；指针移入信息窗则取消关闭计时。
  const [infoAnchor, setInfoAnchor] = useState<{
    tabId: string;
    rect: { left: number; bottom: number; width: number };
  } | null>(null);
  const infoTimer = useRef<number | null>(null);
  const clearInfoTimer = useCallback(() => {
    if (infoTimer.current !== null) {
      window.clearTimeout(infoTimer.current);
      infoTimer.current = null;
    }
  }, []);
  const closeInfo = useCallback(() => {
    clearInfoTimer();
    setInfoAnchor(null);
  }, [clearInfoTimer]);
  const scheduleInfoClose = useCallback(() => {
    clearInfoTimer();
    infoTimer.current = window.setTimeout(() => setInfoAnchor(null), 160);
  }, [clearInfoTimer]);
  const openInfo = useCallback(
    (e: ReactMouseEvent<HTMLElement>, id: string) => {
      // 拖拽中不弹：跟手 ghost 已占用指针，信息窗会干扰落点判断。
      if (dragRef.current || document.documentElement.dataset.tabDrag != null)
        return;
      if (!tabs[id]?.path) return;
      clearInfoTimer();
      const rect = e.currentTarget.getBoundingClientRect();
      infoTimer.current = window.setTimeout(() => {
        infoTimer.current = null;
        setInfoAnchor({
          tabId: id,
          rect: { left: rect.left, bottom: rect.bottom, width: rect.width },
        });
      }, noticeDurationMs(useEditorStore.getState().config.noticeDuration));
    },
    [clearInfoTimer, tabs],
  );

  useEffect(() => () => clearInfoTimer(), [clearInfoTimer]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setExportOpen(false);
      setMenu({ x: e.clientX, y: e.clientY, tabId });
    },
    [],
  );

  const closeMenu = useCallback(() => {
    if (exportCloseTimer.current !== null) {
      window.clearTimeout(exportCloseTimer.current);
      exportCloseTimer.current = null;
    }
    setMenu(null);
    setExportOpen(false);
  }, []);

  // 导出子菜单收起条件 = 指针离开「导出行 ∪ 二级面板」并集（#910）。
  // 二级是导出行 DOM 的后代（绝对定位），父级 pointerleave 即并集语义。
  const cancelExportClose = useCallback(() => {
    if (exportCloseTimer.current !== null) {
      window.clearTimeout(exportCloseTimer.current);
      exportCloseTimer.current = null;
    }
  }, []);
  const scheduleExportClose = useCallback(() => {
    cancelExportClose();
    exportCloseTimer.current = window.setTimeout(() => {
      exportCloseTimer.current = null;
      setExportOpen(false);
    }, 120);
  }, [cancelExportClose]);

  // 就地子菜单默认向右展开；右缘放不下则翻到左侧，下缘放不下则底对齐。
  useLayoutEffect(() => {
    if (!exportOpen) return;
    const sub = exportSubmenuRef.current;
    if (!sub) return;
    const rect = sub.getBoundingClientRect();
    const margin = 8;
    setSubmenuSide(rect.right > window.innerWidth - margin ? "left" : "right");
    setSubmenuAlignTop(rect.bottom <= window.innerHeight - margin);
  }, [exportOpen]);

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

  const tabMenuItems = getMenuItems("tab-context");
  const exportMenuItems = getMenuItems("export-submenu");

  const runTabAction = useCallback(
    (action: string) => {
      if (!menu) return false;
      const tab = tabs[menu.tabId];
      const path = tab?.path;
      switch (action) {
        case "previewTab": {
          if (!tab || !path) return false;
          const el = stripRef.current?.querySelector<HTMLElement>(
            `[data-tab-id="${menu.tabId}"]`,
          );
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const w = 320;
          const h = 360;
          useStore.getState().openPreview({
            path,
            title: tab.title,
            x: Math.max(8, Math.min(rect.right + 12, window.innerWidth - w - 8)),
            y: Math.max(8, Math.min(rect.top, window.innerHeight - h - 8)),
            w,
            h,
            flippedX: false,
            flippedY: false,
            source: "tab",
          });
          return true;
        }
        case "splitRight":
          useStore.getState().splitPaneWithTab("row", menu.tabId);
          return true;
        case "splitDown":
          useStore.getState().splitPaneWithTab("col", menu.tabId);
          return true;
        case "addField":
          useDocPropertyPanelStore.getState().requestPalette(menu.tabId);
          return true;
        case "print": {
          if (!tab) return false;
          flushTabContent(menu.tabId);
          printMarkdownPreview(
            { content: tab.content, path: tab.path },
            { paneId },
          );
          return true;
        }
        case "copyPath":
          if (path) {
            void navigator.clipboard.writeText(path).catch(() => undefined);
          }
          return true;
        case "reveal":
          if (path) revealInFinder(path);
          return true;
        case "moveTo": {
          if (!path) return false;
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
          return true;
        }
        case "reload": {
          if (!path || tab?.dirty) return false;
          void invoke<{ path: string; content: string }>("open_file_direct", {
            path,
          })
            .then((result) => {
              // 刷新以磁盘内容为准；先 flush 保证基准是 live 全文。
              flushTabContent(menu.tabId);
              useStore
                .getState()
                .refreshTabContent(menu.tabId, result.content, "external");
            })
            .catch(() => undefined);
          return true;
        }
        case "closeTab":
          onCloseTab(menu.tabId);
          return true;
        case "closeOthers":
          Object.keys(tabs)
            .filter((id) => id !== menu.tabId)
            .forEach((id) => onCloseTab(id));
          return true;
        default:
          return false;
      }
    },
    [menu, onCloseTab, paneId, tabs],
  );

  const kbd = (action: string) => (
    <span className="cm-menu-kbd">{menuShortcut(action)}</span>
  );

  return (
    <>
      <div
        ref={stripRef}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-tab-id], button, input"))
            return;
          // 双击空白是窗口级动作：进入/退出全屏，不再新建文档（D15 / #923）。
          if (!isTauriEnv()) return;
          void import("@tauri-apps/api/window")
            .then(async ({ getCurrentWindow }) => {
              const win = getCurrentWindow();
              await win.setFullscreen(!(await win.isFullscreen()));
            })
            .catch(() => {});
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          // 页签本体 / 按钮 / 输入框交给既有交互（切签、拖拽换位、关闭、重命名）；
          // 只有页签条空白处才允许拖窗。
          if ((e.target as HTMLElement).closest("[data-tab-id], button, input"))
            return;
          // 空白处只做窗口拖动：阻止冒泡到 PaneHeader 的栏目拖动（#922）。
          e.stopPropagation();
          if (!isTauriEnv()) return;
          // 双击的第二记不接管拖窗：startDragging 会把手势交给系统，dblclick 不再到达页面。
          const now = performance.now();
          const prev = blankDownRef.current;
          const isSecondOfDoubleClick =
            prev !== null &&
            now - prev.t <= DOUBLE_CLICK_MS &&
            Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <=
              DRAG_THRESHOLD_PX;
          blankDownRef.current = isSecondOfDoubleClick
            ? null
            : { t: now, x: e.clientX, y: e.clientY };
          if (isSecondOfDoubleClick) return;
          const startX = e.clientX;
          const startY = e.clientY;
          let started = false;
          const cleanup = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
          };
          function onMove(ev: PointerEvent) {
            if (started) return;
            // 未超阈值视为点击，不拖窗（AGENTS.md 拖拽阈值约定）。
            if (
              Math.hypot(ev.clientX - startX, ev.clientY - startY) <
              DRAG_THRESHOLD_PX
            )
              return;
            started = true;
            cleanup();
            // CRITICAL: 不要 await startDragging()——它阻塞拖拽发起，
            // Promise 在拖拽结束时才 resolve（同 CaptureOverlay）。
            void import("@tauri-apps/api/window")
              .then(({ getCurrentWindow }) =>
                getCurrentWindow().startDragging(),
              )
              .catch(() => {});
          }
          function onUp() {
            cleanup();
          }
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          window.addEventListener("pointercancel", onUp);
        }}
        className="tab-strip flex min-h-[26px] w-full min-w-0 items-center gap-8 select-none overflow-x-auto px-1"
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
                  closeInfo();
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
                  // 不伸展（flex: 0 1 auto）：宽度按内容自适应，上限 --tab-max-width。
                  // 保底 = min(96px, 内容宽)：短名按实际宽度，不被撑到 96px（G-6 / #1231）。
                  // min() 不接受 max-content 关键字（各引擎均丢弃），用 calc-size() 表达同一语义。
                  minWidth:
                    "calc-size(max-content, min(var(--tab-min-width), size))",
                  maxWidth: "var(--tab-max-width)",
                  ...(isDragged
                    ? {
                        opacity: 0.5,
                        outline: "2px dashed var(--app-accent)",
                        outlineOffset: 2,
                        zIndex: 1,
                      }
                    : null),
                }}
                aria-label={tab.title}
                onMouseEnter={(e) => openInfo(e, id)}
                onMouseLeave={scheduleInfoClose}
                onContextMenu={(e) => handleContextMenu(e, id)}
                onDoubleClick={(e) => {
                  if ((e.target as HTMLElement).closest("button, input"))
                    return;
                  setEditingId(id);
                  setEditValue(splitStemExt(tab.title).stem);
                }}
                className={`group flex min-w-0 flex-[0_1_auto] items-center gap-1.5 px-2.5 py-1 text-xs cursor-pointer transition-colors outline-none focus:outline-none focus-visible:outline-none ${
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
                  <span className="inline-flex min-w-0 items-center gap-0.5">
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
                    {splitStemExt(tab.title).ext && (
                      <span
                        data-testid="tab-ext"
                        className="select-none text-[var(--app-text-3)]"
                      >
                        {splitStemExt(tab.title).ext}
                      </span>
                    )}
                  </span>
                ) : (
                  <span
                    data-testid="tab-title"
                    className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    {tab.title}
                  </span>
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
                  className={`px-1 rounded shrink-0 transition-opacity ${
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
        <span
          aria-hidden
          data-testid="tab-strip-tail"
          className="h-full shrink-0"
          style={{ width: "var(--tab-strip-tail)" }}
        />
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
            <span className="min-w-0 max-w-44 break-words line-clamp-2">
              {ghostTab.title}
            </span>
          </div>,
          document.body,
        )}

      {infoAnchor && tabs[infoAnchor.tabId] && (
        <TabInfoPopover
          tab={tabs[infoAnchor.tabId]}
          anchor={infoAnchor.rect}
          onKeepOpen={clearInfoTimer}
          onClose={closeInfo}
        />
      )}

      {/* Context menu：项集合 / 顺序 / 启停 / 文案均来自菜单面（tab-context 组），
          代码只按 action 分派动作（D2 混合面）。分隔线位置由数据顺序决定。 */}
      {menu && (
        <div
          data-tab-menu
          className="tab-context-menu fixed z-50 w-[132px] border py-1 text-xs shadow-lg"
          style={{
            left: menu.x,
            top: menu.y,
            background: "var(--app-surface)",
            borderColor: "var(--app-border)",
            color: "var(--app-text-2)",
          }}
        >
          {tabMenuItems.map((item) => {
            if (item.action === "export") {
              return (
                <div
                  key={item.id}
                  data-export-row
                  className="relative"
                  onPointerEnter={cancelExportClose}
                  onPointerLeave={scheduleExportClose}
                >
                  <button
                    data-menu-item="export"
                    aria-haspopup="menu"
                    aria-expanded={exportOpen}
                    className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!tabs[menu.tabId]?.path}
                    title={
                      tabs[menu.tabId]?.path
                        ? item.label
                        : "此页签尚未保存，无路径可导出"
                    }
                    onMouseEnter={() => setExportOpen(true)}
                    onClick={() => setExportOpen(true)}
                  >
                    <Icon name={item.icon} size={18} />
                    {item.label}
                    {kbd(item.action)}
                    <span
                      className="ml-auto h-0 w-0 border-y-4 border-l-4 border-y-transparent border-l-[var(--app-text-3)]"
                      aria-hidden="true"
                    />
                  </button>
                  {exportOpen && (
                    <div
                      data-testid="pane-export-submenu"
                      role="menu"
                      ref={exportSubmenuRef}
                      className="tab-context-menu absolute min-w-[132px] border py-1 text-xs shadow-lg"
                      style={{
                        ...(submenuSide === "left"
                          ? { right: "100%", marginRight: 1 }
                          : { left: "100%", marginLeft: 1 }),
                        ...(submenuAlignTop ? { top: 0 } : { bottom: 0 }),
                        background: "var(--app-surface)",
                        borderColor: "var(--app-border)",
                        color: "var(--app-text-2)",
                      }}
                    >
                      {exportMenuItems.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          role="menuitem"
                          data-export-item={sub.action}
                          onClick={() => {
                            flushTabContent(menu.tabId);
                            const tab = useStore.getState().tabs[menu.tabId];
                            if (!tab) return;
                            void runExportAction(
                              sub.action as ExportMenuAction,
                              {
                                title: tab.title,
                                content: tab.content,
                                path: tab.path,
                              },
                              showNotice,
                            );
                            closeMenu();
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Icon name={sub.icon} size={18} />
                          <span>{sub.label}</span>
                          {kbd(sub.action)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            const needsPath = PATH_GATED.has(item.action);
            const showDivider = item.action === "addField";
            return (
              <Fragment key={item.id}>
                {showDivider && (
                  <div
                    className="h-px my-1"
                    style={{ background: "var(--app-border)" }}
                  />
                )}
                <button
                  data-menu-item={item.action}
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[var(--app-sunken)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={needsPath && !tabs[menu.tabId]?.path}
                  title={needsPath && !tabs[menu.tabId]?.path
                    ? "此页签尚未保存，无路径可用"
                    : item.label}
                  onClick={() => {
                    if (runTabAction(item.action)) closeMenu();
                  }}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                  {kbd(item.action)}
                </button>
              </Fragment>
            );
          })}
        </div>
      )}

      {notice && (
        <div
          role="status"
          data-export-notice
          className="fixed bottom-6 left-1/2 z-[2147483000] -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-700/95"
        >
          {notice}
        </div>
      )}
    </>
  );
}
