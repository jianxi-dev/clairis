/* 浮动工具条共享能力（shell-editor-batch5 / design D16）。
 *
 * 文字工具条与块工具条共用：包裹/拆绑、选区着色、块级动作（对齐/删除/颜色）、
 * 弹层定位与开关。纯逻辑集中在这里，两个 ViewPlugin 只负责各自的触发时机。
 */

import type { EditorView } from "@codemirror/view";

import { getBlocks, getBlockAt, type Block } from "../block-model";
import {
  toggleBlockAlignmentText,
  type BlockAlignment,
} from "./block-alignment";
import { applyBlockColor, type ColorFamily } from "./block-color";
import { computeBlockDelete } from "./block-actions";

/**
 * 切换包裹：选区已带同对标记 → 拆；标记贴在选区外 → 拆；否则包上。
 * 空选区插入标记对并把光标放进中间。
 */
export function toggleWrap(
  view: EditorView,
  before: string,
  after: string,
): void {
  const { from, to, empty } = view.state.selection.main;
  const doc = view.state.doc;

  if (empty) {
    view.dispatch({
      changes: { from, to, insert: `${before}${after}` },
      selection: { anchor: from + before.length },
    });
    return;
  }

  const selected = doc.sliceString(from, to);

  if (
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after)
  ) {
    const inner = selected.slice(before.length, -after.length);
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    });
    return;
  }

  const prefix =
    from >= before.length ? doc.sliceString(from - before.length, from) : "";
  const suffix = doc.sliceString(to, to + after.length);
  if (prefix === before && suffix === after) {
    view.dispatch({
      changes: [
        { from: from - before.length, to: from, insert: "" },
        { from: to, to: to + after.length, insert: "" },
      ],
      selection: { anchor: from - before.length, head: to - before.length },
    });
    return;
  }

  view.dispatch({
    changes: [
      { from, insert: before },
      { from: to, insert: after },
    ],
    selection: {
      anchor: from + before.length,
      head: from + before.length + selected.length,
    },
  });
}

/**
 * 切换选区上的 `mdb-{prefix}-*` 包裹。
 *
 * 与 `toggleWrap` 类似，但按族替换：同族异色换类名，同色拆绑，无包裹新包。
 */
export function toggleRangeSpan(
  view: EditorView,
  className: string,
  prefix: string,
): void {
  const { from, to } = view.state.selection.main;
  if (from === to) return;

  const doc = view.state.doc;
  const selected = doc.sliceString(from, to);
  const openTag = `<span class="${className}">`;
  const closeTag = "</span>";

  const sameFamily = new RegExp(`^<span class="(${prefix}-[\\w-]+)">`);
  const inside = sameFamily.exec(selected);

  if (inside && selected.endsWith(closeTag)) {
    const inner = selected.slice(inside[0].length, -closeTag.length);
    const next =
      inside[1] === className ? inner : `${openTag}${inner}${closeTag}`;
    view.dispatch({
      changes: { from, to, insert: next },
      selection: {
        anchor: from + (next === inner ? 0 : openTag.length),
        head:
          from +
          (next === inner ? inner.length : openTag.length + inner.length),
      },
    });
    return;
  }

  view.dispatch({
    changes: [
      { from, insert: openTag },
      { from: to, insert: closeTag },
    ],
    selection: {
      anchor: from + openTag.length,
      head: to + openTag.length,
    },
  });
}

/** 光标/选区所在的块；找不到返回 null。 */
export function blockAt(view: EditorView, pos: number): Block | null {
  const blocks = getBlocks(view.state);
  return (
    getBlockAt(pos, blocks) ??
    blocks.find((b) => pos >= b.from && pos <= b.to) ??
    null
  );
}

/** 对块应用对齐（Pandoc 围栏 div 语义）。 */
export function alignBlock(
  view: EditorView,
  block: Block,
  alignment: BlockAlignment,
): void {
  const blockText = view.state.doc.sliceString(block.from, block.to);
  const next = toggleBlockAlignmentText(blockText, alignment);
  if (next === blockText) return;
  view.dispatch({
    changes: { from: block.from, to: block.to, insert: next },
    selection: { anchor: block.from, head: block.from + next.length },
  });
}

/** 删除整块（含接缝空行规整）。 */
export function deleteBlock(view: EditorView, block: Block): void {
  const docText = view.state.doc.toString();
  const next = computeBlockDelete(docText, block.from, block.to);
  if (next === docText) return;
  view.dispatch({ changes: { from: 0, to: docText.length, insert: next } });
}

/** 给整块上背景 / 边框 / 文字颜色。 */
export function applyBlockColorToBlock(
  view: EditorView,
  block: Block,
  family: ColorFamily,
  className: string,
): void {
  const blockText = view.state.doc.sliceString(block.from, block.to);
  const next = applyBlockColor(blockText, block.type, family, className);
  if (next === null || next === blockText) return;
  view.dispatch({
    changes: { from: block.from, to: block.to, insert: next },
  });
}

/** 弹层开关：hover 滑入 + 点击切换，Esc / 外部 mousedown 关闭。 */
export function wirePopup(
  container: HTMLElement,
  btn: HTMLButtonElement,
  menu: HTMLElement,
): { closeMenu: () => void } {
  let isOpen = false;
  let openedByHover = false;

  function openMenu(): void {
    menu.style.display = "flex";
    isOpen = true;
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
  }

  function closeMenu(): void {
    menu.style.display = "none";
    isOpen = false;
    openedByHover = false;
    document.removeEventListener("mousedown", closeOnOutsideClick);
    document.removeEventListener("keydown", closeOnEscape);
  }

  function closeOnOutsideClick(e: MouseEvent): void {
    if (!container.contains(e.target as Node)) closeMenu();
  }

  function closeOnEscape(e: KeyboardEvent): void {
    if (e.key === "Escape") closeMenu();
  }

  container.addEventListener("mouseenter", () => {
    if (isOpen) return;
    openMenu();
    openedByHover = true;
  });
  container.addEventListener("mouseleave", () => {
    if (isOpen) closeMenu();
  });
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen && openedByHover) {
      openedByHover = false;
      return;
    }
    if (isOpen) closeMenu();
    else openMenu();
  });

  return { closeMenu };
}
