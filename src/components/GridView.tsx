import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { useStore } from "../stores";
import { colorOfType, fileTypeOf, iconOfType } from "../lib/fileType";
import { isUnread } from "../lib/aiViewSpec";
import { parentPathOf, readPercentOf, relativeDate } from "../lib/railCards";
import { revealInFinder } from "../lib/finder";
import { fileDragHandlers } from "../hooks/fileDrag";
import {
  filterGridItems,
  groupGridItems,
  sortGridItems,
  tileSizeOf,
} from "../lib/gridView";
import {
  digitFromCode,
  moveHorizontal,
  moveVertical,
  pageStep,
  sequenceOfVisible,
  type GridBox,
  type GridViewport,
} from "../lib/gridKeyboard";
import {
  PREVIEW_DEFAULT_H,
  PREVIEW_DEFAULT_W,
  anchorFromGrid,
  clampPreviewSize,
  gridTriggerOf,
} from "../lib/previewAnchor";
import GridToolbar from "./Grid/GridToolbar";
import GridTile from "./Grid/GridTile";
import type { RecentFile } from "../types";

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

/**
 * 网格概览（layout-portal 10.1）。⌘⇧\ 打开：不聚焦搜索、默认选中第一张卡；
 * 顶部单行全下拉；tile 三型（大 2×2 仅置顶/继续阅读）；时间粘性分组头；
 * 点击档经 8.1 悬浮预览窗贴卡右缘 +12 弹出真内容。
 */
