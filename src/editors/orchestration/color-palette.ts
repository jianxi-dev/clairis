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

// --- 纯高亮独立色系（#1437） -------------------------------------------------

/** 一个高亮色相：浅填充 + 同色系深边框。 */
export interface HighlightColorFamily {
  readonly key: string;
  readonly label: string;
  /** 浅档填充色名（`mdb-bg-*` 后缀）。 */
  readonly light: string;
  /** 同色系深档（边框色名 / 深填充色名）。 */
  readonly dark: string;
}

/** 纯高亮的 7 个色相（豆包高亮色系，与标注的 15 色板独立）。 */
export const HIGHLIGHT_COLORS: readonly HighlightColorFamily[] = [
  { key: "red", label: "红", light: "red", dark: "darkred" },
  { key: "orange", label: "橙", light: "orange", dark: "brown" },
  { key: "yellow", label: "黄", light: "yellow", dark: "olive" },
  { key: "green", label: "绿", light: "green", dark: "darkgreen" },
  { key: "blue", label: "蓝", light: "blue", dark: "navy" },
  { key: "purple", label: "紫", light: "purple", dark: "indigo" },
  { key: "gray", label: "灰", light: "gray", dark: "slate" },
];

const BG_BY_NAME = new Map(
  BACKGROUND_COLORS.map((color) => [
    color.className.replace(/^mdb-bg-/, ""),
    color,
  ]),
);
const BORDER_BY_NAME = new Map(
  BORDER_COLORS.map((color) => [
    color.className.replace(/^mdb-border-/, ""),
    color,
  ]),
);

function fillOf(name: string): ColorSwatch {
  return (
    BG_BY_NAME.get(name) ?? {
      label: name,
      className: `mdb-bg-${name}`,
      swatch: "",
    }
  );
}

function borderOf(name: string): ColorSwatch {
  return (
    BORDER_BY_NAME.get(name) ?? {
      label: name,
      className: `mdb-border-${name}`,
      swatch: "",
    }
  );
}

/** 填充颜色：浅档一行 + 深档一行（首格均为「无」）。 */
export const HIGHLIGHT_LIGHT_FILLS: readonly ColorSwatch[] = [
  BACKGROUND_COLORS[0],
  ...HIGHLIGHT_COLORS.map((family) => fillOf(family.light)),
];

export const HIGHLIGHT_DARK_FILLS: readonly ColorSwatch[] = [
  BACKGROUND_COLORS[0],
  ...HIGHLIGHT_COLORS.map((family) => fillOf(family.dark)),
];

/** 边框颜色：与深档填充同值。 */
export const HIGHLIGHT_BORDER_COLORS: readonly ColorSwatch[] = [
  BORDER_COLORS[0],
  ...HIGHLIGHT_COLORS.map((family) => borderOf(family.dark)),
];
