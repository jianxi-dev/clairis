/**
 * HTML 可视化编辑的模型层（E-16 / H2，切片 1）。
 *
 * 三个纯函数，没有 UI、没有 iframe：
 *   parseHtml      HTML 文本 → 节点引用列表
 *   annotate       给元素与文本节点打锚点，便于 iframe 内上报「哪个节点」
 *   cleanSnapshot  剥掉所有编辑期痕迹，作为保存前的最后一道
 *
 * design D3：id 只在内存里稳定，不写回文件。同一份 content 每次解析出的 id 相同，
 * 所以重建模型后锚点仍能对上；这正是不需要 pnid 回写（design D5）的前提。
 */

/** 元素锚点属性。只在编辑期存在，保存前必须剥干净。 */
export const ANCHOR_ATTR = "data-cm-node-id";

/** 文本节点锚点注释前缀：`<!--cmid:p:3-->`。纯文本挂不了属性，只能靠注释。 */
export const ANCHOR_COMMENT_PREFIX = "cmid:";

/** 编辑期内部节点（注入的运行时 style/script、高亮框）统一带这个属性。 */
export const INTERNAL_ATTR = "data-cm-internal";

/**
 * raw-text 元素：内容是**字面文本**，不会被解析成节点。
 *
 * 往 `<style>` 里插 `<!--cmid:-->` 不会变成注释，只会变成 CSS 文本——清洗时
 * 删不掉，最后原样进用户文件。所以这些元素的内部一律不锚定。
 */
const RAW_TEXT_TAGS = new Set([
  "style",
  "script",
  "textarea",
  "title",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "plaintext",
]);

export interface HtmlNodeRef {
  /** `tag:index`，同一份 content 内可复现 */
  id: string;
  tag: string;
  kind: "element" | "text";
  /** 该标签在文档中的出现序号 */
  index: number;
}

function parse(content: string): Document {
  return new DOMParser().parseFromString(content, "text/html");
}

function serialize(doc: Document): string {
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

/** 列出可被点选的节点：元素按 `tag:index` 编号，文本节点按所属元素归类。 */
export function listNodes(content: string): HtmlNodeRef[] {
  const doc = parse(content);
  const seen = new Map<string, number>();
  const refs: HtmlNodeRef[] = [];

  const walk = (el: Element) => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as Element).tagName.toLowerCase();
        const index = seen.get(tag) ?? 0;
        seen.set(tag, index + 1);
        refs.push({ id: `${tag}:${index}`, tag, kind: "element", index });
        walk(child as Element);
      }
    }
  };
  walk(doc.documentElement);
  return refs;
}

/**
 * 打锚点：元素加 `data-cm-node-id`，文本节点前后插 `<!--cmid:...-->`。
 *
 * 文本也要锚定——可视化编辑里双击改字改的正是文本节点，只给元素打点的话
 * 桥上报「改了哪个文本」就只能靠序号猜测。
 */
export function annotate(content: string): string {
  const doc = parse(content);
  const seen = new Map<string, number>();
  const textSeen = new Map<string, number>();

  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    // raw-text 元素的子树不参与锚定（见 RAW_TEXT_TAGS 注释）
    if (RAW_TEXT_TAGS.has(tag)) return;
    if (!el.hasAttribute(ANCHOR_ATTR)) {
      const index = seen.get(tag) ?? 0;
      seen.set(tag, index + 1);
      el.setAttribute(ANCHOR_ATTR, `${tag}:${index}`);
    }

    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child as Element);
        continue;
      }
      if (child.nodeType !== Node.TEXT_NODE) continue;
      // 纯空白（缩进）不锚定：否则每次格式化都会凭空多出一堆锚点
      if (!(child.nodeValue ?? "").trim()) continue;

      const owner = el.tagName.toLowerCase();
      const n = textSeen.get(owner) ?? 0;
      textSeen.set(owner, n + 1);
      const id = `t:${owner}:${n}`;
      child.parentNode?.insertBefore(
        doc.createComment(`${ANCHOR_COMMENT_PREFIX}${id}`),
        child,
      );
      child.parentNode?.insertBefore(
        doc.createComment(`${ANCHOR_COMMENT_PREFIX}${id}/`),
        child.nextSibling,
      );
    }
  };

  walk(doc.documentElement);
  return serialize(doc);
}

/**
 * 保存前清洗：编辑期的一切痕迹都不许进文件。
 *
 * 这是整个特性最容易出脏数据的口子（design D6），所以写成纯函数、单独兜测试。
 */
export function cleanSnapshot(html: string): string {
  const doc = parse(html);

  const strip = (el: Element) => {
    if (el.hasAttribute(INTERNAL_ATTR)) {
      el.remove();
      return;
    }
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("data-cm-")) el.removeAttribute(attr.name);
    }
    // 双击进编辑时临时加的；漏掉就会把整个文档变成可编辑区域
    el.removeAttribute("contenteditable");
    el.removeAttribute("spellcheck");

    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        strip(child as Element);
        continue;
      }
      if (child.nodeType !== Node.COMMENT_NODE) continue;
      if ((child.nodeValue ?? "").trim().startsWith(ANCHOR_COMMENT_PREFIX)) {
        child.parentNode?.removeChild(child);
      }
    }
  };

  strip(doc.documentElement);
  return serialize(doc);
}

/** 幂等性检查用：清洗两次结果应与一次相同。 */
export function isClean(html: string): boolean {
  return cleanSnapshot(html) === cleanSnapshot(cleanSnapshot(html));
}
