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
import { rectFromCoords, resolvePlacement, type AnchorRect } from "./anchor";
import {
  blockConvertChanges,
  blockMenuItems,
  currentConvertTarget,
  type BlockConvertTarget,
  type BlockLike,
} from "./block-convert";

export const BLOCK_MENU_WIDTH = 236;
export const BLOCK_MENU_ROW_HEIGHT = 32;

/** 菜单 id 前缀：Esc / 外部点击用它识别块菜单层。 */
export const BLOCK_MENU_ID_PREFIX = "block:";

const HIDE_DELAY_MS = 150;

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
  menuStack.closeAll(
    "block-close",
    (entry) =>
      entry.scope === view && entry.id.startsWith(BLOCK_MENU_ID_PREFIX),
  );
  // 父菜单收起时二级插入面板不能变成孤儿。
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
 * 菜单摆放走 `resolvePlacement`：贴手柄右侧、纵向以指针行为中心，越界先翻转再
 * 夹取，并把高度封顶到锚点较大一侧（#453 / #466 / #487）。
 */
function positionPanel(
  view: EditorView,
  panel: HTMLElement,
  anchorPos: number,
  handle: HTMLElement | null,
): void {
  const own = view.dom.getBoundingClientRect();
  const anchor = anchorRectAt(view, anchorPos, handle);
  const box = panel.getBoundingClientRect();
  const placement = resolvePlacement(
    anchor,
    {
      width: box.width || panel.offsetWidth || BLOCK_MENU_WIDTH,
      height: box.height || panel.offsetHeight,
    },
    viewportRect(),
    boxRect(own),
    8,
    Number.POSITIVE_INFINITY,
    "center-right",
  );
  panel.style.left = `${placement.x - own.left}px`;
  panel.style.top = `${placement.y - own.top}px`;
  panel.style.maxHeight = `${Math.max(120, placement.maxHeight)}px`;
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
  panel.style.width = `${BLOCK_MENU_WIDTH}px`;
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

  const addBelow = document.createElement("button");
  addBelow.type = "button";
  addBelow.className = "cm-block-menu-item";
  addBelow.dataset.testid = "block-menu-add-below";
  addBelow.style.height = `${BLOCK_MENU_ROW_HEIGHT}px`;
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
      document.removeEventListener("keydown", onKeyDown, true);
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    },
  });
}

/** 块菜单是否已打开（供调用方避免重复构建）。 */
export function isBlockMenuOpen(view: EditorView): boolean {
  const top = menuStack.top(view);
  return top !== null && top.id.startsWith(BLOCK_MENU_ID_PREFIX);
}
