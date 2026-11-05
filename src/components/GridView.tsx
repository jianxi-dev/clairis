import { useCallback, useEffect, useMemo } from "react";
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
  PREVIEW_DEFAULT_H,
  PREVIEW_DEFAULT_W,
  anchorFromGrid,
  clampPreviewSize,
  gridTriggerOf,
} from "../lib/previewAnchor";
import GridToolbar from "./Grid/GridToolbar";
import GridTile from "./Grid/GridTile";
import type { RecentFile } from "../types";

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
      useStore.getState().splitPane(dir);
      void Promise.resolve(onOpenPath(path));
    },
    [onOpenPath],
  );

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
