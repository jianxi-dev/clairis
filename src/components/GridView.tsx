import { useEffect } from "react";
import Icon from "./Icon";
import { useStore } from "../stores/index";
import { TYPE_COLORS, fileTypeOf, iconOfType } from "../lib/fileType";
import { fileDragHandlers } from "../hooks/fileDrag";

/**
 * 网格场景的最小可用形态（layout-portal 2.1 接入的场景路由）。
 *
 * 完整 bento 网格是票 10.1；这里只做本票 AC 要的那件事：按类型过滤的列表 +
 * Esc 回到门户。刻意不画 bento——那是 10.1 的交付物，这里提前实现会变成两套
 * 网格互相打架。
 */
export default function GridView({
  onOpenPath,
}: {
  onOpenPath: (path: string) => void | Promise<void>;
}) {
  const filter = useStore((s) => s.gridTypeFilter);
  const recentFiles = useStore((s) => s.recentFiles);
  const setScene = useStore((s) => s.setScene);
  const setFilter = useStore((s) => s.setGridTypeFilter);

  const items = filter
    ? recentFiles.filter((f) => fileTypeOf(f.path) === filter)
    : recentFiles;

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

  return (
    <div
      data-testid="grid"
      data-grid-filter={filter ?? "all"}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => {
            const kind = fileTypeOf(f.path);
            return (
              <button
                key={f.path}
                data-grid-item={f.path}
                {...fileDragHandlers(f.path)}
                onClick={() => {
                  const tabs = useStore.getState().tabs;
                  const tab = Object.values(tabs).find(
                    (t) => t.path === f.path,
                  );
                  if (tab) {
                    useStore.getState().switchTab(tab.id);
                    useStore.getState().setScene("workspace");
                  } else {
                    void onOpenPath(f.path);
                  }
                }}
                className="rounded border border-gray-200 p-3 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Icon
                    name={iconOfType(kind)}
                    size={18}
                    color={TYPE_COLORS[kind]}
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
          })}
        </div>
      )}
    </div>
  );
}
