import YAML from "yaml";
import { todayStamp } from "./extensions/templates";

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

/**
 * 字段类型（P-3 八类 + 未识别）。
 *
 * YAML 不存类型：`text/number/date/datetime/boolean/array` 由值推断，
 * `select/multiselect` 只能由用户判定（typeOverrides，会话态，不落盘），
 * `unknown` = 未命中别称且值无法推断（P-8「?」）。
 */
export type FrontmatterType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "boolean"
  | "array"
  | "select"
  | "multiselect"
  | "unknown";

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

/**
 * 标签色板（design-system §6「标签色板」唯一数值来源，10 色）。
 *
 * `light` / `dark` 各为 [底, 字, 描边]；暖主题沿用 light。数组下标即色板索引，
 * `tagColor` 的返回值直接索引本表——顺序不可调整。
 */
export interface TagPaletteEntry {
  name: string;
  light: [string, string, string];
  dark: [string, string, string];
}

export const TAG_PALETTE: readonly TagPaletteEntry[] = [
  {
    name: "靛蓝",
    light: ["#eef0ff", "#4338ca", "#c7cbff"],
    dark: ["#262a52", "#aeb4ff", "#3c4278"],
  },
  {
    name: "青碧",
    light: ["#e6f7f4", "#0f766e", "#b8e6de"],
    dark: ["#173b37", "#7ee0d0", "#256055"],
  },
  {
    name: "琥珀",
    light: ["#fdf2e2", "#b45309", "#f2d9a8"],
    dark: ["#3d2e18", "#f0c074", "#5c4526"],
  },
  {
    name: "玫红",
    light: ["#fdeaf2", "#be185d", "#f5c6dc"],
    dark: ["#3d1d2c", "#f2a4c8", "#5c2c44"],
  },
  {
    name: "竹绿",
    light: ["#e9f7ed", "#15803d", "#bfe6c9"],
    dark: ["#183625", "#86d99c", "#26543a"],
  },
  {
    name: "天青",
    light: ["#e6f4fc", "#0369a1", "#b9dff2"],
    dark: ["#142f40", "#7fcbed", "#204c66"],
  },
  {
    name: "紫罗兰",
    light: ["#f2ecfd", "#6d28d9", "#dcccf7"],
    dark: ["#2e2050", "#c3a6fa", "#463473"],
  },
  {
    name: "赭石",
    light: ["#fceee6", "#9a3412", "#f3cdb6"],
    dark: ["#3a2118", "#f0a884", "#5a3324"],
  },
  {
    name: "石板",
    light: ["#eef1f5", "#334155", "#ccd4de"],
    dark: ["#232a35", "#b3bfcf", "#38434f"],
  },
  {
    name: "藤黄",
    light: ["#fbf5df", "#854d0e", "#ecdfa8"],
    dark: ["#383114", "#e0c96a", "#564b20"],
  },
];

/**
 * 标签名 → 色板索引（0..9）。FNV-1a（与定稿原型 `fnv1a` 同实现），
 * 按名哈希、不按位置：同名同色，增删其他标签不改变既有标签的色值。
 */
export function tagColor(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % TAG_PALETTE.length;
}

/** 自动托管的创建 / 修改日期键：只读、键名锁定（P-6）。 */
export function isManagedDateKey(key: string): boolean {
  return key === "created" || key === "updated";
}

/**
 * 托管日期展示值：只取 `YYYY-MM-DD` 部分（`updated` 含时间也截断）；
 * 空值 / 非日期字面量返回 null，供 UI 缺失时不渲染空壳。
 */
export function managedDateDisplay(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return m ? m[1] : null;
}

/** 新建文档默认 frontmatter（P-7）：标题占位空串 + 创建 / 修改日期。 */
export function newDocFrontmatter(now: Date = new Date()): string {
  const stamp = todayStamp(now);
  return `---\ntitle: ""\ncreated: ${stamp}\nupdated: ${stamp}\n---\n`;
}

/**
 * 别称表（P-6，应用级预设）：规范键 → 中文 / 英文别称。
 * 仅用于类型识别，不改写显示名、不重命名 YAML 键。
 */
