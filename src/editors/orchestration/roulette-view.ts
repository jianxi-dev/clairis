import { iconSvg, type IconName } from "../../ui/icons";
import { isMacPlatform } from "../key-chord";
import { executeCommand, hasCommand, type CommandContext } from "./commands";
import { FONT_COLORS, BACKGROUND_COLORS } from "./color-palette";
import {
  COLOR_BG_DEG,
  COLOR_BG_IN,
  COLOR_BG_OUT,
  COLOR_FONT_DEG,
  COLOR_FONT_IN,
  COLOR_FONT_OUT,
  FAN_IN,
  FAN_OUT,
  GAP_DEG,
  ITEM_DEG,
  ROOT_IN,
  ROOT_LABEL_RADIUS,
  ROOT_OUT,
  ROOT_SECTOR_DEG,
  ROOT_SECTORS,
  ROULETTE_BOX,
  SUB_DIM_OPACITY,
  THIRD_IN,
  THIRD_OUT,
  angleOfPoint,
  clampBoxCenter,
  fanAngles,
  polar,
  sectorPath,
  type SectorId,
} from "./roulette";

export interface RouletteItem {
  id: string;
  label: string;
  icon: IconName;
  run?: () => void;
  /** 注册表命令标识；无 `run` 时经 executeCommand 执行。 */
  commandId?: string;
  /** 格式类动作执行后保持展开。 */
  keepOpen?: boolean;
  /** 有子项时点击进第三层。 */
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

export interface RouletteHandle {
  element: HTMLDivElement;
  destroy: () => void;
  setCenter: (x: number, y: number) => void;
  setPainter: (active: boolean, count: number) => void;
  getForm: () => RouletteForm;
}

export type RouletteForm = "hub" | "disk";

const SVG_NS = "http://www.w3.org/2000/svg";
const CLOSE_DELAY_MS = 400;

interface Cmd {
  item: RouletteItem;
  group: string;
}

export interface RouletteGroup {
  items: RouletteItem[];
  label: string;
}

/**
 * 筛选树遍历：父级命中 → 展开其全部可执行后代（父级自身不重复显示）；
 * 父级未命中 → 递归子级；叶子命中且可执行 → 收录（group 记最近父级）。
 * 平铺过滤会把「父级命中但子级 label 不含父级名」的场景漏光，只剩死父级行。
 * 同一 item.id 只收录一次，避免跨分组重复。
 */
export function matchCommandsIn(
  groups: readonly RouletteGroup[],
  query: string,
  isExecutable: (item: RouletteItem) => boolean,
): Cmd[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: Cmd[] = [];
  const seen = new Set<string>();
  const push = (item: RouletteItem, groupLabel: string) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push({ item, group: groupLabel });
  };
  const pushDescendants = (
    items: readonly RouletteItem[],
    groupLabel: string,
  ) => {
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        pushDescendants(item.children, item.label);
      } else if (isExecutable(item)) {
        push(item, groupLabel);
      }
    }
  };
  const walk = (items: readonly RouletteItem[], groupLabel: string) => {
    for (const item of items) {
      const hit = item.label.toLowerCase().includes(q);
      if (item.children && item.children.length > 0) {
        if (hit) pushDescendants(item.children, item.label);
        else walk(item.children, item.label);
      } else if (hit && isExecutable(item)) {
        push(item, groupLabel);
      }
    }
  };
  for (const g of groups) walk(g.items, g.label);
  return out;
}

function formatShortcut(n: number): string {
  return isMacPlatform() ? `⌘${n}` : `Ctrl+${n}`;
}

