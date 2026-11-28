/* 高亮块首行属性块（`{bg=… border=… text=…}`）的解析 / 序列化 / 写回。
 *
 * 纯函数，无 CM6 / DOM 依赖：编辑装饰（`decorations/callout.ts`）与预览渲染
 * （`renderers/markdown.ts`）共用这一份，避免两侧解析漂移（D1）。
 *
 * 色名取自统一色板（`orchestration/color-palette.ts`）的类名后缀，不另立色值：
 * 存储写 `bg=green`，不写 CSS / hex。未知色名与 `none` 一律忽略（回落类型 tone）。
 */
import {
  BACKGROUND_COLORS,
  FONT_COLORS,
  HIGHLIGHT_BORDER_COLORS,
  HIGHLIGHT_FILL_DEEP,
  HIGHLIGHT_FILL_MID,
  HIGHLIGHT_FONT_COLORS,
} from "./orchestration/color-palette";

/** 解析后的高亮块三色属性；缺省项表示「未设色，回落类型 tone」。 */
export interface CalloutAttrs {
  /** 填充色名（`BACKGROUND_COLORS` 后缀）。 */
  readonly bg?: string;
  /** 边框色名（`BORDER_COLORS` 后缀，与背景色同值集）。 */
  readonly border?: string;
  /** 文字色名（`FONT_COLORS` 后缀）。 */
  readonly text?: string;
  /** 头部 emoji 覆盖（单个字符，重启后仍生效；缺省回落类型图标）。 */
  readonly emoji?: string;
}

/** 填充 / 边框共用背景色板的后缀集合。 */
const BG_NAMES: ReadonlySet<string> = new Set(
  BACKGROUND_COLORS.filter((color) => !color.isDefault).map((color) =>
    color.className.replace(/^mdb-bg-/, ""),
  ),
);

/** 文字色板的后缀集合。 */
const TEXT_NAMES: ReadonlySet<string> = new Set(
  FONT_COLORS.filter((color) => !color.isDefault).map((color) =>
    color.className.replace(/^mdb-color-/, ""),
  ),
);

/** 高亮填充色板（深档 + 中档）的后缀集合。 */
const HIGHLIGHT_FILL_NAMES: ReadonlySet<string> = new Set(
  [...HIGHLIGHT_FILL_DEEP, ...HIGHLIGHT_FILL_MID]
    .filter((color) => !color.isDefault)
    .map((color) => color.className.replace(/^hl-fill-/, "")),
);

/** 高亮边框色板的后缀集合。 */
const HIGHLIGHT_BORDER_NAMES: ReadonlySet<string> = new Set(
  HIGHLIGHT_BORDER_COLORS.filter((color) => !color.isDefault).map((color) =>
    color.className.replace(/^hl-border-/, ""),
  ),
);

/** 高亮字体色板的后缀集合。 */
const HIGHLIGHT_TEXT_NAMES: ReadonlySet<string> = new Set([
  ...HIGHLIGHT_FONT_COLORS.filter((color) => !color.isDefault).map((color) =>
    color.className.replace(/^hl-color-/, ""),
  ),
  // 旧文档 `text=gray`：灰色已从高亮字体板移出，但 CSS 变量仍在，保留解析兼容。
  "gray",
]);

const BG_NAME_SET: ReadonlySet<string> = new Set([
  ...BG_NAMES,
  ...HIGHLIGHT_FILL_NAMES,
]);
const BORDER_NAME_SET: ReadonlySet<string> = new Set([
  ...BG_NAMES,
  ...HIGHLIGHT_BORDER_NAMES,
]);
const TEXT_NAME_SET: ReadonlySet<string> = new Set([
  ...TEXT_NAMES,
  ...HIGHLIGHT_TEXT_NAMES,
]);

const BG_SWATCH = new Map(
  BACKGROUND_COLORS.filter((color) => !color.isDefault).map((color) => [
    color.className.replace(/^mdb-bg-/, ""),
    color.swatch,
  ]),
);

const TEXT_SWATCH = new Map(
  FONT_COLORS.filter((color) => !color.isDefault).map((color) => [
    color.className.replace(/^mdb-color-/, ""),
    color.swatch,
  ]),
);

/** 面板类名前缀 → 属性键（`mdb-*` 标注板 + `hl-*` 高亮板）。 */
const ATTR_PREFIX = {
  bg: ["mdb-bg-", "hl-fill-"],
  border: ["mdb-border-", "hl-border-"],
  text: ["mdb-color-", "hl-color-"],
} as const;

