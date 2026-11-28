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
import { findCalloutBlocks } from "../decorations/callout";
import { structureTransaction } from "../structure-history";
import {
  mixOver,
  parseHexColor,
  pickVariedText,
  readCssColor,
  rgbToHex,
  type VariedCandidate,
} from "./color-contrast";

/** 面板类名（供 CSS 收窄宽度 / 行标签样式）。 */
export const CALLOUT_COLOR_PANEL_CLASS = "cm-callout-color-panel";

/** 用面板打开时捕获的起点，重新解析当前文档里的 callout 块范围。 */
function resolveCalloutRange(
  view: EditorView,
  from: number,
): { from: number; to: number } | null {
  const blocks = findCalloutBlocks(view.state.doc.toString());
  const hit =
    blocks.find((b) => from >= b.from && from <= b.to) ??
    blocks.find((b) => b.from >= from);
  return hit ? { from: hit.from, to: hit.to } : null;
}

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
  const range = resolveCalloutRange(view, from);
  if (!range) return false;
  const current = view.state.doc.sliceString(range.from, range.to);
  const next = setCalloutAttrs(
    current,
    nextCalloutAttrs(getCalloutAttrs(current), key, nameOf(key, className)),
  );
  if (next === current) return false;
  view.dispatch(
    structureTransaction({
      changes: { from: range.from, to: range.to, insert: next },
    }),
  );
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
    (family) =>
      family.light === attrs.bg ||
      family.dark === attrs.border ||
      family.border === attrs.border,
  )?.key;
  const pool = HIGHLIGHT_COLORS.filter((family) => family.key !== currentKey);
  return pool[Math.floor(rand() * pool.length)] ?? HIGHLIGHT_COLORS[0];
}

/** 高亮字体候选：默认文字 + 字体色板非默认项（name 去 `hl-color-` 前缀）。 */
function highlightTextCandidates(): VariedCandidate[] {
  const candidates: VariedCandidate[] = [];
  for (const color of HIGHLIGHT_FONT_COLORS) {
    if (color.className === "") continue;
    const name = color.className.replace(/^hl-color-/, "");
    const hex = readCssColor(color.swatch);
    if (hex !== "") candidates.push({ name, hex, hue: name });
  }
  return candidates;
}

/** 一次事务写回三元组；`text` 为空名时删除该键（同 setCalloutAttrs 空值语义）。 */
function writeRandomTriple(
  view: EditorView,
  range: { from: number; to: number },
  current: string,
  attrs: CalloutAttrs,
  textName: string | null,
): boolean {
  const nextAttrs: { bg?: string; border?: string; text?: string } = {
    ...attrs,
  };
  if (textName !== null) nextAttrs.text = textName;
  const next = setCalloutAttrs(current, nextAttrs);
  if (next === current) return false;
  view.dispatch(
    structureTransaction({
      changes: { from: range.from, to: range.to, insert: next },
    }),
  );
  return true;
}

export function randomHighlightColors(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const range = resolveCalloutRange(view, from);
  if (!range) return false;
  const current = view.state.doc.sliceString(range.from, range.to);
  const attrs = getCalloutAttrs(current);
  const family = pickHighlightFamily(attrs);
  const fillHex = readCssColor(`--hl-fill-${family.light}`);
  const candidates = highlightTextCandidates();
  // 填充或候选缺失时只写 bg/border（文字保持现状），不崩溃。
  const text =
    fillHex === "" || candidates.length === 0
      ? null
      : pickVariedText(fillHex, candidates, attrs.text ?? "", family.key);
  return writeRandomTriple(
    view,
    range,
    current,
    { ...attrs, bg: family.light, border: family.border },
    text ? text.name : null,
  );
}

/** 「恢复默认」：清空首行三色属性；一次事务 = 一步撤销。 */
export function resetCalloutColors(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const range = resolveCalloutRange(view, from);
  if (!range) return false;
  const current = view.state.doc.sliceString(range.from, range.to);
  const next = setCalloutAttrs(current, {});
  if (next === current) return false;
  view.dispatch(
    structureTransaction({
      changes: { from: range.from, to: range.to, insert: next },
    }),
  );
  return true;
}

