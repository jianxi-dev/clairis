/**
 * 可视化编辑态的文档组装与注入运行时（E-16 / H2，切片 2）。
 *
 * 与预览通道的分工（design D1）：
 *   预览   `HtmlPreview`     CSP `script-src 'none'`      —— 一个脚本都不跑
 *   编辑   本文件            CSP `script-src 'nonce-…'`   —— 只跑注入的运行时
 *
 * nonce 是关键：CSP 不能按「谁写的」区分脚本，但能按 nonce 区分。注入的运行时
 * 带 nonce 放行，用户文件里那些没有 nonce 的 `<script>` 一律被挡掉——
 * 这样既让运行时跑起来，又没把用户脚本的执行权一起放开。
 */

import { rewriteHtmlPaths } from "../../renderers/html";
import { BRIDGE_VERSION } from "./bridge";
import { INTERNAL_ATTR, annotate } from "./model";

/** 桥协议版本。见 design D4：iframe 里跑的是「用户文档的上下文」，UI 一升级就会和主侧对不上。 */
export const RUNTIME_VERSION = BRIDGE_VERSION;

function runtimeSource(version: number): string {
  // 切片 3：点选上报 + 按主侧命令画高亮框。
  // 文本编辑、拆块在后续切片往这里加，保持单一入口。
  return `
(() => {
  const V = ${version};
  const HL = "highlight";
  // html/body 不算可点选目标：点它们等于点空白，应当清掉高亮，
  // 否则框会一直贴在整页边缘，看起来像"没反应"。
  const anchorOf = (el) => {
    const host = el && el.closest && el.closest("[data-cm-node-id]");
    if (!host) return null;
    const tag = host.tagName.toLowerCase();
    if (tag === "html" || tag === "body") return null;
    return host.getAttribute("data-cm-node-id");
  };
  const post = (msg) => parent.postMessage(Object.assign({ v: V }, msg), "*");

  addEventListener("DOMContentLoaded", () => {
    post({ type: "ready", nodeCount: document.querySelectorAll("[data-cm-node-id]").length });
  });

  // 高亮框必须活在这个文档里：主应用与 srcdoc 跨源，画不到上面去。
  let box = null;
  let current = null;

  const ensureBox = () => {
    if (box && box.isConnected) return box;
    box = document.createElement("div");
    box.setAttribute("data-cm-internal", HL);
    box.setAttribute("data-cm-hl-for", "");
    Object.assign(box.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "2147483647",
      border: "2px solid rgba(59,130,246,0.9)",
      borderRadius: "2px",
      background: "rgba(59,130,246,0.08)",
      boxSizing: "border-box",
      display: "none",
    });
    document.body.appendChild(box);
    return box;
  };

  const place = () => {
    // current 可能来自用户文档（annotate 不覆盖已有 data-cm-node-id），
    // 直接拼进选择器会被引号/括号打断，必须转义。
    const el = current
      ? document.querySelector('[data-cm-node-id="' + CSS.escape(current) + '"]')
      : null;
    if (!el) {
      if (box) box.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    const b = ensureBox();
    b.setAttribute("data-cm-hl-for", current);
    b.style.display = "block";
    b.style.left = (r.left + scrollX) + "px";
    b.style.top = (r.top + scrollY) + "px";
    b.style.width = r.width + "px";
    b.style.height = r.height + "px";
  };

  document.addEventListener("click", (e) => post({ type: "selection", nodeId: anchorOf(e.target) }), true);
  addEventListener("scroll", place, true);
  addEventListener("resize", place);
  addEventListener("message", (e) => {
    if (e.source !== parent) return;
    const d = e.data;
    if (!d || d.v !== V || d.type !== "highlight") return;
    current = typeof d.nodeId === "string" ? d.nodeId : null;
    place();
  });
})();
`.trim();
}

function nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface EditableDocOptions {
  filePath?: string | null;
  /** 缩放用的基准字号（与预览一致） */
  fontSize?: number;
}

/**
 * 组装编辑态文档：相对资源重写 → 打锚点 → 注入 CSP(nonce) 与运行时。
 *
 * 顺序有讲究：先重写路径再打锚点。`annotate` 会经过 DOMParser 序列化，
 * 反过来做的话正则重写就得面对规范化后的 HTML，边界更多。
 */
export function buildEditableDoc(
  content: string,
  options: EditableDocOptions = {},
): string {
  const rewritten = rewriteHtmlPaths(content, options.filePath ?? null);
  const annotated = annotate(rewritten);
  const n = nonce();
  const fontSize = options.fontSize ?? 16;

  const csp = [
    "default-src 'self' 'unsafe-inline'",
    `script-src 'nonce-${n}'`,
    "img-src 'self' data: asset:",
    "style-src 'self' 'unsafe-inline' asset:",
    "font-src 'self' asset: data:",
    "media-src 'self' asset:",
    "frame-src 'self' asset:",
  ].join("; ");

  const head = [
    `<meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<style ${INTERNAL_ATTR}="runtime">html { font-size: ${fontSize}px; }</style>`,
    `<script nonce="${n}" ${INTERNAL_ATTR}="runtime">${runtimeSource(RUNTIME_VERSION)}</script>`,
  ].join("");

  // 注入到 <head> 内；文档没有 head 时（浏览器解析会自动补一个）退回顶层拼接
  if (/<head[^>]*>/i.test(annotated)) {
    return annotated.replace(/<head[^>]*>/i, (m) => `${m}${head}`);
  }
  return annotated.replace(/<html[^>]*>/i, (m) => `${m}<head>${head}</head>`);
}