/**
 * 解析属性块内容（可以带或不带外层 `{}`）。
 *
 * 顺序无关；`key=value` 以空白分隔。未知键、未知色名、`none`、空值一律忽略，
 * 未提供的颜色缺省（渲染回落类型 tone）。
 */
export function parseCalloutAttrs(raw: string): CalloutAttrs {
  // 兼容历史脏数据：同一行可能叠着多个属性块（旧随机写回缺陷），全部合并解析，
  // 后出现的键覆盖先出现的，避免再写时把旧块当标题。
  const groups = raw.match(/\{[^}]*\}/g) ?? [];
  const body = groups.length > 0
    ? groups.map((group) => group.slice(1, -1)).join(" ")
    : raw;
  const attrs: { bg?: string; border?: string; text?: string; emoji?: string } = {};
  for (const token of body.split(/\s+/)) {
    if (token === "") continue;
    const eq = token.indexOf("=");
    if (eq < 0) continue;
    const key = token.slice(0, eq);
    const rawValue = token.slice(eq + 1);
    if (key === "emoji") {
      // emoji 保留原始大小写/码点，只拒绝空白与花括号。
      if (/^[^\s{}]{1,16}$/.test(rawValue)) attrs.emoji = rawValue;
      continue;
    }
    const value = rawValue.toLowerCase();
    if (value === "" || value === "none") continue;
    if (key === "bg" && BG_NAME_SET.has(value)) attrs.bg = value;
    else if (key === "border" && BORDER_NAME_SET.has(value))
      attrs.border = value;
    else if (key === "text" && TEXT_NAME_SET.has(value)) attrs.text = value;
  }
  return attrs;
}

/** 把属性序列化成 `{bg=… border=… text=…}`；全空返回空串。 */
export function serializeCalloutAttrs(attrs: CalloutAttrs): string {
  const parts: string[] = [];
  if (attrs.bg) parts.push(`bg=${attrs.bg}`);
  if (attrs.border) parts.push(`border=${attrs.border}`);
  if (attrs.text) parts.push(`text=${attrs.text}`);
  if (attrs.emoji) parts.push(`emoji=${attrs.emoji}`);
  return parts.length > 0 ? `{${parts.join(" ")}}` : "";
}

/**
 * 首行结构：`> [!TYPE][+-]?{attrs}? 标题`。
 *
 * `]` 与属性块之间允许空白：编辑态回写历史版本时出现过 `> [!NOTE] {bg=red}`
 * 的写法；不容忍空白会把旧属性当标题，导致再次改色时叠加出第二个属性块。
 */
const FIRST_LINE_RE =
  /^(\s{0,3}>\s*\[![A-Za-z]+\])([+-]?)\s*((?:\{[^}]*\}\s*)*)(\s*)(.*)$/;

/** 读取块首行已有的三色属性（无属性块返回空对象）。 */
export function getCalloutAttrs(blockText: string): CalloutAttrs {
  const first = blockText.split("\n")[0] ?? "";
  const match = FIRST_LINE_RE.exec(first);
  return parseCalloutAttrs(match?.[3] ?? "");
}

/**
 * 用新属性替换块首行的属性块，保留类型标记、折叠标记与标题。
 *
 * 属性全空时移除属性块（旧 `> [!NOTE]` 逐字节不变）。只动首行。
 */
export function setCalloutAttrs(
  blockText: string,
  attrs: CalloutAttrs,
): string {
  const lines = blockText.split("\n");
  const match = FIRST_LINE_RE.exec(lines[0] ?? "");
  if (!match) return blockText;
  const serialized = serializeCalloutAttrs(attrs);
  const tail = match[5] ? `${match[4] || " "}${match[5]}` : "";
  lines[0] = `${match[1]}${match[2]}${serialized}${tail}`;
  return lines.join("\n");
}

/** 面板类名（`mdb-bg-green` 等）→ 存储色名；默认项 / 非法项返回空串。 */
export function attrNameFromClassName(
  key: keyof typeof ATTR_PREFIX,
  className: string,
): string {
  for (const prefix of ATTR_PREFIX[key]) {
    if (className.startsWith(prefix)) return className.slice(prefix.length);
  }
  return "";
}

/** 填充软色：与既有 tone soft 同量级（~10% tint），不是实块。 */
export function softColor(hex: string): string {
  return `color-mix(in srgb, ${hex} 10%, transparent)`;
}

/** 渲染用 CSS 变量；缺省项不出现（由 CSS 回落 tone / 继承文字色）。 */
export interface CalloutCssVars {
  readonly bg?: string;
  readonly border?: string;
  readonly text?: string;
}

