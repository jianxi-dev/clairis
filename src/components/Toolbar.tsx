import type { Theme } from "../types";
import Icon from "./Icon";
import { useAiEntryStore } from "../hooks/useAiEntry";

interface ToolbarProps {
  theme: Theme;
  readingMode: boolean;
  onSetReadingMode: (on: boolean) => void;
  onSetTheme: (theme: Theme) => void;
  onOpenGrid: () => void;
}

/**
 * 全局顶栏只保留产品级入口：网格概览、AI、主题、沉浸。
 *
 * 文件标题与预览/编辑/源码切换已经下沉到每个分栏的页签条——同一份状态不再
 * 在顶栏和分栏各画一遍，顶栏也不再承担当前文档的身份。
 */
export default function Toolbar({
  theme,
  readingMode,
  onSetReadingMode,
  onSetTheme,
  onOpenGrid,
}: ToolbarProps) {
  return (
    <header className="app-chrome flex items-center gap-1 px-3 py-1.5 border-b border-[var(--app-border)] bg-[var(--app-surface)] text-sm select-none shrink-0">
      <span className="mr-auto text-xs font-medium tracking-wide text-[var(--app-text-2)]">
        标月
      </span>

      <button
        type="button"
        data-testid="grid-entry"
        title="网格概览（⌘⇧\\）"
        aria-label="网格概览"
        onClick={onOpenGrid}
        className="rounded-full px-2 py-0.5 text-[var(--app-text-2)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
      >
        <Icon name="grid" size={18} />
      </button>

      {/* AI：全产品唯一常驻入口（顶栏星芒）。门户里的 [data-testid="quick-ai"]
          是场景内快捷方式，不是常驻入口——唯一入口判定只看 data-ai-entry。 */}
      <button
        data-ai-entry
        data-testid="ai-entry"
        title="AI（⌘⇧A 切换形态）"
        aria-label="AI"
        onClick={() => {
          const st = useAiEntryStore.getState();
          if (st.form === "docked") st.undock();
          else if (st.bubbleOpen) st.closeBubble();
          else st.openBubble();
        }}
        className="rounded-full px-2 py-0.5 text-[var(--app-text-2)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
      >
        <Icon name="sparkle" size={18} color="var(--app-accent)" />
      </button>

      {/* Theme toggle */}
      <button
        onClick={() =>
          onSetTheme(
            theme === "light"
              ? "dark"
              : theme === "dark"
                ? "warm"
                : theme === "warm"
                  ? "system"
                  : "light",
          )
        }
        className="rounded-full px-2 py-0.5 text-[var(--app-text-2)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
        title={`当前: ${
          theme === "system"
            ? "跟随系统"
            : theme === "dark"
              ? "暗色"
              : theme === "warm"
                ? "暖色"
                : "亮色"
        }`}
      >
        <Icon
          name={
            theme === "light"
              ? "moon"
              : theme === "dark"
                ? "sun"
                : theme === "warm"
                  ? "sun"
                  : "monitor"
          }
          size={18}
        />
      </button>

      <button
        type="button"
        data-testid="immersive-entry"
        aria-pressed={readingMode}
        onClick={() => onSetReadingMode(!readingMode)}
        className={`rounded-full px-2.5 py-0.5 text-xs ${
          readingMode
            ? "bg-[var(--app-accent-soft)] font-medium text-[var(--app-accent)]"
            : "text-[var(--app-text-2)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
        }`}
        title="沉浸阅读（⌘⇧F）"
      >
        沉浸
      </button>
    </header>
  );
}
