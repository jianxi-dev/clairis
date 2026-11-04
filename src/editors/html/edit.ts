/**
 * 文本编辑的落盘形态变换（E-16 切片 4 / design D2）。
 *
 * 主侧 `content` 是唯一真相：iframe 只上报「哪个节点、改成了什么」，
 * 由这里把改动折算回 HTML 文本。iframe 的 DOM 永远不反向覆盖 `content`。
 */

import { ANCHOR_ATTR, annotate, cleanSnapshot } from "./model";

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function anchorEl(doc: Document, nodeId: string): Element | null {
  for (const el of Array.from(doc.querySelectorAll(`[${ANCHOR_ATTR}]`))) {
    if (el.getAttribute(ANCHOR_ATTR) === nodeId) return el;
  }
  return null;
}

/**
 * 把某个可编辑节点的文本改成 `text`。
 *
 * 先 `annotate`（拿到与 iframe 一致的节点编号）再改文本、最后 `cleanSnapshot`
 * 把锚点洗掉——这样文本从「用户原文」进、「用户原文」出，不会把编辑期的
 * 属性或预览用的 asset:// 重写带进文件。
 */
export function applyTextEdit(
  content: string,
  nodeId: string,
  text: string,
): string {
  const doc = new DOMParser().parseFromString(annotate(content), "text/html");
  const el = anchorEl(doc, nodeId);
  if (!el) return content;
  el.innerHTML = escapeText(text);
  return cleanSnapshot(`<!DOCTYPE html>\n${doc.documentElement.outerHTML}`);
}

/**
 * Enter 拆块：把节点按 iframe 给出的两半（before / after）重写，后半段放进
 * 一个同标签的兄弟节点。改叫 before/after 是因为原先传 offset、由主侧再切一次，
 * 会赌「主侧 content 与 iframe 当时的文本同步」——实测会偶发丢块。
 *
 * 只在块级容器（p/h1-h6/li/blockquote）上做；行内元素里按 Enter 保持原样，
 * 否则会把一句话拆成两个 `span`，语义上说不通。
 */
const SPLITTABLE = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "blockquote",
]);

export function applyBlockSplit(
  content: string,
  nodeId: string,
  before: string,
  after: string,
): string {
  if (!before || !after) return content;
  const doc = new DOMParser().parseFromString(annotate(content), "text/html");
  const el = anchorEl(doc, nodeId);
  if (!el) return content;
  if (!SPLITTABLE.has(el.tagName.toLowerCase())) return content;

  const tail = doc.createElement(el.tagName.toLowerCase());
  tail.innerHTML = escapeText(after);
  el.innerHTML = escapeText(before);
  el.parentNode?.insertBefore(tail, el.nextSibling);
  return cleanSnapshot(`<!DOCTYPE html>\n${doc.documentElement.outerHTML}`);
}
