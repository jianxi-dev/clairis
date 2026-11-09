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
  // 阈值 4px：低于它算点击。越过阈值后显示跟随幽灵与稳定落点指示。
  const DRAG_THRESHOLD = 4;
  const DROP_HYSTERESIS = 6;
  let dragFrom = null;
  let dragEl = null;
  let ghost = null;
  let dropTarget = null;
  let dropLine = null;
  let dropKey = "";
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
    dropKey = "";
  };

  const restoreDragEl = () => {
    if (!dragEl || !dragEl.dataset) return;
    dragEl.style.opacity = dragEl.dataset.cmDragOpacity || "";
    delete dragEl.dataset.cmDragOpacity;
  };

  const clearDragVisual = () => {
    if (ghost) { ghost.remove(); ghost = null; }
    restoreDragEl();
    hideDropLine();
  };

  const makeGhost = () => {
    const rect = dragEl.getBoundingClientRect();
    dragFrom.rect = { left: rect.left, top: rect.top };
    const clone = dragEl.cloneNode(true);
    clone.setAttribute("data-cm-internal", "drag-ghost");
    clone.removeAttribute("data-cm-node-id");
    clone.querySelectorAll("[data-cm-node-id]").forEach((n) => n.removeAttribute("data-cm-node-id"));
    clone.querySelectorAll("[data-cm-internal]").forEach((n) => n.removeAttribute("data-cm-internal"));
    Object.assign(clone.style, {
      position: "fixed",
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      margin: "0",
      boxSizing: "border-box",
      opacity: "0.9",
      pointerEvents: "none",
      zIndex: "2147483645",
      transform: "none",
      transition: "none",
      boxShadow: "0 8px 24px rgba(0,0,0,.18)",
      background: "rgba(255,255,255,.7)",
    });
    document.body.appendChild(clone);
    ghost = clone;
    dragEl.dataset.cmDragOpacity = dragEl.style.opacity || "";
    dragEl.style.opacity = "0.4";
  };

  document.addEventListener("mousedown", (e) => {
    if (captureMode || editing || e.button !== 0) return;
    const el = e.target && e.target.closest ? e.target.closest("[data-cm-node-id]") : null;
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    if (tag === "html" || tag === "body") return;
    dragFrom = { el: el, nodeId: el.getAttribute("data-cm-node-id"), x: e.clientX, y: e.clientY, rect: null };
  }, true);

  document.addEventListener("mousemove", (e) => {
    if (captureMode || !dragFrom) return;
    if (!dragEl) {
      if (Math.abs(e.clientX - dragFrom.x) < DRAG_THRESHOLD && Math.abs(e.clientY - dragFrom.y) < DRAG_THRESHOLD) return;
      dragEl = dragFrom.el;
      suppressClick = true;
      makeGhost();
    }
    e.preventDefault();
    const dx = e.clientX - dragFrom.x;
    const dy = e.clientY - dragFrom.y;
    if (ghost && dragFrom.rect) {
      ghost.style.left = (dragFrom.rect.left + dx) + "px";
      ghost.style.top = (dragFrom.rect.top + dy) + "px";
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const cand = under && under.closest ? under.closest("[data-cm-node-id]") : null;
    // 拖到自己或自己的子孙上：浏览器会让整棵子树消失，直接不给落点（design D3）
    if (!cand || cand === dragEl || dragEl.contains(cand)) { hideDropLine(); return; }
    const r = cand.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    const nodeId = cand.getAttribute("data-cm-node-id");
    let position;
    if (dropTarget && dropTarget.nodeId === nodeId) {
      // 滞回：只有越过中线 ±6px 才换边，避免在临界点来回跳
      if (dropTarget.position === "before") {
        position = e.clientY <= mid + DROP_HYSTERESIS ? "before" : "after";
      } else {
        position = e.clientY >= mid - DROP_HYSTERESIS ? "after" : "before";
      }
    } else {
      position = e.clientY < mid ? "before" : "after";
    }
    const key = nodeId + ":" + position;
    if (key !== dropKey) {
      dropKey = key;
      dropTarget = { nodeId: nodeId, position: position };
      const line = ensureDropLine();
      line.setAttribute("data-cm-drop", position);
      line.style.display = "block";
      line.style.left = (r.left + scrollX) + "px";
      line.style.width = r.width + "px";
      line.style.top = ((position === "before" ? r.top : r.bottom) + scrollY - 1) + "px";
    }
  }, true);

  document.addEventListener("mouseup", () => {
    if (dragEl) {
      if (dropTarget) {
        post({ type: "moveNode", nodeId: dragFrom.nodeId, targetId: dropTarget.nodeId, position: dropTarget.position });
      }
      clearDragVisual();
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
    // 双击的默认语义是选词：把选区折叠到点击点，只保留光标。
    const sel = getSelection();
    if (sel) {
      const doc = el.ownerDocument;
      const point =
        typeof doc.caretRangeFromPoint === "function"
          ? doc.caretRangeFromPoint(e.clientX, e.clientY)
          : null;
      sel.removeAllRanges();
      if (point) {
        point.collapse(true);
        sel.addRange(point);
      }
    }
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
    // 文档级撤销/重做（#321）：iframe 里没有可用的撤销栈（每次按键都已提交回
    // 主侧，原生 contenteditable 的撤销在文档重建时丢失），转发给主侧按快照恢复。
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        post({ type: e.shiftKey ? "redoRequest" : "undoRequest" });
        return;
      }
      if (key === "y") {
        e.preventDefault();
        post({ type: "redoRequest" });
        return;
      }
    }
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

  // —— 文字选区（HTML 文字工具条）——
  // 主侧拿不到 iframe 的 Selection（跨源），所以选区矩形与文本由这里算好上报；
  // 格式化命令再回传进来，用 Range/execCommand 作用在同一个选区上。
  let savedRange = null;
  let lastTextReport = "none";

  const blockOf = (node) => {
    let el = node && node.nodeType === 1 ? node : node && node.parentElement;
    while (el && el !== document.body) {
      if (
        el.getAttribute &&
        el.getAttribute("data-cm-node-id") &&
        /^(P|H[1-6]|LI|BLOCKQUOTE|TD|TH|DIV)$/.test(el.tagName)
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  };

  const reportTextSelection = () => {
    if (editing) return;
    const sel = getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      if (lastTextReport !== "none") {
        lastTextReport = "none";
        savedRange = null;
        post({ type: "textSelection", rect: null, text: "" });
      }
      return;
    }
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (!text) return;
    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (!r || (r.width === 0 && r.height === 0)) continue;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    if (!Number.isFinite(left)) return;
    savedRange = range.cloneRange();
    const sig = [Math.round(left), Math.round(top), Math.round(right), Math.round(bottom), text.length].join("|");
    if (sig === lastTextReport) return;
    lastTextReport = sig;
    const block = blockOf(range.startContainer);
    post({
      type: "textSelection",
      rect: { x: left, y: top, width: right - left, height: bottom - top },
      text: text.slice(0, 80),
      nodeId: block ? block.getAttribute("data-cm-node-id") : null,
    });
  };

  const wrapSaved = (style) => {
    if (!savedRange) return false;
    const range = savedRange.cloneRange();
    const span = document.createElement("span");
    span.setAttribute("style", style);
    try {
      range.surroundContents(span);
    } catch (err) {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    const next = document.createRange();
    next.selectNodeContents(span);
    savedRange = next;
    const sel = getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(next);
    }
    return true;
  };

  const unwrapStyle = (prop, block) => {
    if (!savedRange) return false;
    let el = savedRange.startContainer;
    el = el.nodeType === 1 ? el : el.parentElement;
    while (el && el !== block) {
      if (el.tagName === "SPAN" && el.style && el.style[prop]) {
        el.style[prop] = "";
        if (!el.getAttribute("style")) {
          const parent = el.parentNode;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        return true;
      }
      el = el.parentElement;
    }
    return false;
  };

  const applyRangeCommand = (command, value) => {
    if (!savedRange) return;
    const block = blockOf(savedRange.startContainer);
    const toggle = (prop, css) => {
      if (!unwrapStyle(prop, block)) wrapSaved(css);
    };
    switch (command) {
      case "bold":
        toggle("fontWeight", "font-weight:bold");
        break;
      case "italic":
        toggle("fontStyle", "font-style:italic");
        break;
      case "underline":
        wrapSaved("text-decoration:underline");
        break;
      case "strikeThrough":
        wrapSaved("text-decoration:line-through");
        break;
      case "code":
        wrapSaved("font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(127,127,127,0.16);border-radius:3px;padding:0 2px");
        break;
      case "fontSize":
        if (value) wrapSaved("font-size:" + value);
        break;
      case "foreColor":
        if (value) wrapSaved("color:" + value);
        break;
      case "bgColor":
        if (value) wrapSaved("background-color:" + value);
        break;
      case "fontDefault":
        wrapSaved("color:inherit");
        break;
      case "bgDefault":
        wrapSaved("background-color:transparent");
        break;
      case "justifyLeft":
      case "justifyCenter":
      case "justifyRight":
      case "justifyFull":
        if (block) {
          block.style.textAlign = command.replace("justify", "").toLowerCase();
        }
        break;
      case "removeFormat": {
        if (!block) return;
        const range = savedRange.cloneRange();
        for (const span of Array.from(block.querySelectorAll("span[style]"))) {
          if (range.intersectsNode(span)) {
            const parent = span.parentNode;
            while (span.firstChild) parent.insertBefore(span.firstChild, span);
            parent.removeChild(span);
          }
        }
        block.removeAttribute("style");
        break;
      }
      default:
        return;
    }
    if (block) {
      post({
        type: "rangeHtml",
        nodeId: block.getAttribute("data-cm-node-id"),
        html: block.innerHTML,
      });
    }
    lastTextReport = "";
    reportTextSelection();
  };

  document.addEventListener("selectionchange", () => {
    if (editing) return;
    requestAnimationFrame(reportTextSelection);
  });

  document.addEventListener("click", (e) => {
    // 拖拽结束后的那一次 click 不算点选；截图模式下完全不报选区
    if (suppressClick || captureMode) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) {
      reportTextSelection();
      return;
    }
    reportTextSelection();
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
    if (d.type === "rangeCommand") {
      applyRangeCommand(d.command, d.value);
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

/** 取出文档自己声明的 CSS 文本（`<style>` 内容 + 元素上的 style 属性）。 */
function authorCss(content: string): string {
  const blocks: string[] = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = styleRe.exec(content))) blocks.push(m[1]);
  const inlineRe = /\sstyle="([^"]*)"/gi;
  while ((m = inlineRe.exec(content))) blocks.push(m[1]);
  return blocks.join("\n");
}

function parseColor(raw: string): [number, number, number] | null {
  const v = raw.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h =
      hex[1].length === 3
        ? hex[1]
            .split("")
            .map((c) => c + c)
            .join("")
        : hex[1];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * 深底兜底文字色（#327）。
 *
 * 有些文档把底色写在自带 CSS 里，文字色却交给外部样式表（典型：Tailwind CDN 的
 * `text-[#e4e4e7]`）。编辑态按设计不执行文档脚本，那份样式表不会生效，文字就退回
 * 浏览器默认的纯黑 —— 黑字落在 `#0a0a0f` 这类近黑底上，正文 3522 字全看不见，
 * 面板看起来是「空白」。
 *
 * 只在「文档自己没声明任何 color + 自己的底色是深色」时补一条兜底色；作者写了
 * color 就完全不动，避免覆盖正常文档。
 */
function readableFallback(css: string): string {
  if (/(^|[;{\s])color\s*:/i.test(css)) return "";
  const bgRe = /(?:^|[;{\s])background(?:-color)?\s*:\s*([^;}]+)/gi;
  let dark: boolean | null = null;
  let m: RegExpExecArray | null;
  while ((m = bgRe.exec(css))) {
    const value = m[1];
    const hex = /#[0-9a-f]{3,6}\b/i.exec(value);
    const rgb = /rgba?\([^)]*\)/i.exec(value);
    const parsed = hex ? parseColor(hex[0]) : rgb ? parseColor(rgb[0]) : null;
    if (!parsed) continue;
    dark = luminance(parsed) < 0.2;
  }
  if (dark !== true) return "";
  return "body { color: #e8e8ea; }";
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
    // 外链脚本必须放行（#327）：像 Tailwind CDN 这类样式表是脚本在运行时生成的，
    // 拦掉它页面不仅没样式，还会因为 absolute/flex 定位类失效把正文顶到几屏之外。
    // 内联脚本仍然只认 nonce —— 用户文档里的 <script>…</script> 照旧不执行。
    `script-src 'nonce-${n}' https:`,
    "img-src 'self' data: asset: https:",
    "style-src 'self' 'unsafe-inline' asset: https:",
    "font-src 'self' asset: data: https:",
    "media-src 'self' asset:",
    "frame-src 'self' asset:",
  ].join("; ");

  const fallback = readableFallback(authorCss(content));

  const head = [
    `<meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<style ${INTERNAL_ATTR}="runtime">html { font-size: ${fontSize}px; }</style>`,
    fallback ? `<style ${INTERNAL_ATTR}="runtime">${fallback}</style>` : "",
    `<script nonce="${n}" ${INTERNAL_ATTR}="runtime">${runtimeSource(RUNTIME_VERSION)}</script>`,
  ].join("");

  // 注入到 <head> 内；文档没有 head 时（浏览器解析会自动补一个）退回顶层拼接
  if (/<head[^>]*>/i.test(annotated)) {
    return annotated.replace(/<head[^>]*>/i, (m) => `${m}${head}`);
  }
  return annotated.replace(/<html[^>]*>/i, (m) => `${m}<head>${head}</head>`);
}
