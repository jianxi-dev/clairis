/* 统一色板（md-orchestration 1.4 / design D6 / shell-editor-batch5 D16）。
 *
 * 字体色 9 格（默认 + 8）与背景色 16 格（无 + 15）共用一份数据源：
 * 块菜单、块工具条、文字工具条都从这里取，标签与色值不再各写一套。
 * 写入语法沿用现有 `<span class="mdb-color-*">` / `<span class="mdb-bg-*">`。
 *
 * 字体色画成字母 A 字形（#1437 恢复 #1423 之前的字形），背景色画成实色块。
 * 色板只是选择器，实际应用的高亮仍走 `.cm-bg-*` / `.mdb-bg-*` 的半透明规则，
 * 保证深底可读。
 */

import { renderIcon } from "../icons";

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
/** 字体色块内的形象图标容器类名。 */
export const COLOR_SWATCH_ICON_CLASS = "cm-color-swatch-icon";

/**
 * 构建一个色板行。
 *
 * `onPick` 收到 `(kind, className)`；`className` 为空表示清除该属性。
 * 默认项画成带斜线的透明块（`.cm-color-swatch-default`）。
 *
 * 字体色块为字母 A 字形（`.cm-color-swatch-icon`），背景 / 边框色为实色块。
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

    if (kind === "font") {
      swatch.style.display = "flex";
      swatch.style.alignItems = "center";
      swatch.style.justifyContent = "center";
      const icon = document.createElement("span");
      icon.className = COLOR_SWATCH_ICON_CLASS;
      icon.setAttribute("aria-hidden", "true");
      icon.appendChild(renderIcon("FormatColorTextOutlined"));
      if (!color.isDefault) icon.style.color = color.swatch;
      swatch.appendChild(icon);
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

/** `#rrggbb` → 色相角（0..360）；非 hex 输入返回 null。 */
function hueOf(hex: string): number | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return null;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** 色相环距离（0..180）。 */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 标注类型 tone → 填充色板色名（#1413 / D2）。 */
const TONE_BG_NAME: Readonly<Record<string, string>> = {
  blue: "blue",
  green: "green",
  purple: "purple",
  orange: "orange",
  red: "red",
  teal: "cyan",
  gray: "gray",
  muted: "gray",
  yellow: "yellow",
};

const BG_SWATCH_BY_NAME = new Map(
  BACKGROUND_COLORS.filter((color) => !color.isDefault).map((color) => [
    color.className.replace(/^mdb-bg-/, ""),
    color.swatch,
  ]),
);

/**
 * 切换标注类型时把当前填充色的色相映射到目标类型的可用色板（#1413 / D2）。
 *
 * 同色相（容差 20°）优先取目标类型的默认色名；无同色相时取色板中色相最近者；
 * 仍无可用色（空板 / 无法解析色相）回落目标类型默认色。纯函数，无 DOM 依赖。
 */
export function mapHueToType(currentColor: string, targetTone: string): string {
  const fallback = TONE_BG_NAME[targetTone] ?? "";
  const targetHex = BG_SWATCH_BY_NAME.get(fallback);
  const currentHue = hueOf(currentColor);
  if (currentHue === null || !targetHex) return fallback;

  const targetHue = hueOf(targetHex);
  if (targetHue !== null && hueDistance(currentHue, targetHue) <= 20) {
    return fallback;
  }

  let best = fallback;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [name, hex] of BG_SWATCH_BY_NAME) {
    const hue = hueOf(hex);
    if (hue === null) continue;
    const distance = hueDistance(currentHue, hue);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  return best;
}

// --- 高亮 24 格独立色板（editor-surface-batch22 / design D1） ----------------
//
// 高亮块专用四组色板，与标注的 `FONT_COLORS` / `BACKGROUND_COLORS` /
// `BORDER_COLORS` 完全分开：后三者同时供标注面板与块级颜色行复用，直接改会
// 连带改标注与块颜色。色值取自豆包高亮截图逐格采样（对账表 §3.2）。
//
// className 走 `hl-*` 前缀，与 `mdb-*`（标注 / 块颜色 span）区分：
// - `hl-color-*`   字体色
// - `hl-border-*`  边框色
// - `hl-fill-*`    填充色（深档 `dark*` / 中档 `gray|lightgray|*`）
// `callout-attrs.ts` 的 `attrNameFromClassName` 同时解析两套前缀。

