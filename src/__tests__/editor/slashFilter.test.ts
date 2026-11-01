// 斜杠菜单过滤（移植自 md-bundle packages/editor/test/slash-filter.test.ts）。
//
// 源用例以 md-bundle 的 `defaultCommands` 注册表为输入；该注册表属于菜单层
// （1.2b），本票只移植纯过滤逻辑，所以这里用与源注册表同构的最小夹具：
// 同样的 id/label/code/children/grid，覆盖排序规则需要的全部形态。
import { describe, expect, it } from "vitest";
import {
  TABLE_SIZE_QUERY,
  filterSlashCommands,
} from "../../editors/slash-filter";
import { CALLOUT_EDIT_TYPES } from "../../editors/callout-types";

interface FixtureRow {
  id: string;
  label: string;
  code?: string;
  aliases?: readonly string[];
  children?: readonly FixtureRow[];
  grid?: { rows: number; cols: number };
}

const calloutChildren: FixtureRow[] = CALLOUT_EDIT_TYPES.map((type) => ({
  id: `callout-${type.key}`,
  label: type.label,
  code: `n${type.key[0]}`,
}));

const defaultCommands: readonly FixtureRow[] = [
  { id: "heading", label: "标题", code: "h" },
  { id: "quote", label: "引用", code: "q" },
  { id: "code", label: "代码块", code: "c" },
  { id: "divider", label: "分割线", code: "d" },
  { id: "task", label: "任务", code: "r" },
  { id: "image", label: "图片引用", code: "i" },
  { id: "media", label: "视频/文件", code: "v" },
  { id: "table", label: "表格", code: "t", grid: { rows: 3, cols: 3 } },
  {
    id: "columns",
    label: "分栏",
    code: "f",
    children: [
      { id: "col-1", label: "1 栏", code: "f1" },
      { id: "col-2", label: "2 栏", code: "f2" },
      { id: "col-3", label: "3 栏", code: "f3" },
      { id: "col-4", label: "4 栏", code: "f4" },
      { id: "col-5", label: "5 栏", code: "f5" },
    ],
  },
  { id: "callout", label: "标注", code: "n", children: calloutChildren },
  { id: "dashboard", label: "数据看板", code: "b" },
  { id: "html", label: "插入 HTML", code: "H" },
  { id: "css", label: "插入 CSS", code: "C" },
  { id: "mermaid", label: "流程图", code: "m" },
  { id: "checklist", label: "任务清单", code: "k" },
  { id: "toc", label: "目录导航", code: "o" },
  { id: "embed", label: "内嵌网页", code: "e" },
];

/** Row labels for a filtered result, in render order. */
function labels(rows: readonly { label: string }[]): string[] {
  return rows.map((row) => row.label);
}

function row(commandId: string): FixtureRow {
  const found = defaultCommands.find((cmd) => cmd.id === commandId);
  if (!found) throw new Error(`missing registry command: ${commandId}`);
  return found;
}

describe("filterSlashCommands", () => {
  it("lists every root command in canonical order for an empty query", () => {
    expect(labels(filterSlashCommands(defaultCommands, ""))).toEqual([
      "标题",
      "引用",
      "代码块",
      "分割线",
      "任务",
      "图片引用",
      "视频/文件",
      "表格",
      "分栏",
      "标注",
      "数据看板",
      "插入 HTML",
      "插入 CSS",
      "流程图",
      "任务清单",
      "目录导航",
      "内嵌网页",
    ]);
  });

  it("assigns /fN codes to the column children and /f to the parent", () => {
    const columns = row("columns");
    expect(columns.code).toBe("f");
    expect((columns.children ?? []).map((child) => child.code)).toEqual([
      "f1",
      "f2",
      "f3",
      "f4",
      "f5",
    ]);
  });

  it("filters /f3 to the 3-column row", () => {
    expect(labels(filterSlashCommands(defaultCommands, "f3"))).toEqual([
      "3 栏",
    ]);
  });

  it("returns nothing for the stale /fl3 code", () => {
    expect(filterSlashCommands(defaultCommands, "fl3")).toEqual([]);
  });

  it("declares the thirteen editor callout types as second-level options", () => {
    const children = row("callout").children ?? [];
    expect(children).toHaveLength(13);
    expect(children.map((c) => c.label)).toEqual([
      "注释",
      "信息",
      "摘要",
      "待办",
      "提示",
      "成功",
      "问题",
      "警告",
      "失败",
      "危险",
      "Bug",
      "示例",
      "引用",
    ]);
    expect(
      children.map(
        (c) =>
          CALLOUT_EDIT_TYPES.find((t) => `callout-${t.key}` === c.id)?.emoji,
      ),
    ).toEqual([
      "📝",
      "ℹ️",
      "📋",
      "☑️",
      "💡",
      "✅",
      "❓",
      "⚠️",
      "✖️",
      "🚨",
      "🐛",
      "📝",
      "💬",
    ]);
  });

  it("keeps only the table for a size query and reads the size from the same rule", () => {
    expect(labels(filterSlashCommands(defaultCommands, "t53"))).toEqual([
      "表格",
    ]);
    const match = TABLE_SIZE_QUERY.exec("t53");
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("5");
    expect(match?.[2]).toBe("3");
  });

  it("ranks the table first for its full pinyin", () => {
    expect(labels(filterSlashCommands(defaultCommands, "biaoge"))[0]).toBe(
      "表格",
    );
  });

  it("matches the table by pinyin prefix", () => {
    expect(labels(filterSlashCommands(defaultCommands, "biao"))).toContain(
      "表格",
    );
  });

  it("keeps the callout parent and surfaces its styles for the parent code", () => {
    const rows = labels(filterSlashCommands(defaultCommands, "n"));
    expect(rows[0]).toBe("标注");
    expect(rows.slice(1)).toEqual(calloutChildren.map((child) => child.label));
  });

  it("shows only the matching style for a second-level code", () => {
    expect(labels(filterSlashCommands(defaultCommands, "nd"))).toEqual([
      "危险",
    ]);
  });

  it("ranks an exact code above label matches", () => {
    expect(labels(filterSlashCommands(defaultCommands, "t"))[0]).toBe("表格");
  });

  it("finds the task by its code", () => {
    expect(labels(filterSlashCommands(defaultCommands, "r"))).toContain("任务");
  });

  it("finds the heading by pinyin initials", () => {
    expect(labels(filterSlashCommands(defaultCommands, "bt"))).toContain(
      "标题",
    );
  });

  it("finds the divider by its label pinyin", () => {
    expect(labels(filterSlashCommands(defaultCommands, "fenge"))).toContain(
      "分割线",
    );
  });

  it("returns nothing when the query matches no row", () => {
    expect(filterSlashCommands(defaultCommands, "zzzz")).toEqual([]);
  });
});
