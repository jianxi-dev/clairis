/* 高亮 / 标注随机选色的对比度工具（fix/random-contrast）。
 *
 * 随机不再只换 bg/border：按当前主题读出填充实色，再从「默认文字 + 字体色板」
 * 中挑一个对比度达标的文字色，一次事务写回三元组。色值兜底常量与
 * `src/styles/editor.css` / `src/styles/tokens.css` 同步（改动须同步三处）。
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** 解析 `#rgb` / `#rrggbb`；其它格式（含 `var(...)`）返回 null。 */
export function parseHexColor(value: string): Rgb | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  const n = Number.parseInt(hex, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 相对亮度（0..1）。 */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** WCAG 对比度（1..21）。 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB 线性插值：fg 以 alpha 叠在 bg 上。 */
export function mixOver(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
  };
}

export function rgbToHex(rgb: Rgb): string {
  const to = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
}

/** 当前主题（`warm` 为独立暖色主题，对比度兜底按浅色处理）。 */
export function currentTheme(): "light" | "dark" | "warm" {
  const root = document.documentElement;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("warm")) return "warm";
  return "light";
}

/**
 * 读 CSS 色值：`var(--x)` 时取 `:root` 计算值，为空用 fallback；
 * 其它值（hex）原样返回。
 */
export function readColor(cssValue: string, fallbackHex: string): string {
  const trimmed = cssValue.trim();
  const m = /^var\((--[a-zA-Z0-9-]+)\)$/.exec(trimmed);
  if (!m) return trimmed;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(m[1])
    .trim();
  return value === "" ? fallbackHex : value;
}

/** 主题兜底常量（与 editor.css / tokens.css 同值，改动须同步）。 */
export const APP_TEXT: Readonly<Record<"light" | "dark" | "warm", string>> = {
  light: "#24262b",
  dark: "#d8dade",
  warm: "#3b3024",
};

export const APP_SURFACE: Readonly<
  Record<"light" | "dark" | "warm", string>
> = {
  light: "#fbfaf8",
  dark: "#1a1b1e",
  warm: "#fbf4e8",
};

/** 高亮填充实色（深档 + 中档，与 editor.css 1-62 行同步）。 */
export const HL_FILL: Readonly<
  Record<"light" | "dark", Readonly<Record<string, string>>>
> = {
  light: {
    darkgray: "#f2f3f5",
    darkred: "#fde2e2",
    darkorange: "#feead2",
    darkyellow: "#ffffcc",
    darkgreen: "#daf5d6",
    darkblue: "#e1eaff",
    darkpurple: "#ebe2fe",
    gray: "#e7e9eb",
    lightgray: "#e7e9eb",
    red: "#fbbfbc",
    orange: "#fed4a4",
    yellow: "#fffca3",
    green: "#b7edb2",
    blue: "#bacefd",
    purple: "#cdb2fa",
  },
  dark: {
    darkgray: "#2b2b2b",
    darkred: "#4a1d1b",
    darkorange: "#57330a",
    darkyellow: "#5c5514",
    darkgreen: "#1f471b",
    darkblue: "#192a4c",
    darkpurple: "#361d61",
    gray: "#363636",
    lightgray: "#3c3c3c",
    red: "#6b2827",
    orange: "#845117",
    yellow: "#877b10",
    green: "#296b22",
    blue: "#213e78",
    purple: "#4d2691",
  },
};

/** 高亮字体色实色（灰/红/橙/黄/绿/蓝/紫 + 高对比，与 editor.css 同步）。 */
export const HL_FONT: Readonly<
  Record<"light" | "dark", Readonly<Record<string, string>>>
> = {
  light: {
    gray: "#8f959e",
    contrast: "#111111",
    red: "#d83930",
    orange: "#de7704",
    yellow: "#dd9b02",
    green: "#2ea122",
    blue: "#245bdb",
    purple: "#6425d0",
  },
  dark: {
    gray: "#757575",
    contrast: "#ffffff",
    red: "#fa7873",
    orange: "#f5a54a",
    yellow: "#fcd456",
    green: "#6dd162",
    blue: "#71a0ff",
    purple: "#a472fc",
  },
};

export interface ReadableCandidate {
  readonly name: string;
  readonly hex: string;
}

export interface ReadablePick {
  readonly name: string;
  readonly hex: string;
  readonly ratio: number;
}

/**
 * 从候选里挑可读文字色：优先默认文字（`name === ""`）且达标；否则取对比度最大者。
 * 填充无法解析时返回候选中对比度最大者（ratio 可能低于阈值）。
 */
export function pickReadableText(
  fillHex: string,
  candidates: readonly ReadableCandidate[],
  minRatio = 4.5,
): ReadablePick {
  const fill = parseHexColor(fillHex);
  if (!fill || candidates.length === 0) {
    const fallback = candidates[0] ?? { name: "", hex: fillHex };
    return { ...fallback, ratio: 0 };
  }
  let best: ReadableCandidate = candidates[0];
  let bestRatio = -1;
  for (const candidate of candidates) {
    const rgb = parseHexColor(candidate.hex);
    const ratio = rgb ? contrastRatio(rgb, fill) : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  }
  const def = candidates.find((candidate) => candidate.name === "");
  if (def) {
    const defRgb = parseHexColor(def.hex);
    if (defRgb) {
      const defRatio = contrastRatio(defRgb, fill);
      if (defRatio >= minRatio) {
        return { ...def, ratio: defRatio };
      }
    }
  }
  return { ...best, ratio: bestRatio };
}