/** 字体色：默认 + 灰/红/橙/黄/绿/蓝/紫（8 格，顺序与豆包一致）。 */
export const HIGHLIGHT_FONT_COLORS: readonly ColorSwatch[] = [
  { label: "默认", className: "", swatch: "#ebebeb", isDefault: true },
  { label: "灰色", className: "hl-color-gray", swatch: "#757575" },
  { label: "红色", className: "hl-color-red", swatch: "#fa7873" },
  { label: "橙色", className: "hl-color-orange", swatch: "#f5a54a" },
  { label: "黄色", className: "hl-color-yellow", swatch: "#fcd456" },
  { label: "绿色", className: "hl-color-green", swatch: "#6dd162" },
  { label: "蓝色", className: "hl-color-blue", swatch: "#71a0ff" },
  { label: "紫色", className: "hl-color-purple", swatch: "#a472fc" },
];

/** 边框色：无（斜线）+ 灰/红/橙/黄/绿/蓝/紫（8 格）。 */
export const HIGHLIGHT_BORDER_COLORS: readonly ColorSwatch[] = [
  { label: "无", className: "", swatch: "", isDefault: true },
  { label: "灰色", className: "hl-border-gray", swatch: "#434343" },
  { label: "红色", className: "hl-border-red", swatch: "#9e3836" },
  { label: "橙色", className: "hl-border-orange", swatch: "#bd7017" },
  { label: "黄色", className: "hl-border-yellow", swatch: "#c7b302" },
  { label: "绿色", className: "hl-border-green", swatch: "#339428" },
  { label: "蓝色", className: "hl-border-blue", swatch: "#2951a3" },
  { label: "紫色", className: "hl-border-purple", swatch: "#6532bd" },
];

/** 填充深档：无（斜线）+ 深灰/暗红/暗橙/暗黄/暗绿/暗蓝/暗紫（8 格）。 */
export const HIGHLIGHT_FILL_DEEP: readonly ColorSwatch[] = [
  { label: "无", className: "", swatch: "", isDefault: true },
  { label: "深灰", className: "hl-fill-darkgray", swatch: "#2b2b2b" },
  { label: "暗红", className: "hl-fill-darkred", swatch: "#4a1d1b" },
  { label: "暗橙", className: "hl-fill-darkorange", swatch: "#57330a" },
  { label: "暗黄", className: "hl-fill-darkyellow", swatch: "#5c5514" },
  { label: "暗绿", className: "hl-fill-darkgreen", swatch: "#1f471b" },
  { label: "暗蓝", className: "hl-fill-darkblue", swatch: "#192a4c" },
  { label: "暗紫", className: "hl-fill-darkpurple", swatch: "#361d61" },
];

/** 填充中档：灰/灰/红/橙/黄/绿/蓝/紫（8 格，无默认项）。 */
export const HIGHLIGHT_FILL_MID: readonly ColorSwatch[] = [
  { label: "灰色", className: "hl-fill-gray", swatch: "#363636" },
  { label: "浅灰", className: "hl-fill-lightgray", swatch: "#3c3c3c" },
  { label: "红色", className: "hl-fill-red", swatch: "#6b2827" },
  { label: "橙色", className: "hl-fill-orange", swatch: "#845117" },
  { label: "黄色", className: "hl-fill-yellow", swatch: "#877b10" },
  { label: "绿色", className: "hl-fill-green", swatch: "#296b22" },
  { label: "蓝色", className: "hl-fill-blue", swatch: "#213e78" },
  { label: "紫色", className: "hl-fill-purple", swatch: "#4d2691" },
];

export interface HighlightColorFamily {
  readonly key: string;
  readonly label: string;
  readonly light: string;
  readonly dark: string;
  readonly border: string;
}

export const HIGHLIGHT_COLORS: readonly HighlightColorFamily[] = [
  { key: "red", label: "红", light: "red", dark: "darkred", border: "red" },
  { key: "orange", label: "橙", light: "orange", dark: "darkorange", border: "orange" },
  { key: "yellow", label: "黄", light: "yellow", dark: "darkyellow", border: "yellow" },
  { key: "green", label: "绿", light: "green", dark: "darkgreen", border: "green" },
  { key: "blue", label: "蓝", light: "blue", dark: "darkblue", border: "blue" },
  { key: "purple", label: "紫", light: "purple", dark: "darkpurple", border: "purple" },
  { key: "gray", label: "灰", light: "gray", dark: "darkgray", border: "gray" },
];
