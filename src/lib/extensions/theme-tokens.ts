/* 主题 token 覆盖（design §D4）。
 *
 * `theme.toml` 的 `[tokens]` 经 IPC 传到前端后**再校验一遍**（不信任 IPC 输入）：
 * 键必须匹配 `^--app-[a-z0-9-]+$`，值只能是 `#rgb` / `#rrggbb` / `rgb()` /
 * `rgba()` / `hsl()`。非法项丢弃；全部非法时 `buildTokenStyle` 返回 `null`。
 *
 * 应用方式：在 `document.head` 维护**单个** `<style id="user-theme-tokens">`，
 * 内容形如 `:root{--app-x:...;}`，只作用于 `:root`，绝不修改任何 CSS 文件。
 */

const KEY_RE = /^--app-[a-z0-9-]+$/;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** 函数式颜色：`rgb(...)` / `rgba(...)` / `hsl(...)`，内部不含括号/分号，杜绝注入。 */
const FUNC_RE = /^(?:rgb|rgba|hsl)\([0-9a-zA-Z.,%/+ -]*\)$/;

/** 值白名单：`#rgb`/`#rrggbb`/`rgb()`/`rgba()`/`hsl()`；其它（含 `url()`）拒绝。 */
function isValidColorValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return HEX_RE.test(trimmed) || FUNC_RE.test(trimmed);
}

/**
 * 把 token 表编译成一段 `:root{...}` 样式文本。
 * 非法键/值静默丢弃；没有任何合法项时返回 `null`。
 */
export function buildTokenStyle(tokens: Record<string, string>): string | null {
  const declarations: string[] = [];
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value !== "string") continue;
    if (!KEY_RE.test(key)) continue;
    if (!isValidColorValue(value)) continue;
    declarations.push(`${key}:${value.trim()};`);
  }
  if (declarations.length === 0) return null;
  return `:root{${declarations.join("")}}`;
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
