/* 文字选区浮动工具条（shell-editor-batch5 / design D16，迁移自 md-bundle
 * `floating-toolbar.ts`）。
 *
 * 选中文本即出现，控件集合按 md-bundle 收敛为 12 项：
 * AI 组（改写 / 翻译 / 润色）+ 格式组（字号（显示当前值）/ 加粗 / 斜体 /
 * 下划线 / 删除线 / 链接 / 对齐 / 文字颜色 / 删除）。
 *
 * 作用域：
 * - 加粗 / 斜体 / 下划线 / 删除线 / 链接 / 文字颜色 → 选区范围。
 * - 对齐 / 删除 → 选区所在的整个块。
 *
 * 定位：优先贴在选区下方，下方放不下时翻到上方（md-bundle `positionToolbar`）。
 */

import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

import { renderIcon, hasIcon } from "../icons";
import { FONT_COLORS, createColorRow, type ColorKind } from "./color-palette";
import {
  alignBlock,
  blockAt,
  deleteBlock,
  toggleRangeSpan,
  toggleWrap,
  wirePopup,
} from "./toolbar-shared";
import type { BlockAlignment } from "./block-alignment";
import { useEditorStore } from "../../stores/editorStore";
import { useAiEntryStore } from "../../hooks/useAiEntry";

export const FLOATING_TOOLBAR_CLASS = "cm-floating-toolbar";

interface AlignOption {
  readonly alignment: BlockAlignment;
  readonly label: string;
  readonly icon: string;
}

const ALIGN_OPTIONS: readonly AlignOption[] = [
  { alignment: "left", label: "左对齐", icon: "AlignLeftOutlined" },
  { alignment: "center", label: "居中", icon: "AlignCenterOutlined" },
  { alignment: "right", label: "右对齐", icon: "AlignRightOutlined" },
];

const FONT_SIZE_CHOICES: readonly number[] = [
  12, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32,
];

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

function setIcon(btn: HTMLButtonElement, icon: string | undefined): void {
  if (icon && hasIcon(icon)) btn.appendChild(renderIcon(icon));
}

function buildAlignControl(view: EditorView): HTMLElement {
  const container = document.createElement("div");
  container.className = "cm-toolbar-dropdown";
  container.style.position = "relative";
  container.style.display = "inline-flex";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cm-toolbar-btn";
  btn.dataset.action = "align";
  btn.title = "对齐";
  applyButtonStyle(btn);
  setIcon(btn, "AlignLeftOutlined");
  const caret = document.createElement("span");
  caret.textContent = "▾";
  caret.setAttribute("aria-hidden", "true");
  caret.style.fontSize = "10px";
  btn.appendChild(caret);

  const menu = document.createElement("div");
  menu.className = "cm-toolbar-menu";
  menu.style.display = "none";

  const { closeMenu } = wirePopup(container, btn, menu);

  for (const option of ALIGN_OPTIONS) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "cm-toolbar-menu-item";
    item.dataset.option = `align-${option.alignment}`;
    item.title = option.label;
    item.appendChild(renderIcon(option.icon));
    const text = document.createElement("span");
    text.textContent = option.label;
    item.appendChild(text);
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const block = blockAt(view, view.state.selection.main.head);
      if (block) alignBlock(view, block, option.alignment);
      closeMenu();
    });
    menu.appendChild(item);
  }

  container.appendChild(btn);
  container.appendChild(menu);
  return container;
}