/** 把三色属性换算成卡片 CSS 变量值（填充走软色，边框 / 文字走实色）。 */
export function calloutCssVars(attrs: CalloutAttrs): CalloutCssVars {
  const vars: { bg?: string; border?: string; text?: string } = {};
  const bg = attrs.bg ? BG_SWATCH.get(attrs.bg) : undefined;
  if (bg) vars.bg = softColor(bg);
  const border = attrs.border ? BG_SWATCH.get(attrs.border) : undefined;
  if (border) vars.border = border;
  const text = attrs.text ? TEXT_SWATCH.get(attrs.text) : undefined;
  if (text) vars.text = text;
  return vars;
}

/** 高亮填充色名 → 色值（深档 + 中档）。 */
const HIGHLIGHT_FILL_SWATCH = new Map(
  [...HIGHLIGHT_FILL_DEEP, ...HIGHLIGHT_FILL_MID]
    .filter((color) => !color.isDefault)
    .map((color) => [color.className.replace(/^hl-fill-/, ""), color.swatch]),
);

/** 高亮边框色名 → 色值。 */
const HIGHLIGHT_BORDER_SWATCH = new Map(
  HIGHLIGHT_BORDER_COLORS.filter((color) => !color.isDefault).map((color) => [
    color.className.replace(/^hl-border-/, ""),
    color.swatch,
  ]),
);

/** 高亮字体色名 → 色值。 */
const HIGHLIGHT_TEXT_SWATCH = new Map(
  HIGHLIGHT_FONT_COLORS.filter((color) => !color.isDefault).map((color) => [
    color.className.replace(/^hl-color-/, ""),
    color.swatch,
  ]),
);
// 旧文档可能存 `text=gray`：灰色已从字体板移出（换成「高对比」），但 CSS 变量
// 仍在，保留兼容映射，避免旧文档失去文字色。
HIGHLIGHT_TEXT_SWATCH.set("gray", "var(--hl-font-gray)");

/**
 * 旧色名 → 高亮新色名（editor-surface-batch22 兼容映射）。
 *
 * 旧文档用 `bg=darkred` / `border=olive` / `text=orange` 等旧标注色名；高亮
 * 色板换成独立 24 格后，部分旧名不在新板内。这里把**新板缺失**的旧名映射到
 * 视觉最接近的新名，保证旧文档仍渲染出颜色。新板已有的同名色（`gray` / `red`
 * / `darkred` 等）不经过此表，按原名直查，保留旧文档的明暗语义。
 *
 * 填充 / 边框分别维护：同一旧名在两表的最佳落点不同（如 `darkred` 作填充
 * 保留暗红 `darkred`，作边框落到 `red`）。
 */
const FILL_LEGACY_ALIAS: Readonly<Record<string, string>> = {
  cyan: "blue",
  brown: "darkorange",
  olive: "darkyellow",
  navy: "darkblue",
  indigo: "darkpurple",
  slate: "darkgray",
};

const BORDER_LEGACY_ALIAS: Readonly<Record<string, string>> = {
  darkred: "red",
  cyan: "blue",
  brown: "orange",
  olive: "yellow",
  navy: "blue",
  indigo: "purple",
  slate: "gray",
  darkgreen: "green",
};

const TEXT_LEGACY_ALIAS: Readonly<Record<string, string>> = {
  cyan: "blue",
};

function resolveHighlightFill(name: string): string | undefined {
  return HIGHLIGHT_FILL_SWATCH.get(FILL_LEGACY_ALIAS[name] ?? name);
}

function resolveHighlightBorder(name: string): string | undefined {
  return HIGHLIGHT_BORDER_SWATCH.get(BORDER_LEGACY_ALIAS[name] ?? name);
}

function resolveHighlightText(name: string): string | undefined {
  return HIGHLIGHT_TEXT_SWATCH.get(TEXT_LEGACY_ALIAS[name] ?? name);
}

/** 纯高亮渲染：填充用更强叠底（80%），无属性时由 CSS 回落 tone。 */
export function highlightCssVars(attrs: CalloutAttrs): CalloutCssVars {
  const vars: { bg?: string; border?: string; text?: string } = {};
  const bg = attrs.bg ? resolveHighlightFill(attrs.bg) : undefined;
  if (bg) vars.bg = bg;
  const border = attrs.border ? resolveHighlightBorder(attrs.border) : undefined;
  if (border) vars.border = border;
  const text = attrs.text ? resolveHighlightText(attrs.text) : undefined;
  if (text) vars.text = text;
  return vars;
}
