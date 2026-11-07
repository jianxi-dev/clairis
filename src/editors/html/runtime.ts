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
    // 工具条画在主文档（design D1），但只有这里知道元素的精确矩形。
    // 视口坐标直接上报，主侧加上 iframe 自身的偏移即可。
    post({ type: "selectionRect", nodeId: current, rect: { x: r.left, y: r.top, width: r.width, height: r.height } });
  };

  // 截图模式（E-21）下禁用点选/拖拽/编辑，光标切十字
  let captureMode = false;

  // —— 拖拽移动（E-20）——
  // 阈值 4px：低于它算点击（design D2）。越过阈值前不 preventDefault，
  // 用户反悔时松手仍是一次正常的点选。
  const DRAG_THRESHOLD = 4;
  let dragFrom = null;
  let dragEl = null;
  let dropTarget = null;
  let dropLine = null;
  let suppressClick = false;

  const ensureDropLine = () => {
    if (dropLine && dropLine.isConnected) return dropLine;
    dropLine = document.createElement("div");
    dropLine.setAttribute("data-cm-internal", "dropline");
    Object.assign(dropLine.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "2147483646",
      height: "2px",
      background: "rgba(59,130,246,0.9)",
      borderRadius: "1px",
      display: "none",
    });
    document.body.appendChild(dropLine);
    return dropLine;
  };

  const hideDropLine = () => {
    if (dropLine) dropLine.style.display = "none";
    dropTarget = null;
  };

  document.addEventListener("mousedown", (e) => {
    if (captureMode || editing || e.button !== 0) return;
    const el = e.target && e.target.closest ? e.target.closest("[data-cm-node-id]") : null;
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    if (tag === "html" || tag === "body") return;
    dragFrom = { el: el, nodeId: el.getAttribute("data-cm-node-id"), x: e.clientX, y: e.clientY };
  }, true);

  document.addEventListener("mousemove", (e) => {
    if (captureMode || !dragFrom) return;
    if (!dragEl) {
      if (Math.abs(e.clientX - dragFrom.x) < DRAG_THRESHOLD && Math.abs(e.clientY - dragFrom.y) < DRAG_THRESHOLD) return;
      dragEl = dragFrom.el;
      suppressClick = true;
    }
    e.preventDefault();
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const cand = under && under.closest ? under.closest("[data-cm-node-id]") : null;
    // 拖到自己或自己的子孙上：浏览器会让整棵子树消失，直接不给落点（design D3）
    if (!cand || cand === dragEl || dragEl.contains(cand)) { hideDropLine(); return; }
    const r = cand.getBoundingClientRect();
    const position = e.clientY < r.top + r.height / 2 ? "before" : "after";
    dropTarget = { nodeId: cand.getAttribute("data-cm-node-id"), position: position };
    const line = ensureDropLine();
    line.setAttribute("data-cm-drop", position);
    line.style.display = "block";
    line.style.left = (r.left + scrollX) + "px";
    line.style.width = r.width + "px";
    line.style.top = ((position === "before" ? r.top : r.bottom) + scrollY - 1) + "px";
  }, true);

  document.addEventListener("mouseup", () => {
    if (dragEl) {
      if (dropTarget) {
        post({ type: "moveNode", nodeId: dragFrom.nodeId, targetId: dropTarget.nodeId, position: dropTarget.position });
      }
      hideDropLine();
      dragEl = null;
    }
    dragFrom = null;
    // click 紧跟在 mouseup 后同步触发；这里放到下个任务再解，刚好吞掉它
    if (suppressClick) setTimeout(() => { suppressClick = false; }, 0);
  }, true);

  // —— 文本编辑（切片 4）——
  // 只有块级容器可编辑：行内元素上双击改字会拆碎句子。
  const EDITABLE = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote"]);
  let editing = null;

  const caretOffset = (el) => {
    const sel = getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const r = sel.getRangeAt(0).cloneRange();
    r.selectNodeContents(el);
    try {
      r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    } catch (err) {
      return 0;
    }
    return r.toString().length;
  };

  const flush = () => {
    if (!editing) return;
    post({ type: "textEditInput", nodeId: editing.getAttribute("data-cm-node-id"), text: editing.textContent || "" });
  };

  const endEdit = () => {
    if (!editing) return;
    flush();
    const nodeId = editing.getAttribute("data-cm-node-id");
    editing.removeAttribute("contenteditable");
    editing = null;
    post({ type: "textEditEnd", nodeId });
  };

  document.addEventListener("dblclick", (e) => {
    if (captureMode) return;
    // 向上找最近的可编辑块：双击落在行内元素（span/a/strong）上时，
    // closest("[data-cm-node-id]") 会停在这个行内元素，它不在 EDITABLE 里，
    // 于是编辑永远不开始。块级祖先（p/h1-h6/li/blockquote）才是编辑单元。
    let el = e.target;
    while (el && el.nodeType === 1 && el !== document.body) {
      if (EDITABLE.has(el.tagName.toLowerCase())) break;
      el = el.parentElement;
    }
    if (!el || el.nodeType !== 1 || el === document.body) return;
    if (!el.getAttribute("data-cm-node-id")) return;
    e.preventDefault();
    // contenteditable 聚焦会滚动 iframe；先记下滚动位，聚焦后恢复，
    // 否则双击任何位置都会把长文拉回顶部。
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    if (editing) endEdit();
    editing = el;
    el.setAttribute("contenteditable", "true");
    el.focus({ preventScroll: true });
    window.scrollTo(scrollX, scrollY);
    post({ type: "textEditBegin", nodeId: el.getAttribute("data-cm-node-id") });
  }, true);

  // 每个 input 直接上报，不做节流：编辑期文档是冻结的（不会因为 content 变化重建），
  // 所以逐键提交没有重建成本，却能消灭「最后 N 毫秒的击键在保存时还没落地」这类丢字。
  document.addEventListener("input", () => {
    if (!editing) return;
    flush();
  }, true);

  // ⌘S / Ctrl+S：焦点在 iframe 里时，主窗口的全局快捷键收不到这个按键，
  // 不转发的话"编辑中按保存没反应"，只能等自动保存。转发出去让主侧走同一条保存链路。
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      post({ type: "saveRequest" });
      return;
    }
    if (!editing) return;
    if (e.key === "Escape") { e.preventDefault(); endEdit(); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const nodeId = editing.getAttribute("data-cm-node-id");
    const offset = caretOffset(editing);
    const text = editing.textContent || "";
    endEdit();
    // 直接把切开的两半发出去：主侧的 content 与这里的文本可能差一次提交，
    // 用 offset 让主侧再切一次就是在赌两者同步（实测会偶发丢块）。
    post({ type: "splitBlock", nodeId, before: text.slice(0, offset), after: text.slice(offset) });
  }, true);

  document.addEventListener("focusout", () => {
    // 焦点离开编辑元素即收尾：别让 contenteditable 挂在那儿进快照
    setTimeout(() => { if (editing && !editing.contains(document.activeElement)) endEdit(); }, 0);
  }, true);

  // —— 区域截图（E-21）——
  // 框只能画在 iframe 内（主文档跨源描不到）；主侧拿到的只是坐标，
  // 真正的渲染走它自己的 SVG→canvas 管线。
  let capStart = null;
  let capBox = null;

  const ensureCapBox = () => {
    if (capBox && capBox.isConnected) return capBox;
    capBox = document.createElement("div");
    capBox.setAttribute("data-cm-internal", "capture");
    Object.assign(capBox.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "2147483647",
      border: "1px dashed rgba(59,130,246,0.9)",
      background: "rgba(59,130,246,0.12)",
      boxSizing: "border-box",
      display: "none",
    });
    document.body.appendChild(capBox);
    return capBox;
  };

  // 只收这几个键：它们拼进 SVG 的 style 属性，多一个都不认（design D5）
  const BODY_STYLE_KEYS = ["margin", "padding", "background-color", "background-image", "color", "font-family", "font-size", "line-height", "font-weight", "font-style"];

  document.addEventListener("mousedown", (e) => {
    if (!captureMode || e.button !== 0) return;
    e.preventDefault();
    capStart = { x: e.clientX, y: e.clientY };
    const b = ensureCapBox();
    b.style.display = "block";
    b.style.left = (capStart.x + scrollX) + "px";
    b.style.top = (capStart.y + scrollY) + "px";
    b.style.width = "0px";
    b.style.height = "0px";
  }, true);

  document.addEventListener("mousemove", (e) => {
    if (!captureMode || !capStart) return;
    e.preventDefault();
    const b = ensureCapBox();
    b.style.left = (Math.min(capStart.x, e.clientX) + scrollX) + "px";
    b.style.top = (Math.min(capStart.y, e.clientY) + scrollY) + "px";
    b.style.width = Math.abs(e.clientX - capStart.x) + "px";
    b.style.height = Math.abs(e.clientY - capStart.y) + "px";
  }, true);

  document.addEventListener("mouseup", (e) => {
    if (!captureMode || !capStart) return;
    const left = Math.min(capStart.x, e.clientX);
    const top = Math.min(capStart.y, e.clientY);
    const width = Math.abs(e.clientX - capStart.x);
    const height = Math.abs(e.clientY - capStart.y);
    capStart = null;
    ensureCapBox().style.display = "none";
    // 宽高不足 1px 视为误触，不上报（主侧也就不必白跑一遍栅格化）
    if (width < 1 || height < 1) return;
    const cs = getComputedStyle(document.body);
    const bodyStyle = {};
    for (const key of BODY_STYLE_KEYS) bodyStyle[key] = cs.getPropertyValue(key);
    post({
      type: "captureRegion",
      region: { x: left + scrollX, y: top + scrollY, width: width, height: height },
      viewportWidth: document.documentElement.clientWidth,
      bodyStyle: bodyStyle,
    });
  }, true);

  document.addEventListener("click", (e) => {
    // 拖拽结束后的那一次 click 不算点选；截图模式下完全不报选区
    if (suppressClick || captureMode) return;
    post({ type: "selection", nodeId: anchorOf(e.target) });
  }, true);
  addEventListener("scroll", place, true);
  addEventListener("resize", place);
  addEventListener("message", (e) => {
    if (e.source !== parent) return;
    const d = e.data;
    if (!d || d.v !== V) return;
    if (d.type === "captureMode") {
      captureMode = !!d.active;
      document.body.style.cursor = captureMode ? "crosshair" : "";
      if (!captureMode) {
        capStart = null;
        if (capBox) capBox.style.display = "none";
      }
      return;
    }
    if (d.type !== HL) return;
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