export const ALIAS: Readonly<Record<string, readonly string[]>> = {
  title: ["标题"],
  tags: ["标签"],
  category: ["分类"],
  author: ["作者"],
  status: ["状态"],
  date: ["日期"],
  createdate: ["创建日期"],
  updatedate: ["更新日期"],
};

/** 别称规范键 → 类型（与 ALIAS 的键一一对应）。 */
export const CANON_TYPE: Readonly<Record<string, FrontmatterType>> = {
  title: "text",
  tags: "array",
  category: "select",
  author: "text",
  status: "select",
  date: "date",
  createdate: "date",
  updatedate: "date",
};

/** 别称映射可赋的八类类型（不含 unknown 收编态）。 */
export const PROP_ALIAS_TYPES: readonly FrontmatterType[] = [
  "text",
  "number",
  "date",
  "datetime",
  "boolean",
  "array",
  "select",
  "multiselect",
];

/**
 * 内置别称映射（P-6，由 ALIAS/CANON_TYPE 派生）：规范键 + 各别称 → 类型。
 * 键统一小写，供大小写不敏感查找；应用配置未命中时回落此表。
 */
export const BUILTIN_ALIAS_MAP: Readonly<Record<string, FrontmatterType>> =
  (() => {
    const map: Record<string, FrontmatterType> = {};
    for (const canon of Object.keys(ALIAS)) {
      const type = CANON_TYPE[canon];
      if (!type) continue;
      map[canon.toLowerCase()] = type;
      for (const alias of ALIAS[canon]) map[alias.toLowerCase()] = type;
    }
    return map;
  })();

/** 归一化应用配置别称映射：键 trim、丢弃非法键名与未知类型并告警。 */
export function normalizePropAliasMap(
  raw: Record<string, string> | null | undefined,
): { config: Record<string, FrontmatterType>; warnings: string[] } {
  const warnings: string[] = [];
  const out: Record<string, FrontmatterType> = {};
  if (!raw || typeof raw !== "object") return { config: out, warnings };
  for (const [rawKey, rawType] of Object.entries(raw)) {
    const key = rawKey.trim();
    if (!key) {
      warnings.push("忽略空键名的别称映射");
      continue;
    }
    if (/[:#\r\n]/.test(key)) {
      warnings.push(`忽略非法键名「${key}」的别称映射`);
      continue;
    }
    if (!PROP_ALIAS_TYPES.includes(rawType as FrontmatterType)) {
      warnings.push(`别称映射「${key}」未知类型 ${rawType}，已忽略`);
      continue;
    }
    out[key] = rawType as FrontmatterType;
  }
  return { config: out, warnings };
}

/**
 * 命中别称表则返回对应类型，未命中返回 null（P-6：只赋类型，不改名）。
 * 先查应用配置 `aliasMap`（大小写不敏感、trim 后比对），未命中回落内置表。
 */
export function resolveAlias(
  key: string,
  aliasMap?: Record<string, FrontmatterType> | null,
): FrontmatterType | null {
  const k = key.trim().toLowerCase();
  if (aliasMap) {
    for (const [name, type] of Object.entries(aliasMap)) {
      if (name.trim().toLowerCase() === k) return type;
    }
  }
  return BUILTIN_ALIAS_MAP[k] ?? null;
}

/**
 * 定位标题字段（P-8 收编 / #1232）：规范键 `title` 优先，其次内置别称
 * （`ALIAS.title`，如「标题」）或用户在 `propAliasMap` 里登记为标题类型的别称。
 *
 * 不用 `resolveAlias(key) === CANON_TYPE.title` 直接判定：该函数返回「类型」，
 * `title` 与 `author` 同为 `text`，会把普通文本字段误认为标题。
 */
export function findTitleField(
  fields: readonly FrontmatterField[],
  aliasMap?: Record<string, FrontmatterType> | null,
): FrontmatterField | undefined {
  const bare = fields.find((f) => f.key === "title");
  if (bare) return bare;
  const aliases = new Set<string>(ALIAS.title);
  if (aliasMap) {
    for (const [key, type] of Object.entries(aliasMap)) {
      if (type === CANON_TYPE.title) aliases.add(key.trim());
    }
  }
  return fields.find((f) => aliases.has(f.key));
}

/**
 * 值 → 类型推断。纯字符串无法推断为具体类型（可能是文本 / 下拉），
 * 因此返回 `unknown`，等用户收编或命中别称（P-8）。
 */
export function inferFrontmatterType(value: unknown): FrontmatterType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") {
    if (DATE_RE.test(value)) return "date";
    if (DATETIME_RE.test(value)) return "datetime";
  }
  return "unknown";
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

