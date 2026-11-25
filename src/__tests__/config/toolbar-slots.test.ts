import { describe, expect, it, vi } from "vitest";
import defaultSurface from "../../../src-tauri/src/resources/html-toolbar.default.json";
import {
  normalizeSurface,
  type SurfacePayload,
} from "../../lib/dataSurfaces/loader";
import type { ToolbarSlotItem } from "../../editors/orchestration/slots";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  convertFileSrc: (p: string) => p,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

/** 默认面 payload：与 Rust `load_surfaces` 返回形状一致。 */
function defaultPayload(): SurfacePayload {
  return {
    id: "html-toolbar",
    items: defaultSurface.items as ToolbarSlotItem[],
    warnings: [],
  };
}

describe("数据面归一化（html-toolbar）", () => {
  it("默认态：无覆盖即返回内嵌默认全集", () => {
    const result = normalizeSurface(defaultPayload(), null);
    expect(result.items.map((i) => (i as ToolbarSlotItem).id)).toEqual([
      "ai-rewrite",
      "ai-translate",
      "ai-polish",
      "format-bold",
      "format-italic",
      "format-underline",
      "format-strike",
      "format-code",
      "format-link",
      "align-left",
      "align-center",
      "align-right",
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("覆盖态：保留覆盖顺序并过滤未知 id，聚合一条告警", () => {
    const result = normalizeSurface(defaultPayload(), [
      "format-bold",
      "nope",
      "format-italic",
    ]);
    expect(result.items.map((i) => (i as ToolbarSlotItem).id)).toEqual([
      "format-bold",
      "format-italic",
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("nope");
  });

  it("空覆盖 / 全非法覆盖回落默认", () => {
    const defaults = defaultPayload().items.length;
    expect(normalizeSurface(defaultPayload(), []).items).toHaveLength(defaults);
    const allBad = normalizeSurface(defaultPayload(), ["a", "b"]);
    expect(allBad.items).toHaveLength(defaults);
    expect(allBad.warnings).toHaveLength(1);
  });

  it("重复 id 去重保留首个", () => {
    const result = normalizeSurface(defaultPayload(), [
      "format-bold",
      "ai-polish",
      "format-bold",
    ]);
    expect(result.items.map((i) => (i as ToolbarSlotItem).id)).toEqual(["format-bold", "ai-polish"]);
  });
});

describe("默认文件 ↔ TS 类型对账", () => {
  it("默认文件项数形状与 ToolbarSlotItem 对齐", () => {
    const items = defaultSurface.items as ToolbarSlotItem[];
    // 12 = 回归红线：默认集合项数契约（与 Rust 校验上限一致）
    expect(items).toHaveLength(12);
    for (const item of items) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.label).toBe("string");
      expect(typeof item.icon).toBe("string");
      expect(["ai", "format", "align"]).toContain(item.group);
    }
  });

  it("默认文件 id 集合与既有内置顺序一致（回归红线）", () => {
    expect(
      (defaultSurface.items as ToolbarSlotItem[]).map((i) => i.id),
    ).toEqual([
      "ai-rewrite",
      "ai-translate",
      "ai-polish",
      "format-bold",
      "format-italic",
      "format-underline",
      "format-strike",
      "format-code",
      "format-link",
      "align-left",
      "align-center",
      "align-right",
    ]);
  });
});
