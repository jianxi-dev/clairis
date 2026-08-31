import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores";
import { useConfig } from "../../hooks/useConfig";
import { log } from "../../utils/log";

interface FlatEntry {
  name: string;
  path: string;
  relative_path: string;
  is_dir: boolean;
  size: number;
}

interface FlattenResult {
  entries: FlatEntry[];
  truncated: boolean;
}

const isTauri =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !==
    undefined;

export default function FileTree() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [entries, setEntries] = useState<FlatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [search, setSearch] = useState("");
  const { scheduleSave } = useConfig();

  const loadFolder = useCallback(async (folderPath: string) => {
    if (!isTauri) return;
    setLoading(true);
    log.info("FileTree", "Loading folder", { path: folderPath });
    try {
      const result = await invoke<FlattenResult>("flatten_files", {
        path: folderPath,
      });
      setEntries(result.entries);
      setTruncated(result.truncated);
      setSelectedFolder(folderPath);
      if (result.truncated) {
        log.warn("FileTree", "Folder scan truncated at 2000 files", {
          path: folderPath,
        });
      }
      log.info("FileTree", "Folder loaded", {
        count: result.entries.length,
        truncated: result.truncated,
      });
    } catch (e) {
      log.error("FileTree", "Failed to list files", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChooseFolder = useCallback(async () => {
    if (!isTauri) return;
    try {
      const folderPath = await invoke<string>("pick_folder");
      loadFolder(folderPath);
    } catch (e) {
      if (String(e) !== "Operation cancelled") {
        log.error("FileTree", "Failed to choose folder", e);
      }
    }
  }, [loadFolder]);

  const handleOpenFile = useCallback(
    async (filePath: string) => {
      if (!isTauri) return;
      try {
        const result = await invoke<{
          content: string;
          path: string;
          file_size: number;
        }>("open_file_direct", { path: filePath });
        const store = useStore.getState();
        store.openFile(result.path, result.content);
        store.addRecentFile(
          result.path,
          result.path.split("/").pop() || result.path,
        );
        scheduleSave();
      } catch (e) {
        log.error("FileTree", "Failed to open file", e);
      }
    },
    [scheduleSave],
  );

  // Breadcrumb segments
  const breadcrumbs = selectedFolder
    ? selectedFolder.split("/").filter(Boolean)
    : [];

  // Filter by search
  const filtered = search
    ? entries.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.relative_path.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  // Group: subdirectories first, then files
  const dirs = filtered.filter((e) => e.is_dir);
  const files = filtered.filter((e) => !e.is_dir);

  if (!selectedFolder) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          选择一个文件夹以浏览文件
        </p>
        <button
          onClick={handleChooseFolder}
          className="px-3 py-1.5 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          选择文件夹
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-1 text-xs flex-wrap">
        <button
          onClick={() => setSelectedFolder(null)}
          className="text-blue-500 hover:underline shrink-0"
        >
          📁
        </button>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        {breadcrumbs.map((seg, i) => {
          const targetPath = "/" + breadcrumbs.slice(0, i + 1).join("/");
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-1">
              <button
                onClick={() => loadFolder(targetPath)}
                className={`hover:underline truncate max-w-24 ${
                  isLast
                    ? "text-gray-800 dark:text-gray-200 font-medium"
                    : "text-blue-500"
                }`}
              >
                {seg}
              </button>
              {!isLast && (
                <span className="text-gray-300 dark:text-gray-600">/</span>
              )}
            </span>
          );
        })}
        <button
          onClick={handleChooseFolder}
          className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          title="切换文件夹"
        >
          ↻
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="过滤..."
          className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {truncated && (
          <div className="px-3 py-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            ⚠ 文件过多，仅显示前 2000 个
          </div>
        )}
        {loading && (
          <div className="p-4 text-xs text-gray-400 text-center">加载中...</div>
        )}
        {!loading && entries.length > 0 && (
          <div className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
            {entries.filter((e) => !e.is_dir).length} 个文件
            {entries.filter((e) => e.is_dir).length > 0 &&
              ` · ${entries.filter((e) => e.is_dir).length} 个文件夹`}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-4 text-xs text-gray-400 text-center">
            {search ? "无匹配文件" : "无支持的文件"}
          </div>
        )}

        {dirs.length > 0 && !search && (
          <div className="border-b border-gray-100 dark:border-gray-800">
            {dirs.map((d) => (
              <button
                key={d.path}
                onClick={() => loadFolder(d.path)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1.5"
              >
                <span className="text-yellow-600">📁</span>
                <span className="text-gray-700 dark:text-gray-300 truncate">
                  {d.relative_path}
                </span>
              </button>
            ))}
          </div>
        )}

        {files.map((f) => (
          <button
            key={f.path}
            onClick={() => handleOpenFile(f.path)}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-50 dark:border-gray-700 flex items-center gap-1.5"
            title={f.path}
          >
            <span className="text-blue-500 shrink-0">📄</span>
            <span className="text-gray-800 dark:text-gray-200 truncate">
              {search ? f.relative_path : f.name}
            </span>
            {!search && (
              <span className="text-gray-400 dark:text-gray-600 text-xs truncate ml-auto">
                {f.relative_path.split("/").slice(0, -1).join("/")}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
