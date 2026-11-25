import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import defaultIcons from "../../../src-tauri/src/resources/icons.default.json";
import { ICONS } from "../../ui/icons";
import {
  getIconSpec,
  resetSurfaces,
  setSurfaces,
} from "../../lib/dataSurfaces/store";
import {
  normalizeSurface,
  parseSurfaces,
  toIconSpec,
  type SurfacePayload,
} from "../../lib/dataSurfaces/loader";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  convertFileSrc: (p: string) => p,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

const HERE = dirname(fileURLToPath(import.meta.url));

function iconsPayload(overrides: Partial<SurfacePayload> = {}): SurfacePayload {
  return {
    id: "icons",
    items: defaultIcons.items as SurfacePayload["items"],
    warnings: [],
    ...overrides,
  };
}

/** 从 `src/ui/icons.ts` 解析 `ICONS` 的概念键集合（与默认 JSON 对账）。 */
function tsIconKeys(): string[] {
  const source = readFileSync(resolve(HERE, "../../ui/icons.ts"), "utf8");
  const start = source.indexOf("export const ICONS");
  const end = source.indexOf("export const ICON_NAMES");
  const block = source.slice(start, end);
  const keys: string[] = [];
  for (const line of block.split("\n")) {
    const m = line.match(/^  (?:"([^"]+)"|([A-Za-z0-9_]+)): \{$/);
    if (m) keys.push(m[1] ?? m[2]);
  }
  return keys;
}

describe("图标面（icons）", () => {
  beforeEach(() => resetSurfaces());

  it("默认集合与 src/ui/icons.ts 的 ICONS 逐键一致且每键恰一次", () => {
    const keys = (defaultIcons.items as { key: string }[]).map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(tsIconKeys().sort());
  });

  it("默认态：每个概念键可查到，label 与 ICONS 一致", () => {
    setSurfaces([iconsPayload()]);
    for (const key of tsIconKeys()) {
      const spec = getIconSpec(key);
      expect(spec, `${key} 应可查`).not.toBeNull();
      expect(spec!.label).toBe(ICONS[key as keyof typeof ICONS].label);
    }
  });

  it("覆盖改名生效：查回新 label", () => {
    const renamed: SurfacePayload = {
      id: "icons",
      items: (defaultIcons.items as Record<string, unknown>[]).map((item) =>
        item.key === "close" ? { ...item, label: "关窗" } : item,
      ) as SurfacePayload["items"],
      warnings: [],
    };
    setSurfaces([renamed]);
    expect(getIconSpec("close")?.label).toBe("关窗");
    expect(getIconSpec("markdown")?.label).toBe("Markdown");
  });

  it("覆盖替换 s 路径生效：查回新路径组", () => {
    const replaced: SurfacePayload = {
      id: "icons",
      items: (defaultIcons.items as Record<string, unknown>[]).map((item) =>
        item.key === "close" ? { ...item, s: "M1 1 L23 23" } : item,
      ) as SurfacePayload["items"],
      warnings: [],
    };
    setSurfaces([replaced]);
    expect(getIconSpec("close")?.s).toBe("M1 1 L23 23");
    expect(getIconSpec("close")?.d).toBeUndefined();
  });

  it("未知键回落：面里没有的概念键返回 null（消费端回落 ICONS）", () => {
    setSurfaces([iconsPayload()]);
    expect(getIconSpec("notAKey")).toBeNull();
  });

  it("空覆盖回落完整默认集合", () => {
    const empty = normalizeSurface(iconsPayload(), []);
    setSurfaces([empty]);
    expect(getIconSpec("close")).not.toBeNull();
    expect(getIconSpec("markdown")).not.toBeNull();
  });

  it("坏项（缺 path 组）在加载时被过滤", () => {
    const bad: SurfacePayload = {
      id: "icons",
      items: [
        ...(defaultIcons.items as Record<string, unknown>[]),
        { key: "x", label: "X" },
      ] as SurfacePayload["items"],
      warnings: [],
    };
    setSurfaces([bad]);
    expect(getIconSpec("x")).toBeNull();
    expect(getIconSpec("close")).not.toBeNull();
  });

  it("未加载过返回 null，不猜", () => {
    expect(getIconSpec("close")).toBeNull();
  });

  it("toIconSpec 拒绝缺字段与类型错", () => {
    expect(toIconSpec(null)).toBeNull();
    expect(toIconSpec({})).toBeNull();
    expect(toIconSpec({ key: "x", label: "X" })).toBeNull();
    expect(toIconSpec({ key: "x", label: "X", s: "" })).toBeNull();
    expect(toIconSpec({ key: "x", label: "X", s: 1 })).toBeNull();
    expect(toIconSpec({ key: "x", label: "X", parts: "no" })).toBeNull();
    expect(toIconSpec({ key: "x", label: "X", parts: [{ d: "" }] })).toBeNull();
    expect(toIconSpec({ key: "x", label: "X", s: "M0 0" })).toEqual({
      key: "x",
      label: "X",
      s: "M0 0",
    });
  });

  it("parseSurfaces 把 icons 面解析成 IconSpec", () => {
    const parsed = parseSurfaces([
      { id: "icons", items: defaultIcons.items, warnings: [] },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("icons");
    expect(parsed[0].items.length).toBe(defaultIcons.items.length);
    expect((parsed[0].items[0] as { key: string }).key).toBe("markdown");
  });
});
