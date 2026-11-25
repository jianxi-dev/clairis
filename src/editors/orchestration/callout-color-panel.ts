/* 高亮块三色面板（填充 / 边框 / 文字 + 恢复默认）。
 *
 * 块菜单的颜色行与「点击高亮块」浮条共用这一份：DOM 构建、属性换算与写回
 * 事务都在这里，避免两侧实现漂移（同 `callout-attrs.ts` 的纯函数拆分）。
 * 色板数据仍取自 `color-palette.ts`，不另立色值。
 */
import type { EditorView } from "@codemirror/view";
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  FONT_COLORS,
  HIGHLIGHT_BORDER_COLORS,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_FILL_DEEP,
  HIGHLIGHT_FILL_MID,
  HIGHLIGHT_FONT_COLORS,
  createColorRow,
  type ColorKind,
  type ColorSwatch,
} from "./color-palette";
import { renderIcon } from "../icons";
import {
  attrNameFromClassName,
  getCalloutAttrs,
  setCalloutAttrs,
  type CalloutAttrs,
} from "../callout-attrs";
import { structureTransaction } from "../structure-history";

/** 面板类名（供 CSS 收窄宽度 / 行标签样式）。 */
export const CALLOUT_COLOR_PANEL_CLASS = "cm-callout-color-panel";

/** 三色属性键。 */
export type CalloutColorKey = "bg" | "border" | "text";

/** 面板行 kind → 属性键。 */
const KEY_OF_KIND: Record<ColorKind, CalloutColorKey> = {
  font: "text",
  border: "border",
  background: "bg",
};

/**
 * 计算一次改色后的属性（toggle 语义）：空名（默认项）或同名 → 清除该项；
 * 否则写入新色名。纯函数，供两侧与单测共用。
 */
export function nextCalloutAttrs(
  attrs: CalloutAttrs,
  key: CalloutColorKey,
  name: string,
): CalloutAttrs {
  const next: { bg?: string; border?: string; text?: string } = { ...attrs };
  if (name === "" || attrs[key] === name) delete next[key];
  else next[key] = name;
  return next;
}

/** 把面板 className（如 `mdb-bg-green`）换算成存储色名；默认项返回空串。 */
function nameOf(key: CalloutColorKey, className: string): string {
  return attrNameFromClassName(key, className);
}

/**
 * 改一色并写回块首行；一次事务 = 一步撤销。
 *
 * @returns 是否产生变化（无变化时不 dispatch，避免空撤销步）。
 */
export function applyCalloutColorToBlock(
  view: EditorView,
  from: number,
  to: number,
  key: CalloutColorKey,
  className: string,
): boolean {
  const current = view.state.doc.sliceString(from, to);
  const next = setCalloutAttrs(
    current,
    nextCalloutAttrs(getCalloutAttrs(current), key, nameOf(key, className)),
  );
  if (next === current) return false;
  view.dispatch(structureTransaction({ changes: { from, to, insert: next } }));
  return true;
}

/**
 * 纯高亮随机：取一个与当前色相不同的家族，同时写浅填充与深边框。
 * 一次事务 = 一步撤销；`text` 保持不变。
 */
export function pickHighlightFamily(
  attrs: CalloutAttrs,
  rand: () => number = Math.random,
): (typeof HIGHLIGHT_COLORS)[number] {
  const currentKey = HIGHLIGHT_COLORS.find(
    (family) => family.light === attrs.bg || family.dark === attrs.border,
  )?.key;
  const pool = HIGHLIGHT_COLORS.filter((family) => family.key !== currentKey);
  return pool[Math.floor(rand() * pool.length)] ?? HIGHLIGHT_COLORS[0];
}

export function randomHighlightColors(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const current = view.state.doc.sliceString(from, to);
  const attrs = getCalloutAttrs(current);
  const family = pickHighlightFamily(attrs);
  const next = setCalloutAttrs(current, {
    ...attrs,
    bg: family.light,
    border: family.border,
  });
  if (next === current) return false;
  view.dispatch(structureTransaction({ changes: { from, to, insert: next } }));
  return true;
}

/** 「恢复默认」：清空首行三色属性；一次事务 = 一步撤销。 */
export function resetCalloutColors(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const current = view.state.doc.sliceString(from, to);
  const next = setCalloutAttrs(current, {});
  if (next === current) return false;
  view.dispatch(structureTransaction({ changes: { from, to, insert: next } }));
  return true;
}

/**
 * 把面板的裸色名（存储值，如 `yellow` / `darkred`）换算成该行的 className，
 * 供 `data-active` 比对。
 *
 * 旧文档存的是裸名（`text=yellow`），新色板的 swatch `dataset.className` 是
 * `hl-color-yellow`；直接比会全不命中（旧文档打开面板无选中态）。这里按色板的
 * className 反查：先直接拼 `hl-*` 前缀，再对旧名走 `attrNameFromClassName`
 * 兼容（旧名可能不在新板内，此时回落到旧 `mdb-*` 前缀）。
 */
