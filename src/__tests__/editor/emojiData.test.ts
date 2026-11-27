/**
 * emoji 库解析与检索（issue #1657 / 票 1.4）。
 *
 * 契约：TSV 1578 行、7 个分类；`searchEmojis` 中文关键词可命中；
 * `randomEmoji` 永不返回 RANDOM_BLOCKLIST 内的 id。
 */
import { describe, expect, it } from "vitest";
import {
  EMOJI_CATEGORY_LABELS,
  EMOJI_DATA,
  EMOJI_TAB_LABELS,
  RANDOM_BLOCKLIST,
  emojisOfCategory,
  randomEmoji,
  searchEmojis,
} from "../../editors/emoji-data";

describe("emoji 库数据", () => {
  it("解析出 1578 条", () => {
    expect(EMOJI_DATA.length).toBe(1578);
  });

  it("分类标签 7 个且顺序正确", () => {
    expect([...EMOJI_CATEGORY_LABELS]).toEqual([
      "表情符号",
      "动物",
      "食物",
      "活动",
      "地点",
      "物件",
      "符号",
    ]);
    expect(EMOJI_TAB_LABELS.length).toBe(8);
    expect(EMOJI_TAB_LABELS[0]).toBe("最近");
  });

  it("每个分类都非空", () => {
    for (let cat = 0; cat < EMOJI_CATEGORY_LABELS.length; cat += 1) {
      expect(emojisOfCategory(cat).length).toBeGreaterThan(0);
    }
  });

  it("searchEmojis(\"猫\") 非空", () => {
    expect(searchEmojis("猫").length).toBeGreaterThan(0);
  });

  it("searchEmojis(\"rocket\") 命中 🚀", () => {
    const chars = searchEmojis("rocket").map((entry) => entry.char);
    expect(chars).toContain("🚀");
  });

  it("randomEmoji 不返回 RANDOM_BLOCKLIST 内 id", () => {
    for (let i = 0; i < 50; i += 1) {
      const picked = randomEmoji();
      expect(picked).toBeDefined();
      expect(RANDOM_BLOCKLIST.has(picked?.id ?? "")).toBe(false);
    }
  });

  it("randomEmoji(excludeIds) 排除指定 id", () => {
    const exclude = new Set(EMOJI_DATA.slice(0, 100).map((entry) => entry.id));
    for (let i = 0; i < 20; i += 1) {
      const picked = randomEmoji(exclude);
      expect(picked).toBeDefined();
      expect(exclude.has(picked?.id ?? "")).toBe(false);
    }
  });
});
