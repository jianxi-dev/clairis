import { describe, expect, it, vi, beforeEach } from "vitest";
import defaultSurface from "../../../src-tauri/src/resources/html-toolbar.default.json";
import {
  applySurfacePayload,
  getSurfaceItems,
  getSurfaceWarnings,
  reloadSurface,
  resetSurfaces,
  setSurfaces,
} from "../../lib/dataSurfaces/store";
import type { SurfacePayload } from "../../lib/dataSurfaces/loader";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  convertFileSrc: (p: string) => p,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

function payload(overrides: Partial<SurfacePayload> = {}): SurfacePayload {
  return {
    id: "html-toolbar",
    items: defaultSurface.items as SurfacePayload["items"],
    warnings: [],
    ...overrides,
  };
}

describe("数据面 store", () => {
  beforeEach(() => resetSurfaces());

  it("启动加载后按 id 缓存有效集合", () => {
    setSurfaces([payload()]);
    expect(getSurfaceItems("html-toolbar")).toHaveLength(12);
    expect(getSurfaceWarnings("html-toolbar")).toEqual([]);
  });

  it("未加载过的面返回空集合，不猜", () => {
    expect(getSurfaceItems("nope")).toEqual([]);
  });

  it("reloadSurface 只更新对应面", async () => {
    setSurfaces([payload()]);
    const invoke = vi.fn(async () => [
      payload({ items: payload().items.slice(0, 2) }),
    ]);
    await reloadSurface("html-toolbar", invoke);
    expect(getSurfaceItems("html-toolbar").map((i) => i.id)).toEqual([
      "ai-rewrite",
      "ai-translate",
    ]);
  });

  it("事件载荷带告警时透传", () => {
    applySurfacePayload("html-toolbar", payload({ warnings: ["未知动作: nope"] }));
    expect(getSurfaceWarnings("html-toolbar")).toEqual(["未知动作: nope"]);
  });
});
