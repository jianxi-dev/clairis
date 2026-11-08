import type { Theme } from "../types";
import Icon from "./Icon";
import { useAiEntryStore } from "../hooks/useAiEntry";
import { useEditorStore } from "../stores/editorStore";
import { useStore } from "../stores/index";
import { readPercentOf } from "../lib/railCards";

interface StatusBarProps {
  theme: Theme;
  readingMode: boolean;
  onSetReadingMode: (on: boolean) => void;
  onSetTheme: (theme: Theme) => void;
  onOpenGrid: () => void;
  onToggleVisibility: () => void;
  onPointerLeave?: () => void;
}

/** 中文用户直觉的字数：CJK 字符数 + 西文单词数（不含 markdown 符号与空白）。 */
function countWords(content: string): number {
  const cjk = (
    content.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) ?? []
  ).length;
  const latin = (content.match(/[a-zA-Z0-9]+/g) ?? []).length;
  return cjk + latin;
}

function formatNumber(n: number): string {
  return n.toLocaleString("zh-CN");
}

/**
 * 底部状态栏（G-3 / shell-ui 状态栏）。
 *
 * 左侧常驻读出当前页签的行数 / 字数 / 阅读进度 / 页面宽度（opacity 0.6）；
 * 右侧是原顶栏的四个产品级入口：网格概览 / AI / 主题 / 沉浸，顺序与点击行为不变。
 * 沉浸模式下顶栏收拢，但状态栏常驻（spec：状态栏不被沉浸 chrome 折叠）。
 */
export default function StatusBar({
  theme,
  readingMode,
  onSetReadingMode,
  onSetTheme,
  onOpenGrid,
  onToggleVisibility,
  onPointerLeave,
}: StatusBarProps) {
  const activeTabId = useStore((s) => s.activeTabId);
  const tabs = useStore((s) => s.tabs);
  const scrollPositions = useStore((s) => s.scrollPositions);
  const readerWidth = useEditorStore((s) => s.config.readerWidth ?? 1080);

  const activeTab = activeTabId ? tabs[activeTabId] : undefined;
  const content = activeTab?.content ?? "";
  const lineCount = content === "" ? 0 : content.split("\n").length;
  const wordCount = countWords(content);
  const percent = activeTab?.path
    ? readPercentOf(scrollPositions[activeTab.path])
    : undefined;

  return (
    <footer
      className="app-status-bar flex items-center gap-3 px-3 py-0.5 text-xs text-[var(--app-text-2)] select-none shrink-0"
      data-testid="status-bar"
      onPointerLeave={onPointerLeave}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onToggleVisibility();
      }}
    >
      <div className="flex items-center gap-2 opacity-60">
        <span
          data-testid="status-lines"
          title={`共 ${formatNumber(lineCount)} 行`}
        >
          行 {formatNumber(lineCount)}
        </span>
        <span aria-hidden="true">·</span>
        <span
          data-testid="status-words"
          title={`共 ${formatNumber(wordCount)} 字`}
        >
          {formatNumber(wordCount)} 字
        </span>
        <span aria-hidden="true">·</span>
        <span
          data-testid="status-progress"
          title={percent === undefined ? "暂无阅读进度" : `已读 ${percent}%`}
        >
          {percent === undefined ? "—" : `${percent}%`}
        </span>
        <span aria-hidden="true">·</span>
        <span data-testid="status-width" title={`页面宽度 ${readerWidth}px`}>
          {readerWidth}px
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
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

        {/* AI：全产品唯一常驻入口（状态栏星芒）。门户里的 [data-testid="quick-ai"]
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
          aria-label="沉浸阅读"
          onClick={() => onSetReadingMode(!readingMode)}
          className={`rounded-full px-2 py-0.5 ${
            readingMode
              ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
              : "text-[var(--app-text-2)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
          }`}
          title="沉浸阅读（⌘⇧F）"
        >
          <Icon name="immersive" size={18} />
        </button>
      </div>
    </footer>
  );
}
