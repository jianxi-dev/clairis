import { log } from "../utils/log";

/** md-bundle 预览态字体栈（`--type-font-sans`）；标题字体缺省值，唯一来源。 */
export const HEADING_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';

export const HEADING_LEVELS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

export type HeadingLevel = (typeof HEADING_LEVELS)[number];

export interface HeadingFonts {
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  h5: string;
  h6: string;
}

const GENERIC_FONT_KEYWORDS = new Set([
  "-apple-system",
  "blinkmacsystemfont",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "ui-rounded",
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy",
]);

const MAX_FONT_VALUE_LENGTH = 300;

export function isFontFamilyStructurallyValid(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if ([...trimmed].length > MAX_FONT_VALUE_LENGTH) return false;
  if (
    [...trimmed].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)
  ) {
    return false;
  }
  return !/[{}<>\\`]/.test(trimmed);
}

function familyCandidates(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().replace(/^["']+|["']+$/g, ""))
    .filter((part) => part.length > 0);
}

/**
 * 系统可用性：值整体等于默认栈时直接通过；否则至少一个非 generic 候选族要落在本机
 * 已安装列表里。`families` 为 null / 空表示枚举不可用（预设兜底），跳过该项检查，
 * 只做结构性校验——避免枚举缺失时把别的机器上的合法字体误判成非法。
 */
export function isFontFamilyAllowed(
  value: string,
  families: string[] | null,
): boolean {
  if (value === HEADING_FONT_STACK) return true;
  if (!isFontFamilyStructurallyValid(value)) return false;
  if (!families || families.length === 0) return true;
  const candidates = familyCandidates(value);
  const specific = candidates.filter(
    (name) => !GENERIC_FONT_KEYWORDS.has(name.toLowerCase()),
  );
  if (specific.length === 0) return true;
  const installed = new Set(families.map((name) => name.toLowerCase()));
  return specific.some((name) => installed.has(name.toLowerCase()));
}

/**
 * 把 Rust 传来的原始 `headingFonts` 归一化成**显式配置**的部分映射：结构合法且不等于
 * 默认栈的值保留；缺失 / 非法 / 等于默认栈的值丢弃（渲染层由 CSS fallback 兜底）。
 * 系统可用性不在加载路径判定（此时尚未枚举字体），由设置面板输入时校验。
 */
export function normalizeHeadingFonts(raw: unknown): Partial<HeadingFonts> {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const rejected: string[] = [];
  const out: Partial<HeadingFonts> = {};
  for (const level of HEADING_LEVELS) {
    const value = record?.[level];
    if (
      typeof value === "string" &&
      isFontFamilyStructurallyValid(value) &&
      value !== HEADING_FONT_STACK
    ) {
      out[level] = value;
    } else if (
      typeof value === "string" &&
      value.trim() &&
      value !== HEADING_FONT_STACK
    ) {
      rejected.push(level);
    }
  }
  if (rejected.length > 0) {
    log.warn("Config", `标题字体非法值已回落默认: ${rejected.join(", ")}`);
  }
  return out;
}

/** 输入框显示值：空值 / 默认栈都显示空串，由 placeholder 呈现「默认」。 */
export function headingFontInputValue(value: string | undefined): string {
  if (!value || value === HEADING_FONT_STACK) return "";
  return value;
}

export type HeadingFontParse =
  { kind: "default" } | { kind: "valid"; value: string } | { kind: "invalid" };

export function parseHeadingFontInput(
  text: string,
  families: string[] | null,
): HeadingFontParse {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "default" };
  if (!isFontFamilyAllowed(trimmed, families)) return { kind: "invalid" };
  return { kind: "valid", value: trimmed };
}
