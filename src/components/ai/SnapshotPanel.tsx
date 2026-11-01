import { useAiEntryStore, formatSnapshotTime } from "../../hooks/useAiEntry";

export default function SnapshotPanel() {
  const store = useAiEntryStore();

  if (!store.panelOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="配置历史"
      data-snapshot-panel
      data-ai-chrome
      className="fixed bottom-20 left-1/2 z-[2147483000] w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-[14px] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.06)] border border-black/6 dark:border-white/10 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
          配置历史
        </h3>
        <button
          type="button"
          onClick={store.closePanel}
          aria-label="关闭历史面板"
          className="w-6 h-6 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto px-2 pb-1">
        {store.snapshotsLoading ? (
          <p className="px-2 py-3 text-xs text-gray-400" role="status">
            正在读取…
          </p>
        ) : store.snapshots.length === 0 ? (
          <p className="px-2 py-3 text-xs text-gray-400 dark:text-gray-500">
            还没有历史记录。每次改动配置前都会自动留档。
          </p>
        ) : (
          <ul>
            {store.snapshots.map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {formatSnapshotTime(s.name)}
                </span>
                <button
                  type="button"
                  onClick={() => void store.restoreSnapshot(s.name)}
                  className="text-xs px-2 py-1 rounded-md bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/20 font-medium"
                >
                  恢复
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="px-4 py-2 text-[11px] text-gray-400 dark:text-gray-500 border-t border-black/5 dark:border-white/5">
        恢复前会把当前状态也保存一份，随时可以再换回来。
      </p>
    </div>
  );
}
