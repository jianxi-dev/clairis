/* 未知结构标签行的判定（#255）。
 *
 * SKILL.md 这类文件用 `<objective>` / `<essential_principles>` / `<routing>` 等
 * 自定义标签分节。它们不是 HTML 标签，但整行只有标签时会被 marked 的
 * CommonMark type-7 HTML block 规则吞到下一个空行，紧随其后的 `## 标题` /
 * 表格源文本被整行吞进 HTML block，DOMPurify 剥掉标签后只剩字面文本。
 *
 * 预览渲染（`renderers/markdown.ts`）在解析前删掉这些行；语义编辑态
 * （`decorations/structuralTags.ts`）用同一判定隐藏这些行。两处必须共用
 * 同一份「可渲染标签」清单，否则编辑态隐藏的行与预览删除的行会不一致。
 *
 * 本模块刻意零依赖：渲染器与装饰层都只取这里的常量与判定，不把
 * marked / DOMPurify / CodeMirror 拖进对方的加载路径。
 */

/** marked 自定义 tokenizer 处理的块级 HTML 标签。 */
export const BLOCK_HTML_TAGS =
  "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";

/**
 * DOMPurify 放行的标签：markdown 基本集 + 富文本安全子集（支持 md 内嵌
 * HTML/CSS）。不放开 script / iframe / form / style 标签与事件属性。
 */
export const SANITIZE_ALLOWED_TAGS = [
  // markdown 基本集
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "pre",
  "code",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "video",
  "a",
  "em",
  "strong",
  "del",
  "hr",
  "br",
  "input",
  // 富文本子集（内嵌 HTML）
  "div",
  "span",
  "section",
  "article",
  "details",
  "summary",
  "figure",
  "figcaption",
  "dl",
  "dt",
  "dd",
  "kbd",
  "sup",
  "sub",
  "mark",
  "abbr",
  "small",
  "u",
  "s",
  "var",
  "samp",
  "cite",
  "q",
  "time",
  "picture",
  "source",
  // 代码块复制按钮
  "button",
];

/**
 * 可渲染标签集合：块级 HTML 标签 + DOMPurify 放行标签。
 *
 * `h[1-6]` 要展开成 h1…h6——否则 `<h2>` 独占一行会被误判成未知标签删掉。
 */
export const RENDERABLE_TAGS: ReadonlySet<string> = new Set(
  [
    ...BLOCK_HTML_TAGS.split("|").flatMap((tag) =>
      tag === "h[1-6]" ? ["h1", "h2", "h3", "h4", "h5", "h6"] : [tag],
    ),
    ...SANITIZE_ALLOWED_TAGS,
    // marked 按 CommonMark type-1 单独处理的标签，删除会破坏代码块语义
    "script",
    "pre",
    "style",
    "textarea",
  ].map((tag) => tag.toLowerCase()),
);

/** 整行只有一个标签：开 / 闭 / 自闭合均可，允许标签后跟属性与空白。 */
export const STRUCTURAL_TAG_LINE_RE =
  /^ {0,3}<\/?([A-Za-z][\w-]*)(?:\s[^<>]*)?\/?>[ \t]*$/;

/**
 * 该行是否是「未知结构标签独占行」——渲染前需要清理、语义编辑态需要隐藏。
 *
 * 行内标签（`正文 <u>下划线</u>`）不匹配：正则要求整行只有标签。
 */
export function isUnknownStructuralTagLine(line: string): boolean {
  const match = STRUCTURAL_TAG_LINE_RE.exec(line);
  if (!match) return false;
  return !RENDERABLE_TAGS.has(match[1].toLowerCase());
}
