/* emoji 库与检索（issue #1657 / 票 1.4）。
 *
 * 数据源是 quiet-md 的 `crates/core/src/emoji.tsv`（1578 行，7 列 TSV）：
 * cat / id / char / 中文名 / 英文名 / 关键词(逗号) / emoticons(逗号)。
 * cat 0..6 依次对应 表情符号 / 动物 / 食物 / 活动 / 地点 / 物件 / 符号。
 *
 * 模块加载时解析一次（Vite `?raw` 内联原文），之后所有取色器 / 搜索 / 随机
 * 都走内存表。`search` 字段把 id、中文名、英文名、关键词、emoticons 全部
 * 小写化后拼成一行，检索时按逗号分词做「全部命中」的包含匹配。
 */
import raw from "./emoji.tsv?raw";

/** 一个 emoji 条目；`search` 已小写化，供包含匹配。 */
export interface EmojiEntry {
  readonly id: string;
  readonly char: string;
  /** 中文名（取自 TSV 第 4 列）。 */
  readonly name: string;
  /** 分类下标 0..6，顺序同 `EMOJI_CATEGORY_LABELS`。 */
  readonly cat: number;
  /** 小写化的检索串：id + 中文名 + 英文名 + 关键词 + emoticons。 */
  readonly search: string;
}

/** 7 个分类的中文名，顺序与 TSV 的 cat 列一致。 */
export const EMOJI_CATEGORY_LABELS: readonly string[] = [
  "表情符号",
  "动物",
  "食物",
  "活动",
  "地点",
  "物件",
  "符号",
];

/** 「最近」页签名（固定放在页签栏首位，不占分类下标）。 */
export const RECENT_TAB_LABEL = "最近";

/** 页签栏顺序：最近 + 7 个分类。 */
export const EMOJI_TAB_LABELS: readonly string[] = [
  RECENT_TAB_LABEL,
  ...EMOJI_CATEGORY_LABELS,
];

/**
 * 随机按钮的排除名单（拷贝自 quiet-md `src/editor/emoji.rs` 的
 * `RANDOM_BLOCKLIST`，43 个 id）：负面 / 攻击 / 死亡类 emoji 不进随机池。
 */
export const RANDOM_BLOCKLIST: ReadonlySet<string> = new Set([
  "dizzy_face",
  "rage",
  "angry",
  "face_with_symbols_on_mouth",
  "mask",
  "nauseated_face",
  "face_vomiting",
  "smiling_imp",
  "imp",
  "japanese_ogre",
  "japanese_goblin",
  "skull_and_crossbones",
  "middle_finger",
  "anger",
  "bomb",
  "hocho",
  "crossed_swords",
  "gun",
  "coffin",
  "funeral_urn",
  "right_anger_bubble",
  "face_with_head_bandage",
  "face_with_thermometer",
  "persevere",
  "disappointed_relieved",
  "tired_face",
  "unamused",
  "sweat",
  "pensive",
  "confused",
  "white_frowning_face",
  "slightly_frowning_face",
  "disappointed",
  "worried",
  "triumph",
  "cry",
  "sob",
  "weary",
  "crying_cat_face",
  "-1",
  "broken_heart",
  "black_heart",
  "sos",
]);

/** 搜索结果上限（与 quiet-md 的 MAX_RESULTS 一致）。 */
const MAX_RESULTS = 90;

/** 解析 TSV 原文为内存表；字段缺失的行跳过。 */
function parseEmojis(text: string): EmojiEntry[] {
  const out: EmojiEntry[] = [];
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const f = line.split("\t");
    if (f.length < 7) continue;
    const [catRaw, id, char, name, en, keywords, emoticons] = f;
    const cat = Number(catRaw);
    if (!Number.isInteger(cat) || cat < 0 || cat >= EMOJI_CATEGORY_LABELS.length)
      continue;
    const searchParts = [
      id,
      name,
      en,
      ...keywords.split(","),
      ...emoticons.split(","),
    ]
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part !== "");
    out.push({
      id,
      char,
      name,
      cat,
      search: searchParts.join(" "),
    });
  }
  return out;
}

export const EMOJI_DATA: readonly EmojiEntry[] = parseEmojis(raw);

/** 按分类下标取该分类全部 emoji（顺序同 TSV）。 */
export function emojisOfCategory(cat: number): readonly EmojiEntry[] {
  return EMOJI_DATA.filter((entry) => entry.cat === cat);
}

/**
 * 全局搜索：query 按空白 / 逗号 / 竖线切词，每个词都要在 `search` 里出现
 * （全部命中才返回），最多 90 条。空查询返回空数组。
 */
export function searchEmojis(query: string): readonly EmojiEntry[] {
  const terms = query
    .split(/[\s,|]+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term !== "");
  if (terms.length === 0) return [];
  const hits = EMOJI_DATA.filter((entry) =>
    terms.every((term) => entry.search.includes(term)),
  );
  return hits.slice(0, MAX_RESULTS);
}

/**
 * 随机取一个 emoji：排除 `excludeIds` 与 `RANDOM_BLOCKLIST`。
 * 池为空时返回 undefined。
 */
export function randomEmoji(
  excludeIds?: ReadonlySet<string>,
): EmojiEntry | undefined {
  const pool = EMOJI_DATA.filter(
    (entry) =>
      !RANDOM_BLOCKLIST.has(entry.id) &&
      !(excludeIds && excludeIds.has(entry.id)),
  );
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}