function activeClassNameOf(
  kind: ColorKind,
  name: string,
  colors: readonly ColorSwatch[],
): string {
  if (name === "") return "";
  const attrKey = kind === "font" ? "text" : kind === "background" ? "bg" : "border";
  const hit = colors.find(
    (color) =>
      color.className !== "" &&
      attrNameFromClassName(attrKey, color.className) === name,
  );
  if (hit) return hit.className;
  return "";
}

/**
 * 构建三色面板内容：字体颜色 / 边框颜色 / 填充颜色三行 + 「恢复默认」。
 *
 * 调用方负责外层容器（类名、定位、生命周期）；本函数只产出内容与选择回调，
 * 当前选中项以 `data-active` 标注。
 */
export function buildCalloutColorPanel(args: {
  active: CalloutAttrs;
  onPick: (key: CalloutColorKey, className: string) => void;
  onReset: () => void;
}): HTMLElement {
  const { active, onPick, onReset } = args;
  const root = document.createElement("div");
  root.className = CALLOUT_COLOR_PANEL_CLASS;

  const addRow = (
    label: string,
    kind: ColorKind,
    colors: readonly ColorSwatch[],
    activeName: string,
  ): void => {
    const labelEl = document.createElement("div");
    labelEl.className = "cm-color-row-label";
    labelEl.textContent = label;
    root.appendChild(labelEl);
    const rowEl = createColorRow(kind, colors, (pickedKind, className) =>
      onPick(KEY_OF_KIND[pickedKind], className),
    );
    const activeClass = activeClassNameOf(kind, activeName, colors);
    rowEl
      .querySelectorAll<HTMLButtonElement>(".cm-color-swatch")
      .forEach((swatch) => {
        swatch.dataset.active = String(swatch.dataset.className === activeClass);
      });
    root.appendChild(rowEl);
  };

  addRow("字体颜色", "font", FONT_COLORS, active.text ?? "");
  addRow("边框颜色", "border", BORDER_COLORS, active.border ?? "");
  addRow("填充颜色", "background", BACKGROUND_COLORS, active.bg ?? "");

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "cm-color-reset";
  resetButton.dataset.testid = "color-reset";
  resetButton.textContent = "恢复默认";
  resetButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onReset();
  });
  root.appendChild(resetButton);

  return root;
}

/**
 * 纯高亮的独立颜色面板（#1437）：字体色（字母 A）/ 边框 / 浅填充 / 深填充，
 * 右上「随机」，底部「恢复默认」。色系与标注的 15 色板分开。
 */
export function buildHighlightColorPanel(args: {
  active: CalloutAttrs;
  onPick: (key: CalloutColorKey, className: string) => void;
  onReset: () => void;
  onRandom: () => void;
}): HTMLElement {
  const { active, onPick, onReset, onRandom } = args;
  const root = document.createElement("div");
  root.className = `${CALLOUT_COLOR_PANEL_CLASS} cm-highlight-color-panel`;

  const head = document.createElement("div");
  head.className = "cm-color-panel-head";
  const headLabel = document.createElement("span");
  headLabel.className = "cm-color-row-label";
  headLabel.textContent = "字体颜色";
  head.appendChild(headLabel);
  const randomButton = document.createElement("button");
  randomButton.type = "button";
  randomButton.className = "cm-color-random";
  randomButton.dataset.testid = "color-random";
  randomButton.title = "随机切换边框与填充（同色系）";
  randomButton.appendChild(renderIcon("RotateOutlined"));
  const randomText = document.createElement("span");
  randomText.textContent = "随机";
  randomButton.appendChild(randomText);
  randomButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRandom();
  });
  head.appendChild(randomButton);
  root.appendChild(head);

  const addRow = (
    label: string | null,
    kind: ColorKind,
    colors: readonly ColorSwatch[],
    activeName: string,
  ): void => {
    if (label !== null) {
      const labelEl = document.createElement("div");
      labelEl.className = "cm-color-row-label";
      labelEl.textContent = label;
      root.appendChild(labelEl);
    }
    const rowEl = createColorRow(kind, colors, (pickedKind, className) =>
      onPick(KEY_OF_KIND[pickedKind], className),
    );
    const activeClass = activeClassNameOf(kind, activeName, colors);
    rowEl
      .querySelectorAll<HTMLButtonElement>(".cm-color-swatch")
      .forEach((swatch) => {
        swatch.dataset.active = String(swatch.dataset.className === activeClass);
      });
    root.appendChild(rowEl);
  };

  addRow(null, "font", HIGHLIGHT_FONT_COLORS, active.text ?? "");
  addRow("边框颜色", "border", HIGHLIGHT_BORDER_COLORS, active.border ?? "");
  addRow("填充颜色", "background", HIGHLIGHT_FILL_DEEP, active.bg ?? "");
  addRow(null, "background", HIGHLIGHT_FILL_MID, active.bg ?? "");

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "cm-color-reset";
  resetButton.dataset.testid = "color-reset";
  resetButton.textContent = "恢复默认";
  resetButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onReset();
  });
  root.appendChild(resetButton);

  return root;
}
