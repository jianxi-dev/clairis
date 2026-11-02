/* GFM 管道表格单元格的文本工具（移植自 md-bundle
 * packages/editor/src/decorations/cell-text.ts，全量）。
 *
 * `sanitizeCellText` 压平文本，使其可安全放进单元格；`renderCellText`
 * 把单元格显示时用到的行内 markdown 子集渲染成 HTML，而原始 markdown
 * 始终是真相源。
 *
 * 为什么本文件自带 URL 策略而不调用 `renderMarkdown`
 * --------------------------------------------------------------------------
 * 单元格需要**仅行内**渲染：块级 `renderMarkdown` 会把输出包进 `<p>` /
 * 块级元素，破坏表格布局。下面的 scheme 白名单因此**镜像**渲染器 SSOT
 * （`packages/renderer/src/markdown.ts` 的 `DANGEROUS_URL_RE`），让两条路径
 * 对「哪些 URL 可以执行」达成一致。
 *
 * 依赖叶子：表格 widget（staging/render）与锚定插入菜单（commands）复用它，
 * 互不 import。
 */

/**
 * 压平文本，使其可安全放进 GFM 管道表格的单元格。
 *
 * 换行会开启新块、裸 `|` 会多出一列，两者都会让下次解析静默破坏表格结构，
 * 所以一律替换为空格：丢一个字符好过毁掉文档。
 */
export function sanitizeCellText(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(/\|/g, " ");
}

/**
 * 单元格背景约定（#328）。
 *
 * 单元格背景以「整个单元格文本被同一个原始 HTML span 包裹」的形式存在 markdown
 * 源码里，与文字色系统用的是同一族 span：
 *
 *   | <span class="mdb-bg-blue">hello</span> | ...
 *
 * 这样 markdown 仍是合法的 GFM 管道表格（不发明任何列/行语法），并复用已有的
 * `mdb-bg-*` 类，所以背景能跨重载存活、在预览里渲染。表格 widget 识别这个精确
 * 形状，把 `<td>`/`<th>` 本身上色，而不是把 span 标记显示出来。
 */
const BACKGROUND_SPAN_RE =
  /^<span class="(mdb-bg-(?:red|orange|yellow|green|cyan|blue|purple|gray|darkred|brown|olive|darkgreen|navy|indigo|slate))">([\s\S]*)<\/span>$/;

export interface ParsedCellBackground {
  /** `mdb-bg-*` span 类名。 */
  colorClass: string;
  /** 去掉 span 包裹后的可见文本。 */
  inner: string;
}

/** 解析「整个文本就是一个背景 span」的单元格；否则返回 null。 */
export function parseCellBackground(text: string): ParsedCellBackground | null {
  const match = BACKGROUND_SPAN_RE.exec(text);
  if (!match) return null;
  return { colorClass: match[1], inner: match[2] };
}

/** 剥掉背景 span 包裹，返回裸单元格文本。 */
export function stripCellBackground(text: string): string {
  return parseCellBackground(text)?.inner ?? text;
}

// ── URL scheme 白名单（镜像渲染器 SSOT）────────────────────────────────────
// 渲染器 `DANGEROUS_URL_RE` 会剥掉 `javascript:` / `vbscript:`；这里是编辑端
// 更严的镜像：**只有**下列 scheme（或没有 scheme）能到达 `href`。
const SAFE_SCHEMES = new Set(["http", "https", "mailto"]);
const URL_SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;

/**
 * 在 scheme 检查前丢掉所有空格与 C0 控制字符（码点 ≤ 0x20）。
 *
 * 浏览器解析 URL 前会剥掉这些字符，所以检查必须看到同一个字符串——否则
 * `java\nscript:` 会被当成无 scheme 的「相对」URL 而仍然执行。用码点而不是
 * 正则，源码里就不含控制字符。
 */
function stripControlsForSchemeCheck(url: string): string {
  let normalized = "";
  for (const char of url) {
    if (char.charCodeAt(0) > 0x20) normalized += char;
  }
  return normalized;
}

/** `url` 能否成为 `href`（白名单，绝不是黑名单）。 */
function isSafeHref(url: string): boolean {
  const scheme = URL_SCHEME_RE.exec(stripControlsForSchemeCheck(url))?.[1];
  if (!scheme) return true; // 无 scheme → 相对路径或片段
  return SAFE_SCHEMES.has(scheme.toLowerCase());
}

/**
 * 穿过行内转换仍然存活的哨兵，把链接目标槽出来。用私用区码点，不会与普通
 * 单元格文本冲突，也不会被强调/代码转换改写。第 4 步总会解析每个槽位。
 */
const URL_SLOT = "\uE000";

/**
 * 把单元格文本里的行内 markdown 渲染成 HTML。
 *
 * 表格 widget 用它显示格式化文本，同时保持原始 markdown 为真相源。处理
 * **bold**、*italic*、`code`、~~strike~~、[link](url)。源文本里的 HTML 先被
 * 转义，所以输出里只有本函数生成的标签。
 */
export function renderCellText(text: string): string {
  const background = parseCellBackground(text);
  const inner = background ? background.inner : text;

  // 第 1 步：先转义 HTML 实体——这是安全边界。
  // 只有下面显式生成的标签才会是输出里真实的 HTML。
  const escaped = inner
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // 第 2 步：在任何行内转换之前把链接目标槽出来。强调（`_…_`、`*…*`）不能
  // 改写 URL：`[x](https://a_b_c.com)` 保留字面下划线，路径里的 `*` 不会变成
  // `<em>`。
  const targets: string[] = [];
  const stashed = escaped.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, url: string) => {
      targets.push(url);
      return `[${label}](${URL_SLOT}${targets.length - 1}${URL_SLOT})`;
    },
  );

  // 第 3 步：对转义后、无 URL 的文本做 markdown 转换。替换串里的 HTML 标签
  // 是我们有意输出的。
  const rendered = stashed
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .replace(/_([^_]+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>");

  // 第 4 步：重新输出锚点，每个目标都过一遍 scheme 白名单。不安全的 scheme
  // （javascript:、vbscript:、data:、file: …）永远到不了 `href`：锚点被丢弃，
  // 标签文字保留。
  return rendered.replace(
    new RegExp(`\\[([^\\]]+)\\]\\(${URL_SLOT}(\\d+)${URL_SLOT}\\)`, "g"),
    (_match, label: string, index: string) => {
      const url = targets[Number(index)] ?? "";
      if (!isSafeHref(url)) return label;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
  );
}
