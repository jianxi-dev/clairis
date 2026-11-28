import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon";
import { useAnchoredPosition } from "./useAnchoredPosition";
import { useLayerDismiss } from "./useLayerDismiss";
import { PortalScope } from "./PortalScope";

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}

interface MenuProps {
  anchor: { x: number; y: number };
  items: readonly MenuItem[];
  onClose: () => void;
  testId?: string;
  /** 翻转 / 夹取的右 / 下缘容器；缺省只夹视口（#1017 嵌入态靠它） */
  boundsOf?: () => HTMLElement | null;
  /** 触发器：点击它不算「点外」，供「再开一层」的按钮复用同一锚点 */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * 基件 Menu（ui-quality-primitives-v1 / 2.2）。
 *
 * 定位走 `useAnchoredPosition(..., { placement: "flip" })`（12 向翻转），
 * 关闭仲裁走 `useLayerDismiss`（Esc / 点外 / 滚动，只关栈顶），
 * 挂载走 `PortalScope`（统一 portal 宿主）。
 * 样式全在 `src/styles/primitives.css` 的 `bp-menu*` 类。
 */
export function Menu({ anchor, items, onClose, testId, boundsOf, triggerRef }: MenuProps): JSX.Element {
  const { pos, ref, side } = useAnchoredPosition<HTMLDivElement>(anchor, {
    placement: "flip",
    boundsOf,
  });
  useLayerDismiss({
    ref,
    onDismiss: onClose,
    isInside: (target) =>
      ref.current?.contains(target as Node) ||
      triggerRef?.current?.contains(target as Node) ||
      false,
  });
  const listRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    listRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();
  }, [ready]);

  const move = (dir: 1 | -1) => {
    const list = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    if (list.length === 0) return;
    const i = list.findIndex((el) => el === document.activeElement);
    list[(i + dir + list.length) % list.length].focus();
  };

  return (
    <PortalScope id={testId}>
      <div
        ref={ref}
        data-testid={testId}
        data-side={side ?? ""}
        role="menu"
        className="bp-menu"
        style={{ left: pos?.x ?? anchor.x, top: pos?.y ?? anchor.y }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            const el = document.activeElement as HTMLButtonElement | null;
            if (el?.getAttribute("role") === "menuitem") {
              e.preventDefault();
              el.click();
            }
            return;
          }
          if (e.key === "Tab") onClose();
        }}
      >
        <div ref={listRef} className="bp-menu__list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={[
                "bp-menu__item",
                item.disabled ? "bp-menu__item--disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                onClose();
                item.run();
              }}
            >
              {item.icon ? (
                <Icon name={item.icon} size={14} className="bp-menu__icon" />
              ) : null}
              <span className="bp-menu__label">{item.label}</span>
              {item.shortcut ? (
                <span className="bp-menu__shortcut">{item.shortcut}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </PortalScope>
  );
}

export default Menu;
