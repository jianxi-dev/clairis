import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import type { IconName } from "../ui/icons";
import { popOverlay, pushOverlay } from "../lib/overlayGate";

export interface ContextMenuItem {
  label: string;
  icon: IconName;
  disabled?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  testId?: string;
}

const MENU_W = 180;
const ITEM_H = 30;

export default function ContextMenu({
  x,
  y,
  items,
  onClose,
  testId,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    pushOverlay();
    return () => popOverlay();
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  useEffect(() => {
    ref.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();
  }, []);

  const move = useCallback((dir: 1 | -1) => {
    const list = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    if (list.length === 0) return;
    const i = list.findIndex((el) => el === document.activeElement);
    list[(i + dir + list.length) % list.length].focus();
  }, []);

  const left = Math.min(x, Math.max(window.innerWidth - MENU_W - 8, 8));
  const top = Math.min(
    y,
    Math.max(window.innerHeight - items.length * ITEM_H - 16, 8),
  );

  return createPortal(
    <div
      ref={ref}
      data-testid={testId ?? "context-menu"}
      role="menu"
      className="context-menu"
      style={{ left, top, width: MENU_W }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          move(e.key === "ArrowDown" ? 1 : -1);
          return;
        }
        if (e.key === "Tab") onClose();
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className="context-menu-item"
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
