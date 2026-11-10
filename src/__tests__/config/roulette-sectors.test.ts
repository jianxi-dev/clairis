import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  convertFileSrc: (p: string) => p,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

import { normalizeRouletteSectors } from "../../hooks/useConfig";

describe("轮盘扇区归一化", () => {
  it("缺省与空数组回落 null", () => {
    expect(normalizeRouletteSectors(null)).toBeNull();
    expect(normalizeRouletteSectors(undefined)).toBeNull();
    expect(normalizeRouletteSectors([])).toBeNull();
  });

  it("保留合法顺序", () => {
    expect(normalizeRouletteSectors(["format", "smart"])).toEqual([
      "format",
      "smart",
    ]);
  });

  it("未知 id 丢弃", () => {
    expect(normalizeRouletteSectors(["format", "nope"])).toEqual(["format"]);
  });

  it("重复 id 去重保留首个", () => {
    expect(normalizeRouletteSectors(["smart", "format", "smart"])).toEqual([
      "smart",
      "format",
    ]);
  });

  it("全为未知 id 时回落 null", () => {
    expect(normalizeRouletteSectors(["a", "b"])).toBeNull();
  });
});
