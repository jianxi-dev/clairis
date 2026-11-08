/* 块菜单（md-orchestration 1.3b / design D2 + D6）。
 *
 * 块手柄 hover 召唤：`openBlockMenu` 建面板并 `menuStack.push`（owner = 块范围，
 * scope = 视图），关闭由栈统一驱动（离栈 / 滚动 / Esc / 外部点击）。
 * 十项「转为」按块型裁剪，另有「在下方添加」走 `openInsertMenu`。
 */

import type { EditorView } from "@codemirror/view";

import { defaultCommands, openInsertMenu, releaseInsertMenu } from "../slash";
import { renderIcon } from "../icons";
import { menuStack } from "./menu-stack";
import { MENU_WIDTH, MENU_ROW_HEIGHT } from "./menu-metrics";
import {
  PANEL_MAX_HEIGHT,
  rectFromCoords,
  intersectRects,
  type AnchorRect,
} from "./anchor";
import { placeMenu } from "./placement";
import { getBlocks } from "../block-model";
import { moveBlock } from "./block-handle";
import {
  blockConvertChanges,
  blockMenuItems,
  currentConvertTarget,
  type BlockConvertTarget,
  type BlockLike,
} from "./block-convert";
import {
  calloutKeyOf,
  changeCalloutType,
  computeBlockDelete,
  computeBlockDuplicate,
  indentBlock,
  outdentBlock,
} from "./block-actions";
import { CALLOUT_EDIT_TYPES } from "../callout-types";
import {
  applyBlockColor,
  blockColorOf,
  keepColorPanelOpen,
  type ColorFamily,
} from "./block-color";
import { toggleBlockAlignmentText } from "./block-alignment";
import {
  BACKGROUND_COLORS,
  FONT_COLORS,
  createColorRow,
} from "./color-palette";

export { MENU_ROW_HEIGHT, MENU_WIDTH };

/** 菜单 id 前缀：Esc / 外部点击用它识别块菜单层。 */
export const BLOCK_MENU_ID_PREFIX = "block:";

/** 颜色二级面板类名（挂在通用 flyout 类之外，供 CSS 收窄宽度）。 */
const COLOR_PANEL_CLASS = "cm-block-menu-color-panel";

const HIDE_DELAY_MS = 150;

/** 结构动作组：直接在源码上执行的块级操作。 */
const ACTION_ROWS: ReadonlyArray<readonly [string, string, string]> = [
  ["复制块", "CopyOutlined", "duplicate"],
  ["剪切块", "FeishuclipOutlined", "cut"],
  ["上移", "ArrowUpwardOutlined", "move-up"],
  ["下移", "ArrowDownwardOutlined", "move-down"],
  ["删除块", "DeleteTrashOutlined", "delete"],
];

/** 「对齐与缩进」二级：三项对齐（带图标）+ 两项缩进。顺序即用户心智顺序。 */
const ALIGN_INDENT_ITEMS: ReadonlyArray<{
  key: string;
  label: string;
  icon: string;
  align?: "left" | "center" | "right";
  indent?: "indent" | "outdent";
}> = [
  { key: "left", label: "左对齐", icon: "AlignLeftOutlined", align: "left" },
  {
    key: "center",
    label: "居中",
    icon: "AlignCenterOutlined",
    align: "center",
  },
  { key: "right", label: "右对齐", icon: "AlignRightOutlined", align: "right" },
  {
    key: "indent",
    label: "增加缩进",
    icon: "IndentIncreaseOutlined",
    indent: "indent",
  },
  {
    key: "outdent",
    label: "减少缩进",
    icon: "IndentDecreaseOutlined",
    indent: "outdent",
  },
];

const closeTimers = new WeakMap<EditorView, number>();

function cancelPendingClose(view: EditorView): void {
  const timer = closeTimers.get(view);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    closeTimers.delete(view);
  }
}

