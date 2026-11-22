import type { TokenizerAndRendererExtension } from "marked";
import { isCapabilityEnabled } from "../lib/capabilities";
import { isDisplayMath, renderMathHtml } from "../lib/math";

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

/** 块级公式 $$…$$：多行与单行都按块级渲染（与编辑态装饰一致）。 */
export const mathBlockExtension: TokenizerAndRendererExtension = {
  name: "mathBlock",
  level: "block",
  tokenizer(src) {
    if (!isCapabilityEnabled("math")) return undefined;
    const multi = /^ {0,3}\$\$[ \t]*\n([\s\S]*?)\n[ \t]*\$\$(?:\n|$)/.exec(src);
    if (multi) {
      return { type: "mathBlock", raw: multi[0], text: multi[1].trim() };
    }
    const single = /^ {0,3}\$\$[ \t]*(.*?)[ \t]*\$\$[ \t]*(?:\n|$)/.exec(src);
    if (single && single[1].trim() !== "") {
      return { type: "mathBlock", raw: single[0], text: single[1].trim() };
    }
    return undefined;
  },
  renderer(token) {
    const id = pushMath(renderMathHtml(String(token.text ?? ""), true));
    return `<div class="katex-block wide"><span data-math="${id}"></span></div>`;
  },
};

/** 行内公式 $…$（不跨行；两侧不能是空白，右侧不能紧跟数字，规避 $100 这类货币写法）。
 *  含换行 / \tag / 块级环境的 tex 仍按块级渲染（与编辑态装饰同一判定）。 */
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
    const tex = String(token.text ?? "");
    const id = pushMath(renderMathHtml(tex, isDisplayMath(tex)));
    return `<span data-math="${id}"></span>`;
  },
};
