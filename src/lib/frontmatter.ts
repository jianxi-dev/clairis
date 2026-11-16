import YAML from "yaml";

/**
 * 文档 frontmatter 解析 / 序列化（doc-property-panel 功能一）。
 *
 * 识别规则与 `src/renderers/markdown.ts` 的 `FRONTMATTER_RE` 保持同一语义
 * （含 BOM 兼容），预览剥离与面板解析共用一种判定，避免「面板显示了但预览
 * 没剥掉」这类不一致。序列化输出必须能被同一正则再次识别。
 *
 * 实现用 `yaml` 的 Document（AST）而非 parse/stringify：Document 在未改动的
 * 键上保留原始文本（缩进、引号、注释、锚点），因此「自由键原文保留」与
 * 「往返一致」是结构保证，而不是重新拼字符串。
 */

export const FRONTMATTER_RE = /^\uFEFF?---\s*\n[\s\S]*?\n---\s*(?:\n|$)/;

/** 只读显示用的推断类型；仅影响图标与格式，不改写原文。 */
export type FrontmatterType =
  "text" | "number" | "date" | "datetime" | "boolean" | "array";

export interface FrontmatterField {
  /** YAML 键名，原样保留（不改写、不翻译）。 */
  key: string;
  type: FrontmatterType;
  /** 解析后的原始值（写回用；显示请用 display）。 */
  value: unknown;
  /** 显示层格式化后的文本（千分位 / 顿号 / 日期时间空格等）。 */
  display: string;
}

export interface ParsedFrontmatter {
  present: boolean;
  /** 整块原文（含首尾 `---` 行），未命中时为空串。 */
  block: string;
  /** 块在文档中的起始下标。 */
  start: number;
  /** 块在文档中的结束下标（不含后续正文）。 */
  end: number;
  /** 首行（含 BOM 与 `---`），用于写回时原样重建。 */
  openLine: string;
  /** 末行（`---`，可带尾随空格）。 */
  closeLine: string;
  /** 块尾随的换行（`""` 或 `"\n"`）。 */
  trailing: string;
  /** 首尾 `---` 之间的 YAML 正文（保留尾部换行）。 */
  inner: string;
  /** 键序数组即唯一顺序真相（面板行序、写回顺序都以此为准）。 */
  fields: FrontmatterField[];
}

export interface FrontmatterWriteResult {
  /** 替换后的完整文档。 */
  text: string;
  /** CM6 `changes` 的替换起点。 */
  from: number;
  /** CM6 `changes` 的替换终点。 */
  to: number;
  /** 新的整块文本（`from === to` 时即插入内容）。 */
  block: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export function inferFrontmatterType(value: unknown): FrontmatterType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") {
    if (DATE_RE.test(value)) return "date";
    if (DATETIME_RE.test(value)) return "datetime";
    return "text";
  }
  return "text";
}

/** 显示层格式化；空值返回空串（由 UI 决定占位符）。 */
export function formatFrontmatterValue(
  value: unknown,
  type: FrontmatterType,
): string {
  if (value === null || value === undefined || value === "") return "";
  switch (type) {
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
    }
    case "boolean":
      return value ? "开" : "关";
    case "array":
      return (value as unknown[]).map((v) => String(v)).join("、");
    case "datetime":
      return String(value).replace("T", " ");
    default:
      return String(value);
  }
}

function toFields(data: unknown): FrontmatterField[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [];
  }
  const fields: FrontmatterField[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const type = inferFrontmatterType(value);
    fields.push({
      key,
      type,
      value,
      display: formatFrontmatterValue(value, type),
    });
  }
  return fields;
}

export function parseFrontmatter(doc: string): ParsedFrontmatter {
  const empty: ParsedFrontmatter = {
    present: false,
    block: "",
    start: 0,
    end: 0,
    openLine: "",
    closeLine: "",
    trailing: "",
    inner: "",
    fields: [],
  };
  const match = FRONTMATTER_RE.exec(doc);
  if (!match) return empty;

  const block = match[0];
  const start = match.index;
  const end = start + block.length;
  const nl = block.indexOf("\n");
  if (nl === -1) return empty;

  const openLine = block.slice(0, nl);
  const closeIdx = block.lastIndexOf("\n---");
  if (closeIdx === -1) return empty;

  const inner = block.slice(nl + 1, closeIdx + 1);
  const tail = block.slice(closeIdx + 1);
  const trailing = tail.endsWith("\n") ? "\n" : "";
  const closeLine = trailing ? tail.slice(0, -1) : tail;

  let data: unknown = null;
  if (inner.trim()) {
    try {
      data = YAML.parse(inner);
    } catch {
      data = null;
    }
  }

  return {
    present: true,
    block,
    start,
    end,
    openLine,
    closeLine,
    trailing,
    inner,
    fields: toFields(data),
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 整块序列化写回。传入完整字段列表（含未改动字段）：
 * - 无改动时原样返回（`from`/`to` 为原块范围，`block` 为原块）；
 * - 有改动时用 Document 只改目标键，未预置自由键与注释保持原文；
 * - 无 frontmatter 时在文档首部新建 `--- ... ---` 块。
 */
export function writeFrontmatter(
  doc: string,
  fields: FrontmatterField[],
): FrontmatterWriteResult {
  const parsed = parseFrontmatter(doc);

  if (!parsed.present) {
    const body =
      fields.length > 0
        ? YAML.stringify(
            Object.fromEntries(fields.map((f) => [f.key, f.value])),
          )
        : "";
    const block = `---\n${body}---\n`;
    const bom = doc.startsWith("\uFEFF") ? "\uFEFF" : "";
    const text = bom + block + doc.slice(bom.length);
    return { text, from: bom.length, to: bom.length, block };
  }

  const unchanged =
    parsed.fields.length === fields.length &&
    parsed.fields.every(
      (f, i) => f.key === fields[i].key && sameValue(f.value, fields[i].value),
    );
  if (unchanged) {
    return {
      text: doc,
      from: parsed.start,
      to: parsed.end,
      block: parsed.block,
    };
  }

  // 畸形 YAML 不阻断写回：解析失败时退化为整块重建。
  let nextInner: string;
  try {
    const ast = YAML.parseDocument(parsed.inner);
    const keep = new Set(fields.map((f) => f.key));
    for (const key of Object.keys(ast.toJS() ?? {})) {
      if (!keep.has(key)) ast.delete(key);
    }
    for (const f of fields) ast.set(f.key, f.value);
    nextInner = ast.toString();
  } catch {
    nextInner = YAML.stringify(
      Object.fromEntries(fields.map((f) => [f.key, f.value])),
    );
  }

  const block =
    parsed.openLine + "\n" + nextInner + parsed.closeLine + parsed.trailing;
  const text = doc.slice(0, parsed.start) + block + doc.slice(parsed.end);
  return { text, from: parsed.start, to: parsed.end, block };
}
