/* 最近使用 emoji 的跨会话持久化（issue #1657 / 票 1.4）。
 *
 * localStorage 键 `biaoyue.callout-emoji.recent.v1`，存 emoji 字符数组
 * （最新在前、去重、上限 20）。localStorage 不可用 / JSON 损坏时静默
 * 回退空数组，不抛错——取色器的「最近」段只是增强，不能让它拖垮编辑。
 */

const RECENT_KEY = "biaoyue.callout-emoji.recent.v1";
const MAX_RECENT = 20;

/** 读最近列表；任何异常都回退空数组。 */
export function readRecentEmoji(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

/** 写入一个 emoji 到最近列表头部，返回更新后的列表（同样上限 20）。 */
export function pushRecentEmoji(char: string): string[] {
  const next = [char, ...readRecentEmoji().filter((item) => item !== char)].slice(
    0,
    MAX_RECENT,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // 写不进去就算了：内存里仍返回更新后的列表，本次会话可用。
  }
  return next;
}
