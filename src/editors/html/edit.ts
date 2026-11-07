/**
 * 文本编辑的落盘形态变换（E-16 切片 4 / design D2）。
 *
 * 主侧 `content` 是唯一真相：iframe 只上报「哪个节点、改成了什么」，
 * 由这里把改动折算回 HTML 文本。iframe 的 DOM 永远不反向覆盖 `content`。
 */

import { ANCHOR_ATTR, annotate, cleanSnapshot } from "./model";

function rewrite(
  content: string,
  nodeId: string,
  mutate: (el: Element) => boolean,
): string {
  const doc = new DOMParser().parseFromString(annotate(content), "text/html");
  const el = anchorEl(doc, nodeId);
  if (!el || !mutate(el)) return content;
  return cleanSnapshot(`<!DOCTYPE html>\n${doc.documentElement.outerHTML}`);
}

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

/**
 * 工具条可换的标签白名单（design D4）。
 *
 * 不给自由输入：`<table>`/`<td>` 这类元素的父子约束一旦被换坏，浏览器会把
 * 结构整个重排，「换标签」就变成「悄悄删内容」。
 */
export const TAG_WHITELIST = [
  "p",
  "h1",
  "h2",
  "h3",
  "div",
  "section",
  "blockquote",
  "li",
  "span",
] as const;

const TAG_SET = new Set<string>(TAG_WHITELIST);

/**
 * 标签替换：保留属性与子树，只换成另一个标签名。
 *
 * 返回新的 `nodeId`：锚点 id 是 `tag:index`，换了标签 id 就变了。
 * 不返回的话，上层还攥着旧 id，工具条下一帧就找不到节点——表现为
 * 「换完标签工具条自己消失」。
 */
export interface TagReplaceResult {
  content: string;
  nodeId: string;
}

export function applyTagReplace(
  content: string,
  nodeId: string,
  tag: string,
): TagReplaceResult {
  const next = tag.trim().toLowerCase();
  if (!TAG_SET.has(next)) return { content, nodeId };

  let nextId = nodeId;
  const updated = rewrite(content, nodeId, (el) => {
    if (el.tagName.toLowerCase() === next) return false;
    const doc = el.ownerDocument;
    const replacement = doc.createElement(next);
    for (const attr of Array.from(el.attributes)) {
      // 锚点由 cleanSnapshot 统一剥；不带走可以少一次遍历
      if (attr.name.startsWith("data-cm-")) continue;
      replacement.setAttribute(attr.name, attr.value);
    }
    while (el.firstChild) replacement.appendChild(el.firstChild);
    el.parentNode?.replaceChild(replacement, el);
    // 新元素在新文档里的序号 = 同标签元素里它前面有几个
    const same = doc.querySelectorAll(next);
    const index = Array.prototype.indexOf.call(same, replacement);
    nextId = `${next}:${index < 0 ? 0 : index}`;
    return true;
  });

  return { content: updated, nodeId: nextId };
}

/**
 * 样式合并：写进元素的 inline `style`，已有项保留。
 *
 * `null` 与空串都表示「删掉这一项」（design D5）——否则清空字号会留下
 * `style="font-size: "` 这种半截声明。
 */
export function applyStylePatch(
  content: string,
  nodeId: string,
  styles: Record<string, string | null>,
): string {
  return rewrite(content, nodeId, (el) => {
    const style = (el as HTMLElement).style;
    let changed = false;
    for (const [prop, value] of Object.entries(styles)) {
      const current = style.getPropertyValue(prop);
      if (value === null || value === "") {
        if (!current) continue;
        style.removeProperty(prop);
        changed = true;
        continue;
      }
      if (current === value) continue;
      style.setProperty(prop, value);
      changed = true;
    }
    if (!changed) return false;
    // 全清空后 style 属性不能留个空壳
    if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
    return true;
  });
}

/** 合法属性名：挡住 `setAttribute` 会抛 InvalidCharacterError 的输入。 */
const ATTR_NAME = /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/;

/** 属性写入：`null` 与空串表示删除该属性（design D5）。 */
export function applyAttrPatch(
  content: string,
  nodeId: string,
  attrs: Record<string, string | null>,
): string {
  return rewrite(content, nodeId, (el) => {
    let changed = false;
    for (const [name, value] of Object.entries(attrs)) {
      if (!ATTR_NAME.test(name)) continue;
      // 编辑期内部标记不接受外部写入，否则会在保存前被 cleanSnapshot 删掉，白改
      if (name.startsWith("data-cm-") || name === "contenteditable") continue;
      if (value === null || value === "") {
        if (!el.hasAttribute(name)) continue;
        el.removeAttribute(name);
        changed = true;
        continue;
      }
      if (el.getAttribute(name) === value) continue;
      el.setAttribute(name, value);
      changed = true;
    }
    return changed;
  });
}

export interface NodeInfo {
  tag: string;
  attrs: Record<string, string>;
  style: Record<string, string>;
}

/**
 * 读某个节点当前的标签、属性与内联样式，供工具条显示**真值**。
 *
 * 不靠 iframe 上报属性：content 才是唯一真相（design D3），工具条显示它，
 * 就和用户在源码模式看到的一致；iframe 只负责告诉主侧"选中了哪个节点"。
 */
export function describeNode(content: string, nodeId: string): NodeInfo | null {
  const doc = new DOMParser().parseFromString(annotate(content), "text/html");
  const el = anchorEl(doc, nodeId);
  if (!el) return null;

  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("data-cm-")) continue;
    attrs[attr.name] = attr.value;
  }

  const style: Record<string, string> = {};
  const decl = (el as HTMLElement).style;
  for (let i = 0; i < decl.length; i += 1) {
    const prop = decl.item(i);
    if (!prop) continue;
    style[prop] = decl.getPropertyValue(prop);
  }

  return { tag: el.tagName.toLowerCase(), attrs, style };
}

export type MovePosition = "before" | "after";

/**
 * 拖拽移动（E-20）：把节点挪到目标节点之前/之后。
 *
 * 目标是自己或自己的子孙时必须拒绝——`insertBefore` 把父节点塞进自己的子树，
 * 浏览器会让整棵子树从文档里消失，这是"拖一下没了半页"的经典事故。
 */
export function applyNodeMove(
  content: string,
  nodeId: string,
  targetId: string,
  position: MovePosition,
): string {
  return rewrite(content, nodeId, (el) => {
    const doc = el.ownerDocument;
    const target = anchorEl(doc, targetId);
    if (!target) return false;
    if (target === el || el.contains(target)) return false;
    const anchor = position === "before" ? target : target.nextSibling;
    target.parentNode?.insertBefore(el, anchor);
    return true;
  });
}
