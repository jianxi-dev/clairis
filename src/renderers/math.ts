import katex from "katex";
import type { TokenizerAndRendererExtension } from "marked";
import { isCapabilityEnabled } from "../lib/capabilities";

/** 公式渲染结果暂存区。marked 的 extension 是全局注册的，拿不到局部上下文；
 *  渲染是同步的（marked.parse async: false），所以用模块级数组是安全的。 */
let pending: string[] = [];

export function resetMathStore(): void {
  pending = [];
}

function pushMath(html: string): number {
  return pending.push(html) - 1;
}

export function takeMathHtml(id: number): string | undefined {
  return pending[id];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "html",
      strict: false,
    });
  } catch {
    return `<span class="katex-error">${escapeHtml(tex)}</span>`;
  }
}

/** 块级公式 $$…$$ */
export const mathBlockExtension: TokenizerAndRendererExtension = {
  name: "mathBlock",
  level: "block",
  tokenizer(src) {
    if (!isCapabilityEnabled("math")) return undefined;
    const m = /^ {0,3}\$\$[ \t]*\n([\s\S]*?)\n[ \t]*\$\$(?:\n|$)/.exec(src);
    if (!m) return undefined;
    return { type: "mathBlock", raw: m[0], text: m[1].trim() };
  },
  renderer(token) {
    const id = pushMath(renderMath(String(token.text ?? ""), true));
    return `<div class="katex-block wide"><span data-math="${id}"></span></div>`;
  },
};

/** 行内公式 $…$（不跨行；两侧不能是空白，右侧不能紧跟数字，规避 $100 这类货币写法） */
export const mathInlineExtension: TokenizerAndRendererExtension = {
  name: "mathInline",
  level: "inline",
  start(src) {
    return src.indexOf("$");
  },
  tokenizer(src) {
    if (!isCapabilityEnabled("math")) return undefined;
    const m = /^\$(?!\s)([^$\n]*?)(?<!\s)\$(?!\d)/.exec(src);
    if (!m) return undefined;
    return { type: "mathInline", raw: m[0], text: m[1] };
  },
  renderer(token) {
    const id = pushMath(renderMath(String(token.text ?? ""), false));
    return `<span data-math="${id}"></span>`;
  },
};
