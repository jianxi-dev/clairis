/* 扩展 bundle：一次 `list_extensions` 调用拿回 templates + theme tokens + warnings。
 *
 * 与 `src/editors/user-extensions.ts` 的 `loadUserExtensions` 并存（后者把
 * snippets 映射成斜杠命令）；本模块负责新建页模板与主题 token。
 * 任何调用异常或返回形状不对都静默返回空 bundle，不抛错
 * （`list_extensions` 在纯浏览器/老版本里不存在）。
 */

import type { Template } from "./templates";
import type { UserSnippet } from "../../editors/user-extensions";
import { extractSnippets } from "../../editors/user-extensions";

export interface ExtensionBundle {
  templates: Template[];
  themeTokens: Record<string, string>;
  warnings: string[];
}

/** 一次 `list_extensions` 调用解析出的三类扩展数据（snippets 供斜杠菜单）。 */
export interface ExtensionSnapshot {
  snippets: UserSnippet[];
  templates: Template[];
  themeTokens: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 宽松解析单个 template；缺 `name`/`body` 或类型不对返回 null。 */
function toTemplate(raw: unknown): Template | null {
  if (!isRecord(raw)) return null;
  const { name, body, path } = raw;
  if (typeof name !== "string" || name === "") return null;
  if (typeof body !== "string") return null;
  if (typeof path !== "string") return null;
  return { name, body, path };
}

/** 从 `list_extensions` 返回值里取模板；形状不对返回空列表。 */
function extractTemplates(result: unknown): Template[] {
  if (!isRecord(result)) return [];
  const templates = result.templates;
  if (!Array.isArray(templates)) return [];
  const out: Template[] = [];
  for (const entry of templates) {
    const template = toTemplate(entry);
    if (template !== null) out.push(template);
  }
  return out;
}

/** 从 `theme.tokens` 取字符串键值对；形状不对返回空对象。 */
function extractTokens(result: unknown): Record<string, string> {
  if (!isRecord(result)) return {};
  const theme = result.theme;
  if (!isRecord(theme)) return {};
  const tokens = theme.tokens;
  if (!isRecord(tokens)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** 从顶层 `warnings` 取字符串数组；形状不对返回空列表。 */
function extractWarnings(result: unknown): string[] {
  if (!isRecord(result)) return [];
  const warnings = result.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.filter((w): w is string => typeof w === "string");
}

/** 把 `list_extensions` 返回值映射成 bundle；形状不对的字段各自降级。 */
function toBundle(result: unknown): ExtensionBundle {
  return {
    templates: extractTemplates(result),
    themeTokens: extractTokens(result),
    warnings: extractWarnings(result),
  };
}

/**
 * 调一次 `list_extensions` 并解析成 bundle。
 * 异常（命令不存在/后端报错）与返回形状不对都静默返回空 bundle。
 */
export async function loadExtensionBundle(
  invokeFn: (cmd: string) => Promise<unknown>,
): Promise<ExtensionBundle> {
  try {
    const result = await invokeFn("list_extensions");
    return toBundle(result);
  } catch {
    return { templates: [], themeTokens: {}, warnings: [] };
  }
}

/**
 * 调一次 `list_extensions`，解析 snippets / templates / theme tokens 三类。
 * 异常与形状不对都静默返回全空快照。
 */
export async function loadExtensionSnapshot(
  invokeFn: (cmd: string) => Promise<unknown>,
): Promise<ExtensionSnapshot> {
  try {
    const result = await invokeFn("list_extensions");
    const bundle = toBundle(result);
    return {
      snippets: extractSnippets(result),
      templates: bundle.templates,
      themeTokens: bundle.themeTokens,
    };
  } catch {
    return { snippets: [], templates: [], themeTokens: {} };
  }
}