/**
 * 标注随机：从背景色板（15 色，排除默认项）随机取一色名，同时写 `bg` 与
 * `border`（同名），并按 10% 叠底背景挑可读文字色。一次事务 = 一步撤销。
 *
 * 与高亮的 `randomHighlightColors` 分开：标注只有填充 / 边框两行，且两行
 * 取同一色名（不是同色相的深浅档）。
 */
export function randomCalloutColors(
  view: EditorView,
  from: number,
  to: number,
): CalloutAttrs | null {
  const range = resolveCalloutRange(view, from);
  if (!range) return null;
  const current = view.state.doc.sliceString(range.from, range.to);
  const attrs = getCalloutAttrs(current);
  const pool = BACKGROUND_COLORS.filter(
    (color) => color.className !== "" && !color.isDefault,
  );
  const picked = pool[Math.floor(Math.random() * pool.length)];
  if (!picked) return null;
  const name = attrNameFromClassName("bg", picked.className);
  if (name === "") return null;
  // swatch 可能是 CSS 变量名或带包裹函数的变量引用，统一剥离后读计算值。
  const swatchRef = picked.swatch.replace(/^var\((--[a-zA-Z0-9-]+)\)$/, "$1");
  const bgHex = readCssColor(swatchRef);
  const surfaceHex = readCssColor("--app-surface");
  const bgRgb = parseHexColor(bgHex);
  const surfaceRgb = parseHexColor(surfaceHex);
  const tintHex =
    bgRgb && surfaceRgb ? rgbToHex(mixOver(bgRgb, surfaceRgb, 0.1)) : "";
  const candidates: VariedCandidate[] = FONT_COLORS.filter(
    (color) => color.className !== "",
  )
    .map((color) => {
      const colorName = color.className.replace(/^mdb-color-/, "");
      return { name: colorName, hex: readCssColor(color.swatch), hue: colorName };
    })
    .filter((candidate) => candidate.hex !== "");
  // tint 或候选缺失时只写 bg/border（文字保持现状），不崩溃。
  const text =
    tintHex === "" || candidates.length === 0
      ? null
      : pickVariedText(tintHex, candidates, attrs.text ?? "", name);
  const nextAttrs: { bg?: string; border?: string; text?: string } = {
    ...attrs,
    bg: name,
    border: name,
  };
  // 有可读候选才换字；没有则保留当前文字色。
  if (text) nextAttrs.text = text.name;
  const next = setCalloutAttrs(current, nextAttrs);
  if (next === current) return null;
  view.dispatch(
    structureTransaction({
      changes: { from: range.from, to: range.to, insert: next },
    }),
  );
  return nextAttrs;
}

/**
 * 把面板的裸色名（存储值，如 `yellow` / `darkred`）换算成该行的 className，
 * 供 `data-active` 比对。
 *
 * 旧文档存的是裸名（`text=yellow`），新色板的 swatch `dataset.className` 是
 * `hl-color-yellow`；直接比会全不命中（旧文档打开面板无选中态）。这里按色板的
 * className 反查：先直接拼 `hl-*` 前缀，再对旧名走 `attrNameFromClassName`
 * 兼容（旧名可能不在新板内，此时回落到旧 `mdb-*` 前缀）。
 *
 * @returns `""` = 默认格（无 / 透明）选中；命中 = 该色 className；
 *          `null` = 这一行没有任何选中格（色名非空但本行色板没有它，例如
 *          深档行遇到中档色 `red`——此时不能把默认格误标成选中）。
 */
function activeClassNameOf(
  kind: ColorKind,
  name: string,
  colors: readonly ColorSwatch[],
): string | null {
  if (name === "") return "";
  const attrKey = kind === "font" ? "text" : kind === "background" ? "bg" : "border";
  const hit = colors.find(
    (color) =>
      color.className !== "" &&
      attrNameFromClassName(attrKey, color.className) === name,
  );
  return hit ? hit.className : null;
}

