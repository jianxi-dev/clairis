/* 高亮 / 标注随机选色的对比度工具（fix/random-contrast）。
 *
 * 随机不再只换 bg/border：按当前主题从 CSS 变量读出填充实色，再从「默认文字 +
 * 字体色板」中挑一个对比度达标的文字色，一次事务写回三元组。色值唯一来源是
 * `src/styles/editor.css` / `src/styles/tokens.css`，本文件不持有任何兜底色值。
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** 解析 `#rgb` / `#rrggbb`；其它格式返回 null。 */
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

/**
 * 读 CSS 色值：入参是 CSS 变量名（`--hl-fill-red` 或 `var(--hl-fill-red)`）时
 * 取 `:root` 计算值，否则按 hex 原样处理；无法解析为 hex 时返回空串（调用方
 * 据此跳过文字改色）。
 */
export function readCssColor(nameOrHex: string): string {
  const name = nameOrHex.trim().replace(/^var\((--[^)]+)\)$/, "$1");
  const value = name.startsWith("--")
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : name;
  return parseHexColor(value) ? value : "";
}

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
