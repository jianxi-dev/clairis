import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
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

const TYPE_OPTIONS: ReadonlyArray<{
  kind: "all" | FileTypeKind;
  label: string;
}> = [
  { kind: "all", label: "全部类型" },
  ...RAIL_KIND_ORDER.map((kind) => ({
    kind,
    label: RAIL_KIND_LABELS[kind],
  })),
];

const TYPE_MENU_CLOSE_MS = 240;

/**
 * 网格顶部单行工具条（layout-portal 10.1）。
 *
 * 类型筛选是 hover 自定义菜单（#262）；排序 / 分组 / 收藏保持原生 `<select>`。
 * 网格 / 列表是两个各自定值的按钮。`/` 聚焦搜索，`×` 清空。
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
  const typeTriggerRef = useRef<HTMLButtonElement>(null);
  const typeCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [typeMenuIndex, setTypeMenuIndex] = useState(-1);
  const [typeMenuPos, setTypeMenuPos] = useState<{
    left: number;
    top: number;
    minWidth: number;
  } | null>(null);

  const selectedTypeIndex = Math.max(
    0,
    TYPE_OPTIONS.findIndex((o) => o.kind === (filter ?? "all")),
  );

  const cancelTypeClose = () => {
    if (typeCloseTimer.current) {
      clearTimeout(typeCloseTimer.current);
      typeCloseTimer.current = null;
    }
  };

  const openTypeMenu = () => {
    cancelTypeClose();
    const el = typeTriggerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setTypeMenuPos({
        left: r.left,
        top: r.bottom + 4,
        minWidth: r.width,
      });
    }
    setTypeMenuIndex(selectedTypeIndex);
    setTypeMenuOpen(true);
  };

  const scheduleTypeClose = () => {
    cancelTypeClose();
    typeCloseTimer.current = setTimeout(() => {
      typeCloseTimer.current = null;
      setTypeMenuOpen(false);
      setTypeMenuIndex(-1);
    }, TYPE_MENU_CLOSE_MS);
  };

  const selectType = (kind: "all" | FileTypeKind) => {
    cancelTypeClose();
    setFilter(kind === "all" ? null : kind);
    setTypeMenuOpen(false);
    setTypeMenuIndex(-1);
  };

  const onTypeTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const last = TYPE_OPTIONS.length - 1;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelTypeClose();
      setTypeMenuOpen(false);
      setTypeMenuIndex(-1);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (!typeMenuOpen) {
        openTypeMenu();
        return;
      }
      const idx = typeMenuIndex >= 0 ? typeMenuIndex : selectedTypeIndex;
      selectType(TYPE_OPTIONS[idx].kind);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    e.stopPropagation();
    if (!typeMenuOpen) {
      openTypeMenu();
      setTypeMenuIndex(e.key === "ArrowDown" ? 0 : last);
      return;
    }
    setTypeMenuIndex((prev) => {
      const cur = prev >= 0 ? prev : selectedTypeIndex;
      return e.key === "ArrowDown"
        ? Math.min(last, cur + 1)
        : Math.max(0, cur - 1);
    });
  };

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

  useEffect(() => {
    if (!typeMenuOpen) return;
    const close = () => {
      cancelTypeClose();
      setTypeMenuOpen(false);
      setTypeMenuIndex(-1);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [typeMenuOpen]);

  useEffect(
    () => () => {
      if (typeCloseTimer.current) clearTimeout(typeCloseTimer.current);
    },
    [],
  );

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

      <div
        className="relative shrink-0"
        onPointerEnter={openTypeMenu}
        onPointerLeave={scheduleTypeClose}
      >
        <button
          ref={typeTriggerRef}
          type="button"
          data-grid-type-select
          data-testid="grid-type-select"
          aria-label="类型筛选"
          aria-haspopup="menu"
          aria-expanded={typeMenuOpen}
          onClick={() => {
            cancelTypeClose();
            if (typeMenuOpen) {
              setTypeMenuOpen(false);
              setTypeMenuIndex(-1);
            } else {
              openTypeMenu();
            }
          }}
          onKeyDown={onTypeTriggerKeyDown}
          className="shrink-0 rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-1.5 py-0.5 text-xs text-[var(--app-text)]"
        >
          {filter ? RAIL_KIND_LABELS[filter] : "全部类型"}
        </button>
        {typeMenuOpen && typeMenuPos && (
          <div
            data-testid="grid-type-menu"
            role="menu"
            style={{
              position: "fixed",
              left: typeMenuPos.left,
              top: typeMenuPos.top,
              minWidth: typeMenuPos.minWidth,
            }}
            className="z-50 rounded border border-[var(--app-border)] bg-[var(--app-surface)] py-1 text-xs shadow-lg"
            onPointerEnter={cancelTypeClose}
            onPointerLeave={scheduleTypeClose}
          >
            {TYPE_OPTIONS.map((opt, i) => (
              <button
                key={opt.kind}
                type="button"
                role="menuitemradio"
                aria-checked={opt.kind === (filter ?? "all")}
                data-grid-type-option={opt.kind}
                onMouseEnter={() => setTypeMenuIndex(i)}
                onClick={() => selectType(opt.kind)}
                className={`flex w-full items-center gap-2 px-2 py-1 text-left text-[var(--app-text)] hover:bg-[var(--app-sunken)] ${
                  i === typeMenuIndex ? "bg-[var(--app-sunken)]" : ""
                }`}
              >
                {opt.kind === (filter ?? "all") ? (
                  <Icon name="check" size={18} />
                ) : (
                  <span className="w-[18px]" />
                )}
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

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
        aria-label="收藏筛选"
        value={pinnedOnly ? "pinned" : "all"}
        onChange={(e) => setPinnedOnly(e.target.value === "pinned")}
        className="shrink-0 rounded border border-gray-200 bg-transparent px-1.5 py-0.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-200"
      >
        <option value="all">全部</option>
        <option value="pinned">仅收藏</option>
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