/** 关闭该视图的块菜单层（不动文档）。 */
export function closeBlockMenu(view: EditorView): void {
  cancelPendingClose(view);
  menuStack.setKeepOpen(view, false);
  menuStack.closeAll(
    "block-close",
    (entry) =>
      entry.scope === view && entry.id.startsWith(BLOCK_MENU_ID_PREFIX),
  );
  // 父菜单收起时二级面板不能变成孤儿。
  document
    .querySelectorAll<HTMLElement>("[data-block-flyout]")
    .forEach((el) => el.remove());
  releaseInsertMenu(view, "below");
}

export function scheduleBlockMenuClose(view: EditorView): void {
  scheduleClose(view);
}

function scheduleClose(view: EditorView): void {
  cancelPendingClose(view);
  closeTimers.set(
    view,
    window.setTimeout(() => {
      closeTimers.delete(view);
      // 二级色板还开着：指针在父面板与色板之间移动不算离开，等选色 / Esc /
      // 点外部再收（#374）。
      if (menuStack.isKeepOpen(view)) return;
      closeBlockMenu(view);
    }, HIDE_DELAY_MS),
  );
}

function applyConvert(
  view: EditorView,
  block: BlockLike,
  target: BlockConvertTarget,
): void {
  const changes = blockConvertChanges(view.state.doc, block, target);
  closeBlockMenu(view);
  if (changes.length === 0) return;
  view.dispatch({ changes, scrollIntoView: true });
}

function viewportRect(): AnchorRect {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return { left: 0, top: 0, right: width, bottom: height, width, height };
}

function boxRect(rect: DOMRect): AnchorRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * 锚点矩形：纵向取指针所在的可视行（`coordsAtPos`），横向取手柄自身的左右边界。
 *
 * 纵向必须走 `coordsAtPos`（滚动后 DOM 坐标会漂移）；横向必须用手柄，因为菜单
 * 要贴着手柄弹出而不是压住正文（md-bundle #453）。
 */
function anchorRectAt(
  view: EditorView,
  pos: number,
  handle: HTMLElement | null,
): AnchorRect {
  const clamped = Math.max(0, Math.min(pos, view.state.doc.length));
  let row: ReturnType<EditorView["coordsAtPos"]> | null = null;
  try {
    row = view.coordsAtPos(clamped);
  } catch {
    row = null;
  }
  const rect = rectFromCoords(row, view.documentTop);
  if (!handle) return rect;
  const handleRect = handle.getBoundingClientRect();
  return {
    ...rect,
    left: handleRect.left,
    right: handleRect.right,
    width: Math.max(0, handleRect.right - handleRect.left),
  };
}

/**
 * 菜单摆放走 `placeMenu`（`align: "right"`）：贴手柄右侧、纵向以指针行为中心，
 * 越界按「右 → 右顶 → 左 → 左顶」取最近可用位，统一 8px 视口边距（#371）。
 */
function positionPanel(
  view: EditorView,
  panel: HTMLElement,
  anchorPos: number,
  handle: HTMLElement | null,
): void {
  const own = view.dom.getBoundingClientRect();
  const anchor = anchorRectAt(view, anchorPos, handle);
  const bounds = intersectRects(viewportRect(), boxRect(own));
  panel.style.maxHeight = `${Math.max(
    120,
    Math.min(PANEL_MAX_HEIGHT, bounds.height - 16),
  )}px`;
  const box = panel.getBoundingClientRect();
  const placement = placeMenu(
    anchor,
    {
      width: box.width || panel.offsetWidth || MENU_WIDTH,
      height: box.height || panel.offsetHeight,
    },
    bounds,
    8,
    "right",
  );
  panel.style.left = `${placement.left - own.left}px`;
  panel.style.top = `${placement.top - own.top}px`;
}

