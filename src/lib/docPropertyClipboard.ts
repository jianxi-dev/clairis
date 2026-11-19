import type { FrontmatterField, FrontmatterType } from "./frontmatter";

/**
 * 文档属性选中集剪贴板（#1161 / P-4「选中集复制不含值」）。
 *
 * 载荷只含字段定义（名称 / 类型 / 未来属性），**不含值**：复制不搬内容，
 * 粘贴在目标文档重建同定义的空值字段。模块级单例承载，跨页签 / 跨文档
 * 可用（组件 state 会随页签卸载丢失，故提升到模块）。
 *
 * 不写系统剪贴板：仅在应用会话内有效，不落盘、无跨应用互操作。
 */

/** 载荷版本；结构变更时递增，decode 拒绝不识别的版本。 */
export const FIELD_SELECTION_VERSION = 1;

const FRONTMATTER_TYPES: ReadonlySet<string> = new Set<FrontmatterType>([
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

export interface FieldSelectionEntry {
  key: string;
  type: FrontmatterType;
  /** 未来字段属性扩展位（当前预留，序列化时携带）。 */
  attrs?: Record<string, unknown>;
}

export interface DocPropertyClipboardPayload {
  version: typeof FIELD_SELECTION_VERSION;
  fields: FieldSelectionEntry[];
}

/** `FrontmatterField` 里属于剪贴板载荷的字段；其余键视为未来属性。 */
const RESERVED_FIELD_KEYS = new Set(["key", "type", "value", "display"]);

function isFrontmatterType(value: unknown): value is FrontmatterType {
  return typeof value === "string" && FRONTMATTER_TYPES.has(value);
}

function encodeEntry(field: FrontmatterField): FieldSelectionEntry {
  const attrs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(field)) {
    if (!RESERVED_FIELD_KEYS.has(k)) attrs[k] = v;
  }
  const entry: FieldSelectionEntry = { key: field.key, type: field.type };
  if (Object.keys(attrs).length > 0) entry.attrs = attrs;
  return entry;
}

/**
 * 把选中下标编码为剪贴板载荷：剥离 `value` / `display`，只留定义。
 * 下标升序去重，越界 / 非整数忽略。
 */
export function encodeFieldSelection(
  fields: readonly FrontmatterField[],
  indices: readonly number[],
): DocPropertyClipboardPayload {
  const picked = [
    ...new Set(
      indices.filter((i) => Number.isInteger(i) && i >= 0 && i < fields.length),
    ),
  ].sort((a, b) => a - b);
  return {
    version: FIELD_SELECTION_VERSION,
    fields: picked.map((i) => encodeEntry(fields[i])),
  };
}

/** 各类型的空值默认：数组 / 复选为空列表，其余为空串。 */
export function emptyValueForType(type: FrontmatterType): unknown {
  return type === "array" || type === "multiselect" ? [] : "";
}

/**
 * 把载荷重建为空值字段：类型 / 名称（/未来属性）与原行一致，值为空。
 * 版本不符或结构非法返回空数组；条目缺键 / 类型不识别时跳过。
 */
export function decodeFieldSelection(
  payload: DocPropertyClipboardPayload | null,
): FrontmatterField[] {
  if (!payload || payload.version !== FIELD_SELECTION_VERSION) return [];
  if (!Array.isArray(payload.fields)) return [];
  const out: FrontmatterField[] = [];
  for (const entry of payload.fields) {
    if (
      !entry ||
      typeof entry.key !== "string" ||
      !isFrontmatterType(entry.type)
    ) {
      continue;
    }
    out.push({
      ...(entry.attrs ?? {}),
      key: entry.key,
      type: entry.type,
      value: emptyValueForType(entry.type),
      display: "",
    });
  }
  return out;
}

let current: DocPropertyClipboardPayload | null = null;

export function setFieldSelection(
  payload: DocPropertyClipboardPayload | null,
): void {
  current = payload;
}

export function getFieldSelection(): DocPropertyClipboardPayload | null {
  return current;
}

export function clearFieldSelection(): void {
  current = null;
}