function svgNode<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function checkerPattern(): SVGDefsElement {
  const pattern = svgNode("pattern", {
    id: "sr-checker",
    width: "6",
    height: "6",
    patternUnits: "userSpaceOnUse",
  });
  pattern.append(
    svgNode("rect", { width: "6", height: "6", class: "sr-checker-bg" }),
    svgNode("rect", { width: "3", height: "3", class: "sr-checker-cell" }),
    svgNode("rect", {
      x: "3",
      y: "3",
      width: "3",
      height: "3",
      class: "sr-checker-cell",
    }),
  );
  const defs = svgNode("defs");
  defs.appendChild(pattern);
  return defs;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function button(className: string): HTMLButtonElement {
  const node = el("button", className);
  node.type = "button";
  return node;
}

export function createRoulette(
  actions: RouletteActions,
  onClose: () => void,
  options: {
    sectors?: readonly SectorId[];
    commandContext?: () => CommandContext | null;
    form?: RouletteForm;
    onMove?: (x: number, y: number) => void;
    onFormChange?: (form: RouletteForm) => void;
  } = {},
): RouletteHandle {
  const visibleSectors = options.sectors ?? ROOT_SECTORS.map((s) => s.id);
  let form: RouletteForm = options.form ?? "hub";
  const isExecutable = (item: RouletteItem): boolean =>
    !!item.run || (!!item.commandId && hasCommand(item.commandId));
  const root = el("div", "selection-roulette");
  root.dataset.testid = "selection-roulette";
  root.setAttribute("role", "menu");
  root.setAttribute("aria-label", "选区轮盘");
  root.style.width = `${ROULETTE_BOX}px`;
  root.style.height = `${ROULETTE_BOX}px`;

  const svg = svgNode("svg", {
    class: "sr-svg",
    viewBox: `0 0 ${ROULETTE_BOX} ${ROULETTE_BOX}`,
    width: String(ROULETTE_BOX),
    height: String(ROULETTE_BOX),
    "aria-hidden": "true",
  });
  const rootLayer = svgNode("g", { class: "sr-root-layer" });
  const subLayer = svgNode("g", { class: "sr-sub-layer" });
  svg.append(checkerPattern(), rootLayer, subLayer);

  const labelLayer = el("div", "sr-labels");
  const overlay = el("div", "sr-overlay");
  const hub = button("sr-hub");
  hub.dataset.testid = "roulette-center";
  hub.title = "格式刷：取当前选区格式";
  hub.setAttribute("aria-label", "格式刷");

  const filterPanel = el("div", "sr-filter");
  filterPanel.dataset.testid = "sr-filter-panel";
  const filterInput = el("input", "sr-filter-input");
  filterInput.dataset.testid = "sr-filter-input";
  filterInput.placeholder = "筛选全部动作…";
  filterInput.setAttribute("aria-label", "筛选动作");
  const filterList = el("div", "sr-filter-list");
  filterPanel.append(filterInput, filterList);
  filterPanel.hidden = true;

  root.append(svg, labelLayer, overlay, hub, filterPanel);
  document.body.appendChild(root);

  const applyForm = () => {
    root.dataset.form = form;
    root.classList.toggle("form-hub", form === "hub");
    root.classList.toggle("form-disk", form === "disk");
  };
  applyForm();

  let openSector: SectorId | null = null;
  let group: RouletteItem | null = null;
  let groupCenter: number | null = null;
  let hot = -1;
  let thirdCenters: number[] = [];
  let filter: string | null = null;
  let matches: Cmd[] = [];
  let closed = false;
  let closeTimer = 0;
  let opened = false;
  let center = { x: 0, y: 0 };
  let painterArmed = false;

  const sectorOf = (id: SectorId) => ROOT_SECTORS.find((s) => s.id === id)!;

  const sectorItems = (): RouletteItem[] => {
    if (!openSector) return [];
    switch (openSector) {
      case "smart":
        return actions.smart;
      case "convert":
        return actions.convert();
      case "align":
        return actions.align;
      case "columns":
        return actions.columns;
      case "history":
        return actions.history;
      case "clear":
        return actions.clear;
      case "format":
        return actions.format;
      case "color":
        return [];
    }
  };

  const currentItems = (): RouletteItem[] => {
    if (filter !== null) return matches.map((m) => m.item);
    if (group) return group.children ?? [];
    return sectorItems();
  };

  const matchCommands = (query: string): Cmd[] =>
    matchCommandsIn(
      [
        { items: actions.smart, label: "智能" },
        { items: actions.convert(), label: "转换" },
        { items: actions.align, label: "对齐" },
        { items: actions.columns, label: "分栏" },
        { items: actions.history, label: "历史" },
        { items: actions.clear, label: "清格" },
        { items: actions.format, label: "格式" },
      ],
      query,
      isExecutable,
    );

  const updateHub = () => {
    const painterActive = actions.painter.active();
    const count = actions.painter.count();
    hub.dataset.painter = painterActive ? "true" : "false";
    if (group) {
      hub.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6 8.5 12l6 6"/></svg>`;
      hub.title = "返回上一层";
      hub.setAttribute("aria-label", "返回");
      return;
    }
    hub.innerHTML = iconSvg("brush", 18);
    if (count > 0) {
      const badge = el("span", "sr-hub-count");
      badge.textContent = String(count);
      hub.appendChild(badge);
    }
    hub.title = painterActive ? "退出格式刷" : "格式刷：取当前选区格式";
    hub.setAttribute("aria-label", "格式刷");
  };

  const markHot = () => {
    subLayer
      .querySelectorAll<SVGPathElement>("path[data-band]")
      .forEach((p) => {
        const idx = Number(p.dataset.idx);
        const band = Number(p.dataset.band);
        const active =
          idx === hot && (band === 3 ? !!group : !group) && filter === null;
        p.classList.toggle("hot", active);
      });
    filterList
      .querySelectorAll<HTMLElement>("[data-row]")
      .forEach((row, i) => row.classList.toggle("hot", i === hot));
  };

  const clearSub = () => {
    subLayer.replaceChildren();
    overlay.replaceChildren();
  };

  const drawBand = (
    items: RouletteItem[],
    rIn: number,
    rOut: number,
    band: 2 | 3,
    alpha: number,
    centerAngle: number,
  ) => {
    const angles = fanAngles(centerAngle, items.length);
    items.forEach((item, i) => {
      const center = angles[i];
      const path = svgNode("path", {
        d: sectorPath(
          rIn,
          rOut,
          center - ITEM_DEG / 2 + GAP_DEG,
          center + ITEM_DEG / 2 - GAP_DEG,
        ),
        class: "sr-sec sr-sub",
      });
      if (alpha < 1) path.style.opacity = String(alpha);
      path.dataset.band = String(band);
      path.dataset.idx = String(i);
      path.dataset.action = item.id;
      path.dataset.testid = (band === 3 ? "l3-slot-" : "sub-slot-") + String(i);
      path.setAttribute("role", "menuitem");
      path.setAttribute("aria-label", item.label);
      path.addEventListener("pointerenter", () => {
        if (band === 3 || !group) {
          hot = i;
          markHot();
        }
      });
      if (!isExecutable(item)) path.setAttribute("aria-disabled", "true");
      path.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item.children && item.children.length > 0 && band === 2) {
          openGroup(item);
          return;
        }
        if (!isExecutable(item)) return;
        runLeaf(item);
      });
      subLayer.appendChild(path);

      const mid = (rIn + rOut) / 2;
      const unit = el("div", "sr-unit");
      if (band === 2) unit.classList.add("sr-item");
      if (alpha < 1) unit.style.opacity = String(alpha);
      unit.dataset.band = String(band);
      unit.dataset.idx = String(i);
      unit.dataset.action = item.id;
      unit.style.left = `${polar(center, mid).x + ROULETTE_BOX / 2}px`;
      unit.style.top = `${polar(center, mid).y + ROULETTE_BOX / 2}px`;
      unit.innerHTML = iconSvg(item.icon, 15);
      if (item.children && band === 2) {
        const caret = el("span", "sr-unit-caret");
        caret.textContent = "›";
        unit.appendChild(caret);
      }
      unit.setAttribute("aria-hidden", "true");
      overlay.appendChild(unit);
    });
  };

  const renderColor = (centerAngle: number) => {
    const draw = (
      colors: typeof FONT_COLORS,
      rIn: number,
      rOut: number,
      width: number,
      kind: "font" | "background",
      withLetter: boolean,
    ) => {
      const angles = fanAngles(centerAngle, colors.length, width);
      colors.forEach((color, i) => {
        const center = angles[i];
        const path = svgNode("path", {
          d: sectorPath(
            rIn,
            rOut,
            center - width / 2 + GAP_DEG,
            center + width / 2 - GAP_DEG,
          ),
          class: `sr-sec sr-color ${kind === "font" ? "sr-color-font" : "sr-color-bg"}${color.isDefault ? " is-default" : ""}`,
        });
        path.dataset.action = color.className
          ? `${kind === "font" ? "font" : "bg"}-${color.className}`
          : `${kind === "font" ? "font" : "bg"}-default`;
        path.setAttribute("role", "menuitem");
        path.setAttribute("aria-label", `${color.label}`);
        if (color.swatch) path.style.setProperty("--sw", color.swatch);
        else path.classList.add("bare");
        path.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          actions.color(kind, color.className);
        });
        subLayer.appendChild(path);

        if (!withLetter) return;
        const p = polar(center, (rIn + rOut) / 2);
        const letter = el("div", "sr-color-A");
        letter.style.left = `${p.x + ROULETTE_BOX / 2}px`;
        letter.style.top = `${p.y + ROULETTE_BOX / 2}px`;
        letter.style.transform = `translate(-50%, -50%) rotate(${center}deg)`;
        letter.textContent = color.isDefault ? "A/" : "A";
        if (color.isDefault) letter.classList.add("none");
        else letter.style.color = color.swatch;
        overlay.appendChild(letter);
      });
    };
    draw(
      FONT_COLORS,
      COLOR_FONT_IN,
      COLOR_FONT_OUT,
      COLOR_FONT_DEG,
      "font",
      true,
    );
    draw(
      BACKGROUND_COLORS,
      COLOR_BG_IN,
      COLOR_BG_OUT,
      COLOR_BG_DEG,
      "background",
      false,
    );
  };

  const render = () => {
    clearSub();
    root.classList.toggle("sub-open", openSector !== null);
    root.classList.toggle("third-open", group !== null);
    root.classList.toggle("filtering", filter !== null);

    if (filter === null && openSector) {
      const def = sectorOf(openSector);
      if (openSector === "color") {
        renderColor(def.angle);
      } else {
        const items = sectorItems();
        drawBand(
          items,
          FAN_IN,
          FAN_OUT,
          2,
          group ? SUB_DIM_OPACITY : 1,
          def.angle,
        );
        if (group) {
          const children = group.children ?? [];
          thirdCenters = fanAngles(groupCenter ?? def.angle, children.length);
          drawBand(
            children,
            THIRD_IN,
            THIRD_OUT,
            3,
            1,
            groupCenter ?? def.angle,
          );
        } else {
          thirdCenters = [];
        }
      }
    }
    updateHub();
    markHot();
  };

  const openGroup = (item: RouletteItem) => {
    if (!item.children) return;
    const list = sectorItems();
    const idx = list.indexOf(item);
    const base = openSector ? sectorOf(openSector).angle : 0;
    groupCenter =
      idx < 0 || list.length <= 1
        ? base
        : base - ((list.length - 1) * ITEM_DEG) / 2 + idx * ITEM_DEG;
    group = item;
    hot = item.children ? Math.floor((item.children.length - 1) / 2) : -1;
    render();
  };

  const backOneLevel = () => {
    if (filter !== null) {
      closeFilter();
      return;
    }
    if (group) {
      group = null;
      groupCenter = null;
      hot = -1;
      render();
      return;
    }
    if (openSector) {
      openSector = null;
      hot = -1;
      render();
    }
  };

  const runLeaf = (item: RouletteItem) => {
    if (item.run) {
      item.run();
    } else if (item.commandId) {
      const ctx = options.commandContext?.() ?? null;
      if (!ctx || !executeCommand(item.commandId, ctx)) return;
    } else {
      return;
    }
    if (item.keepOpen) return;
    close();
  };

  const openSectorById = (id: SectorId) => {
    if (openSector === id && !group) {
      backOneLevel();
      return;
    }
    openSector = id;
    group = null;
    groupCenter = null;
    hot = -1;
    if (id === "clear") {
      const item = actions.clear[0];
      if (item) runLeaf(item);
      else close();
      return;
    }
    render();
  };

  const closeFilter = () => {
    filter = null;
    matches = [];
    hot = -1;
    filterPanel.hidden = true;
    filterList.replaceChildren();
    filterInput.value = "";
    render();
  };

  const paintFilterRows = () => {
    filterList.replaceChildren();
    if (matches.length === 0) {
      const empty = el("div", "sr-filter-empty");
      empty.textContent = filter?.trim() ? "无匹配" : "输入关键词";
      filterList.appendChild(empty);
      return;
    }
    matches.forEach((row, i) => {
      const b = button("sr-filter-row");
      b.dataset.row = String(i);
      b.dataset.action = row.item.id;
      b.innerHTML = iconSvg(row.item.icon, 15);
      const label = el("span", "sr-filter-label");
      label.textContent = row.item.label;
      b.append(label);
      const shortcut = el("span", "sr-filter-shortcut");
      if (i < 9) {
        shortcut.textContent = i === 0 ? "回车" : formatShortcut(i + 1);
        shortcut.dataset.shortcut = String(i + 1);
      }
      b.append(shortcut);
      b.addEventListener("pointerdown", (e) => e.preventDefault());
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        runLeaf(row.item);
      });
      filterList.appendChild(b);
    });
    markHot();
  };

  const openFilter = () => {
    if (filter === null) filter = "";
    matches = matchCommands(filter);
    hot = matches.length > 0 ? 0 : -1;
    filterPanel.hidden = false;
    root.classList.add("filtering");
    filterInput.value = filter;
    paintFilterRows();
    requestAnimationFrame(() => filterInput.focus());
  };

  const close = () => {
    if (closed) return;
    closed = true;
    window.clearTimeout(closeTimer);
    cleanup();
    root.remove();
    onClose();
  };

  visibleSectors.forEach((id) => {
    const sector = sectorOf(id);
    const path = svgNode("path", {
      d: sectorPath(
        ROOT_IN,
        ROOT_OUT,
        sector.angle - ROOT_SECTOR_DEG / 2 + GAP_DEG,
        sector.angle + ROOT_SECTOR_DEG / 2 - GAP_DEG,
      ),
      class: "sr-sec sr-sector",
    });
    path.dataset.sector = sector.id;
    path.dataset.testid = `sector-${sector.id}`;
    path.setAttribute("role", "menuitem");
    path.setAttribute("aria-label", sector.label);
    path.addEventListener("pointerenter", () => {
      window.clearTimeout(closeTimer);
    });
    path.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSectorById(sector.id);
    });
    rootLayer.appendChild(path);

    const p = polar(sector.angle, ROOT_LABEL_RADIUS);
    const label = el("div", "sr-root-item");
    label.dataset.sectorLabel = sector.id;
    label.style.left = `${p.x + ROULETTE_BOX / 2}px`;
    label.style.top = `${p.y + ROULETTE_BOX / 2}px`;
    const icon = sectorIcon(sector.id);
    label.innerHTML = `<span class="sr-root-icon" data-icon="${icon}">${iconSvg(icon, 14)}</span><span class="sr-sector-label">${sector.label}</span>`;
    label.setAttribute("aria-hidden", "true");
    labelLayer.appendChild(label);
  });

  hub.addEventListener("pointerdown", (e) => e.preventDefault());
  hub.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 双击圆心切换形态；第一下会误触格式刷，这里回退掉。
    if (e.detail >= 2) {
      if (painterArmed) {
        painterArmed = false;
        actions.painter.toggle();
      }
      form = form === "hub" ? "disk" : "hub";
      applyForm();
      options.onFormChange?.(form);
      return;
    }
    if (group) {
      backOneLevel();
      return;
    }
    painterArmed = !actions.painter.active();
    actions.painter.toggle();
    updateHub();
  });

  filterInput.addEventListener("input", () => {
    filter = filterInput.value;
    matches = matchCommands(filter);
    hot = matches.length > 0 ? 0 : -1;
    paintFilterRows();
  });
  filterInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeFilter();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const hit = matches[hot >= 0 ? hot : 0];
      if (hit) runLeaf(hit.item);
      return;
    }
    e.stopPropagation();
  });

  const moveHot = (delta: number) => {
    const items = currentItems();
    if (items.length === 0) return;
    hot = (hot + delta + items.length) % items.length;
    markHot();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (filter !== null || group || openSector) {
        backOneLevel();
        return;
      }
      close();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      e.stopPropagation();
      openFilter();
      return;
    }
    if (filter !== null) {
      // 搜索面板打开时：⌘/Ctrl+2~9 直接执行对应行（首行回车在输入框内处理）。
      if ((e.metaKey || e.ctrlKey) && /^[2-9]$/.test(e.key)) {
        const hit = matches[Number(e.key) - 1];
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
          runLeaf(hit.item);
        }
      }
      return;
    }
    // 焦点仍在编辑器时，方向键/数字/Enter 属于输入，不由轮盘劫持。
    // 只有指针在轮盘上或显式进入筛选用键盘操作。
    const target = e.target as HTMLElement | null;
    if (target && target.closest?.(".cm-editor")) return;
    if (e.key >= "1" && e.key <= "8") {
      const id = visibleSectors[Number(e.key) - 1];
      if (id) {
        e.preventDefault();
        openSectorById(id);
      }
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      moveHot(1);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      moveHot(-1);
      return;
    }
    if (e.key === "Enter") {
      const items = currentItems();
      const item = items[hot >= 0 ? hot : 0];
      if (item) {
        e.preventDefault();
        runLeaf(item);
      }
    }
  };
  document.addEventListener("keydown", onKey, true);

  // 三层展开后：高亮跟着指针在二层上滑动同向移动（按角度就近命中）。
  const onThirdTrack = (event: PointerEvent) => {
    if (!group || thirdCenters.length === 0) return;
    const rect = root.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return;
    }
    const center = {
      x: rect.left + ROULETTE_BOX / 2,
      y: rect.top + ROULETTE_BOX / 2,
    };
    if (Math.hypot(x - center.x, y - center.y) < FAN_IN - 6) return;
    const angle = angleOfPoint(center, { x, y });
    let best = hot;
    let bestDiff = Infinity;
    thirdCenters.forEach((mark, i) => {
      const diff = Math.abs(((angle - mark + 540) % 360) - 180);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    });
    if (best !== hot) {
      hot = best;
      markHot();
    }
  };

  const onOutside = (e: PointerEvent) => {
    if (root.contains(e.target as Node)) return;
    if (actions.painter.active()) return;
    close();
  };
  document.addEventListener("pointerdown", onOutside, true);
  document.addEventListener("pointermove", onThirdTrack, true);

  // 根容器 pointer-events 为 none，pointerleave 在扇格间隙会误判离开；
  // 用文档级坐标判断是否真的移出 420×420 包围盒。
  const onDocMove = (event: PointerEvent) => {
    const rect = root.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (inside) {
      window.clearTimeout(closeTimer);
      closeTimer = 0;
      return;
    }
    if (closeTimer) return;
    closeTimer = window.setTimeout(() => {
      closeTimer = 0;
      if (filter !== null || group || openSector) backOneLevel();
    }, CLOSE_DELAY_MS);
  };
  document.addEventListener("pointermove", onDocMove, true);

  // 中键拖动：整个轮盘跟随指针，松手把圆心写回配置。
  const onMiddleDown = (e: PointerEvent) => {
    if (e.button !== 1) return;
    if (!root.contains(e.target as Node)) return;
    e.preventDefault();
    window.addEventListener("pointermove", onMiddleMove);
    window.addEventListener("pointerup", onMiddleUp);
  };
  const onMiddleMove = (e: PointerEvent) => {
    setCenter(e.clientX, e.clientY);
  };
  const onMiddleUp = () => {
    window.removeEventListener("pointermove", onMiddleMove);
    window.removeEventListener("pointerup", onMiddleUp);
    options.onMove?.(center.x, center.y);
  };
  document.addEventListener("pointerdown", onMiddleDown, true);

  const onWheel = (e: WheelEvent) => {
    if (filter !== null) return;
    e.preventDefault();
    moveHot(e.deltaY > 0 ? 1 : -1);
  };
  root.addEventListener("wheel", onWheel, { passive: false });

  let cleanup = () => {};
  cleanup = () => {
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onOutside, true);
    document.removeEventListener("pointermove", onThirdTrack, true);
    document.removeEventListener("pointermove", onDocMove, true);
    document.removeEventListener("pointerdown", onMiddleDown, true);
    window.removeEventListener("pointermove", onMiddleMove);
    window.removeEventListener("pointerup", onMiddleUp);
    root.removeEventListener("wheel", onWheel);
    window.clearTimeout(closeTimer);
  };

  const destroy = () => {
    closed = true;
    cleanup();
    root.remove();
  };

  const setCenter = (x: number, y: number) => {
    const centerPoint = clampBoxCenter(x, y, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    center = centerPoint;
    root.style.left = `${centerPoint.x - ROULETTE_BOX / 2}px`;
    root.style.top = `${centerPoint.y - ROULETTE_BOX / 2}px`;
    root.dataset.centerX = String(Math.round(centerPoint.x));
    root.dataset.centerY = String(Math.round(centerPoint.y));
    if (!opened) {
      opened = true;
      requestAnimationFrame(() => root.classList.add("is-open"));
    }
  };

  const setPainter = (_active: boolean, _count: number) => {
    updateHub();
  };

  updateHub();
  return { element: root, destroy, setCenter, setPainter, getForm: () => form };
}

function sectorIcon(id: SectorId): IconName {
  switch (id) {
    case "smart":
      return "sparkle";
    case "convert":
      return "convert";
    case "align":
      return "align";
    case "columns":
      return "columns3";
    case "history":
      return "undo";
    case "clear":
      return "brush";
    case "format":
      return "bold";
    case "color":
      return "droplet";
  }
}
