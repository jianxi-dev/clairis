import { useAiEntryStore } from "../../hooks/useAiEntry";

export default function UndoBar() {
  const store = useAiEntryStore();
  const armed =
    store.undoTarget !== null ||
    store.undoPreConfig !== null ||
    store.undoPreSpec !== null;

  if (!armed) return null;

  return (
    <>
      <div
        data-undo-hover-zone
        className="fixed bottom-0 left-1/2 z-[2147482900] h-5 w-56 -translate-x-1/2"
        onMouseEnter={store.reshowUndo}
        aria-hidden
      />
      <div
        data-undo-bar
        data-ai-chrome
        className={`fixed bottom-4 left-1/2 z-[2147482950] -translate-x-1/2 transition-opacity duration-200 ${
          store.undoVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onMouseEnter={store.reshowUndo}
        onMouseLeave={store.undoFadeLater}
        role="status"
        aria-label="配置已被更新，可撤销"
      >
        <div className="flex items-center gap-3 rounded-full bg-gray-900/92 dark:bg-gray-800/92 px-4 py-2 text-sm shadow-lg backdrop-blur-sm border border-white/10">
          <span className="text-gray-100">已更新配置</span>
          <button
            type="button"
            data-undo-button
            onClick={() => void store.runUndo()}
            className="text-[#5eb0ff] hover:underline font-medium"
          >
            撤销
          </button>
          <span className="h-3 w-px bg-white/20" aria-hidden />
          <button
            type="button"
            data-undo-history-button
            onClick={store.openPanel}
            className="text-gray-300 hover:text-white"
          >
            历史
          </button>
        </div>
      </div>
    </>
  );
}
