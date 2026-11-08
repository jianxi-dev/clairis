import { iconSvg, type IconName } from "../../ui/icons";
import { FONT_COLORS, BACKGROUND_COLORS } from "./color-palette";
import {
  FAN_ITEM_SIZE,
  FAN_RADIUS,
  ROOT_SECTORS,
  ROOT_RADIUS,
  ROOT_SECTOR_SIZE,
  ROULETTE_BOX,
  ROULETTE_CENTER,
  clampBoxCenter,
  fanAngles,
  polar,
  ringAngles,
  type SectorId,
} from "./roulette";

export interface RouletteItem {
  id: string;
  label: string;
  icon: IconName;
  run?: () => void;
  /** 格式类动作执行后保持展开。 */
  keepOpen?: boolean;
  /** 有子项时点击进第三层（原位替换）。 */
  children?: RouletteItem[];
}

export interface RouletteActions {
  smart: RouletteItem[];
  convert: () => RouletteItem[];
  align: RouletteItem[];
  columns: RouletteItem[];
  history: RouletteItem[];
  clear: RouletteItem[];
  format: RouletteItem[];
  color: (kind: "font" | "background", className: string) => void;
  painter: { toggle: () => void; count: () => number; active: () => boolean };
}

const CLOSE_DELAY_MS = 240;
const DWELL_MS = 90;
const DWELL_SWITCH_MS = 300;

function button(className: string): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  return el;
}

function place(el: HTMLElement, angle: number, radius: number, size: number) {
  const p = polar(angle, radius);
  el.style.left = `${ROULETTE_CENTER + p.x - size / 2}px`;
  el.style.top = `${ROULETTE_CENTER + p.y - size / 2}px`;
}

export interface RouletteHandle {
  element: HTMLDivElement;
  destroy: () => void;
  setCenter: (x: number, y: number) => void;
  setPainter: (active: boolean, count: number) => void;
}

