/* 块颜色（reading-surface-refine 4.1 / design D6「块菜单可选颜色」）。
 *
 * 纯函数：把块内容用 `<span class="mdb-color-*">` / `<span class="mdb-bg-*">`
 * 包裹，写回源码。格式沿用 md-bundle 既有约定（boldItalic.ts 的 mdb-color-* 透传
 * span 与表格单元格 mdb-bg-* 都是这一套），渲染侧早已认识它。
 *
 * 包裹只包「标记之后的内容」：标题 `# 标题` → `# <span>标题</span>`，列表
 * `- 项` → `- <span>项</span>`。把整块（含标记）塞进 span 会让 marked 把这一行
 * 当成 HTML 块，`#` / `-` / `>` 全部失效（实测：`<span># 标题</span>` 渲染成
 * 段落而不是标题）。代码块 / 表格 / 分割线等结构块不包裹——span 会切断它们的
 * 语法（表格管道、代码围栏）。
 */

/** 色板族前缀 → 源码 span 类名前缀。 */
export type ColorFamily = "mdb-color" | "mdb-bg";

/** 结构块：包裹会破坏语法，一律不动。 */
const NON_COLORABLE = new Set([
  "fencedCode",
  "codeBlock",
  "table",
  "thematicBreak",
  "image",
  "htmlBlock",
  "yamlFrontMatter",
]);

/**
 * 行首块标记：标题 / 无序 / 有序 / 待办 / 引用。只剥一层。
 * 与 block-convert.ts 的 MARKER_RE 保持一致，缩进原样保留（嵌套列表）。
 */
const MARKER_RE =
  /^(#{1,6}[ \t]+|\s*(?:[-*+]|\d+\.)(?:[ \t]+\[[ xX]\])?[ \t]+|>[ \t]?)/;

/** 纯标记行（`#` / `-` / `>` 后面没有内容）：包裹没有意义，原样返回。 */
const MARKER_ONLY_RE =
  /^(?:#{1,6}[ \t]*|(?:[-*+]|\d+\.)(?:[ \t]+\[[ xX]\])?[ \t]*|>)$/;

/** 包裹单行：标记留在 span 外，内容进 span；空行 / 纯标记行不包。 */
export function wrapColorLine(line: string, className: string): string {
  if (line.trim() === "" || MARKER_ONLY_RE.test(line)) return line;
  const open = `<span class="${className}">`;
  const close = "</span>";
  const match = MARKER_RE.exec(line);
  if (match) {
    return `${match[1]}${open}${line.slice(match[1].length)}${close}`;
  }
  return `${open}${line}${close}`;
}

/**
 * 剥掉某一族（mdb-color / mdb-bg）在块内所有行上的包裹 span。
 *
 * 逐行反复拆「最内层、内容不含标签」的目标族 span 对；拆开后外层的内层变纯
 * 文本，下一轮继续拆。其它族的嵌套 span 原样保留（正则的 `[^<]*` 不会跨越
 * 标签，拆外层不会误删内层）。标记留在原处。
 */
function stripFamily(blockText: string, family: ColorFamily): string {
  const pairRe = new RegExp(
    `<span class="${family}-[\\w-]+">([^<]*)</span>`,
    "g",
  );
  return blockText
    .split("\n")
    .map((line) => {
      let prev = line;
      for (;;) {
        const next = prev.replace(pairRe, "$1");
        if (next === prev) return prev;
        prev = next;
      }
    })
    .join("\n");
}

/** 读取块上已有颜色的类名；没有对应包裹返回 null。 */
export function blockColorOf(
  blockText: string,
  family: ColorFamily,
): string | null {
  const first = blockText.split("\n")[0] ?? "";
  const match = new RegExp(`<span class="(${family}-[\\w-]+)">`).exec(first);
  return match ? match[1] : null;
}

/**
 * 给块上颜色 / 换色 / 清除。
 *
 * - `className` 为空串：剥掉该族包裹（清除）。
 * - 块已是同族同色：返回 null（幂等，调用方不产生事务）。
 * - 块已是同族异色：换掉类名，包裹结构不变。
 * - 结构块（代码 / 表格 / 分割线等）：返回 null，不包裹。
 *
 * 返回新块文本；无变化返回 null。
 */
export function applyBlockColor(
  blockText: string,
  blockType: string,
  family: ColorFamily,
  className: string,
): string | null {
  if (blockText === "") return null;
  if (NON_COLORABLE.has(blockType)) return null;

  const current = blockColorOf(blockText, family);

  // 清除：剥掉该族所有包裹。
  if (className === "") {
    if (current === null) return null;
    return stripFamily(blockText, family);
  }

  // 同族同色：幂等，不产生事务。
  if (current === className) return null;

  // 同族异色：逐行换掉开口标签的类名，闭合标签不动。
  if (current !== null) {
    const next = blockText
      .split("\n")
      .map((line) =>
        line.replace(
          new RegExp(`<span class="${current}">`),
          `<span class="${className}">`,
        ),
      )
      .join("\n");
    return next === blockText ? null : next;
  }

  // 新包裹：逐行包上。
  const next = blockText
    .split("\n")
    .map((line) => wrapColorLine(line, className))
    .join("\n");
  return next === blockText ? null : next;
}
