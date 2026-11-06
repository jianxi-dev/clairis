import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../stores/index";
import { fileTypeOf, iconOfType, colorOfType } from "../lib/fileType";
import { buildQuickItems, type QuickItem } from "../lib/quickOpen";
import type { IconName } from "../ui/icons";
import Icon from "./Icon";

/**
 * 快速打开（reading-surface-refine 6.1）。
 *
 * ⌘P / Ctrl+P 唤起，跨三类联合过滤：当前页签、最近文件、命令（网格概览 / 设置）。
 * Esc 关闭、↑↓ 选择、Enter 执行、点击执行、点遮罩（mousedown）关闭。
 *
 * 键盘在 window capture 阶段拦截并 stopPropagation，避免与 App 全局层、
 * 设置/AI 的 Esc 分层逻辑抢键（与 ShortcutOverlay 同一范式）。
 */

export interface QuickOpenProps {
  open: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onOpenTab: (tabId: string) => void;
  onOpenPath: (path: string) => void;
  onOpenGrid: () => void;
  onOpenSettings: () => void;
}

const GROUPS: Array<{ kind: QuickItem["kind"]; label: string }> = [
  { kind: "tab", label: "页签" },
  { kind: "recent", label: "最近文件" },
  { kind: "command", label: "命令" },
];

/** 命中片段高亮：查询为空时原样返回，避免无意义切分。 */
function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: Array<{ text: string; hit: boolean }> = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push({ text: text.slice(i), hit: false });
      break;
    }
    if (idx > i) parts.push({ text: text.slice(i, idx), hit: false });
    parts.push({ text: text.slice(idx, idx + needle.length), hit: true });
    i = idx + needle.length;
  }
  return (
    <>
      {parts.map((p, n) =>
        p.hit ? (
          <mark
            key={n}
            className="bg-transparent font-medium text-[var(--app-accent)]"
          >
            {p.text}
          </mark>
        ) : (
          <span key={n}>{p.text}</span>
        ),
      )}
    </>
  );
}

export default function QuickOpen({
  open,
  query,
  onQueryChange,
  onClose,
  onOpenTab,
  onOpenPath,
  onOpenGrid,
  onOpenSettings,
}: QuickOpenProps) {
  const tabs = useStore((s) => s.tabs);
  const recentFiles = useStore((s) => s.recentFiles);
  const inputRef = useRef<HTMLInputElement>(null);
  // 选中项与查询绑定：查询一变即回到首项，避免依赖 effect 重置。
  const [selection, setSelection] = useState({ query: "", index: 0 });

  const commands = useMemo(
    () => [
      {
        key: "cmd:grid",
        label: "网格概览",
        hint: "⌘⇧\\",
        icon: "grid" as IconName,
        run: onOpenGrid,
      },
      {
        key: "cmd:settings",
        label: "设置",
        hint: "⌘,",
        icon: "settings" as IconName,
        run: onOpenSettings,
      },
    ],
    [onOpenGrid, onOpenSettings],
  );

  const items = useMemo(
    () => buildQuickItems(tabs, recentFiles, commands, query),
    [tabs, recentFiles, commands, query],
  );

  const { groups, indexByKey } = useMemo(() => {
    const groups = GROUPS.map((g) => ({
      ...g,
      items: items.filter((it) => it.kind === g.kind),
    })).filter((g) => g.items.length > 0);
    const indexByKey = new Map<string, number>();
    let i = 0;
    for (const g of groups) {
      for (const item of g.items) indexByKey.set(item.key, i++);
    }
    return { groups, indexByKey };
  }, [items]);

  const active =
    selection.query === query
      ? Math.min(selection.index, Math.max(0, items.length - 1))
      : 0;

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSelection({ query, index: 0 });
    }
    prevOpenRef.current = open;
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const runItem = useCallback(
    (item: QuickItem | undefined) => {
      if (!item) return;
      if (item.kind === "tab") onOpenTab(item.tabId);
      else if (item.kind === "recent") onOpenPath(item.path);
      else item.run();
      onClose();
    },
    [onOpenTab, onOpenPath, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelection((s) => ({
          query,
          index: Math.min(s.index + 1, items.length - 1),
        }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelection((s) => ({ query, index: Math.max(s.index - 1, 0) }));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        runItem(items[active]);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, items, active, query, onClose, onOpenTab, onOpenPath, runItem]);

  if (!open) return null;

  return (
    <div
      data-testid="quick-open"
      role="dialog"
      aria-label="快速打开"
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 p-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-[560px] max-w-full overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--app-border)] px-3 py-2.5">
          <Icon name="search" size={18} className="text-[var(--app-text-3)]" />
          <input
            ref={inputRef}
            data-testid="quick-open-input"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索页签、最近文件与命令…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-3)]"
          />
          <kbd className="shrink-0 rounded border border-[var(--app-border-strong)] bg-[var(--app-sunken)] px-1.5 py-0.5 text-[11px] text-[var(--app-text-2)]">
            Esc
          </kbd>
        </div>

        <div
          className="max-h-[52vh] overflow-y-auto py-1"
          aria-label="快速打开结果"
        >
          {items.length === 0 && (
            <div
              data-testid="quick-open-empty"
              className="px-3 py-6 text-center text-sm text-[var(--app-text-3)]"
            >
              没有匹配的结果
            </div>
          )}

          {groups.map((group) => (
            <section
              key={group.kind}
              data-quick-group={group.kind}
              className="mb-1 last:mb-0"
            >
              <h3 className="px-3 py-1 text-[11px] font-medium text-[var(--app-text-3)]">
                {group.label}
              </h3>
              {group.items.map((item) => {
                const index = indexByKey.get(item.key) ?? 0;
                const isActive = index === active;
                const icon =
                  item.kind === "command"
                    ? item.icon
                    : iconOfType(fileTypeOf(item.path));
                const color =
                  item.kind === "command"
                    ? "var(--app-accent)"
                    : colorOfType(fileTypeOf(item.path));
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-testid="quick-open-row"
                    data-quick-kind={item.kind}
                    data-quick-id={item.key}
                    data-active={isActive ? "true" : "false"}
                    aria-current={isActive ? "true" : undefined}
                    onMouseEnter={() => setSelection({ query, index })}
                    onClick={() => runItem(item)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--app-text)] ${
                      isActive ? "bg-[var(--app-accent-soft)]" : ""
                    }`}
                  >
                    <Icon name={icon} size={18} color={color} />
                    <span className="min-w-0 flex-1 truncate">
                      <Highlight
                        text={item.kind === "command" ? item.label : item.title}
                        query={query}
                      />
                    </span>
                    {item.kind === "command" && (
                      <kbd className="shrink-0 rounded border border-[var(--app-border)] bg-[var(--app-sunken)] px-1.5 py-0.5 text-[11px] text-[var(--app-text-3)]">
                        {item.hint}
                      </kbd>
                    )}
                    {item.kind !== "command" && item.path && (
                      <span className="shrink-0 text-[11px] text-[var(--app-text-3)]">
                        {item.path}
                      </span>
                    )}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
