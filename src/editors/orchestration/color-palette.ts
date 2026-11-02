/* 统一色板（md-orchestration 1.4 / design D6）。
 *
 * 字体色 9 格（默认 + 8）与背景色 16 格（无 + 15）共用一份数据源：
 * 表格单元格工具栏、未来的行内文字工具栏都从这里取，标签与色值不再各写一套。
 * 写入语法沿用现有 `<span class="mdb-color-*">` / `<span class="mdb-bg-*">`。
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

/** 字体色：默认 + 8 色（顺序与设计稿一致）。 */
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

/** 背景色：无 + 15 色。 */
export const BACKGROUND_COLORS: readonly ColorSwatch[] = [
  { label: "无", className: "", swatch: "", isDefault: true },
  { label: "红色", className: "mdb-bg-red", swatch: "#ffd8d3" },
  { label: "橙色", className: "mdb-bg-orange", swatch: "#ffedd0" },
  { label: "黄色", className: "mdb-bg-yellow", swatch: "#fff6cc" },
  { label: "绿色", className: "mdb-bg-green", swatch: "#d2f8d2" },
  { label: "青色", className: "mdb-bg-cyan", swatch: "#d0f4f2" },
  { label: "蓝色", className: "mdb-bg-blue", swatch: "#d7dcff" },
  { label: "紫色", className: "mdb-bg-purple", swatch: "#e6dbff" },
  { label: "浅灰", className: "mdb-bg-gray", swatch: "#ebebeb" },
  { label: "暗红", className: "mdb-bg-darkred", swatch: "#f5c8c8" },
  { label: "棕色", className: "mdb-bg-brown", swatch: "#e8d7c3" },
  { label: "橄榄绿", className: "mdb-bg-olive", swatch: "#e6e4bf" },
  { label: "深绿", className: "mdb-bg-darkgreen", swatch: "#cfe6cc" },
  { label: "藏蓝", className: "mdb-bg-navy", swatch: "#ccd6ea" },
  { label: "靛紫", className: "mdb-bg-indigo", swatch: "#ddd2f0" },
  { label: "深灰", className: "mdb-bg-slate", swatch: "#dcdcdc" },
];

export type ColorKind = "font" | "background";

/**
 * 构建一个色板行。
 *
 * `onPick` 收到 `(kind, className)`；`className` 为空表示清除该属性。
 * 默认项画成带斜线的透明块（`.cm-color-swatch-default`）。
 */
export function createColorRow(
  kind: ColorKind,
  colors: readonly ColorSwatch[],
  onPick: (kind: ColorKind, className: string) => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "cm-color-row";
  row.dataset.kind = kind;

  for (const color of colors) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "cm-color-swatch";
    swatch.dataset.className = color.className;
    swatch.dataset.testid = `color-swatch-${kind}`;
    swatch.title = color.label;
    swatch.setAttribute("aria-label", color.label);
    if (color.isDefault) swatch.classList.add("cm-color-swatch-default");
    if (color.swatch !== "") swatch.style.background = color.swatch;
    swatch.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onPick(kind, color.className);
    });
    row.appendChild(swatch);
  }
  return row;
}