export default function GridView({
  onOpenPath,
}: {
  onOpenPath: (path: string) => void | Promise<void>;
}) {
  const filter = useStore((s) => s.gridTypeFilter);
  const query = useStore((s) => s.gridQuery);
  const sort = useStore((s) => s.gridSort);
  const group = useStore((s) => s.gridGroup);
  const pinnedOnly = useStore((s) => s.gridPinnedOnly);
  const pinnedPaths = useStore((s) => s.pinnedPaths);
  const selectedPath = useStore((s) => s.gridSelectedPath);
  const recentFiles = useStore((s) => s.recentFiles);
  const scrollPositions = useStore((s) => s.scrollPositions);
  const viewSpec = useStore((s) => s.viewSpec);

  const setGridSelectedPath = useStore((s) => s.setGridSelectedPath);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const sequenceRef = useRef<string[]>([]);
  const metaHeldRef = useRef(false);
  const [sequence, setSequence] = useState<string[]>([]);
  const [metaHeld, setMetaHeld] = useState(false);

  const filtered = useMemo(() => {
    const list = filterGridItems(recentFiles, {
      type: filter,
      query,
      pinnedOnly,
      pinnedPaths,
    });
    return viewSpec.unreadOnly
      ? list.filter((f) => isUnread(f.path, scrollPositions))
      : list;
  }, [
    recentFiles,
    filter,
    query,
    pinnedOnly,
    pinnedPaths,
    viewSpec.unreadOnly,
    scrollPositions,
  ]);

  const sorted = useMemo(() => sortGridItems(filtered, sort), [filtered, sort]);
  const groups = useMemo(() => groupGridItems(sorted, group), [sorted, group]);
  const visible = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const continuePath = recentFiles[0]?.path ?? null;
  const listMode = viewSpec.gridMode === "list";

  // 进入即选中第一张卡：不聚焦搜索框，只在当前选中不在列表里时兜底重选
  useEffect(() => {
    if (visible.length === 0) {
      if (selectedPath !== null) setGridSelectedPath(null);
      return;
    }
    if (!selectedPath || !visible.some((v) => v.path === selectedPath)) {
      setGridSelectedPath(visible[0].path);
    }
  }, [visible, selectedPath, setGridSelectedPath]);

  const readPercentFor = useCallback(
    (path: string): number | undefined => readPercentOf(scrollPositions[path]),
    [scrollPositions],
  );

  const splitItem = useCallback(
    (path: string, dir: "row" | "col") => {
      const store = useStore.getState();
      const existing = Object.values(store.tabs).find((t) => t.path === path);
      if (existing) {
        store.switchTab(existing.id);
        useStore.getState().splitPane(dir);
        const targetId = useStore.getState().focusedPaneId;
        useStore.getState().moveTabToPane(existing.id, targetId);
        return;
      }
      useStore.getState().splitPane(dir);
      void Promise.resolve(onOpenPath(path));
    },
    [onOpenPath],
  );

  const readBoxes = useCallback((): GridBox[] => {
    const el = scrollRef.current;
    if (!el) return [];
    const boxes: GridBox[] = [];
    for (const node of Array.from(
      el.querySelectorAll<HTMLElement>("[data-grid-item]"),
    )) {
      const path = node.getAttribute("data-grid-item");
      if (!path) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      boxes.push({
        path,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      });
    }
    return boxes;
  }, []);

  const computeSequence = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      sequenceRef.current = [];
      setSequence([]);
      return;
    }
    const rect = el.getBoundingClientRect();
    const viewport: GridViewport = {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
    };
    const next = sequenceOfVisible(readBoxes(), viewport, 9);
    sequenceRef.current = next;
    setSequence(next);
  }, [readBoxes]);

  const scheduleRecompute = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      computeSequence();
    });
  }, [computeSequence]);

  const locateInRail = useCallback((path: string) => {
    const st = useStore.getState();
    st.setScene("workspace");
    if (st.railState === "collapsed") st.setRailState("hover");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("rail-locate", { detail: path }));
    }, 0);
  }, []);

  const openCardPreview = useCallback((item: RecentFile, el: HTMLElement) => {
    const st = useStore.getState();
    const trigger = gridTriggerOf(st.previewSettings.gridMode);
    if (!st.previewSettings.enabled || !trigger.onClick) return false;
    const rect = el.getBoundingClientRect();
    const size = clampPreviewSize({
      w: PREVIEW_DEFAULT_W,
      h: PREVIEW_DEFAULT_H,
    });
    const anchor = anchorFromGrid({
      cardRightX: rect.right,
      cardTopY: rect.top,
      size,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    st.openPreview({
      path: item.path,
      title: item.title,
      x: anchor.x,
      y: anchor.y,
      w: size.w,
      h: size.h,
      flippedX: anchor.flipped.x,
      flippedY: anchor.flipped.y,
      source: "grid",
    });
    return true;
  }, []);

  const openItem = useCallback(
    (path: string) => {
      const tabs = useStore.getState().tabs;
      const tab = Object.values(tabs).find((t) => t.path === path);
      if (tab) {
        useStore.getState().switchTab(tab.id);
        useStore.getState().setScene("workspace");
      } else {
        void onOpenPath(path);
      }
    },
    [onOpenPath],
  );

  const onCardClick = useCallback(
    (item: RecentFile, el: HTMLElement) => {
      useStore.getState().setGridSelectedPath(item.path);
      if (openCardPreview(item, el)) return;
      openItem(item.path);
    },
    [openCardPreview, openItem],
  );

  const onTileHoverEnter = useCallback(
    (item: RecentFile, el: HTMLElement) => {
      const st = useStore.getState();
      if (!st.previewSettings.enabled) return;
      if (!gridTriggerOf(st.previewSettings.gridMode).onHover) return;
      openCardPreview(item, el);
    },
    [openCardPreview],
  );

  // Esc：先关预览，再清搜索，最后退回门户
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      const st = useStore.getState();
      if (st.preview) {
        st.closePreview();
        return;
      }
      if (st.gridQuery !== "") {
        st.setGridQuery("");
        return;
      }
      st.setGridTypeFilter(null);
      st.setGridSelectedPath(null);
      st.setScene("portal");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 按住 ⌘/Ctrl 显示视口编号；滚动 / 窗口失焦时重算或清除
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const clearSequence = () => {
      metaHeldRef.current = false;
      setMetaHeld(false);
      sequenceRef.current = [];
      setSequence([]);
    };
    const onScroll = () => {
      if (metaHeldRef.current) scheduleRecompute();
    };
    const onMetaDown = (e: KeyboardEvent) => {
      if (e.key !== "Meta" && e.key !== "Control") return;
      if (isEditableTarget(e.target)) return;
      metaHeldRef.current = true;
      setMetaHeld(true);
      computeSequence();
    };
    const onMetaUp = (e: KeyboardEvent) => {
      if (e.key !== "Meta" && e.key !== "Control") return;
      clearSequence();
    };
    const onBlur = () => clearSequence();
    const onResize = () => {
      if (metaHeldRef.current) scheduleRecompute();
    };

    el.addEventListener("scroll", onScroll);
    window.addEventListener("keydown", onMetaDown);
    window.addEventListener("keyup", onMetaUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onMetaDown);
      window.removeEventListener("keyup", onMetaUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [computeSequence, scheduleRecompute]);

  // 筛选 / 排序 / 分组 / 模式变化后重算编号（rAF 节流）
  useEffect(() => {
    if (metaHeldRef.current) scheduleRecompute();
  }, [visible, listMode, scheduleRecompute]);

  // 键盘导航：j/k/h/l、Home/End、整页、Enter 系、数字直开、Tab 切筛选
  useEffect(() => {
    const pageScroll = (dir: 1 | -1) => {
      const el = scrollRef.current;
      if (!el) return;
      const step = pageStep(el.clientHeight);
      const max = el.scrollHeight - el.clientHeight;
      const next = dir === 1 ? el.scrollTop + step : el.scrollTop - step;
      el.scrollTop = Math.max(0, Math.min(max, next));
      if (metaHeldRef.current) scheduleRecompute();
    };

    const scrollSelectedIntoView = (path: string) => {
      const el = scrollRef.current;
      if (!el) return;
      const node = el.querySelector<HTMLElement>(
        `[data-grid-item="${CSS.escape(path)}"]`,
      );
      node?.scrollIntoView({ block: "nearest" });
    };

    const moveSelection = (key: "j" | "k" | "h" | "l") => {
      const boxes = readBoxes();
      if (boxes.length === 0) return;
      const current = useStore.getState().gridSelectedPath;
      if (!current) return;
      const next =
        key === "j"
          ? moveVertical(boxes, current, 1)
          : key === "k"
            ? moveVertical(boxes, current, -1)
            : key === "h"
              ? moveHorizontal(boxes, current, -1)
              : moveHorizontal(boxes, current, 1);
      if (!next) return;
      useStore.getState().setGridSelectedPath(next);
      requestAnimationFrame(() => scrollSelectedIntoView(next));
    };

    const jumpToEdge = (edge: "start" | "end") => {
      const boxes = readBoxes();
      if (boxes.length === 0) return;
      // Home/End 按视觉阅读顺序（先上后左）取首尾，而非 DOM 顺序
      const sorted = [...boxes].sort(
        (a, b) => a.top - b.top || a.left - b.left,
      );
      const next =
        edge === "start" ? sorted[0].path : sorted[sorted.length - 1].path;
      useStore.getState().setGridSelectedPath(next);
      requestAnimationFrame(() => scrollSelectedIntoView(next));
    };

    const cycleFilterControl = (dir: 1 | -1) => {
      const el = scrollRef.current;
      if (!el) return;
      const controls = [
        el.querySelector<HTMLElement>("[data-grid-search]"),
        el.querySelector<HTMLElement>("[data-grid-type-select]"),
        el.querySelector<HTMLElement>("[data-grid-sort-select]"),
        el.querySelector<HTMLElement>("[data-grid-group-select]"),
        el.querySelector<HTMLElement>("[data-grid-pinned-select]"),
      ].filter((c): c is HTMLElement => c !== null);
      if (controls.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const index = active ? controls.indexOf(active) : -1;
      const next =
        index === -1
          ? dir === 1
            ? 0
            : controls.length - 1
          : (index + dir + controls.length) % controls.length;
      controls[next].focus();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      const meta = e.metaKey || e.ctrlKey;
      const typing = isEditableTarget(e.target);

      if (e.key === "Meta" || e.key === "Control") return;

      if (meta) {
        const digit = digitFromCode(e.code);
        if (digit !== null) {
          if (typing) return;
          e.preventDefault();
          computeSequence();
          const path = sequenceRef.current[digit - 1];
          if (!path) return;
          if (e.altKey) splitItem(path, "col");
          else if (e.shiftKey) splitItem(path, "row");
          else openItem(path);
          return;
        }
      }

      if (typing) {
        if (e.key === "PageDown" || e.key === "PageUp") {
          e.preventDefault();
          pageScroll(e.key === "PageDown" ? 1 : -1);
        }
        return;
      }

      switch (e.key) {
        case "j":
        case "k":
        case "h":
        case "l": {
          if (meta || e.altKey) return;
          e.preventDefault();
          moveSelection(e.key);
          return;
        }
        case "Home":
        case "End": {
          if (meta || e.altKey) return;
          e.preventDefault();
          jumpToEdge(e.key === "Home" ? "start" : "end");
          return;
        }
        case "PageDown":
        case "PageUp": {
          if (e.altKey) return;
          e.preventDefault();
          pageScroll(e.key === "PageDown" ? 1 : -1);
          return;
        }
        case "Enter": {
          if (e.altKey) return;
          const path = useStore.getState().gridSelectedPath;
          if (!path) return;
          e.preventDefault();
          if (meta) splitItem(path, "row");
          else if (e.shiftKey) locateInRail(path);
          else openItem(path);
          return;
        }
        case "Tab": {
          if (meta || e.altKey) return;
          e.preventDefault();
          cycleFilterControl(e.shiftKey ? -1 : 1);
          return;
        }
        default:
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    computeSequence,
    scheduleRecompute,
    readBoxes,
    openItem,
    splitItem,
    locateInRail,
  ]);

  const numberFor = (path: string): number | undefined => {
    if (!metaHeld) return undefined;
    const index = sequence.indexOf(path);
    return index >= 0 ? index + 1 : undefined;
  };

  const renderTile = (item: RecentFile) => {
    const pinned = pinnedPaths.includes(item.path);
    const size = tileSizeOf(item, { pinned, continuePath });
    return (
      <GridTile
        key={item.path}
        item={item}
        size={size}
        selected={selectedPath === item.path}
        pinned={pinned}
        blockColors={viewSpec.blockColors}
        readPercent={readPercentFor(item.path)}
        number={numberFor(item.path)}
        onCardClick={onCardClick}
        onOpen={openItem}
        onSplit={splitItem}
        onReveal={revealInFinder}
        onHoverEnter={onTileHoverEnter}
      />
    );
  };

  const renderRow = (item: RecentFile) => {
    const kind = fileTypeOf(item.path);
    const number = numberFor(item.path);
    return (
      <button
        key={item.path}
        type="button"
        {...fileDragHandlers(item.path)}
        data-grid-item={item.path}
        data-tile-size="row"
        data-selected={selectedPath === item.path ? "true" : "false"}
        onClick={(e) => onCardClick(item, e.currentTarget)}
        className="flex w-full items-center gap-2 rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        {number !== undefined && (
          <span
            data-grid-number={number}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent)] text-[11px] font-semibold leading-none text-white"
          >
            {number}
          </span>
        )}
        <Icon
          name={iconOfType(kind)}
          size={18}
          color={viewSpec.blockColors ? colorOfType(kind) : undefined}
        />
        <span className="truncate text-sm text-gray-900 dark:text-gray-100">
          {item.title}
        </span>
        <span className="ml-auto shrink-0 truncate text-xs text-gray-400 dark:text-gray-500">
          {parentPathOf(item.path)} · {relativeDate(item.openedAt)}
        </span>
      </button>
    );
  };

  return (
    <div
      ref={scrollRef}
      data-testid="grid"
      data-grid-filter={filter ?? "all"}
      data-grid-mode={viewSpec.gridMode}
      data-grid-grouping={group}
      className="h-full overflow-auto bg-white dark:bg-gray-900"
    >
      <GridToolbar count={filtered.length} />

      {visible.length === 0 ? (
        <p data-testid="grid-empty" className="p-8 text-sm text-gray-400">
          该条件下还没有文件。
        </p>
      ) : (
        <div className="space-y-4 p-4">
          {groups.map((g) => (
            <section key={g.key} data-grid-group={g.key}>
              {g.label !== "" && (
                <h2
                  data-grid-group-head
                  className="sticky top-0 z-10 mb-2 bg-white px-1 py-1.5 text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  {g.label}
                </h2>
              )}
              {listMode ? (
                <div className="flex flex-col gap-2">
                  {g.items.map(renderRow)}
                </div>
              ) : (
                <div
                  data-grid-grid
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gridAutoRows: "168px",
                    gridAutoFlow: "dense",
                    gap: "12px",
                  }}
                >
                  {g.items.map(renderTile)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
