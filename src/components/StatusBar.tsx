import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Theme } from "../types";
import Icon from "./Icon";
import { useAiEntryStore } from "../hooks/useAiEntry";
import { useEditorStore } from "../stores/editorStore";
import { useStore } from "../stores/index";
import { readPercentOf } from "../lib/railCards";

import {
  READER_WIDTH_MAX,
  READER_WIDTH_MIN,
  READER_WIDTH_PRESETS,
  READER_WIDTH_STEP,
} from "../lib/readerWidth";

/** 宽度弹层的关闭宽限：足够让指针从按钮跨到弹层里。 */
const WIDTH_CLOSE_MS = 200;

const WIDTH_PANEL_W = 200;

/** 主题点击循环次序（点击图标 = 切到下一个）。 */
const THEME_CYCLE: Theme[] = ["system", "light", "dark", "warm"];

/** 悬停弹层的关闭宽限：足够让指针跨过触发器与面板之间的桥接区。 */
const THEME_CLOSE_MS = 250;

const THEME_MENU_W = 132;

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

function nextThemeOf(theme: Theme): Theme {
  const i = THEME_CYCLE.indexOf(theme);
  return THEME_CYCLE[(i + 1) % THEME_CYCLE.length];
}

interface StatusBarProps {
  theme: Theme;
  readingMode: boolean;
  onSetReadingMode: (on: boolean) => void;
  onSetTheme: (theme: Theme) => void;
  onOpenGrid: () => void;
  onToggleVisibility: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onSetReaderWidth: (width: number) => void;
  /** 隐藏/沉浸态临时浮现时以 fixed 浮层覆盖内容，不参与流式布局。 */
  floating?: boolean;
  /** 主题 / 宽度面板的展开状态；父级据此避免在面板打开时卸载状态栏。 */
  onPopupOpenChange?: (open: boolean) => void;
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
  onPointerEnter,
  onPointerLeave,
  onSetReaderWidth,
  floating,
  onPopupOpenChange,
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
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const themeCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!themeOpen) return;
    const el = themeBtnRef.current;
    if (el) setThemeRect(el.getBoundingClientRect());
  }, [themeOpen]);

  const [widthOpen, setWidthOpen] = useState(false);
  const [widthAnchor, setWidthAnchor] = useState(0);
  const [widthRect, setWidthRect] = useState<DOMRect | null>(null);
  const widthBtnRef = useRef<HTMLButtonElement | null>(null);
  const widthPanelRef = useRef<HTMLDivElement | null>(null);
  const widthCloseTimer = useRef<number | null>(null);

  const cancelWidthClose = useCallback(() => {
    if (widthCloseTimer.current !== null) {
      window.clearTimeout(widthCloseTimer.current);
      widthCloseTimer.current = null;
    }
  }, []);

  const openWidthPanel = useCallback(() => {
    cancelWidthClose();
    const rect = widthBtnRef.current?.getBoundingClientRect();
    if (rect) setWidthAnchor(rect.left + rect.width / 2);
    setWidthOpen(true);
  }, [cancelWidthClose]);

  const scheduleWidthClose = useCallback(() => {
    cancelWidthClose();
    widthCloseTimer.current = window.setTimeout(() => {
      widthCloseTimer.current = null;
      setWidthOpen(false);
    }, WIDTH_CLOSE_MS);
  }, [cancelWidthClose]);

  useEffect(() => () => cancelWidthClose(), [cancelWidthClose]);

  useEffect(() => {
    if (!widthOpen) return;
    const el = widthBtnRef.current;
    if (el) setWidthRect(el.getBoundingClientRect());
  }, [widthOpen]);

  const cancelThemeClose = useCallback(() => {
    if (themeCloseTimer.current !== null) {
      window.clearTimeout(themeCloseTimer.current);
      themeCloseTimer.current = null;
    }
  }, []);

  const scheduleThemeClose = useCallback(() => {
    cancelThemeClose();
    themeCloseTimer.current = window.setTimeout(() => {
      themeCloseTimer.current = null;
      setThemeOpen(false);
    }, THEME_CLOSE_MS);
  }, [cancelThemeClose]);

  useEffect(() => cancelThemeClose, [cancelThemeClose]);

  const popupOpenRef = useRef(false);
  useEffect(() => {
    const open = themeOpen || widthOpen;
    if (popupOpenRef.current === open) return;
    popupOpenRef.current = open;
    onPopupOpenChange?.(open);
  }, [themeOpen, widthOpen, onPopupOpenChange]);

  const focusThemeItem = useCallback((direction: 0 | 1 | -1) => {
    const items = Array.from(
      themeMenuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]',
      ) ?? [],
    );
    if (items.length === 0) return;
    const current = items.findIndex((el) => el === document.activeElement);
    if (current === -1) {
      const checked = items.findIndex(
        (el) => el.getAttribute("aria-checked") === "true",
      );
      items[Math.max(checked, 0)].focus();
      return;
    }
    if (direction === 0) return;
    items[(current + direction + items.length) % items.length].focus();
  }, []);

  const pendingThemeFocusRef = useRef(false);
  useEffect(() => {
    if (!themeOpen || !themeRect) return;
    if (!pendingThemeFocusRef.current) return;
    pendingThemeFocusRef.current = false;
    focusThemeItem(0);
  }, [themeOpen, themeRect, focusThemeItem]);

  useEffect(() => {
    if (!themeOpen && !widthOpen) return;
    const closeAll = () => {
      setThemeOpen(false);
      setWidthOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (themeBtnRef.current?.contains(target)) return;
      if (themeMenuRef.current?.contains(target)) return;
      if (widthBtnRef.current?.contains(target)) return;
      if (widthPanelRef.current?.contains(target)) return;
      closeAll();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closeAll();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", closeAll, true);
    window.addEventListener("resize", closeAll);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", closeAll, true);
      window.removeEventListener("resize", closeAll);
    };
  }, [themeOpen, widthOpen]);

  return (
    <footer
      className={`app-status-bar flex items-center gap-3 px-3 py-0.5 text-xs text-[var(--app-text-2)] select-none shrink-0${
        floating ? " app-status-bar--floating" : ""
      }`}
      data-testid="status-bar"
      onPointerEnter={onPointerEnter}
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
        {/* 命中区域常驻，控件本体默认透明；指针进入 / 聚焦 / 面板展开时淡入。
            只隐藏宽度控件组，不隐藏整个状态栏。 */}
        <div
          className={`width-control${widthOpen ? " is-open" : ""}`}
          data-testid="width-control"
          onPointerEnter={openWidthPanel}
          onPointerLeave={scheduleWidthClose}
        >
          <button
            type="button"
            ref={widthBtnRef}
            data-testid="status-width"
            title={`页面宽度 ${readerWidth}px`}
            onClick={(e) => {
              cancelWidthClose();
              setWidthAnchor(e.clientX);
              setWidthOpen((v) => !v);
            }}
            className="rounded px-1 hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
          >
            {readerWidth}px
          </button>
        </div>
        {widthOpen && widthRect
          ? createPortal(
              <div
                ref={widthPanelRef}
                data-testid="width-panel"
                className="width-panel"
                onPointerEnter={cancelWidthClose}
                onPointerLeave={scheduleWidthClose}
                style={{
                  left: Math.min(
                    Math.max(widthAnchor - WIDTH_PANEL_W / 2, 8),
                    Math.max(window.innerWidth - WIDTH_PANEL_W - 8, 8),
                  ),
                  bottom: window.innerHeight - widthRect.top + 6,
                }}
              >
                <div className="width-bars" data-testid="width-bars">
                  {READER_WIDTH_PRESETS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`width-preset-${opt.value}`}
                      aria-pressed={readerWidth === opt.value}
                      title={opt.label}
                      aria-label={opt.label}
                      onClick={() => onSetReaderWidth(opt.value)}
                      style={{ height: opt.bar }}
                      className={`width-bar ${readerWidth === opt.value ? "is-active" : ""}`}
                    >
                      <span className="width-bar-fill" aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <input
                  data-testid="width-slider"
                  type="range"
                  min={READER_WIDTH_MIN}
                  max={READER_WIDTH_MAX}
                  step={READER_WIDTH_STEP}
                  value={Math.min(READER_WIDTH_MAX, readerWidth)}
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
          className="rounded-full px-2 py-0.5 text-[var(--app-chrome-rest)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-chrome-hover)]"
        >
          <Icon name="home" size={18} />
        </button>

        <button
          type="button"
          data-testid="auto-layout-entry"
          title="自动布局"
          aria-label="自动布局"
          onClick={() => useStore.getState().autoLayoutPanes()}
          className="rounded-full px-2 py-0.5 text-[var(--app-chrome-rest)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-chrome-hover)]"
        >
          <Icon name="layoutAuto" size={18} />
        </button>

        <button
          type="button"
          data-testid="grid-entry"
          title="网格概览（⌘⇧\\）"
          aria-label="网格概览"
          onClick={onOpenGrid}
          className="rounded-full px-2 py-0.5 text-[var(--app-chrome-rest)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-chrome-hover)]"
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
          className="rounded-full px-2 py-0.5 text-[var(--app-chrome-rest)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-chrome-hover)]"
        >
          <Icon name="sparkle" size={18} color="var(--app-accent)" />
        </button>

        <div
          className="relative"
          onPointerEnter={() => {
            cancelThemeClose();
            setThemeOpen(true);
          }}
          onPointerLeave={scheduleThemeClose}
        >
          <button
            ref={themeBtnRef}
            data-testid="theme-entry"
            aria-haspopup="menu"
            aria-expanded={themeOpen}
            aria-label={`主题：${themeLabelOf(theme)}（点击切换，悬停选择）`}
            onPointerEnter={() => {
              cancelThemeClose();
              setThemeOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              e.preventDefault();
              pendingThemeFocusRef.current = true;
              setThemeOpen(true);
            }}
            onClick={() => onSetTheme(nextThemeOf(theme))}
            className="flex items-center gap-0.5 rounded-full px-2 text-[var(--app-chrome-rest)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-chrome-hover)]"
            title={`当前: ${themeLabelOf(theme)}`}
          >
            <Icon name={iconOfTheme(theme)} size={18} />
          </button>
          {themeOpen && themeRect
            ? createPortal(
                <div
                  ref={themeMenuRef}
                  data-testid="theme-menu"
                  className="theme-menu-wrap"
                  style={{
                    left: Math.min(
                      themeRect.left,
                      Math.max(window.innerWidth - THEME_MENU_W - 8, 8),
                    ),
                    bottom: window.innerHeight - themeRect.top,
                  }}
                  onPointerEnter={cancelThemeClose}
                  onPointerLeave={scheduleThemeClose}
                >
                  <div
                    className="theme-menu"
                    role="menu"
                    aria-label="主题"
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        focusThemeItem(e.key === "ArrowDown" ? 1 : -1);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setThemeOpen(false);
                        themeBtnRef.current?.focus();
                        return;
                      }
                      if (e.key === "Tab") setThemeOpen(false);
                    }}
                  >
                    {THEME_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={theme === opt.value}
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
                  </div>
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
              : "text-[var(--app-chrome-rest)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-chrome-hover)]"
          }`}
          title="沉浸阅读（⌘⇧F）"
        >
          <Icon name="immersive" size={18} />
        </button>
      </div>
    </footer>
  );
}