export function createRoulette(
  actions: RouletteActions,
  onClose: () => void,
  options: { sectors?: readonly SectorId[] } = {},
): RouletteHandle {
  const sectors = options.sectors ?? ROOT_SECTORS.map((s) => s.id);
  const root = document.createElement("div");
  root.className = "selection-roulette";
  root.dataset.testid = "selection-roulette";
  root.setAttribute("role", "menu");
  root.setAttribute("aria-label", "选区轮盘");
  root.style.width = `${ROULETTE_BOX}px`;
  root.style.height = `${ROULETTE_BOX}px`;

  const fanLayer = document.createElement("div");
  fanLayer.className = "sr-fan";
  const center = button("sr-center");
  center.dataset.testid = "roulette-center";
  center.textContent = "✦";
  center.setAttribute("aria-label", "格式刷");
  root.appendChild(fanLayer);
  root.appendChild(center);

  let openSector: SectorId | null = null;
  let level: "root" | "fan" | "third" = "root";
  let dwellTimer: number | null = null;
  let closeTimer: number | null = null;

  const clearTimers = () => {
    if (dwellTimer !== null) window.clearTimeout(dwellTimer);
    if (closeTimer !== null) window.clearTimeout(closeTimer);
    dwellTimer = null;
    closeTimer = null;
  };

  const reset = (): void => {
    fanLayer.replaceChildren();
    openSector = null;
    level = "root";
    center.textContent = "✦";
    center.setAttribute("aria-label", "格式刷");
  };

  let closed = false;
  let cleanup = () => {};

  const close = (): void => {
    if (closed) return;
    closed = true;
    cleanup();
    clearTimers();
    reset();
    root.remove();
    onClose();
  };

  const renderItems = (items: RouletteItem[], centerAngle: number) => {
    fanLayer.replaceChildren();
    const angles = fanAngles(centerAngle, items.length);
    items.forEach((item, index) => {
      const el = button("sr-item");
      el.dataset.action = item.id;
      el.title = item.label;
      el.setAttribute("aria-label", item.label);
      el.innerHTML = iconSvg(item.icon, 16);
      place(el, angles[index], FAN_RADIUS, FAN_ITEM_SIZE);
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item.children && item.children.length > 0) {
          center.textContent = "‹";
          center.setAttribute("aria-label", "返回");
          renderItems(item.children, centerAngle);
          level = "third";
          return;
        }
        item.run?.();
        if (item.keepOpen) return;
        close();
      });
      fanLayer.appendChild(el);
    });
    level = "fan";
  };

  const renderColor = () => {
    fanLayer.replaceChildren();
    const fontAngles = ringAngles(FONT_COLORS.length);
    FONT_COLORS.forEach((color, index) => {
      const el = button(
        `sr-color sr-color-font${color.isDefault ? " is-default" : ""}`,
      );
      el.dataset.action = color.className
        ? `font-${color.className}`
        : "font-default";
      el.title = color.label;
      el.setAttribute("aria-label", `文字色 ${color.label}`);
      if (color.isDefault) {
        el.textContent = "A/";
      } else {
        const glyph = document.createElement("span");
        glyph.textContent = "A";
        glyph.style.color = color.swatch;
        el.appendChild(glyph);
      }
      el.style.background = color.swatch
        ? `color-mix(in srgb, ${color.swatch} 16%, transparent)`
        : "var(--app-surface)";
      place(el, fontAngles[index], 100, 28);
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        actions.color("font", color.className);
      });
      fanLayer.appendChild(el);
    });

    const bgAngles = ringAngles(BACKGROUND_COLORS.length);
    BACKGROUND_COLORS.forEach((color, index) => {
      const el = button(
        `sr-color sr-color-bg${color.isDefault ? " is-default" : ""}`,
      );
      el.dataset.action = color.className ? `bg-${color.className}` : "bg-none";
      el.title = color.label;
      el.setAttribute("aria-label", `背景色 ${color.label}`);
      if (!color.isDefault) el.style.background = color.swatch;
      place(el, bgAngles[index], 130, 24);
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        actions.color("background", color.className);
      });
      fanLayer.appendChild(el);
    });
    level = "fan";
  };

  const open = (sector: SectorId) => {
    if (openSector === sector && level !== "root") return;
    clearTimers();
    openSector = sector;
    const def = ROOT_SECTORS.find((s) => s.id === sector)!;
    if (sector === "clear") {
      actions.clear[0]?.run?.();
      close();
      return;
    }
    if (sector === "color") {
      renderColor();
      return;
    }
    if (sector === "convert") {
      renderItems(actions.convert(), def.angle);
      return;
    }
    const items =
      sector === "smart"
        ? actions.smart
        : sector === "align"
          ? actions.align
          : sector === "columns"
            ? actions.columns
            : sector === "history"
              ? actions.history
              : actions.format;
    renderItems(items, def.angle);
  };

  sectors.forEach((id) => {
    const sector = ROOT_SECTORS.find((s) => s.id === id);
    if (!sector) return;
    const el = button("sr-sector");
    el.dataset.sector = sector.id;
    el.title = sector.label;
    el.setAttribute("aria-label", sector.label);
    el.innerHTML = `<span class="sr-sector-icon">${iconSvg(sector.icon, 16)}</span><span class="sr-sector-label">${sector.label}</span>`;
    place(el, sector.angle, ROOT_RADIUS, ROOT_SECTOR_SIZE);
    el.addEventListener("pointerenter", () => {
      clearTimers();
      const delay = openSector === null ? DWELL_MS : DWELL_SWITCH_MS;
      dwellTimer = window.setTimeout(() => open(sector.id), delay);
    });
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      open(sector.id);
    });
    root.appendChild(el);
  });

  root.addEventListener("pointerleave", (event) => {
    const related = event.relatedTarget as Node | null;
    if (related && root.contains(related)) return;
    clearTimers();
    closeTimer = window.setTimeout(() => {
      if (level !== "root") reset();
    }, CLOSE_DELAY_MS);
  });

  center.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (level === "third") {
      open("convert");
      level = "fan";
      return;
    }
    if (level !== "root") {
      reset();
      return;
    }
    actions.painter.toggle();
    const count = actions.painter.count();
    center.textContent =
      count > 0 ? String(count) : actions.painter.active() ? "✎" : "✦";
    center.dataset.painter = actions.painter.active() ? "true" : "false";
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (level !== "root") {
        reset();
        return;
      }
      close();
      return;
    }
    if (e.key >= "1" && e.key <= "8") {
      const index = Number(e.key) - 1;
      const id = sectors[index];
      const sector = ROOT_SECTORS.find((s) => s.id === id);
      if (sector) {
        e.preventDefault();
        open(sector.id);
      }
    }
  };
  document.addEventListener("keydown", onKey, true);

  const onOutside = (e: PointerEvent) => {
    if (root.contains(e.target as Node)) return;
    if (actions.painter.active()) return;
    close();
  };
  document.addEventListener("pointerdown", onOutside, true);

  cleanup = () => {
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onOutside, true);
  };

  const destroy = () => {
    closed = true;
    cleanup();
    clearTimers();
    root.remove();
  };

  const setCenter = (x: number, y: number) => {
    const centerPoint = clampBoxCenter(x, y, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    root.style.left = `${centerPoint.x - ROULETTE_CENTER}px`;
    root.style.top = `${centerPoint.y - ROULETTE_CENTER}px`;
  };

  const setPainter = (active: boolean, count: number) => {
    center.dataset.painter = active ? "true" : "false";
    if (count > 0) center.textContent = String(count);
    else center.textContent = active ? "✎" : "✦";
  };

  return { element: root, destroy, setCenter, setPainter };
}
