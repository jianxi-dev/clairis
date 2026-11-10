import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  convertFileSrc: (p: string) => p,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

import { normalizeHtmlToolbarItems } from "../../hooks/useConfig";
import {
  HTML_TOOLBAR_DEFAULT_ORDER,
  resolveToolbarOrder,
} from "../../editors/orchestration/slots";

describe("工具条槽位解析", () => {
  it("缺省与空数组回落 12 项默认顺序", () => {
    expect(resolveToolbarOrder(null)).toEqual([...HTML_TOOLBAR_DEFAULT_ORDER]);
    expect(resolveToolbarOrder([])).toEqual([...HTML_TOOLBAR_DEFAULT_ORDER]);
    expect(HTML_TOOLBAR_DEFAULT_ORDER).toHaveLength(12);
  });

  it("保留配置顺序并过滤未知 id", () => {
    expect(resolveToolbarOrder(["format-italic", "nope", "ai-polish"])).toEqual(
      ["format-italic", "ai-polish"],
    );
  });

  it("重复 id 去重保留首个", () => {
    expect(
      resolveToolbarOrder(["format-bold", "ai-polish", "format-bold"]),
    ).toEqual(["format-bold", "ai-polish"]);
  });

  it("全为未知 id 时回落默认", () => {
    expect(resolveToolbarOrder(["a", "b"])).toEqual([
      ...HTML_TOOLBAR_DEFAULT_ORDER,
    ]);
  });
});

describe("工具条配置归一化", () => {
  it("缺省与空数组回落 null", () => {
    expect(normalizeHtmlToolbarItems(null)).toBeNull();
    expect(normalizeHtmlToolbarItems(undefined)).toBeNull();
    expect(normalizeHtmlToolbarItems([])).toBeNull();
  });

  it("未知 id 丢弃、重复去重", () => {
    expect(
      normalizeHtmlToolbarItems(["format-bold", "nope", "format-bold"]),
    ).toEqual(["format-bold"]);
  });
});
