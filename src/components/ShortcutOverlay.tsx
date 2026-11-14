import { useEffect } from "react";
import Icon from "./Icon";
import {
  SHORTCUT_FAMILY_LABELS,
  SHORTCUT_FAMILY_ORDER,
  shortcutsByFamily,
} from "../lib/shortcuts";

/**
 * 快捷键总览浮层（layout-portal 15.1 / R-10.3）。
 *
 * `?` 全局开关（App 层处理），全表与 `SHORTCUTS` 注册表严格相等；按家族分组，
 * 冲突裁定项在行内显示 `data-testid="shortcut-decision"`。z-index 高于设置场景。
 */
export default function ShortcutOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="shortcut-overlay"
      role="dialog"
      aria-label="快捷键总览"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-[640px] max-w-full flex-col overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-2.5">
          <h2 className="text-sm font-medium text-[var(--app-text-strong)]">
            快捷键总览
          </h2>
          <button
            type="button"
            data-testid="shortcut-overlay-close"
            aria-label="关闭快捷键总览"
            title="关闭 (Esc)"
            onClick={onClose}
            className="rounded p-0.5 text-[var(--app-text-3)] hover:bg-[var(--app-sunken)] hover:text-[var(--app-text)]"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {SHORTCUT_FAMILY_ORDER.map((family) => {
            const items = shortcutsByFamily(family);
            if (items.length === 0) return null;
            return (
              <section
                key={family}
                data-shortcut-family={family}
                className="mb-4 last:mb-0"
              >
                <h3 className="mb-1 text-xs font-medium text-[var(--app-text-3)]">
                  {SHORTCUT_FAMILY_LABELS[family]}
                </h3>
                <ul className="divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">
                  {items.map((shortcut) => (
                    <li
                      key={shortcut.id}
                      data-testid="shortcut-row"
                      data-shortcut-id={shortcut.id}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <span className="min-w-0 text-sm text-[var(--app-text)]">
                        {shortcut.label}
                        {shortcut.decision && (
                          <span
                            data-testid="shortcut-decision"
                            className="ml-2 text-xs text-[var(--app-text-3)]"
                          >
                            {shortcut.decision}
                          </span>
                        )}
                      </span>
                      <kbd className="shrink-0 rounded border border-[var(--app-border-strong)] bg-[var(--app-sunken)] px-2 py-0.5 text-xs text-[var(--app-text-2)]">
                        {shortcut.keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
