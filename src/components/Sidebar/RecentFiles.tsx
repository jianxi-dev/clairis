import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../stores";
import { useConfig } from "../../hooks/useConfig";
import { log } from "../../utils/log";

const isTauri =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== undefined;

export default function RecentFiles() {
  const recentFiles = useStore((s) => s.recentFiles);
  const { scheduleSave } = useConfig();

  const handleOpen = useCallback(
    async (filePath: string) => {
      if (!isTauri) return;
      try {
        const result = await invoke<{ content: string; path: string; file_size: number }>(
          "open_file_direct",
          { path: filePath },
        );
        const store = useStore.getState();
        store.openFile(result.path, result.content);
        store.addRecentFile(result.path, result.path.split("/").pop() || result.path);
        scheduleSave();
      } catch (e) {
        log.error("RecentFiles", "Failed to open recent file", e);
      }
    },
    [scheduleSave],
  );

  const handleClear = useCallback(() => {
    useStore.getState().clearRecentFiles();
    scheduleSave();
  }, [scheduleSave]);

  if (recentFiles.length === 0) {
    return (
      <div className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">
        暂无最近文件
        <br />
        <span className="text-gray-300 dark:text-gray-600">Cmd+O 打开文件</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">最近</span>
        <button
          onClick={handleClear}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="清除历史"
        >
          清除
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {recentFiles.map((file) => (
          <button
            key={file.path}
            onClick={() => handleOpen(file.path)}
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 truncate block"
            title={file.path}
          >
            <span className="text-gray-800 dark:text-gray-200">{file.title}</span>
            <span className="text-gray-400 dark:text-gray-500 ml-2 truncate">
              {file.path}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
