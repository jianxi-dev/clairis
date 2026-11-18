import type { FrontmatterType } from "./frontmatter";

const FIELD_TYPES: ReadonlySet<string> = new Set<FrontmatterType>([
  "text",
  "number",
  "date",
  "datetime",
  "boolean",
  "array",
  "select",
  "multiselect",
  "unknown",
]);

export function docFieldTypesKey(docId: string): string {
  return `doc-field-types:${docId}`;
}

export function readDocFieldTypes(
  docId: string,
): Record<string, FrontmatterType> {
  try {
    const raw = window.localStorage.getItem(docFieldTypesKey(docId));
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, FrontmatterType> = {};
    for (const [key, type] of Object.entries(parsed)) {
      if (FIELD_TYPES.has(type as string)) out[key] = type as FrontmatterType;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeDocFieldTypes(
  docId: string,
  types: Record<string, FrontmatterType>,
): void {
  try {
    if (Object.keys(types).length === 0) {
      window.localStorage.removeItem(docFieldTypesKey(docId));
      return;
    }
    window.localStorage.setItem(docFieldTypesKey(docId), JSON.stringify(types));
  } catch {
    // 存储不可用（隐私模式 / 配额）：保持内存态，不影响当次类型判定。
  }
}
