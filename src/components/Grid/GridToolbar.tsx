import { useEffect, useLayoutEffect, useRef } from "react";
import Icon from "../Icon";
import { useStore } from "../../stores";
import { RAIL_KIND_LABELS, RAIL_KIND_ORDER } from "../../lib/railView";
import {
  GRID_GROUP_LABELS,
  GRID_SORT_LABELS,
  type GridGroupMode,
  type GridSort,
} from "../../lib/gridView";
import type { FileTypeKind } from "../../lib/fileType";

const SORT_ORDER: readonly GridSort[] = ["recent", "name", "type"];
const GROUP_ORDER: readonly GridGroupMode[] = ["time", "type", "theme", "none"];

/**
 * 网格顶部单行工具条（layout-portal 10.1）。
 *
 * 类型 / 排序 / 分组三控件恒为原生 `<select>`（下拉，禁止点击循环）；网格/列表是
 * 两个各自定值的按钮；置顶是布尔开关。`/` 聚焦搜索，`×` 清空。
 */
export default function GridToolbar({ count }: { count: number }) {
  const filter = useStore((s) => s.gridTypeFilter);
  const sort = useStore((s) => s.gridSort);
  const group = useStore((s) => s.gridGroup);
  const pinnedOnly = useStore((s) => s.gridPinnedOnly);
  const query = useStore((s) => s.gridQuery);
  const gridMode = useStore((s) => s.viewSpec.gridMode);

  const setFilter = useStore((s) => s.setGridTypeFilter);
  const setSort = useStore((s) => s.setGridSort);
  const setGroup = useStore((s) => s.setGridGroup);
  const setPinnedOnly = useStore((s) => s.setGridPinnedOnly);
  const setQuery = useStore((s) => s.setGridQuery);
  const applyViewSpec = useStore((s) => s.applyViewSpec);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useLayoutEffect(() => {
    const onFocusSearch = () => inputRef.current?.focus();
    window.addEventListener("grid-focus-search", onFocusSearch);
    return () => window.removeEventListener("grid-focus-search", onFocusSearch);
  }, []);

  return (
    <div
      data-testid="grid-toolbar"
      className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-gray-200 px-4 py-2 dark:border-gray-700"
    >
      <div className="flex shrink-0 items-center gap-1 rounded border border-gray-200 px-2 py-0.5 dark:border-gray-700">
        <Icon name="search" size={18} color="var(--app-text-3)" />
        <input
          ref={inputRef}
          data-grid-search
          data-testid="grid-search"
          value={query}
          placeholder="搜索文件（/）"
          aria-label="搜索文件"
          onChange={(e) => setQuery(e.target.value)}
          className="w-40 min-w-0 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
        />
        {query !== "" && (
          <button
            type="button"
            data-grid-search-clear
            data-testid="grid-search-clear"
            aria-label="清除搜索"
            title="清除搜索"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      <select
        data-grid-type-select
        data-testid="grid-type-select"
        aria-label="类型筛选"
        value={filter ?? "all"}
        onChange={(e) =>
          setFilter(
            e.target.value === "all" ? null : (e.target.value as FileTypeKind),
          )
        }
        className="shrink-0 rounded border border-gray-200 bg-transparent px-1.5 py-0.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-200"
      >
        <option value="all">全部类型</option>
        {RAIL_KIND_ORDER.map((kind) => (
          <option key={kind} value={kind}>
            {RAIL_KIND_LABELS[kind]}
          </option>
        ))}
      </select>

      <select
        data-grid-sort-select
        data-testid="grid-sort-select"
        aria-label="排序"
        value={sort}
        onChange={(e) => setSort(e.target.value as GridSort)}
        className="shrink-0 rounded border border-gray-200 bg-transparent px-1.5 py-0.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-200"
      >
        {SORT_ORDER.map((s) => (
          <option key={s} value={s}>
            {GRID_SORT_LABELS[s]}
          </option>
        ))}
      </select>

      <select
        data-grid-group-select
        data-testid="grid-group-select"
        aria-label="分组"
        value={group}
        onChange={(e) => setGroup(e.target.value as GridGroupMode)}
        className="shrink-0 rounded border border-gray-200 bg-transparent px-1.5 py-0.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-200"
      >
        {GROUP_ORDER.map((g) => (
          <option key={g} value={g}>
            {GRID_GROUP_LABELS[g]}
          </option>
        ))}
      </select>

      <div
        data-grid-mode-toggle
        data-testid="grid-mode-toggle"
        className="flex shrink-0 items-center rounded border border-gray-200 dark:border-gray-700"
      >
        <button
          type="button"
          data-grid-mode="grid"
          data-active={gridMode === "grid" ? "true" : "false"}
          aria-pressed={gridMode === "grid"}
          onClick={() => applyViewSpec({ gridMode: "grid" })}
          className={`px-2 py-0.5 text-xs ${
            gridMode === "grid"
              ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
              : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          网格
        </button>
        <button
          type="button"
          data-grid-mode="list"
          data-active={gridMode === "list" ? "true" : "false"}
          aria-pressed={gridMode === "list"}
          onClick={() => applyViewSpec({ gridMode: "list" })}
          className={`px-2 py-0.5 text-xs ${
            gridMode === "list"
              ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
              : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          列表
        </button>
      </div>

      <select
        data-grid-pinned-select
        data-testid="grid-pinned-select"
        aria-label="置顶筛选"
        value={pinnedOnly ? "pinned" : "all"}
        onChange={(e) => setPinnedOnly(e.target.value === "pinned")}
        className="shrink-0 rounded border border-gray-200 bg-transparent px-1.5 py-0.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-200"
      >
        <option value="all">全部</option>
        <option value="pinned">仅置顶</option>
      </select>

      <span
        data-grid-count
        data-testid="grid-count"
        className="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500"
      >
        {count} 项
      </span>
    </div>
  );
}
