import {
  formatFrontmatterValue,
  type FrontmatterField,
  type FrontmatterType,
} from "./frontmatter";
import type { PropTemplateConfig, PropTemplateFieldConfig } from "../types";

export type { PropTemplateConfig, PropTemplateFieldConfig } from "../types";

export const BUILTIN_PROP_TEMPLATES: readonly PropTemplateConfig[] = [
  {
    name: "通用",
    fields: [
      { key: "category", type: "select", value: "设计" },
      { key: "author", type: "text", value: "" },
      { key: "status", type: "select", value: "草稿" },
    ],
  },
  {
    name: "会议记录",
    fields: [
      { key: "会议日期", type: "date", value: "" },
      { key: "参会人", type: "text", value: "" },
      { key: "决议", type: "text", value: "" },
    ],
  },
  {
    name: "需求",
    fields: [
      { key: "status", type: "select", value: "草稿" },
      { key: "优先级", type: "select", value: "中" },
      { key: "负责人", type: "text", value: "" },
    ],
  },
];

export const BUILTIN_TEMPLATE_NAMES: readonly string[] =
  BUILTIN_PROP_TEMPLATES.map((t) => t.name);

export const PROP_TEMPLATE_FIELD_TYPES: readonly FrontmatterType[] = [
  "text",
  "number",
  "date",
  "datetime",
  "boolean",
  "array",
  "select",
  "multiselect",
  "unknown",
];

export interface RawPropTemplateField {
  key?: string | null;
  type?: string | null;
  value?: unknown;
}

export interface RawPropTemplate {
  name?: string | null;
  fields?: RawPropTemplateField[] | null;
}

function normalizeField(
  raw: RawPropTemplateField | null | undefined,
  warnings: string[],
): PropTemplateFieldConfig | null {
  const key = typeof raw?.key === "string" ? raw.key.trim() : "";
  if (!key) {
    warnings.push("忽略无键名的模板字段");
    return null;
  }
  if (/[:#\r\n]/.test(key)) {
    warnings.push(`忽略非法字段名「${key}」`);
    return null;
  }
  const rawType = raw?.type;
  let type: FrontmatterType;
  if (rawType == null) {
    type = "text";
  } else if (PROP_TEMPLATE_FIELD_TYPES.includes(rawType as FrontmatterType)) {
    type = rawType as FrontmatterType;
  } else {
    warnings.push(`模板字段「${key}」未知类型 ${rawType}，按文本处理`);
    type = "text";
  }
  return { key, type, value: raw?.value ?? "" };
}

export function normalizePropTemplates(raw?: RawPropTemplate[] | null): {
  config: PropTemplateConfig[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const merged: PropTemplateConfig[] = BUILTIN_PROP_TEMPLATES.map((t) => ({
    name: t.name,
    fields: t.fields.map((f) => ({ ...f })),
  }));
  const indexByName = new Map<string, number>(
    merged.map((t, i) => [t.name, i]),
  );

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      if (!name) {
        warnings.push("忽略无名模板");
        continue;
      }
      const fields = Array.isArray(item.fields)
        ? item.fields
            .map((f) => normalizeField(f, warnings))
            .filter((f): f is PropTemplateFieldConfig => f !== null)
        : [];
      const idx = indexByName.get(name);
      if (idx === undefined) {
        indexByName.set(name, merged.length);
        merged.push({ name, fields });
      } else {
        merged[idx] = { name, fields };
      }
    }
  }

  return { config: merged, warnings };
}

export interface ApplyTemplateResult {
  fields: FrontmatterField[];
  added: number;
  skipped: number;
}

export function applyTemplate(
  fields: readonly FrontmatterField[],
  template: PropTemplateConfig | null | undefined,
): ApplyTemplateResult {
  const next = fields.map((f) => ({ ...f }));
  if (!template || !Array.isArray(template.fields)) {
    return { fields: next, added: 0, skipped: 0 };
  }
  const taken = new Set(next.map((f) => f.key));
  let added = 0;
  let skipped = 0;
  for (const field of template.fields) {
    const key = typeof field?.key === "string" ? field.key.trim() : "";
    if (!key || taken.has(key)) {
      skipped += 1;
      continue;
    }
    taken.add(key);
    const value = field.value ?? "";
    next.push({
      key,
      type: field.type,
      value,
      display: formatFrontmatterValue(value, field.type),
    });
    added += 1;
  }
  return { fields: next, added, skipped };
}
