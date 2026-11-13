/* 用户片段（snippets）接入斜杠菜单。
 *
 * Rust 侧 `list_extensions` 返回的 `ExtensionsSnapshot` 里，`snippets` 是
 * `{ id, label, keywords, icon?, body, path }`（serde 默认 snake_case）。
 * 本模块把它映射成 `SlashCommand`，让同一套过滤/渲染/单事务插入逻辑复用。
 *
 * 模板与主题 token 的前端接入见 `src/lib/extensions/`（bundle / templates /
 * theme-tokens），本模块只管 snippets。
 *
 * 任何调用异常或返回形状不对都返回空列表——菜单退回纯内置命令，
 * 不抛错、不打 error 级日志（`list_extensions` 在纯浏览器/老版本里不存在）。
 */

import type { SlashCommand } from "./slash";

/** 用户片段的原始形状（`list_extensions` 的 `snippets[]` 元素）。 */
export interface UserSnippet {
  id: string;
  label: string;
  keywords: string[];
  icon?: string;
  body: string;
}

/** 用户片段在菜单里的分组标题。 */
const SNIPPET_GROUP = "我的片段";

/**
 * 片段 → 斜杠命令：
 * - `code` 用 `snippet.id`（斜杠过滤按 code/alias 精确匹配）。
 * - `keywords` 作为 `aliases`，与现有拼音过滤叠加。
 * - `insert` 返回正文；`applyCommand` 用单次 `dispatch` 替换 `/query`，
 *   所以插入是单事务、可撤销。
 * - `inline` 按正文单行性自动标注：GFM 单元格只有一行，单行片段可安全落进
 *   单元格菜单（#744）；多行片段只出现在文档级/容器级菜单。
 */
export function snippetToCommand(snippet: UserSnippet): SlashCommand {
  return {
    id: snippet.id,
    code: snippet.id,
    label: snippet.label,
    icon: snippet.icon,
    aliases: snippet.keywords,
    group: SNIPPET_GROUP,
    inline: !snippet.body.includes("\n"),
    insert(state) {
      const head = state.selection.main.head;
      return { from: head - 1, to: head, text: snippet.body };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 字符串数组校验；非数组或含非字符串元素返回 null（形状不对）。 */
function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    out.push(entry);
  }
  return out;
}

/** 宽松解析单个 snippet；缺 `id`/`body` 或类型不对返回 null。 */
function toSnippet(raw: unknown): UserSnippet | null {
  if (!isRecord(raw)) return null;
  const { id, label, keywords, icon, body } = raw;
  if (typeof id !== "string" || id === "") return null;
  if (typeof body !== "string") return null;
  const kw = keywords === undefined ? [] : asStringArray(keywords);
  if (kw === null) return null;
  const iconValue = icon === undefined || icon === null ? undefined : icon;
  if (iconValue !== undefined && typeof iconValue !== "string") return null;
  return {
    id,
    label: typeof label === "string" && label !== "" ? label : id,
    keywords: kw,
    icon: iconValue,
    body,
  };
}

/** 从 `list_extensions` 返回值里取 snippets；形状不对返回空列表。 */
export function extractSnippets(result: unknown): UserSnippet[] {
  if (!isRecord(result)) return [];
  const snippets = result.snippets;
  if (!Array.isArray(snippets)) return [];
  const out: UserSnippet[] = [];
  for (const entry of snippets) {
    const snippet = toSnippet(entry);
    if (snippet !== null) out.push(snippet);
  }
  return out;
}

/**
 * 调 `list_extensions` 并把 `snippets` 映射成斜杠命令。
 *
 * 异常（命令不存在/后端报错）与返回形状不对都静默返回 `[]`。
 */
export async function loadUserExtensions(
  invokeFn: (cmd: string) => Promise<unknown>,
): Promise<SlashCommand[]> {
  try {
    const result = await invokeFn("list_extensions");
    return extractSnippets(result).map(snippetToCommand);
  } catch {
    return [];
  }
}
