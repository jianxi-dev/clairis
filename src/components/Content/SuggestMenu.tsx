import {
  useEffect,
  useLayoutEffect,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { digitFromCode } from "../../lib/gridKeyboard";
import { activateLocalContext } from "../../lib/shortcuts";
import { useMenuPos } from "./useMenuPos";

export interface SuggestRow {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface SuggestMenuProps {
  rows: SuggestRow[];
  selected: number;
  onPick: (index: number) => void;
  onMove: (delta: 1 | -1) => void;
  onEmptyEnter?: () => void;
  onClose: () => void;
  anchor: { x: number; y: number } | null;
  context: string;
  hostRef: RefObject<HTMLElement | null>;
  testId: string;
  rowTestId: string;
  emptyText?: string;
}

/**
 * 建议菜单（文档链接 / 标签建议共用一份实现）。
 *
 * 键盘在 host 的 capture 阶段拦截 ⌘1~9 / Enter / ↑↓ / Esc 并 stopPropagation，
 * 局部键因此优先于全局「卡片直开 ⌘1–9」；菜单关闭即解除，无残留占用。
 * 打开期间把 context 注册进 shortcuts.ts 的局部键上下文。
 */
export default function SuggestMenu({
  rows,
  selected,
  onPick,
  onMove,
  onEmptyEnter,
  onClose,
  anchor,
  context,
  hostRef,
  testId,
  rowTestId,
  emptyText,
}: SuggestMenuProps) {
  const { pos, ref: menuRef } = useMenuPos(anchor);

  useEffect(() => {
    const off = activateLocalContext(context);
    return off;
  }, [context]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      let handled = true;
      if (e.key === "ArrowDown") onMove(1);
      else if (e.key === "ArrowUp") onMove(-1);
      else if (e.key === "Enter") {
        if (rows.length > 0) onPick(selected);
        else onEmptyEnter?.();
      } else if (e.key === "Escape") onClose();
      else if (meta) {
        const digit = digitFromCode(e.code);
        if (digit !== null && digit <= rows.length) onPick(digit - 1);
        else handled = false;
      } else handled = false;

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    host.addEventListener("keydown", onKey, { capture: true });
    return () => host.removeEventListener("keydown", onKey, { capture: true });
  }, [hostRef, rows, selected, onPick, onMove, onEmptyEnter, onClose]);

  useLayoutEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (hostRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [hostRef, menuRef, onClose]);

  if (!anchor) return null;

  return createPortal(
    <span
      ref={menuRef}
      className="dpb-menu"
      data-testid={testId}
      role="menu"
      aria-label="建议"
      style={{ left: (pos ?? anchor).x, top: (pos ?? anchor).y }}
    >
      {rows.length === 0 ? (
        <span className="dpb-menu-row dpb-menu-empty">
          {emptyText ?? "没有匹配项"}
        </span>
      ) : (
        rows.map((row, i) => (
          <button
            key={row.id}
            type="button"
            role="menuitem"
            className={`dpb-menu-row${i === selected ? " dpb-menu-row-cur" : ""}`}
            data-testid={rowTestId}
            data-index={i}
            aria-current={i === selected}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(i)}
          >
            {row.icon ? <span className="dpb-menu-ico">{row.icon}</span> : null}
            <span className="dpb-menu-label">{row.label}</span>
            <span className="dpb-menu-key">
              {i === selected ? "⏎" : `⌘${i + 1}`}
            </span>
          </button>
        ))
      )}
    </span>,
    document.body,
  );
}
