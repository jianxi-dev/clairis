import { useEffect, useRef, useState } from "react";
import { useAiEntryStore, type AiForm } from "../../hooks/useAiEntry";
import { SPEC_PRESETS } from "../../lib/aiViewSpec";

/**
 * AI 对话正文（layout-portal 9.1）——小窗与停靠窗格共用同一份。
 *
 * 唯一真相是 useAiEntryStore.messages：本组件不持任何本地消息状态，
 * 因此两种宿主之间切换形态不会丢对话。
 */
export default function AiConversation({ form }: { form: AiForm }) {
  const messages = useAiEntryStore((s) => s.messages);
  const input = useAiEntryStore((s) => s.input);
  const submitting = useAiEntryStore((s) => s.submitting);
  const pendingConfirm = useAiEntryStore((s) => s.pendingConfirm);

  const [presetOpen, setPresetOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    useAiEntryStore.getState().requestSubmit(useAiEntryStore.getState().input);
  };

  const toggleForm = () => {
    if (form === "bubble") useAiEntryStore.getState().dock();
    else useAiEntryStore.getState().undock();
  };

  return (
    <div className="flex h-full min-h-0 flex-col text-sm">
      <div
        ref={listRef}
        data-ai-thread
        className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            用一句话让 AI 帮你调整标月，改动可随时撤销。
          </p>
        ) : (
          <ul className="space-y-1.5">
            {messages.map((m) => (
              <li
                key={m.id}
                data-ai-message
                data-role={m.role}
                className={
                  m.role === "user"
                    ? "text-gray-800 dark:text-gray-100 font-medium"
                    : `whitespace-pre-wrap ${
                        m.isError
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-600 dark:text-gray-300"
                      }`
                }
              >
                {m.content}
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendingConfirm && (
        <div
          data-ai-confirm-card
          className="mx-2 mb-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-700/50 dark:bg-amber-900/20"
        >
          <p className="text-xs text-gray-700 dark:text-gray-200">
            {pendingConfirm.summary || "将让 AI 修改标月的显示设置，继续？"}
          </p>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              data-ai-confirm-ok
              onClick={() => useAiEntryStore.getState().confirmPendingSubmit()}
              className="rounded-md bg-[#0071e3] px-2.5 py-1 text-xs font-medium text-white"
            >
              继续
            </button>
            <button
              type="button"
              data-ai-confirm-cancel
              onClick={() => useAiEntryStore.getState().cancelPendingSubmit()}
              className="rounded-md bg-gray-200 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <form
        data-ai-composer
        className="flex items-center gap-1 border-t border-black/5 px-2 py-1.5 dark:border-white/10"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          data-ai-input
          rows={1}
          value={input}
          onChange={(e) => useAiEntryStore.getState().setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          aria-label="告诉 AI 要做什么"
          placeholder="告诉 AI 要做什么…"
          className="min-w-0 flex-1 resize-none bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <button
          type="submit"
          data-ai-send
          disabled={submitting || input.trim() === ""}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-[#0071e3] disabled:opacity-40"
        >
          {submitting ? "处理中" : "发送"}
        </button>
      </form>

      <div className="relative flex items-center gap-2 border-t border-black/5 px-2 py-1 text-xs dark:border-white/10">
        <button
          type="button"
          data-ai-presets-button
          aria-haspopup="menu"
          aria-expanded={presetOpen}
          onClick={() => setPresetOpen((v) => !v)}
          className="rounded px-1.5 py-0.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          预设
        </button>
        <button
          type="button"
          data-ai-history-button
          onClick={() => useAiEntryStore.getState().openPanel()}
          className="rounded px-1.5 py-0.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          历史
        </button>
        <button
          type="button"
          data-ai-dock-button
          onClick={toggleForm}
          className="ml-auto rounded px-1.5 py-0.5 text-[#0071e3] hover:bg-blue-50 dark:hover:bg-blue-900/30"
        >
          {form === "bubble" ? "停靠到右侧" : "脱离为小窗"}
        </button>
        {presetOpen && (
          <div
            data-ai-presets-menu
            role="menu"
            className="absolute bottom-full left-2 z-10 mb-1 w-44 rounded border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            {SPEC_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="menuitem"
                data-ai-preset={preset.id}
                onClick={() => {
                  setPresetOpen(false);
                  useAiEntryStore.getState().requestApplyPreset(preset.id);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
