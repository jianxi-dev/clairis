/* 统一色板（md-orchestration 1.4 / design D6 / shell-editor-batch5 D16）。
 *
 * 字体色 9 格（默认 + 8）与背景色 16 格（无 + 15）共用一份数据源：
 * 块菜单、块工具条、文字工具条都从这里取，标签与色值不再各写一套。
 * 写入语法沿用现有 `<span class="mdb-color-*">` / `<span class="mdb-bg-*">`。
 *
 * 观感对齐 md-bundle `color-palette.ts`：字体色画成着色「A」字形，背景色画成
 * 实色块（不再是偏淡的浅色块）。色板只是选择器，实际应用的高亮仍走
 * `.cm-bg-*` / `.mdb-bg-*` 的半透明规则，保证深底可读。
 */

export interface ColorSwatch {
  /** 展示名（中文）。 */
  label: string;
  /** markdown span 类名；空串表示「默认 / 无」。 */
  className: string;
  /** 色块预览色；默认项为空（CSS 画斜线）。 */
  swatch: string;
  /** 首位是「默认 / 无」项。 */
  isDefault?: boolean;
}

/** 字体色：默认 + 8 色（顺序与设计稿一致，色值为实色）。 */
export const FONT_COLORS: readonly ColorSwatch[] = [
  { label: "默认", className: "", swatch: "", isDefault: true },
  { label: "红色", className: "mdb-color-red", swatch: "#f0000e" },
  { label: "橙色", className: "mdb-color-orange", swatch: "#f2962c" },
  { label: "黄色", className: "mdb-color-yellow", swatch: "#f0b622" },
  { label: "绿色", className: "mdb-color-green", swatch: "#419e34" },
  { label: "青色", className: "mdb-color-cyan", swatch: "#20b2aa" },
  { label: "蓝色", className: "mdb-color-blue", swatch: "#4c88ff" },
  { label: "紫色", className: "mdb-color-purple", swatch: "#8a5cf6" },
  { label: "灰色", className: "mdb-color-gray", swatch: "#8b8f96" },
];

/** 背景色：无 + 15 色（实色观感，对齐 md-bundle 色板）。 */
export const BACKGROUND_COLORS: readonly ColorSwatch[] = [
  { label: "无", className: "", swatch: "", isDefault: true },
  { label: "红色", className: "mdb-bg-red", swatch: "#f0000e" },
  { label: "橙色", className: "mdb-bg-orange", swatch: "#f2962c" },
  { label: "黄色", className: "mdb-bg-yellow", swatch: "#f0b622" },
  { label: "绿色", className: "mdb-bg-green", swatch: "#419e34" },
  { label: "青色", className: "mdb-bg-cyan", swatch: "#20b2aa" },
  { label: "蓝色", className: "mdb-bg-blue", swatch: "#4c88ff" },
  { label: "紫色", className: "mdb-bg-purple", swatch: "#8a5cf6" },
  { label: "浅灰", className: "mdb-bg-gray", swatch: "#ebebeb" },
  { label: "暗红", className: "mdb-bg-darkred", swatch: "#b34444" },
  { label: "棕色", className: "mdb-bg-brown", swatch: "#845117" },
  { label: "橄榄绿", className: "mdb-bg-olive", swatch: "#877b10" },
  { label: "深绿", className: "mdb-bg-darkgreen", swatch: "#296b22" },
  { label: "藏蓝", className: "mdb-bg-navy", swatch: "#203e78" },
  { label: "靛紫", className: "mdb-bg-indigo", swatch: "#4d2691" },
  { label: "深灰", className: "mdb-bg-slate", swatch: "#5f5f5f" },
];

/**
 * 边框色：与背景色同值，类名走 `mdb-border-*`。
 *
 * 块工具条的「边框色」复用同一组实色，避免再养一套色板。
 */
export const BORDER_COLORS: readonly ColorSwatch[] = BACKGROUND_COLORS.map(
  (color) => ({
    ...color,
    className:
      color.className === ""
        ? ""
        : color.className.replace("mdb-bg-", "mdb-border-"),
  }),
);

export type ColorKind = "font" | "background" | "border";

/** 色板行类名（供 CSS 收窄宽度 / 测试定位）。 */
export const COLOR_ROW_CLASS = "cm-color-row";
/** 色块类名。 */
export const COLOR_SWATCH_CLASS = "cm-color-swatch";
/** 默认 / 无 项的斜线类名。 */
export const COLOR_SWATCH_DEFAULT_CLASS = "cm-color-swatch-default";

/**
 * 构建一个色板行。
 *
 * `onPick` 收到 `(kind, className)`；`className` 为空表示清除该属性。
 * 默认项画成带斜线的透明块（`.cm-color-swatch-default`）。
 *
 * 渲染观感对齐 md-bundle：字体色为着色「A」字形，背景 / 边框色为实色块。
 */
export function createColorRow(
  kind: ColorKind,
  colors: readonly ColorSwatch[],
  onPick: (kind: ColorKind, className: string) => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = COLOR_ROW_CLASS;
  row.dataset.kind = kind;

  for (const color of colors) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = COLOR_SWATCH_CLASS;
    swatch.dataset.className = color.className;
    swatch.dataset.testid = `color-swatch-${kind}`;
    swatch.title = color.label;
    swatch.setAttribute("aria-label", color.label);
    if (color.isDefault) swatch.classList.add(COLOR_SWATCH_DEFAULT_CLASS);

    if (kind === "font" && !color.isDefault) {
      // 字体色：着色「A」字形（md-bundle 观感），不是实心色块。
      swatch.style.display = "flex";
      swatch.style.alignItems = "center";
      swatch.style.justifyContent = "center";
      const glyph = document.createElement("span");
      glyph.className = "cm-color-swatch-glyph";
      glyph.textContent = "A";
      glyph.style.color = color.swatch;
      swatch.appendChild(glyph);
    } else if (!color.isDefault) {
      // 背景 / 边框色：实色块。
      swatch.style.background = color.swatch;
    }

    swatch.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onPick(kind, color.className);
    });
    row.appendChild(swatch);
  }
  return row;
}

/**
 * 共享双色板（块工具条 / 文字工具条的弹层）：字体色 + 背景色两行。
 *
 * 块工具条需要背景色 + 边框色，用 `createColorRow` 各自建行走同一渲染。
 */
export function createColorPaletteRows(
  onPick: (kind: ColorKind, className: string) => void,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "cm-color-palette";
  root.dataset.testid = "color-palette";
  root.appendChild(createColorRow("font", FONT_COLORS, onPick));
  root.appendChild(createColorRow("background", BACKGROUND_COLORS, onPick));
  return root;
}
