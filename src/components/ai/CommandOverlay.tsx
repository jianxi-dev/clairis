import { useEffect, useRef } from "react";
import { useAiEntryStore } from "../../hooks/useAiEntry";

const EXAMPLES = ["换成深色主题", "字号调到 18"];

export default function CommandOverlay() {
  const store = useAiEntryStore();
  const closeOverlay = useAiEntryStore((s) => s.closeOverlay);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!store.overlayOpen) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [store.overlayOpen]);

  useEffect(() => {
    if (!store.overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay();
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-ai-chrome]")) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        closeOverlay();
      }
    };
    document.addEventListener("keydown", onKey, { capture: true });
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, { capture: true });
      document.removeEventListener("mousedown", onDown);
    };
  }, [store.overlayOpen, closeOverlay]);

  if (!store.overlayOpen) return null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="AI 指令"
      data-ai-overlay
      className="fixed left-1/2 z-[2147483000] w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-[14px] bg-white/88 dark:bg-[#1c1c1e]/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.06)] border border-black/6 dark:border-white/10 overflow-hidden transition-all duration-200"
      style={{ bottom: store.undoVisible ? 72 : 16 }}
    >
      {/* 对话区 */}
      <div className="max-h-64 overflow-y-auto px-4 pt-3">
        {store.messages.length === 0 ? (
          <div className="py-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              用一句话让 AI 帮你调整标月，改动可随时撤销。
            </p>
            <div className="mt-2 flex gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => store.setInput(ex)}
                  className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-2 pb-1">
            {store.messages.map((m) =>
              m.role === "user" ? (
                <li
                  key={m.id}
                  className="text-sm text-gray-800 dark:text-gray-100 font-medium"
                >
                  {m.content}
                </li>
              ) : (
                <li key={m.id}>
                  <div
                    className={`text-sm whitespace-pre-wrap ${
                      m.isError
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.changed && !m.isError && (
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>已更新</span>
                      <span aria-hidden>·</span>
                      <button
                        type="button"
                        onClick={() => void store.runUndo()}
                        className="text-[#0071e3] hover:underline"
                      >
                        撤销
                      </button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {/* 二次确认卡（aiConfirmDensity = always） */}
      {store.pendingConfirm && (
        <div className="mx-3 mt-2 rounded-lg border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
          <p className="text-xs text-gray-700 dark:text-gray-200">
            将让 AI 修改配置，继续？
          </p>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={store.confirmPendingSubmit}
              className="px-2.5 py-1 rounded-md bg-[#0071e3] text-white text-xs font-medium"
            >
              继续
            </button>
            <button
              type="button"
              onClick={store.cancelPendingSubmit}
              className="px-2.5 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-200 text-xs"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 输入行 */}
      <form
        className="flex items-center gap-2 px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          store.requestSubmit(store.input);
        }}
      >
        <input
          ref={inputRef}
          data-ai-input
          value={store.input}
          onChange={(e) => store.setInput(e.target.value)}
          aria-label="告诉 AI 要做什么"
          placeholder="告诉 AI 要做什么…"
          className="flex-1 bg-transparent border-0 outline-none text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        {store.submitting ? (
          <span
            className="text-xs text-gray-400 dark:text-gray-500"
            role="status"
          >
            正在处理…
          </span>
        ) : null}
      </form>
    </div>
  );
}
