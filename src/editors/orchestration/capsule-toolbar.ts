/**
 * 胶囊选区工具条（#572）。
 *
 * 两行按钮：靠近指针的一行放高频动作，另一行放次级动作；颜色按钮在原位
 * 展开 12 色条，不另起浮层。按钮在 pointerdown 阻止默认行为，避免点击时
 * 丢失编辑器选区。
 */
import { iconSvg, type IconName } from "../../ui/icons";

export interface CapsuleItem {
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
}

export interface CapsulePalette {
  font: readonly { label: string; className: string; swatch?: string }[];
  background: readonly {
    label: string;
    className: string;
    swatch?: string;
  }[];
  apply: (kind: "font" | "background", className: string) => void;
}

export interface CapsuleHandle {
  element: HTMLDivElement;
  destroy: () => void;
}

const GAP = 8;

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

export function createCapsuleToolbar(
  primary: CapsuleItem[],
  secondary: CapsuleItem[],
  onClose: () => void,
  palette: CapsulePalette,
  anchor: { x: number; y: number },
): CapsuleHandle {
  const root = node("div", "app-capsule-toolbar");
  root.dataset.testid = "selection-capsule";
  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "选区工具条");

  const row = node("div", "capsule-row capsule-row-single");
  root.appendChild(row);

  const makeButton = (item: CapsuleItem, row: HTMLElement) => {
    const btn = node("button", "capsule-btn");
    btn.type = "button";
    btn.dataset.action = item.id;
    btn.title = item.label;
    btn.setAttribute("aria-label", item.label);
    btn.innerHTML = iconSvg(item.icon, 16);
    btn.addEventListener("pointerdown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.run();
    });
    row.appendChild(btn);
  };

  const paintRows = () => {
    row.replaceChildren();
    for (const item of secondary) makeButton(item, row);
    for (const item of primary) makeButton(item, row);
    root.classList.remove("is-palette");
  };

  const paintPalette = () => {
    row.replaceChildren();
    const draw = (
      colors: CapsulePalette["font"],
      kind: "font" | "background",
      row: HTMLElement,
    ) => {
      for (const color of colors) {
        const btn = node("button", "capsule-swatch");
        btn.type = "button";
        btn.dataset.action = `${kind}-${color.className || "default"}`;
        btn.title = color.label;
        btn.setAttribute("aria-label", color.label);
        if (color.swatch) btn.style.background = color.swatch;
        else btn.classList.add("is-default");
        btn.addEventListener("pointerdown", (e) => e.preventDefault());
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          palette.apply(kind, color.className);
        });
        row.appendChild(btn);
      }
    };
    draw(palette.font, "font", row);
    draw(palette.background, "background", row);
    root.classList.add("is-palette");
  };

  for (const item of primary) {
    if (item.id === "capsule-font" || item.id === "capsule-bg") {
      item.run = paintPalette;
    }
  }

  paintRows();

  document.body.appendChild(root);

  function close(): void {
    cleanup();
    root.remove();
    onClose();
  }

  const onOutside = (e: PointerEvent) => {
    if (root.contains(e.target as Node)) return;
    close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  const onScroll = () => close();

  document.addEventListener("pointerdown", onOutside, true);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onScroll, true);

  function cleanup(): void {
    document.removeEventListener("pointerdown", onOutside, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onScroll, true);
  }

  const place = (x: number, y: number) => {
    const rect = root.getBoundingClientRect();
    const left = Math.min(
      Math.max(x - rect.width / 2, GAP),
      window.innerWidth - rect.width - GAP,
    );
    const top = Math.max(y - rect.height - GAP, GAP);
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
  };

  requestAnimationFrame(() => {
    if (!root.isConnected) return;
    place(anchor.x, anchor.y);
    root.classList.add("is-open");
  });

  return {
    element: root,
    destroy: () => {
      cleanup();
      root.remove();
    },
  };
}