/** 一行色块的 `data-active`：`null` 表示本行无选中格。 */
function applyRowActive(
  rowEl: HTMLElement,
  activeClass: string | null,
): void {
  rowEl
    .querySelectorAll<HTMLButtonElement>(".cm-color-swatch")
    .forEach((swatch) => {
      swatch.dataset.active = String(
        activeClass !== null && swatch.dataset.className === activeClass,
      );
    });
}

/**
 * 构建三色面板内容：头行（字体颜色 + 随机）/ 字体颜色行 / 边框颜色行 /
 * 填充颜色行 + 「恢复默认」。
 *
 * 调用方负责外层容器（类名、定位、生命周期）；本函数只产出内容与选择回调，
 * 当前选中项以 `data-active` 标注。
 */
export function buildCalloutColorPanel(args: {
  active: CalloutAttrs;
  onPick: (key: CalloutColorKey, className: string) => void;
  onReset: () => void;
  /**
   * 头行「随机」：同时写 `bg` / `border`（同名），`text` 不变。
   * 返回写入后的属性，供面板原地刷新 `data-active`。
   */
  onRandom?: () => CalloutAttrs | null;
}): HTMLElement {
  const { active, onPick, onReset, onRandom } = args;
  const root = document.createElement("div");
  root.className = CALLOUT_COLOR_PANEL_CLASS;

  /** 行 kind + 色板 + 属性键，与 addRow 的构建顺序一一对应。 */
  const rowSpecs: ReadonlyArray<{
    label: string | null;
    kind: ColorKind;
    colors: readonly ColorSwatch[];
    key: CalloutColorKey;
  }> = [
    // 头行已渲染「字体颜色」，字体行不再重复标签。
    { label: null, kind: "font", colors: FONT_COLORS, key: "text" },
    { label: "边框颜色", kind: "border", colors: BORDER_COLORS, key: "border" },
    {
      label: "填充颜色",
      kind: "background",
      colors: BACKGROUND_COLORS,
      key: "bg",
    },
  ];

  // 头行与高亮面板一致：左「字体颜色」标签 + 右侧「随机」。
  const head = document.createElement("div");
  head.className = "cm-color-panel-head";
  const headLabel = document.createElement("span");
  headLabel.className = "cm-color-row-label";
  headLabel.textContent = "字体颜色";
  head.appendChild(headLabel);
  if (onRandom) {
    const randomButton = document.createElement("button");
    randomButton.type = "button";
    randomButton.className = "cm-color-random";
    randomButton.dataset.testid = "color-random-callout";
    randomButton.title = "随机切换边框与填充（同色）";
    randomButton.appendChild(renderIcon("RotateOutlined"));
    const randomText = document.createElement("span");
    randomText.textContent = "随机";
    randomButton.appendChild(randomText);
    randomButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next = onRandom();
      if (next) applyActive(next);
    });
    head.appendChild(randomButton);
  }
  root.appendChild(head);

  const addRow = (
    label: string | null,
    kind: ColorKind,
    colors: readonly ColorSwatch[],
    activeName: string,
  ): HTMLElement => {
    if (label !== null) {
      const labelEl = document.createElement("div");
      labelEl.className = "cm-color-row-label";
      labelEl.textContent = label;
      root.appendChild(labelEl);
    }
    const rowEl = createColorRow(kind, colors, (pickedKind, className) => {
      const wasActive = Array.from(
        rowEl.querySelectorAll<HTMLButtonElement>(".cm-color-swatch"),
      ).some(
        (swatch) =>
          swatch.dataset.className === className &&
          swatch.dataset.active === "true",
      );
      onPick(KEY_OF_KIND[pickedKind], className);
      // 选中语义与写回一致：点已选中的色块 = 清除；否则写入选中的色块。
      const target = wasActive ? "" : className;
      rowEl
        .querySelectorAll<HTMLButtonElement>(".cm-color-swatch")
        .forEach((swatch) => {
          swatch.dataset.active = String(swatch.dataset.className === target);
        });
    });
    const activeClass = activeClassNameOf(kind, activeName, colors);
    applyRowActive(rowEl, activeClass);
    root.appendChild(rowEl);
    return rowEl;
  };

  const rows = rowSpecs.map((spec) => ({
    spec,
    rowEl: addRow(spec.label, spec.kind, spec.colors, active[spec.key] ?? ""),
  }));

  /** 按当前属性重算每格 `data-active`；不重建节点、不改动面板结构。 */
  const applyActive = (next: CalloutAttrs): void => {
    for (const { spec, rowEl } of rows) {
      applyRowActive(
        rowEl,
        activeClassNameOf(spec.kind, next[spec.key] ?? "", spec.colors),
      );
    }
  };

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "cm-color-reset";
  resetButton.dataset.testid = "color-reset";
  resetButton.textContent = "恢复默认";
  resetButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onReset();
    applyActive({});
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
  /**
   * 选色 / 随机后重读当前属性，用于原地刷新 `data-active`。
   * 不提供时保持构建时的一次性计算（向后兼容既有调用方）。
   */
  getActive?: () => CalloutAttrs;
}): HTMLElement {
  const { active, onPick, onReset, onRandom, getActive } = args;
  const root = document.createElement("div");
  root.className = `${CALLOUT_COLOR_PANEL_CLASS} cm-highlight-color-panel`;

  /** 行 kind + 色板 + 属性键，与 addRow 的构建顺序一一对应。 */
  const rowSpecs: ReadonlyArray<{
    label: string | null;
    kind: ColorKind;
    colors: readonly ColorSwatch[];
    key: CalloutColorKey;
  }> = [
    {
      label: null,
      kind: "font",
      colors: HIGHLIGHT_FONT_COLORS,
      key: "text",
    },
    {
      label: "边框颜色",
      kind: "border",
      colors: HIGHLIGHT_BORDER_COLORS,
      key: "border",
    },
    {
      label: "填充颜色",
      kind: "background",
      colors: HIGHLIGHT_FILL_DEEP,
      key: "bg",
    },
    { label: null, kind: "background", colors: HIGHLIGHT_FILL_MID, key: "bg" },
  ];

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
    refreshActive();
  });
  head.appendChild(randomButton);
  root.appendChild(head);

  const addRow = (
    label: string | null,
    kind: ColorKind,
    colors: readonly ColorSwatch[],
    activeName: string,
  ): HTMLElement => {
    if (label !== null) {
      const labelEl = document.createElement("div");
      labelEl.className = "cm-color-row-label";
      labelEl.textContent = label;
      root.appendChild(labelEl);
    }
    const rowEl = createColorRow(kind, colors, (pickedKind, className) => {
      const wasActive = Array.from(
        rowEl.querySelectorAll<HTMLButtonElement>(".cm-color-swatch"),
      ).some(
        (swatch) =>
          swatch.dataset.className === className &&
          swatch.dataset.active === "true",
      );
      onPick(KEY_OF_KIND[pickedKind], className);
      // 选中语义与写回一致：点已选中的色块 = 清除；否则写入选中的色块。
      const target = wasActive ? "" : className;
      rowEl
        .querySelectorAll<HTMLButtonElement>(".cm-color-swatch")
        .forEach((swatch) => {
          swatch.dataset.active = String(swatch.dataset.className === target);
        });
    });
    const activeClass = activeClassNameOf(kind, activeName, colors);
    applyRowActive(rowEl, activeClass);
    root.appendChild(rowEl);
    return rowEl;
  };

  const rows = rowSpecs.map((spec) => ({
    spec,
    rowEl: addRow(
      spec.label,
      spec.kind,
      spec.colors,
      active[spec.key] ?? "",
    ),
  }));

  /** 按当前属性重算每格 `data-active`；不重建节点、不改动面板结构。 */
  const applyActive = (next: CalloutAttrs): void => {
    for (const { spec, rowEl } of rows) {
      applyRowActive(
        rowEl,
        activeClassNameOf(spec.kind, next[spec.key] ?? "", spec.colors),
      );
    }
  };

  /** 高亮面板：选色 / 随机后按 getActive 重读属性刷新选中态。 */
  const refreshActive = (): void => {
    if (!getActive) return;
    applyActive(getActive());
  };

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "cm-color-reset";
  resetButton.dataset.testid = "color-reset";
  resetButton.textContent = "恢复默认";
  resetButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onReset();
    applyActive({});
  });
  root.appendChild(resetButton);

  return root;
}
