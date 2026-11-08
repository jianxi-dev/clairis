/* 块级浮动工具条（shell-editor-batch5 / design D16）。
 *
 * 光标落在块内且未选中文本时出现，控件集合按 workbuddy 收敛为 4 项：
 * AI 编辑 / 背景色 / 边框色 / 删除。全部作用于光标所在的整个块。
 *
 * 与块菜单（block-menu.ts）并存：块菜单由手柄 hover 召唤，本工具条由光标位置
 * 驱动。文字工具条出现（有选区）时本工具条隐藏。
 */

import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

import { renderIcon, hasIcon } from "../icons";
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  createColorRow,
  type ColorKind,
} from "./color-palette";
import {
  applyBlockColorToBlock,
  blockAt,
  deleteBlock,
  wirePopup,
} from "./toolbar-shared";
import { useAiEntryStore } from "../../hooks/useAiEntry";

export const BLOCK_TOOLBAR_CLASS = "cm-block-toolbar";

function applyButtonStyle(btn: HTMLButtonElement): void {
  btn.style.background = "transparent";
  btn.style.border = "none";
  btn.style.color = "var(--app-text-2)";
  btn.style.padding = "4px";
  btn.style.cursor = "pointer";
  btn.style.borderRadius = "6px";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.gap = "2px";
  btn.style.minWidth = "28px";
  btn.style.height = "28px";
  btn.style.boxSizing = "border-box";
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "var(--app-hover, rgba(0, 0, 0, 0.06))";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "transparent";
  });
}

function setIcon(btn: HTMLButtonElement, icon: string): void {
  if (hasIcon(icon)) btn.appendChild(renderIcon(icon));
}

function buildAiControl(view: EditorView): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cm-toolbar-btn";
  btn.dataset.action = "ai-edit";
  btn.title = "AI 编辑";
  applyButtonStyle(btn);
  setIcon(btn, "AiEditOutlined");
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const block = blockAt(view, view.state.selection.main.head);
    const text = block
      ? view.state.doc.sliceString(block.from, block.to)
      : view.state.doc.sliceString(
          view.state.selection.main.from,
          view.state.selection.main.to,
        );
    const ai = useAiEntryStore.getState();
    ai.setInput(
      `请改写下面的文本，只返回替换后的文本，不要解释：\n\n${text}`.trim(),
    );
    ai.openOverlay();
  });
  return btn;
}

function buildBlockColorControl(
  view: EditorView,
  kind: "background" | "border",
): HTMLElement {
  const container = document.createElement("div");
  container.className = "cm-toolbar-dropdown";
  container.style.position = "relative";
  container.style.display = "inline-flex";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cm-toolbar-btn";
  btn.dataset.action = kind;
  btn.title = kind === "background" ? "背景色" : "边框色";
  applyButtonStyle(btn);
  setIcon(
    btn,
    kind === "background" ? "StyleSetOutlined" : "BorderColorOutlined",
  );
  const caret = document.createElement("span");
  caret.textContent = "▾";
  caret.setAttribute("aria-hidden", "true");
  caret.style.fontSize = "10px";
  btn.appendChild(caret);

  const menu = document.createElement("div");
  menu.className = "cm-toolbar-menu";
  menu.classList.add("cm-toolbar-color-menu");
  menu.style.display = "none";

  const { closeMenu } = wirePopup(container, btn, menu);

  const family = kind === "background" ? "mdb-bg" : "mdb-border";
  const colors = kind === "background" ? BACKGROUND_COLORS : BORDER_COLORS;

  menu.appendChild(
    createColorRow(kind, colors, (_kind, className) => {
      const block = blockAt(view, view.state.selection.main.head);
      if (block) applyBlockColorToBlock(view, block, family, className);
      closeMenu();
    }),
  );

  container.appendChild(btn);
  container.appendChild(menu);
  return container;
}

function buildToolbar(view: EditorView): HTMLDivElement {
  const toolbar = document.createElement("div");
  toolbar.className = BLOCK_TOOLBAR_CLASS;
  toolbar.dataset.testid = "block-toolbar";

  toolbar.appendChild(buildAiControl(view));
  toolbar.appendChild(buildBlockColorControl(view, "background"));
  toolbar.appendChild(buildBlockColorControl(view, "border"));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "cm-toolbar-btn";
  del.dataset.action = "delete";
  del.title = "删除";
  applyButtonStyle(del);
  setIcon(del, "DeleteTrashOutlined");
  del.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const block = blockAt(view, view.state.selection.main.head);
    if (block) deleteBlock(view, block);
  });
  toolbar.appendChild(del);

  return toolbar;
}

function positionToolbar(view: EditorView, toolbar: HTMLDivElement): void {
  const block = blockAt(view, view.state.selection.main.head);
  if (!block) return;
  try {
    view.requestMeasure({
      read: (v) => {
        const coords = v.coordsAtPos(block.from);
        if (!coords) return null;
        const box = toolbar.getBoundingClientRect();
        return {
          coords,
          rect: v.dom.getBoundingClientRect(),
          width: box.width,
        };
      },
      write: (measure) => {
        if (!measure) return;
        const { coords, rect, width } = measure;
        const right = coords.right - rect.left;
        const left = Math.max(4, right - width);
        toolbar.style.left = `${left}px`;
        const above = coords.top - rect.top - 6;
        toolbar.style.top = `${Math.max(4, above)}px`;
      },
    });
  } catch {
    // jsdom / 未测量内容：留在默认位置
  }
}

export function blockToolbar() {
  return ViewPlugin.define((view) => {
    let dom: HTMLDivElement | null = null;
    let visible = false;

    function show(): void {
      if (!dom) {
        dom = buildToolbar(view);
        if (
          view.dom.style.position === "static" ||
          view.dom.style.position === ""
        ) {
          view.dom.style.position = "relative";
        }
        view.dom.appendChild(dom);
      }
      dom.style.display = "flex";
      visible = true;
      positionToolbar(view, dom);
    }

    function hide(): void {
      if (dom) dom.style.display = "none";
      visible = false;
    }

    return {
      update(u: ViewUpdate): void {
        if (!u.selectionSet && !u.docChanged) return;
        const { from, to } = u.state.selection.main;
        const hasSelection = from !== to;
        const block = blockAt(view, from);
        if (hasSelection || !block) {
          if (visible) hide();
          return;
        }
        if (!visible) show();
        else positionToolbar(view, dom!);
      },
      destroy(): void {
        dom?.remove();
        dom = null;
        visible = false;
      },
    };
  });
}
