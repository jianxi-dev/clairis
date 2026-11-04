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
import { INTERNAL_ATTR, annotate } from "./model";

/** 桥协议版本。见 design D4：iframe 里跑的是「用户文档的上下文」，UI 一升级就会和主侧对不上。 */
export const RUNTIME_VERSION = 1;

export type BridgeMessage =
  | { v: number; type: "ready"; nodeCount: number }
  | { v: number; type: "selection"; nodeId: string | null };

function nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function runtimeSource(version: number): string {
  // 只做切片 2 需要的事：报到、把 select/点选上报为 selection。
  // 文本编辑、拆块在后续切片往这里加，保持单一入口。
  return `
(() => {
  const V = ${version};
  const anchorOf = (el) => {
    const host = el && el.closest && el.closest("[data-cm-node-id]");
    return host ? host.getAttribute("data-cm-node-id") : null;
  };
  const post = (msg) => parent.postMessage(Object.assign({ v: V }, msg), "*");

  addEventListener("DOMContentLoaded", () => {
    post({ type: "ready", nodeCount: document.querySelectorAll("[data-cm-node-id]").length });
  });

  let current = null;
  document.addEventListener("click", (e) => {
    const nodeId = anchorOf(e.target);
    if (nodeId === current) return;
    current = nodeId;
    post({ type: "selection", nodeId });
  }, true);
})();
`.trim();
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
