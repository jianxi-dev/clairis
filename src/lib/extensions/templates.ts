/* 新建页模板（design §D3）。
 *
 * `list_extensions` 返回的 `templates[]` 元素形状；正文里的占位符仅两个：
 * `{{date}}` → `YYYY-MM-DD`，`{{title}}` → 新页签名（无路径时即「未命名」）。
 * 未知占位符原样保留，替换一次性完成（插入值里的 `{{...}}` 不会被二次替换）。
 */

export interface Template {
  name: string;
  body: string;
  path: string;
}

export type UserTemplate = Template;

/** 模板占位符 → 值。`title`/`date` 缺省时按空串处理，调用方保证传入。 */
export interface TemplateVars {
  title: string;
  date: string;
}

/** 匹配 `{{...}}`（内部不含花括号），用于一次性扫描。 */
const PLACEHOLDER_RE = /\{\{([^{}]*)\}\}/g;

/** 把模板正文里的已知占位符替换成变量值；未知占位符原样保留。 */
export function applyTemplatePlaceholders(
  body: string,
  vars: TemplateVars,
): string {
  return body.replace(PLACEHOLDER_RE, (match, key: string) => {
    if (key === "date") return vars.date;
    if (key === "title") return vars.title;
    return match;
  });
}

/** 本地时区的 `YYYY-MM-DD`（`{{date}}` 的值）。 */
export function todayStamp(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
