import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Theme } from "../types";
import Icon from "./Icon";
import { useAiEntryStore } from "../hooks/useAiEntry";
import { useEditorStore } from "../stores/editorStore";
import { useStore } from "../stores/index";
import { readPercentOf } from "../lib/railCards";

const WIDTH_PRESETS = [
  { value: 720, label: "紧凑" },
  { value: 1080, label: "标准" },
  { value: 1200, label: "宽松" },
] as const;

const THEME_OPTIONS: {
  value: Theme;
  label: string;
  icon: "sunBright" | "moon" | "sunWarm" | "monitor";
}[] = [
  { value: "light", label: "亮色", icon: "sunBright" },
  { value: "dark", label: "暗色", icon: "moon" },
  { value: "warm", label: "暖色", icon: "sunWarm" },
  { value: "system", label: "跟随系统", icon: "monitor" },
];

function themeLabelOf(theme: Theme): string {
  return THEME_OPTIONS.find((o) => o.value === theme)?.label ?? "亮色";
}

function iconOfTheme(
  theme: Theme,
): "sunBright" | "moon" | "sunWarm" | "monitor" {
  return THEME_OPTIONS.find((o) => o.value === theme)?.icon ?? "sunBright";
}

interface StatusBarProps {
  theme: Theme;
  readingMode: boolean;
  onSetReadingMode: (on: boolean) => void;
  onSetTheme: (theme: Theme) => void;
  onOpenGrid: () => void;
  onToggleVisibility: () => void;
  onPointerLeave?: () => void;
  onSetReaderWidth: (width: number) => void;
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
  onSetReaderWidth,
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

  const [themeOpen, setThemeOpen] = useState(false);
  const [themeRect, setThemeRect] = useState<DOMRect | null>(null);
  const themeBtnRef = useRef<HTMLButtonElement | null>(null);
  const themeCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!themeOpen) return;
    const el = themeBtnRef.current;
    if (el) setThemeRect(el.getBoundingClientRect());
  }, [themeOpen]);

  const [widthOpen, setWidthOpen] = useState(false);
  const [widthRect, setWidthRect] = useState<DOMRect | null>(null);
  const widthBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!widthOpen) return;
    const el = widthBtnRef.current;
    if (el) setWidthRect(el.getBoundingClientRect());
  }, [widthOpen]);

  const scheduleThemeClose = () => {
    if (themeCloseTimer.current !== null)
      window.clearTimeout(themeCloseTimer.current);
    themeCloseTimer.current = window.setTimeout(() => setThemeOpen(false), 150);
  };

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
        <button
          type="button"
          ref={widthBtnRef}
          data-testid="status-width"
          title={`页面宽度 ${readerWidth}px（点击调整）`}
          onClick={() => setWidthOpen((v) => !v)}
          className="rounded px-1 hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
        >
          {readerWidth}px
        </button>
        {widthOpen && widthRect
          ? createPortal(
              <div
                data-testid="width-panel"
                className="width-panel"
                style={{
                  left: widthRect.left,
                  bottom: window.innerHeight - widthRect.top + 6,
                }}
              >
                {WIDTH_PRESETS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    data-testid={`width-preset-${opt.value}`}
                    aria-pressed={readerWidth === opt.value}
                    onClick={() => onSetReaderWidth(opt.value)}
                    className={`width-preset ${readerWidth === opt.value ? "is-active" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
                <input
                  data-testid="width-slider"
                  type="range"
                  min={480}
                  max={2400}
                  step={20}
                  value={readerWidth}
                  onChange={(e) => onSetReaderWidth(Number(e.target.value))}
                  className="width-slider"
                />
              </div>,
              document.body,
            )
          : null}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          data-testid="home-entry"
          title="主页"
          aria-label="主页"
          onClick={() => useStore.getState().setScene("portal")}
          className="rounded-full px-2 py-0.5 text-[var(--app-text-2)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
        >
          <Icon name="home" size={18} />
        </button>

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

        <div
          className="relative"
          onPointerEnter={() => setThemeOpen(true)}
          onPointerLeave={() => scheduleThemeClose()}
        >
          <button
            ref={themeBtnRef}
            data-testid="theme-entry"
            onPointerEnter={() => setThemeOpen(true)}
            onClick={() => setThemeOpen((v) => !v)}
            className="flex items-center gap-0.5 rounded-full px-2 text-[var(--app-text-2)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
            title={`当前: ${themeLabelOf(theme)}`}
          >
            <Icon name={iconOfTheme(theme)} size={18} />
          </button>
          {themeOpen && themeRect
            ? createPortal(
                <div
                  data-testid="theme-menu"
                  className="theme-menu"
                  style={{
                    left: themeRect.left,
                    bottom: window.innerHeight - themeRect.top + 6,
                  }}
                  onPointerEnter={() => setThemeOpen(true)}
                  onPointerLeave={() => scheduleThemeClose()}
                >
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`theme-option-${opt.value}`}
                      onClick={() => {
                        onSetTheme(opt.value);
                        setThemeOpen(false);
                      }}
                      className={`theme-menu-item ${theme === opt.value ? "is-active" : ""}`}
                    >
                      <Icon name={opt.icon} size={18} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>,
                document.body,
              )
            : null}
        </div>

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
