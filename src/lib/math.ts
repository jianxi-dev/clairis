/* 公式渲染共享语义（editor-batch3-lowcost D5 / E-43）。
 *
 * 编辑态装饰（src/editors/decorations/math.ts）与预览渲染（src/renderers/math.ts）
 * 共用同一套 display 判定与占位渲染，避免「编辑态块级、预览态行内」或
 * 「编辑态残渣、预览态报错」的分叉。
 *
 * 占位元素用内联样式，不引入 `cm-*` class：CSS manifest 门禁要求
 * src/editors/decorations 下声明的每个 cm-* class 在 src/styles 有对应规则，
 * 而本票明确不改 CSS。
 */
import katex from "katex";

/** 空公式占位文案。 */
export const MATH_EMPTY_PLACEHOLDER = "添加 LaTeX 公式";
/** 无效公式占位文案。 */
export const MATH_INVALID_PLACEHOLDER = "无效公式";

/** 块级环境：以这些 \begin{...} 开头的 tex 按块级渲染。 */
const DISPLAY_BEGIN_RE =
  /^\s*\\begin\{(equation|align|gather|split|alignat|CD)\}/;

/**
 * tex 是否按块级（display）渲染。
 *
 * - 含换行 → 块级；
 * - 含 `\tag` → 块级；
 * - 以 `\begin{equation|align|gather|split|alignat|CD}` 开头 → 块级；
 * - `\begin{align*}` 不算块级（正则要求环境名后紧跟 `}`）。
 */
export function isDisplayMath(tex: string): boolean {
  if (tex.includes("\n")) return true;
  if (tex.includes("\\tag")) return true;
  return DISPLAY_BEGIN_RE.test(tex);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 警告图标（内联 SVG，避免依赖图标字体 / 额外 CSS）。 */
const WARNING_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
  '<line x1="12" y1="9" x2="12" y2="13"/>' +
  '<line x1="12" y1="17" x2="12.01" y2="17"/>' +
  "</svg>";

/**
 * 占位元素 HTML：单个 span 内含图标（可选）+ 文案，文本严格等于占位文案。
 * `warning` 为 true 时带警告图标（红橙色调）。
 */
function placeholderHtml(text: string, warning: boolean): string {
  const icon = warning ? WARNING_ICON : "";
  const color = warning ? "#c0563f" : "inherit";
  return (
    `<span class="math-placeholder" role="img" aria-label="${escapeHtml(text)}" ` +
    `style="display:inline-flex;align-items:center;gap:4px;` +
    `color:${color};opacity:.85;font-family:var(--type-font-mono);font-size:.9em;` +
    `white-space:nowrap;">${icon}${escapeHtml(text)}</span>`
  );
}

/** 无效公式占位（浮层预览遇到无法解析的源码时使用）。 */
export function renderMathInvalidPlaceholder(): string {
  return placeholderHtml(MATH_INVALID_PLACEHOLDER, true);
}

/**
 * 渲染 tex 为 HTML；空 tex 与渲染失败都退回占位，绝不产出 `.katex-error`。
 *
 * `throwOnError: true` 让 KaTeX 抛错；再兜一层检查输出里是否混入
 * `katex-error`，保证「无渲染残渣」。
 */
export function renderMathHtml(tex: string, displayMode: boolean): string {
  if (tex.trim() === "") return placeholderHtml(MATH_EMPTY_PLACEHOLDER, false);
  try {
    const html = katex.renderToString(tex, {
      displayMode,
      throwOnError: true,
      output: "html",
      strict: false,
    });
    if (html.includes("katex-error")) {
      return placeholderHtml(MATH_INVALID_PLACEHOLDER, true);
    }
    return html;
  } catch {
    return placeholderHtml(MATH_INVALID_PLACEHOLDER, true);
  }
}
