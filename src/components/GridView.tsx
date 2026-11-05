import { useEffect, useMemo } from "react";
import Icon from "./Icon";
import { useStore } from "../stores/index";
import { TYPE_COLORS, fileTypeOf, iconOfType } from "../lib/fileType";
import type { FileTypeKind } from "../lib/fileType";
import { RAIL_KIND_LABELS } from "../lib/railView";
import { isUnread, type ViewSpec } from "../lib/aiViewSpec";
import { parentPathOf } from "../lib/railCards";
import { fileDragHandlers } from "../hooks/fileDrag";
import type { RecentFile } from "../types";

interface GridGroup {
  key: string;
  label: string;
  items: RecentFile[];
}

/** 按规格把条目分组；themeGroups 用父目录作「主题」，其余按类型或不分组。 */
function groupItems(items: RecentFile[], spec: ViewSpec): GridGroup[] {
  if (!spec.themeGroups && spec.gridGrouping !== "type") {
    return [{ key: "all", label: "", items }];
  }
  const map = new Map<string, GridGroup>();
  for (const item of items) {
    const key = spec.themeGroups
      ? parentPathOf(item.path) || "/"
      : fileTypeOf(item.path);
    const label = spec.themeGroups
      ? key
      : RAIL_KIND_LABELS[key as FileTypeKind];
    const group = map.get(key);
    if (group) group.items.push(item);
    else map.set(key, { key, label, items: [item] });
  }
  return [...map.values()];
}

/**
 * 网格场景（layout-portal 2.1 接入；9.1 起由 AI 视图规格驱动排布/分组/未读/
 * 图标配色）。默认规格下渲染与既有形态逐像素一致。
 */
export default function GridView({
  onOpenPath,
}: {
  onOpenPath: (path: string) => void | Promise<void>;
}) {
  const filter = useStore((s) => s.gridTypeFilter);
  const recentFiles = useStore((s) => s.recentFiles);
  const scrollPositions = useStore((s) => s.scrollPositions);
  const viewSpec = useStore((s) => s.viewSpec);
  const setScene = useStore((s) => s.setScene);
  const setFilter = useStore((s) => s.setGridTypeFilter);

  const items = useMemo(() => {
    let list = filter
      ? recentFiles.filter((f) => fileTypeOf(f.path) === filter)
      : recentFiles;
    if (viewSpec.unreadOnly) {
      list = list.filter((f) => isUnread(f.path, scrollPositions));
    }
    return list;
  }, [filter, recentFiles, viewSpec.unreadOnly, scrollPositions]);

  const groups = useMemo(() => groupItems(items, viewSpec), [items, viewSpec]);
  const grouping = viewSpec.themeGroups
    ? "theme"
    : viewSpec.gridGrouping === "type"
      ? "type"
      : "none";
  const listMode = viewSpec.gridMode === "list";

  const back = () => {
    setFilter(null);
    setScene("portal");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setFilter, setScene]);

  const openItem = (path: string) => {
    const tabs = useStore.getState().tabs;
    const tab = Object.values(tabs).find((t) => t.path === path);
    if (tab) {
      useStore.getState().switchTab(tab.id);
      useStore.getState().setScene("workspace");
    } else {
      void onOpenPath(path);
    }
  };

  const renderCard = (f: RecentFile) => {
    const kind = fileTypeOf(f.path);
    return (
      <button
        key={f.path}
        data-grid-item={f.path}
        {...fileDragHandlers(f.path)}
        onClick={() => openItem(f.path)}
        className="rounded border border-gray-200 p-3 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        <div className="mb-1 flex items-center gap-2">
          <Icon
            name={iconOfType(kind)}
            size={18}
            color={viewSpec.blockColors ? TYPE_COLORS[kind] : undefined}
          />
          <span className="truncate text-sm text-gray-900 dark:text-gray-100">
            {f.title}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
          {f.excerpt || "（还没有内容）"}
        </p>
      </button>
    );
  };

  const renderRow = (f: RecentFile) => {
    const kind = fileTypeOf(f.path);
    return (
      <button
        key={f.path}
        data-grid-item={f.path}
        {...fileDragHandlers(f.path)}
        onClick={() => openItem(f.path)}
        className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        <Icon
          name={iconOfType(kind)}
          size={18}
          color={viewSpec.blockColors ? TYPE_COLORS[kind] : undefined}
        />
        <span className="truncate text-sm text-gray-900 dark:text-gray-100">
          {f.title}
        </span>
        <span className="ml-auto truncate text-xs text-gray-500 dark:text-gray-400">
          {f.excerpt || "（还没有内容）"}
        </span>
      </button>
    );
  };

  return (
    <div
      data-testid="grid"
      data-grid-filter={filter ?? "all"}
      data-grid-mode={viewSpec.gridMode}
      data-grid-grouping={grouping}
      className="h-full overflow-auto bg-white p-8 dark:bg-gray-900"
    >
      <header className="mb-6 flex items-center gap-3">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {filter ? `${filter} 文件` : "全部文件"}
        </h1>
        <span className="text-xs text-gray-400" data-testid="grid-count">
          {items.length} 项
        </span>
        <button
          onClick={back}
          className="ml-auto rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          返回门户 (Esc)
        </button>
      </header>

      {items.length === 0 ? (
        <p data-testid="grid-empty" className="text-sm text-gray-400">
          该类型下还没有文件。
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} data-grid-group={group.key}>
              {grouping !== "none" && (
                <h2 className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {group.label}
                </h2>
              )}
              <div
                className={
                  listMode
                    ? "flex flex-col gap-3"
                    : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                }
              >
                {group.items.map(listMode ? renderRow : renderCard)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
