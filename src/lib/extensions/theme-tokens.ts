/* 主题 token 覆盖（design §D4）。
 *
 * `theme.toml` 的 `[tokens]` 经 IPC 传到前端后**再校验一遍**（不信任 IPC 输入）：
 * 键只接受 `src/styles/tokens.css` 已声明的 `--app-*` 名，且裸名与带前缀两种写法
 * 等价（`accent` 与 `--app-accent` 都指向 `--app-accent`）；值只能是
 * `#rgb` / `#rrggbb` / `rgb()` / `rgba()` / `hsl()` / 具名色。非法项丢弃；
 * 全部非法时 `buildTokenStyle` 返回 `null`。
 *
 * 应用方式：在 `document.head` 维护**单个** `<style id="user-theme-tokens">`，
 * 内容形如 `:root{--app-x:...;}`，只作用于 `:root`，绝不修改任何 CSS 文件。
 */

/** `tokens.css` 已声明的 token 名（不含 `--app-` 前缀）。新增 token 时同步此处。 */
const DECLARED_TOKENS: ReadonlySet<string> = new Set([
  "accent",
  "accent-soft",
  "bg",
  "surface",
  "sunken",
  "text",
  "text-strong",
  "text-2",
  "text-3",
  "border",
  "border-strong",
  "radius",
  "shadow",
]);

const NAME_RE = /^[a-z0-9-]+$/;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** 函数式颜色：`rgb(...)` / `rgba(...)` / `hsl(...)`，内部不含括号/分号，杜绝注入。 */
const FUNC_RE = /^(?:rgb|rgba|hsl)\([0-9a-zA-Z.,%/+ -]*\)$/;
/** 具名色（`red` / `rebeccapurple`）；只有字母，无法注入声明或 `url()`。 */
const NAMED_RE = /^[a-zA-Z]+$/;

/**
 * 把 `theme.toml` 里的键规范化成 `--app-<name>`。
 * 未声明或形状非法的键返回 `null`（调用方丢弃并计入告警）。
 */
export function normalizeTokenKey(key: string): string | null {
  const name = key.startsWith("--app-") ? key.slice("--app-".length) : key;
  if (!NAME_RE.test(name)) return null;
  if (!DECLARED_TOKENS.has(name)) return null;
  return `--app-${name}`;
}

/** 值白名单：`#rgb`/`#rrggbb`/`rgb()`/`rgba()`/`hsl()`/具名色；其它（含 `url()`）拒绝。 */
function isValidColorValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return (
    HEX_RE.test(trimmed) || FUNC_RE.test(trimmed) || NAMED_RE.test(trimmed)
  );
}

export interface TokenStyleResult {
  /** `:root{...}` 文本；没有任何合法项时为 `null`。 */
  css: string | null;
  /** 被丢弃的键（未声明 / 值非法），用于聚合一条告警。 */
  rejected: string[];
}

/**
 * 把 token 表编译成 `:root{...}` 样式文本，同时返回被丢弃的键。
 * 同一个 token 的两种写法重复出现时，后出现的覆盖先出现的。
 */
export function compileTokenStyle(
  tokens: Record<string, string>,
): TokenStyleResult {
  const declarations = new Map<string, string>();
  const rejected: string[] = [];

  for (const [rawKey, value] of Object.entries(tokens)) {
    const key = normalizeTokenKey(rawKey);
    if (
      key === null ||
      typeof value !== "string" ||
      !isValidColorValue(value)
    ) {
      rejected.push(rawKey);
      continue;
    }
    declarations.set(key, value.trim());
  }

  if (declarations.size === 0) return { css: null, rejected };
  const body = [...declarations].map(([key, value]) => `${key}:${value};`);
  return { css: `:root{${body.join("")}}`, rejected };
}

/**
 * 把 token 表编译成一段 `:root{...}` 样式文本。
 * 非法键/值静默丢弃；没有任何合法项时返回 `null`。
 */
export function buildTokenStyle(tokens: Record<string, string>): string | null {
  return compileTokenStyle(tokens).css;
}

/**
 * 应用 token 覆盖：在 `document.head` 维护单个 `<style id="user-theme-tokens">`。
 * `tokens` 全部非法（`buildTokenStyle` 返回 `null`）时移除该元素。
 */
export function applyThemeTokens(tokens: Record<string, string>): void {
  const style = buildTokenStyle(tokens);
  const existing = document.head.querySelector<HTMLStyleElement>(
    "style#user-theme-tokens",
  );

  if (style === null) {
    existing?.remove();
    return;
  }

  if (existing) {
    existing.textContent = style;
    return;
  }

  const el = document.createElement("style");
  el.id = "user-theme-tokens";
  el.setAttribute("data-theme-tokens", "");
  el.textContent = style;
  document.head.appendChild(el);
}

export const applyUserThemeTokens = applyThemeTokens;