/** 打开（或替换）该块的菜单。 */
export function openBlockMenu(
  view: EditorView,
  block: BlockLike,
  anchorPos: number | null = null,
  handle: HTMLElement | null = null,
): void {
  closeBlockMenu(view);

  const panel = document.createElement("div");
  panel.className = "cm-block-menu";
  panel.classList.add("mdb-block-handle-menu");
  panel.dataset.testid = "block-menu";
  panel.style.width = `${MENU_WIDTH}px`;
  panel.addEventListener("pointerenter", () => cancelPendingClose(view));
  panel.addEventListener("pointerleave", () => scheduleClose(view));

  const items = blockMenuItems(block);
  if (items.length > 0) {
    const group = document.createElement("div");
    group.className = "cm-block-menu-group";
    group.textContent = "转为";
    panel.appendChild(group);

    // 豆包把「转为」做成图标网格（5 列 × 2 行）：图标即语义，扫一眼就认出来。
    // 十条等长文字排成一列正是「菜单显小气」的来源（#111）。
    const active = currentConvertTarget(
      view.state.doc.sliceString(block.from, block.to),
      block.type,
    );
    const grid = document.createElement("div");
    grid.className = "cm-block-menu-grid";
    grid.dataset.testid = "block-menu-grid";
    for (const item of items) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cm-block-menu-cell";
      cell.dataset.testid = "block-menu-cell";
      cell.dataset.target = item.target;
      cell.dataset.active = String(item.target === active);
      cell.title = item.label;
      cell.appendChild(renderIcon(item.icon));
      const label = document.createElement("span");
      label.className = "cm-block-menu-cell-label";
      label.textContent = item.shortLabel ?? item.label;
      cell.appendChild(label);
      cell.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyConvert(view, block, item.target);
      });
      grid.appendChild(cell);
    }
    panel.appendChild(grid);
  }

  const separator = document.createElement("div");
  separator.className = "cm-block-menu-separator";
  panel.appendChild(separator);

  // 结构动作组：复制 / 剪切 / 上下移 / 缩进 / 删除。都直接改源码，
  // 不做「看起来生效」的假动作（#114）。
  const runAction = (action: string): void => {
    const docText = view.state.doc.toString();
    const next = (() => {
      switch (action) {
        case "duplicate":
          return computeBlockDuplicate(docText, block.from, block.to);
        case "delete":
          return computeBlockDelete(docText, block.from, block.to);
        case "cut": {
          void navigator.clipboard?.writeText(
            docText.slice(block.from, block.to),
          );
          return computeBlockDelete(docText, block.from, block.to);
        }
        case "indent":
        case "outdent": {
          const text = docText.slice(block.from, block.to);
          const changed =
            action === "indent" ? indentBlock(text) : outdentBlock(text);
          if (changed === text) return docText;
          return (
            docText.slice(0, block.from) + changed + docText.slice(block.to)
          );
        }
        case "move-up":
        case "move-down": {
          const blocks = getBlocks(view.state);
          const index = blocks.findIndex((b) => b.from === block.from);
          const target =
            action === "move-up" ? blocks[index - 1] : blocks[index + 1];
          if (index < 0 || !target) return docText;
          return moveBlock(docText, block, { from: target.from });
        }
        default:
          return docText;
      }
    })();
    closeBlockMenu(view);
    if (next === docText) return;
    view.dispatch({ changes: { from: 0, to: docText.length, insert: next } });
  };

  // 类型（仅高亮块）：直接把 `[!note]` 换成 `[!tip]`，块内正文不动。
  const blockText = view.state.doc.sliceString(block.from, block.to);
  if (calloutKeyOf(blockText) !== null) {
    const typeRow = document.createElement("button");
    typeRow.type = "button";
    typeRow.className = "cm-block-menu-item";
    typeRow.dataset.testid = "block-menu-type";
    typeRow.style.height = `${MENU_ROW_HEIGHT}px`;
    typeRow.appendChild(renderIcon("CalloutOutlined"));
    const typeLabel = document.createElement("span");
    typeLabel.textContent = "类型";
    typeRow.appendChild(typeLabel);
    const typeChevron = document.createElement("span");
    typeChevron.className = "cm-block-menu-chevron";
    typeChevron.textContent = "›";
    typeChevron.setAttribute("aria-hidden", "true");
    typeRow.appendChild(typeChevron);

    let typePanel: HTMLElement | null = null;
    const closeTypePanel = (): void => {
      typePanel?.remove();
      typePanel = null;
    };
    const openTypePanel = (): void => {
      closeTypePanel();
      const current = calloutKeyOf(
        view.state.doc.sliceString(block.from, block.to),
      );
      const panelEl = document.createElement("div");
      panelEl.className = "cm-block-menu-flyout";
      panelEl.dataset.testid = "block-menu-type-panel";
      panelEl.dataset.blockFlyout = "1";
      // E-14：贴在「类型」行右侧，缝隙 ≤ 8px，同一行每次打开位置一致。
      // 挂到编辑器根节点，避免被父菜单的 overflow 裁掉。
      const rowRect = typeRow.getBoundingClientRect();
      const own = view.dom.getBoundingClientRect();
      panelEl.style.left = `${rowRect.right - own.left + 4}px`;
      panelEl.style.top = `${rowRect.top - own.top}px`;
      for (const type of CALLOUT_EDIT_TYPES) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "cm-block-menu-flyout-item";
        option.dataset.testid = "block-menu-type-option";
        option.dataset.typeKey = type.key;
        option.dataset.active = String(type.key === current);
        const emoji = document.createElement("span");
        emoji.textContent = type.emoji;
        emoji.setAttribute("aria-hidden", "true");
        option.appendChild(emoji);
        const text = document.createElement("span");
        text.textContent = type.label;
        option.appendChild(text);
        option.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const rest = view.state.doc.sliceString(block.from, block.to);
          const next = changeCalloutType(rest, type.key);
          closeBlockMenu(view);
          if (next === rest) return;
          view.dispatch({
            changes: { from: block.from, to: block.to, insert: next },
          });
        });
        panelEl.appendChild(option);
      }
      view.dom.appendChild(panelEl);
      panelEl.addEventListener("pointerenter", () => cancelPendingClose(view));
      typePanel = panelEl;
    };

    typeRow.addEventListener("pointerenter", () => {
      cancelPendingClose(view);
      openTypePanel();
    });
    typeRow.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openTypePanel();
    });
    panel.appendChild(typeRow);
  }

  const colorRow = document.createElement("button");
  colorRow.type = "button";
  colorRow.className = "cm-block-menu-item";
  colorRow.dataset.testid = "block-menu-color";
  colorRow.style.height = `${MENU_ROW_HEIGHT}px`;
  colorRow.appendChild(renderIcon("FontcolorOutlined"));
  const colorLabel = document.createElement("span");
  colorLabel.textContent = "颜色";
  colorRow.appendChild(colorLabel);
  const colorChevron = document.createElement("span");
  colorChevron.className = "cm-block-menu-chevron";
  colorChevron.textContent = "›";
  colorChevron.setAttribute("aria-hidden", "true");
  colorRow.appendChild(colorChevron);

  let colorPanel: HTMLElement | null = null;
  let releaseColorKeepOpen: (() => void) | null = null;
  const closeColorPanel = (): void => {
    releaseColorKeepOpen?.();
    releaseColorKeepOpen = null;
    colorPanel?.remove();
    colorPanel = null;
  };
  const openColorPanel = (): void => {
    closeColorPanel();
    const panelEl = document.createElement("div");
    panelEl.className = "cm-block-menu-flyout";
    panelEl.classList.add(COLOR_PANEL_CLASS);
    panelEl.dataset.testid = "block-menu-color-panel";
    panelEl.dataset.blockFlyout = "1";
    panelEl.style.width = `${MENU_WIDTH}px`;
    const own = view.dom.getBoundingClientRect();
    const rowRect = colorRow.getBoundingClientRect();
    panelEl.style.left = `${rowRect.right - own.left + 4}px`;
    panelEl.style.top = `${rowRect.top - own.top}px`;

    const blockText = view.state.doc.sliceString(block.from, block.to);
    const applyColor = (family: ColorFamily, className: string): void => {
      const next = applyBlockColor(blockText, block.type, family, className);
      closeBlockMenu(view);
      if (next === null) return;
      view.dispatch({
        changes: { from: block.from, to: block.to, insert: next },
      });
    };

    const fontRow = createColorRow("font", FONT_COLORS, (_kind, cls) =>
      applyColor("mdb-color", cls),
    );
    const activeFont = blockColorOf(blockText, "mdb-color");
    fontRow
      .querySelectorAll<HTMLButtonElement>(".cm-color-swatch")
      .forEach((swatch) => {
        swatch.dataset.active = String(swatch.dataset.className === activeFont);
      });
    panelEl.appendChild(fontRow);

    const bgRow = createColorRow(
      "background",
      BACKGROUND_COLORS,
      (_kind, cls) => applyColor("mdb-bg", cls),
    );
    const activeBg = blockColorOf(blockText, "mdb-bg");
    bgRow
      .querySelectorAll<HTMLButtonElement>(".cm-color-swatch")
      .forEach((swatch) => {
        swatch.dataset.active = String(swatch.dataset.className === activeBg);
      });
    panelEl.appendChild(bgRow);

    view.dom.appendChild(panelEl);
    panelEl.addEventListener("pointerenter", () => cancelPendingClose(view));
    releaseColorKeepOpen?.();
    releaseColorKeepOpen = keepColorPanelOpen(menuStack, view);
    colorPanel = panelEl;
  };

  colorRow.addEventListener("pointerenter", () => {
    cancelPendingClose(view);
    openColorPanel();
  });
  colorRow.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openColorPanel();
  });
  panel.appendChild(colorRow);

  // 对齐与缩进（#373）：两项合并成一行，二级菜单 3 对齐 + 2 缩进。
  const alignRow = document.createElement("button");
  alignRow.type = "button";
  alignRow.className = "cm-block-menu-item";
  alignRow.dataset.testid = "block-menu-align";
  alignRow.style.height = `${MENU_ROW_HEIGHT}px`;
  alignRow.appendChild(renderIcon("AlignLeftOutlined"));
  const alignLabel = document.createElement("span");
  alignLabel.textContent = "对齐与缩进";
  alignRow.appendChild(alignLabel);
  const alignChevron = document.createElement("span");
  alignChevron.className = "cm-block-menu-chevron";
  alignChevron.textContent = "›";
  alignChevron.setAttribute("aria-hidden", "true");
  alignRow.appendChild(alignChevron);

  let alignPanel: HTMLElement | null = null;
  const closeAlignPanel = (): void => {
    alignPanel?.remove();
    alignPanel = null;
  };
  const openAlignPanel = (): void => {
    closeAlignPanel();
    const panelEl = document.createElement("div");
    panelEl.className = "cm-block-menu-flyout";
    panelEl.dataset.testid = "block-menu-align-panel";
    panelEl.dataset.blockFlyout = "1";
    panelEl.style.width = `${MENU_WIDTH}px`;
    const own = view.dom.getBoundingClientRect();
    const rowRect = alignRow.getBoundingClientRect();
    panelEl.style.left = `${rowRect.right - own.left + 4}px`;
    panelEl.style.top = `${rowRect.top - own.top}px`;

    const blockText = view.state.doc.sliceString(block.from, block.to);
    // 缩进的空白在块范围之外（block.from 落在内容首字），单独取到行首，
    // 否则「减少缩进」永远看不到要剥的空格。
    const lineStart = view.state.doc.lineAt(block.from).from;
    for (const item of ALIGN_INDENT_ITEMS) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "cm-block-menu-flyout-item";
      option.dataset.testid = "block-menu-align-option";
      option.dataset.alignment = item.key;
      option.appendChild(renderIcon(item.icon));
      const text = document.createElement("span");
      text.textContent = item.label;
      option.appendChild(text);
      option.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (item.align) {
          const next = toggleBlockAlignmentText(blockText, item.align);
          closeBlockMenu(view);
          if (next === blockText) return;
          view.dispatch({
            changes: { from: block.from, to: block.to, insert: next },
          });
          return;
        }
        const indented = view.state.doc.sliceString(lineStart, block.to);
        const next =
          item.indent === "indent"
            ? indentBlock(indented)
            : outdentBlock(indented);
        closeBlockMenu(view);
        if (next === indented) return;
        view.dispatch({
          changes: { from: lineStart, to: block.to, insert: next },
        });
      });
      panelEl.appendChild(option);
    }

    view.dom.appendChild(panelEl);
    panelEl.addEventListener("pointerenter", () => cancelPendingClose(view));
    alignPanel = panelEl;
  };

  alignRow.addEventListener("pointerenter", () => {
    cancelPendingClose(view);
    openAlignPanel();
  });
  alignRow.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openAlignPanel();
  });
  panel.appendChild(alignRow);

  for (const [label, icon, action] of ACTION_ROWS) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "cm-block-menu-item";
    row.dataset.testid = "block-menu-action";
    row.dataset.action = action;
    row.style.height = `${MENU_ROW_HEIGHT}px`;
    row.appendChild(renderIcon(icon));
    const text = document.createElement("span");
    text.textContent = label;
    row.appendChild(text);
    row.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      runAction(action);
    });
    panel.appendChild(row);
  }

  const addBelow = document.createElement("button");
  addBelow.type = "button";
  addBelow.className = "cm-block-menu-item";
  addBelow.dataset.testid = "block-menu-add-below";
  addBelow.style.height = `${MENU_ROW_HEIGHT}px`;
  addBelow.appendChild(renderIcon("AddOutlined"));
  const addLabel = document.createElement("span");
  addLabel.textContent = "在下方添加";
  addBelow.appendChild(addLabel);
  // 右侧 chevron：这一行会向右展开二级面板，没有指示用户不知道可以横着走。
  const chevron = document.createElement("span");
  chevron.className = "cm-block-menu-chevron";
  chevron.textContent = "›";
  chevron.setAttribute("aria-hidden", "true");
  addBelow.appendChild(chevron);
  const openBelow = (): void => {
    cancelPendingClose(view);
    const rowRect = addBelow.getBoundingClientRect();
    openInsertMenu(
      view,
      block.to,
      defaultCommands,
      { from: block.from, to: block.to },
      "below",
      {
        left: rowRect.left,
        right: rowRect.right,
        top: rowRect.top,
        bottom: rowRect.bottom,
      },
    );
    // 父菜单保留、二级面板向右展开（#456）；指针跨到面板时不要收起父菜单（#480）。
    view.dom
      .querySelector<HTMLElement>(".mdb-slash-menu")
      ?.addEventListener("pointerenter", () => cancelPendingClose(view));
  };

  let belowTimer: number | null = null;
  addBelow.addEventListener("pointerenter", () => {
    cancelPendingClose(view);
    if (belowTimer !== null) window.clearTimeout(belowTimer);
    belowTimer = window.setTimeout(() => {
      belowTimer = null;
      openBelow();
    }, 150);
  });
  addBelow.addEventListener("pointerleave", () => {
    if (belowTimer !== null) {
      window.clearTimeout(belowTimer);
      belowTimer = null;
    }
    scheduleClose(view);
  });
  addBelow.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openBelow();
  });
  panel.appendChild(addBelow);

  view.dom.appendChild(panel);
  positionPanel(view, panel, anchorPos ?? block.from, handle);

  // CM6 keymap 只在编辑器聚焦时触发；块菜单是 hover 召唤，焦点可能还在别处，
  // 所以自己接一个捕获阶段的 Esc（只负责本视图的块菜单层）。
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeBlockMenu(view);
  };
  document.addEventListener("keydown", onKeyDown, true);

  menuStack.push({
    id: `${BLOCK_MENU_ID_PREFIX}${block.from}`,
    owner: { blockFrom: block.from, blockTo: block.to },
    element: panel,
    scope: view,
    onClose: () => {
      cancelPendingClose(view);
      menuStack.setKeepOpen(view, false);
      document.removeEventListener("keydown", onKeyDown, true);
      // 外部点击 / Esc 走栈关闭时不会经过 closeBlockMenu：二级面板挂在与
      // 父面板平级的编辑器根节点上，必须在这里一并摘掉，否则色板残留。
      document
        .querySelectorAll<HTMLElement>("[data-block-flyout]")
        .forEach((el) => el.remove());
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    },
  });
}

/** 块菜单是否已打开（供调用方避免重复构建）。 */
export function isBlockMenuOpen(view: EditorView): boolean {
  const top = menuStack.top(view);
  return top !== null && top.id.startsWith(BLOCK_MENU_ID_PREFIX);
}