function buildFontSizeControl(view: EditorView): HTMLElement {
  const container = document.createElement("div");
  container.className = "cm-toolbar-dropdown";
  container.style.position = "relative";
  container.style.display = "inline-flex";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cm-toolbar-btn";
  btn.dataset.action = "font-size";
  btn.title = "字号";
  applyButtonStyle(btn);
  const value = document.createElement("span");
  value.className = "cm-toolbar-font-size-value";
  value.textContent = String(useEditorStore.getState().fontSize);
  btn.appendChild(value);
  const caret = document.createElement("span");
  caret.textContent = "▾";
  caret.setAttribute("aria-hidden", "true");
  caret.style.fontSize = "10px";
  btn.appendChild(caret);

  const menu = document.createElement("div");
  menu.className = "cm-toolbar-menu";
  menu.style.display = "none";

  const { closeMenu } = wirePopup(container, btn, menu);

  const applySize = (size: number): void => {
    const store = useEditorStore.getState();
    store.setFontSize(size);
    store.setConfig({ readerFontSize: size });
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${size}px`,
    );
    value.textContent = String(size);
    closeMenu();
  };

  for (const size of FONT_SIZE_CHOICES) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "cm-toolbar-menu-item";
    item.dataset.option = `font-size-${size}`;
    item.textContent = String(size);
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      applySize(size);
    });
    menu.appendChild(item);
  }

  container.appendChild(btn);
  container.appendChild(menu);
  return container;
}

function buildColorControl(view: EditorView): HTMLElement {
  const container = document.createElement("div");
  container.className = "cm-toolbar-dropdown";
  container.style.position = "relative";
  container.style.display = "inline-flex";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cm-toolbar-btn";
  btn.dataset.action = "color";
  btn.title = "文字颜色";
  applyButtonStyle(btn);
  setIcon(btn, "FontcolorOutlined");
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

  const pick = (kind: ColorKind, className: string): void => {
    if (kind === "font") toggleRangeSpan(view, className, "mdb-color");
    closeMenu();
  };

  menu.appendChild(createColorRow("font", FONT_COLORS, pick));

  container.appendChild(btn);
  container.appendChild(menu);
  return container;
}

interface AiAction {
  readonly action: string;
  readonly label: string;
  readonly icon: string;
  readonly prompt: string;
}

/** 三种明确意图各自预填指令；一个笼统的「AI 编辑」按钮每次都要用户自己补全。 */
const AI_ACTIONS: readonly AiAction[] = [
  {
    action: "rewrite",
    label: "改写",
    icon: "SharewordsOutlined",
    prompt: "请改写下面的文本，只返回替换后的文本，不要解释：",
  },
  {
    action: "translate",
    label: "翻译",
    icon: "TranslateOutlined",
    prompt: "请翻译下面的文本（英译中或中译英），只返回译文，不要解释：",
  },
  {
    action: "polish",
    label: "润色",
    icon: "AiEditOutlined",
    prompt: "请润色下面的文本，让它更通顺自然，只返回润色后的文本，不要解释：",
  },
];

function buildAiControl(view: EditorView, spec: AiAction): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cm-toolbar-btn";
  btn.dataset.action = spec.action;
  btn.title = spec.label;
  applyButtonStyle(btn);
  setIcon(btn, spec.icon);
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { from, to } = view.state.selection.main;
    const text = view.state.doc.sliceString(from, to);
    const ai = useAiEntryStore.getState();
    ai.setInput(`${spec.prompt}\n\n${text}`.trim());
    ai.openOverlay();
  });
  return btn;
}

function buildToolbar(view: EditorView): HTMLDivElement {
  const toolbar = document.createElement("div");
  toolbar.className = FLOATING_TOOLBAR_CLASS;
  toolbar.dataset.testid = "floating-toolbar";

  for (const spec of AI_ACTIONS)
    toolbar.appendChild(buildAiControl(view, spec));

  const fontSize = buildFontSizeControl(view);
  toolbar.appendChild(fontSize);

  const simple: ReadonlyArray<readonly [string, string, string, string]> = [
    ["toggle-bold", "加粗", "BoldOutlined", "**"],
    ["toggle-italic", "斜体", "ItalicOutlined", "*"],
    ["toggle-underline", "下划线", "UnderlineOutlined", "<u>"],
    ["toggle-strikethrough", "删除线", "StrikethroughOutlined", "~~"],
  ];
  for (const [action, label, icon, marker] of simple) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-toolbar-btn";
    btn.dataset.action = action;
    btn.title = label;
    applyButtonStyle(btn);
    setIcon(btn, icon);
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const after = marker === "<u>" ? "</u>" : marker;
      toggleWrap(view, marker, after);
    });
    toolbar.appendChild(btn);
  }

  const link = document.createElement("button");
  link.type = "button";
  link.className = "cm-toolbar-btn";
  link.dataset.action = "toggle-link";
  link.title = "链接";
  applyButtonStyle(link);
  setIcon(link, "GlobalLinkOutlined");
  link.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWrap(view, "[", "](url)");
  });
  toolbar.appendChild(link);

  toolbar.appendChild(buildAlignControl(view));
  toolbar.appendChild(buildColorControl(view));

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
  try {
    view.requestMeasure({
      read: (v) => {
        const { from, to } = v.state.selection.main;
        const pos = to > from ? to : from;
        const coords = v.coordsAtPos(pos);
        if (!coords) return null;
        const box = toolbar.getBoundingClientRect();
        return {
          coords,
          rect: v.dom.getBoundingClientRect(),
          width: box.width,
          height: box.height,
        };
      },
      write: (measure) => {
        if (!measure) return;
        const { coords, rect, width, height } = measure;
        const left = coords.left - rect.left;
        const maxLeft = Math.max(4, rect.width - width - 4);
        toolbar.style.left = `${Math.max(4, Math.min(left, maxLeft))}px`;
        const below = coords.bottom - rect.top + 6;
        const above = coords.top - rect.top - height - 6;
        const fitsBelow = rect.top + below + height <= window.innerHeight - 4;
        toolbar.style.top = `${Math.max(4, fitsBelow ? below : above)}px`;
      },
    });
  } catch {
    // jsdom / 未测量内容：留在默认位置
  }
}

export function floatingToolbar() {
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
        if (!u.selectionSet) return;
        const { from, to } = u.state.selection.main;
        if (from !== to) {
          if (!visible) show();
          else positionToolbar(view, dom!);
        } else if (visible) {
          hide();
        }
      },
      destroy(): void {
        dom?.remove();
        dom = null;
        visible = false;
      },
    };
  });
}