const DATETIME_RE_FULL =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/** 公历日期合法性（拒绝 2026-02-30 这类溢出）。 */
function isValidDateParts(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export type FieldValidation =
  { ok: true; value: unknown } | { ok: false; reason: string };

/**
 * 值编辑器的类型校验（P-3）。
 *
 * - number：数值字面量（有限数；空串 / `abc` / `Infinity` 拒绝）；
 * - boolean：仅 `true` / `false`（大小写不敏感）；
 * - date：`YYYY-MM-DD` 且为真实公历日期；
 * - datetime：`YYYY-MM-DDTHH:mm`（可带秒，空格分隔亦可）；
 * - array：逗号 / 顿号 / 全角逗号分割，去空项，回写字符串数组；
 * - text：任意原文（下拉白名单在 1.5 有选项配置前按 text 处理）。
 *
 * 返回 `ok:false` 时 `reason` 为中文提示，供值编辑器还原原值并短暂展示。
 */
export function validateFieldValue(
  type: FrontmatterType,
  raw: string,
): FieldValidation {
  const text = raw.trim();
  switch (type) {
    case "number": {
      if (text === "") return { ok: false, reason: "数字格式不正确" };
      const n = Number(text);
      if (!Number.isFinite(n)) return { ok: false, reason: "数字格式不正确" };
      return { ok: true, value: n };
    }
    case "boolean": {
      const lower = text.toLowerCase();
      if (lower === "true") return { ok: true, value: true };
      if (lower === "false") return { ok: true, value: false };
      return { ok: false, reason: "布尔值只能是 true 或 false" };
    }
    case "date": {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      if (!m || !isValidDateParts(+m[1], +m[2], +m[3])) {
        return { ok: false, reason: "日期格式应为 YYYY-MM-DD" };
      }
      return { ok: true, value: text };
    }
    case "datetime": {
      const m = DATETIME_RE_FULL.exec(text);
      if (
        !m ||
        !isValidDateParts(+m[1], +m[2], +m[3]) ||
        +m[4] > 23 ||
        +m[5] > 59 ||
        (m[6] !== undefined && +m[6] > 59)
      ) {
        return { ok: false, reason: "日期时间格式不正确" };
      }
      return { ok: true, value: text };
    }
    case "array": {
      const items = text
        .split(/[,、，]/)
        .map((s) => s.trim())
        .filter((s) => s !== "");
      return { ok: true, value: items };
    }
    case "text":
    default:
      return { ok: true, value: raw };
  }
}

/** 保序去重（trim、去空项）：列表值与标签的粘贴去重共用。 */
export function dedupeValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (value === "" || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/** 列表链接去重（`[[文档名]]` 按整体字符串比较）。 */
export const dedupeLinks = dedupeValues;

/** 标签去重。 */
export const dedupeTags = dedupeValues;

const LINK_RE = /\[\[([^\[\]]+)\]\]/g;

/**
 * 粘贴文本 → 列表项：先抽出 `[[文档名]]` 链接，再把剩余文本按顿号 / 逗号 /
 * 换行分割。链接保持 `[[..]]` 原样，供列表值直接追加。
 */
export function parseLinkListText(text: string): string[] {
  const links = text.match(LINK_RE) ?? [];
  const rest = text.replace(LINK_RE, " ");
  const parts = rest
    .split(/[,、，\r\n]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
  return [...links, ...parts];
}

/** 粘贴文本 → 标签：按顿号 / 逗号 / 换行分割。 */
export function parseTagListText(text: string): string[] {
  return text
    .split(/[,、，\r\n]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/**
 * 类型切换时的值转换（P-3 / P-8）：把已解析的 JS 值转成目标类型。
 * 数组先还原为顿号文本再按目标类型校验；转换失败返回 `ok:false`，
 * 调用方保留原文并提示，不写回。
 */
export function coerceFrontmatterValue(
  type: FrontmatterType,
  value: unknown,
): FieldValidation {
  let raw: string;
  if (value === null || value === undefined) raw = "";
  else if (Array.isArray(value)) raw = value.map((v) => String(v)).join("、");
  else raw = String(value);
  if (type === "array" && Array.isArray(value)) return { ok: true, value };
  if (type === "multiselect" && Array.isArray(value))
    return { ok: true, value };
  return validateFieldValue(type, raw);
}

/**
 * 单字段写回（P-9）：只改目标键的值，键序与其余字段原样传入，
 * 自由键与注释由 `writeFrontmatter` 的 Document AST 保证不丢。
 */
export function setFrontmatterField(
  doc: string,
  key: string,
  value: unknown,
): FrontmatterWriteResult {
  const parsed = parseFrontmatter(doc);
  const fields = parsed.fields.map((f) =>
    f.key === key ? { ...f, value } : f,
  );
  return writeFrontmatter(doc, fields);
}

function toFields(
  data: unknown,
  aliasMap?: Record<string, FrontmatterType> | null,
): FrontmatterField[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [];
  }
  const fields: FrontmatterField[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const type = resolveAlias(key, aliasMap) ?? inferFrontmatterType(value);
    fields.push({
      key,
      type,
      value,
      display: formatFrontmatterValue(value, type),
    });
  }
  return fields;
}

export function parseFrontmatter(
  doc: string,
  aliasMap?: Record<string, FrontmatterType> | null,
): ParsedFrontmatter {
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
    fields: toFields(data, aliasMap),
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

/**
 * 按给定字段顺序写回（结构变更专用：排序 / 删除 / 粘贴 / 上下移）。
 *
 * 与 `writeFrontmatter` 的差异只在 AST 改写方式：本函数复用原有 Pair 节点
 * 重排 `map.items`，因此自由键原文、注释与锚点随节点一起移动、不丢；新键
 * 用 `new Pair` 插到指定位置。无 frontmatter 时退化为新建块（同 writeFrontmatter）。
 */
export function writeFrontmatterOrdered(
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

  let nextInner: string;
  try {
    const ast = YAML.parseDocument(parsed.inner);
    const map = ast.contents as YAML.YAMLMap | null;
    if (!map || !Array.isArray(map.items)) throw new Error("not a map");
    const byKey = new Map<string, YAML.Pair>();
    for (const pair of map.items) {
      if (!pair || typeof pair !== "object" || !("key" in pair)) continue;
      const k = (pair as YAML.Pair).key as unknown;
      const kv =
        k && typeof k === "object" && "value" in k
          ? String((k as { value: unknown }).value)
          : String(k);
      if (!byKey.has(kv)) byKey.set(kv, pair as YAML.Pair);
    }
    const items: YAML.Pair[] = [];
    for (const f of fields) {
      const pair = byKey.get(f.key);
      if (pair) {
        pair.value = f.value;
        items.push(pair);
      } else {
        items.push(new YAML.Pair(f.key, f.value));
      }
    }
    map.items = items;
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

/** 行标识：字段在 `fields` 中的下标，或伪字段 `"tags"`（标签行）。 */
export type FrontmatterRowId = number | "tags";

/**
 * 整块移动：把 `indices`（升序去重）指定的字段作为整块移动到 `targetIndex`。
 * `targetIndex` 以**移除前**的间隙下标解释（0..fields.length）；落在被移除
 * 块之后时自动前移块长。返回新数组，块内相对顺序保持不变。
 */
export function moveFieldBlock(
  fields: readonly FrontmatterField[],
  indices: readonly number[],
  targetIndex: number,
): FrontmatterField[] {
  const idx = [
    ...new Set(
      indices.filter((i) => Number.isInteger(i) && i >= 0 && i < fields.length),
    ),
  ].sort((a, b) => a - b);
  if (idx.length === 0) return [...fields];

  const selected = new Set(idx);
  const block = idx.map((i) => fields[i]);
  const rest = fields.filter((_, i) => !selected.has(i));
  const removedBefore = idx.filter((i) => i < targetIndex).length;
  const to = Math.max(0, Math.min(rest.length, targetIndex - removedBefore));
  return [...rest.slice(0, to), ...block, ...rest.slice(to)];
}

/**
 * 键名去重：返回 `base`；若与 `existingKeys` 冲突则依次尝试 `base-2`、
 * `base-3`…（P-4 粘贴键名自动追加序号）。
 */
export function uniqueKey(
  base: string,
  existingKeys: Iterable<string>,
): string {
  const taken = new Set(existingKeys);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * 列表内部键名去重：保留首个原键名，后续同名按 `base`、`base-2`… 顺延。
 */
export function dedupeKeys<T extends { key: string }>(
  fields: readonly T[],
): T[] {
  const taken = new Set<string>();
  return fields.map((f) => {
    const key = uniqueKey(f.key, taken);
    taken.add(key);
    return key === f.key ? f : { ...f, key };
  });
}

export type RenameFrontmatterResult =
  ({ ok: true } & FrontmatterWriteResult) | { ok: false; reason: string };

const RENAME_ILLEGAL_RE = /[:#\r\n]/;

/**
 * 字段改名（P-6）：改 YAML 键、保持键序位置与值，自由键 / 注释不丢。
 * 重名或非法键名返回 `ok:false` + 中文原因；同名提交视为无改动。
 */
export function renameFrontmatterField(
  doc: string,
  fromKey: string,
  toKey: string,
): RenameFrontmatterResult {
  const next = toKey.trim();
  if (next === "") return { ok: false, reason: "字段名不能为空" };
  if (RENAME_ILLEGAL_RE.test(next)) {
    return { ok: false, reason: "字段名不能包含 : 或 # 等字符" };
  }

  const parsed = parseFrontmatter(doc);
  if (!parsed.present) return { ok: false, reason: "文档没有 frontmatter" };

  const idx = parsed.fields.findIndex((f) => f.key === fromKey);
  if (idx === -1) return { ok: false, reason: "字段不存在" };
  if (next === fromKey) {
    return {
      ok: true,
      text: doc,
      from: parsed.start,
      to: parsed.end,
      block: parsed.block,
    };
  }
  if (parsed.fields.some((f, i) => i !== idx && f.key === next)) {
    return { ok: false, reason: `字段名「${next}」与已有键重名` };
  }

  let nextInner: string;
  try {
    const ast = YAML.parseDocument(parsed.inner);
    const map = ast.contents as YAML.YAMLMap | null;
    let renamed = false;
    if (map && Array.isArray(map.items)) {
      for (const pair of map.items) {
        const k = pair.key as unknown;
        const kv =
          k && typeof k === "object" && "value" in k
            ? String((k as { value: unknown }).value)
            : String(k);
        if (kv !== fromKey) continue;
        if (k && typeof k === "object" && "value" in k) {
          (k as { value: unknown }).value = next;
        } else {
          pair.key = next;
        }
        renamed = true;
        break;
      }
    }
    if (!renamed) throw new Error("key not found in AST");
    nextInner = ast.toString();
  } catch {
    const fields = parsed.fields.map((f) =>
      f.key === fromKey ? { ...f, key: next } : f,
    );
    return { ok: true, ...writeFrontmatter(doc, fields) };
  }

  const block =
    parsed.openLine + "\n" + nextInner + parsed.closeLine + parsed.trailing;
  const text = doc.slice(0, parsed.start) + block + doc.slice(parsed.end);
  return { ok: true, text, from: parsed.start, to: parsed.end, block };
}
