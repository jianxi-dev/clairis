#!/usr/bin/env node
// 从 src/styles/tokens.css 的 :root 亮色生成 .dark 草稿，人只做校对。
//
// 颜色：OKLab 亮度镜像 mirror = 1.137 − 0.907·L（clamp 0..1）；
//       chroma ≥ 0.14 的鲜艳色保持自身亮度在 0.62–0.86（smoothstep 过渡）。
// 阴影：--shadow-* 取同一几何、alpha ×3 上限 0.6。
//
// 用法：node scripts/theme-mirror.mjs [--tokens <path>] [--out <file>]
// 默认读 src/styles/tokens.css、打印到 stdout；--out 指定时写入该文件。

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_TOKENS = fileURLToPath(
  new URL("../src/styles/tokens.css", import.meta.url),
);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

function srgbChannelToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearChannelToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function rgbToOklab([r, g, b]) {
  const lr = srgbChannelToLinear(r / 255);
  const lg = srgbChannelToLinear(g / 255);
  const lb = srgbChannelToLinear(b / 255);
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToRgb({ L, a, b }) {
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.291485548 * b;
  const lr = l * l * l;
  const mg = m * m * m;
  const sb = s * s * s;
  const r = 4.0767416621 * lr - 3.3077115913 * mg + 0.2309699292 * sb;
  const g = -1.2684380046 * lr + 2.6097574011 * mg - 0.3413193965 * sb;
  const bb = -0.0041960863 * lr - 0.7034186147 * mg + 1.707614701 * sb;
  return [r, g, bb].map((c) =>
    Math.round(clamp01(linearChannelToSrgb(c)) * 255),
  );
}

function smoothstep(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

function mirrorRgb(rgb) {
  const { L, a, b } = rgbToOklab(rgb);
  const chroma = Math.hypot(a, b);
  const mirror = clamp01(1.137 - 0.907 * L);
  const t = smoothstep((chroma - 0.04) / 0.1);
  const L2 = mirror + (Math.min(0.86, Math.max(0.62, L)) - mirror) * t;
  return oklabToRgb({ L: L2, a, b });
}

function formatAlpha(a) {
  return String(Math.round(a * 1000) / 1000);
}

// 解析 rgb()/rgba() 内层（支持逗号与空格 / 斜杠两种写法），返回 { rgb, alpha }。
function parseRgbAlpha(inner) {
  let rest = inner;
  let alpha = null;
  const slash = rest.indexOf("/");
  if (slash >= 0) {
    const raw = rest.slice(slash + 1).trim();
    alpha = raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
    rest = rest.slice(0, slash);
  }
  const parts = rest
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  if (alpha === null && parts.length >= 4) alpha = parts[3];
  return { rgb: parts.slice(0, 3), alpha };
}

function mirrorShadow(value) {
  return value.replace(/rgba?\(([^)]*)\)/g, (whole, inner) => {
    const parsed = parseRgbAlpha(inner);
    if (!parsed || parsed.alpha === null) return whole;
    const alpha = Math.min(0.6, parsed.alpha * 3);
    return `rgba(${parsed.rgb.join(", ")}, ${formatAlpha(alpha)})`;
  });
}

function mirrorColorToken(token) {
  let rgb = null;
  let alpha = null;
  let hex = false;
  if (token.startsWith("#")) {
    const h = token.slice(1);
    if (![3, 4, 6, 8].includes(h.length)) return null;
    hex = true;
    if (h.length === 3 || h.length === 4) {
      rgb = [0, 1, 2].map((i) => parseInt(h[i] + h[i], 16));
      if (h.length === 4) alpha = parseInt(h[3] + h[3], 16) / 255;
    } else {
      rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      if (h.length === 8) alpha = parseInt(h.slice(6, 8), 16) / 255;
    }
  } else {
    const m = token.match(/^rgba?\(([^)]*)\)$/);
    if (!m) return null;
    const parsed = parseRgbAlpha(m[1]);
    if (!parsed) return null;
    rgb = parsed.rgb;
    alpha = parsed.alpha;
  }
  const mirrored = mirrorRgb(rgb);
  if (hex) {
    const body = mirrored.map((c) => c.toString(16).padStart(2, "0")).join("");
    return `#${body}${
      alpha === null
        ? ""
        : Math.round(alpha * 255)
            .toString(16)
            .padStart(2, "0")
    }`;
  }
  if (alpha !== null && alpha !== 1) {
    return `rgba(${mirrored.join(", ")}, ${formatAlpha(alpha)})`;
  }
  return `rgb(${mirrored.join(", ")})`;
}

function mirrorColors(value) {
  return value.replace(
    /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g,
    (token) => mirrorColorToken(token) ?? token,
  );
}

function extractBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([\\s\\S]*?)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`未找到选择器 ${selector}`);
  return m[1];
}

const tokensPath = argValue("--tokens") ?? DEFAULT_TOKENS;
const outPath = argValue("--out");
const css = readFileSync(tokensPath, "utf8");
const rootBody = extractBlock(css, ":root").replace(/\/\*[\s\S]*?\*\//g, "");

const lines = [];
for (const decl of rootBody.split(";")) {
  const d = decl.trim();
  if (!d) continue;
  const i = d.indexOf(":");
  if (i < 0) continue;
  const name = d.slice(0, i).trim();
  const value = d.slice(i + 1).trim();
  const out = name.startsWith("--shadow-")
    ? mirrorShadow(value)
    : mirrorColors(value);
  lines.push(`  ${name}: ${out};`);
}

const draft = `/* .dark 草稿 —— 由 scripts/theme-mirror.mjs 从 tokens.css 生成，人只做校对。 */\n.dark {\n${lines.join("\n")}\n}\n`;

if (outPath) {
  writeFileSync(outPath, draft, "utf8");
  console.error(`已写入 ${outPath}`);
} else {
  process.stdout.write(draft);
}
