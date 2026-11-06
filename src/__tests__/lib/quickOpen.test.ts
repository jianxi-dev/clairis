import { describe, expect, it, vi } from "vitest";
import { buildQuickItems } from "../../lib/quickOpen";
import type { Tab } from "../../types";

function tab(id: string, title: string, path: string): Tab {
  return {
    id,
    title,
    path,
    fileKind: "markdown",
    content: "",
    dirty: false,
    editorMode: "preview",
    scrollPos: 0,
    contentHeight: 0,
  };
}

const COMMANDS = [
  {
    key: "cmd:grid",
    label: "网格概览",
    hint: "⌘⇧\\",
    icon: "grid" as const,
    run: vi.fn(),
  },
  {
    key: "cmd:settings",
    label: "设置",
    hint: "⌘,",
    icon: "settings" as const,
    run: vi.fn(),
  },
];

describe("buildQuickItems", () => {
  it("空查询返回页签 + 最近 + 命令全量", () => {
    const items = buildQuickItems(
      { t1: tab("t1", "甲.md", "/lib/甲.md") },
      [{ path: "/lib/乙.md", title: "乙.md", openedAt: "", excerpt: "" }],
      COMMANDS,
      "",
    );
    expect(items.map((i) => i.kind)).toEqual([
      "tab",
      "recent",
      "command",
      "command",
    ]);
  });

  it("最近文件与页签同路径时去重", () => {
    const items = buildQuickItems(
      { t1: tab("t1", "甲.md", "/lib/甲.md") },
      [
        { path: "/lib/甲.md", title: "甲.md", openedAt: "", excerpt: "" },
        { path: "/lib/乙.md", title: "乙.md", openedAt: "", excerpt: "" },
      ],
      [],
      "",
    );
    const recents = items.filter((i) => i.kind === "recent");
    expect(recents).toHaveLength(1);
    expect(recents[0]).toMatchObject({ path: "/lib/乙.md" });
  });

  it("按 title 子串过滤（大小写不敏感）", () => {
    const items = buildQuickItems(
      { t1: tab("t1", "Alpha.md", "/lib/a.md") },
      [],
      [],
      "alpha",
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "tab", tabId: "t1" });
  });

  it("按 path 子串过滤", () => {
    const items = buildQuickItems(
      { t1: tab("t1", "甲.md", "/docs/甲.md") },
      [],
      [],
      "/docs/",
    );
    expect(items).toHaveLength(1);
  });

  it("无命中返回空数组", () => {
    const items = buildQuickItems(
      { t1: tab("t1", "甲.md", "/lib/甲.md") },
      [],
      COMMANDS,
      "不存在关键字",
    );
    expect(items).toHaveLength(0);
  });

  it("命令按 label 过滤", () => {
    const items = buildQuickItems({}, [], COMMANDS, "设置");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "command", key: "cmd:settings" });
  });
});
