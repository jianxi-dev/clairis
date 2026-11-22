/* 高亮块首行属性块（`{bg=… border=… text=…}`）的解析 / 序列化 / 写回。
 *
 * 纯函数，无 CM6 / DOM 依赖：编辑装饰（`decorations/callout.ts`）与预览渲染
 * （`renderers/markdown.ts`）共用这一份，避免两侧解析漂移（D1）。
 *
 * 色名取自统一色板（`orchestration/color-palette.ts`）的类名后缀，不另立色值：
 * 存储写 `bg=green`，不写 CSS / hex。未知色名与 `none` 一律忽略（回落类型 tone）。
 */
import { BACKGROUND_COLORS, FONT_COLORS } from "./orchestration/color-palette";

/** 解析后的高亮块三色属性；缺省项表示「未设色，回落类型 tone」。 */
export interface CalloutAttrs {
  /** 填充色名（`BACKGROUND_COLORS` 后缀）。 */
  readonly bg?: string;
  /** 边框色名（`BORDER_COLORS` 后缀，与背景色同值集）。 */
  readonly border?: string;
  /** 文字色名（`FONT_COLORS` 后缀）。 */
  readonly text?: string;
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

/** 面板类名前缀 → 属性键。 */
const ATTR_PREFIX = {
  bg: "mdb-bg-",
  border: "mdb-border-",
  text: "mdb-color-",
} as const;

/**
 * 解析属性块内容（可以带或不带外层 `{}`）。
 *
 * 顺序无关；`key=value` 以空白分隔。未知键、未知色名、`none`、空值一律忽略，
 * 未提供的颜色缺省（渲染回落类型 tone）。
 */
export function parseCalloutAttrs(raw: string): CalloutAttrs {
  const body =
    raw.startsWith("{") && raw.endsWith("}") ? raw.slice(1, -1) : raw;
  const attrs: { bg?: string; border?: string; text?: string } = {};
  for (const token of body.split(/\s+/)) {
    if (token === "") continue;
    const eq = token.indexOf("=");
    if (eq < 0) continue;
    const key = token.slice(0, eq);
    const value = token.slice(eq + 1).toLowerCase();
    if (value === "" || value === "none") continue;
    if (key === "bg" && BG_NAMES.has(value)) attrs.bg = value;
    else if (key === "border" && BG_NAMES.has(value)) attrs.border = value;
    else if (key === "text" && TEXT_NAMES.has(value)) attrs.text = value;
  }
  return attrs;
}

/** 把属性序列化成 `{bg=… border=… text=…}`；全空返回空串。 */
export function serializeCalloutAttrs(attrs: CalloutAttrs): string {
  const parts: string[] = [];
  if (attrs.bg) parts.push(`bg=${attrs.bg}`);
  if (attrs.border) parts.push(`border=${attrs.border}`);
  if (attrs.text) parts.push(`text=${attrs.text}`);
  return parts.length > 0 ? `{${parts.join(" ")}}` : "";
}

/** 首行结构：`> [!TYPE][+-]?{attrs}? 标题`（与装饰的 `CALLOUT_OPEN_RE` 同形）。 */
const FIRST_LINE_RE =
  /^(\s{0,3}>\s*\[![A-Za-z]+\])([+-]?)(\{[^}]*\})?(\s*)(.*)$/;

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
export function setCalloutAttrs(blockText: string, attrs: CalloutAttrs): string {
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
  const prefix = ATTR_PREFIX[key];
  return className.startsWith(prefix) ? className.slice(prefix.length) : "";
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
