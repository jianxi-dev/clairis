import { describe, expect, it, vi, beforeEach } from "vitest";
import defaultCapsules from "../../../src-tauri/src/resources/capsules.default.json";
import {
  getCapsuleItems,
  getSurfaceWarnings,
  resetSurfaces,
  setSurfaces,
} from "../../lib/dataSurfaces/store";
import {
  normalizeSurface,
  toCapsuleItem,
  type SurfacePayload,
} from "../../lib/dataSurfaces/loader";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  convertFileSrc: (p: string) => p,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

function capsulesPayload(
  overrides: Partial<SurfacePayload> = {},
): SurfacePayload {
  return {
    id: "capsules",
    items: defaultCapsules.items as SurfacePayload["items"],
    warnings: [],
    ...overrides,
  };
}

/** 胶囊默认 12 项的顺序基准（#916 回滚目标，e2e 亦引用）。 */
const CAPSULE_DEFAULT_IDS = [
  "format-bold",
  "format-italic",
  "format-underline",
  "format-strike",
  "format-code",
  "format-link",
  "ai-rewrite",
  "ai-translate",
  "ai-polish",
  "capsule-font",
  "capsule-bg",
  "clear-format",
] as const;

describe("胶囊面（capsules）", () => {
  beforeEach(() => resetSurfaces());

  it("默认集合 12 项且顺序等于 #916 回滚基准", () => {
    const ids = (defaultCapsules.items as { id: string }[]).map((i) => i.id);
    expect(ids).toHaveLength(12);
    expect(ids).toEqual([...CAPSULE_DEFAULT_IDS]);
  });

  it("默认态：12 项，顺序与默认源一致", () => {
    setSurfaces([capsulesPayload()]);
    const items = getCapsuleItems();
    expect(items).toHaveLength(12);
    expect(items.map((i) => i.id)).toEqual([...CAPSULE_DEFAULT_IDS]);
  });

  it("覆盖只留三项：按钮集恰为这三项且顺序与面数据一致", () => {
    const overridden = normalizeSurface(capsulesPayload(), [
      "capsule-bg",
      "format-bold",
      "ai-polish",
    ]);
    setSurfaces([overridden]);
    expect(getCapsuleItems().map((i) => i.id)).toEqual([
      "capsule-bg",
      "format-bold",
      "ai-polish",
    ]);
  });

  it("改名生效：label 严格等于新名称（旧名不出现）", () => {
    const renamed: SurfacePayload = {
      id: "capsules",
      items: (defaultCapsules.items as Record<string, unknown>[]).map((item) =>
        item.id === "format-bold" ? { ...item, label: "加粗文字" } : item,
      ) as SurfacePayload["items"],
      warnings: [],
    };
    setSurfaces([renamed]);
    const bold = getCapsuleItems().find((i) => i.id === "format-bold");
    expect(bold?.label).toBe("加粗文字");
    expect(getCapsuleItems().map((i) => i.label)).not.toContain("加粗");
  });

  it("清空覆盖（取消）后回落完整默认 12 项", () => {
    const empty = normalizeSurface(capsulesPayload(), []);
    setSurfaces([empty]);
    expect(getCapsuleItems()).toHaveLength(12);
  });

  it("未知 id 覆盖被过滤并聚合一条告警，剩余项不受损", () => {
    const result = normalizeSurface(capsulesPayload(), [
      "format-bold",
      "nope",
      "format-italic",
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("nope");
    setSurfaces([result]);
    expect(getCapsuleItems().map((i) => i.id)).toEqual([
      "format-bold",
      "format-italic",
    ]);
  });

  it("坏项（缺 label / 缺 icon / 类型错）在加载时被过滤", () => {
    const bad: SurfacePayload = {
      id: "capsules",
      items: [
        ...(defaultCapsules.items as Record<string, unknown>[]),
        { id: "x", icon: "bold", order: 99 },
        { id: "y", label: "Y", order: 1 },
        { id: "z", label: "Z", icon: "bold", order: "3" },
      ] as SurfacePayload["items"],
      warnings: [],
    };
    setSurfaces([bad]);
    const ids = getCapsuleItems().map((i) => i.id);
    expect(ids).not.toContain("x");
    expect(ids).not.toContain("y");
    expect(ids).not.toContain("z");
    expect(ids).toHaveLength(12);
  });

  it("告警透传", () => {
    setSurfaces([capsulesPayload({ warnings: ["未知动作 id: nope"] })]);
    expect(getSurfaceWarnings("capsules")).toEqual(["未知动作 id: nope"]);
  });

  it("未加载过时返回空数组，不猜", () => {
    expect(getCapsuleItems()).toEqual([]);
  });

  it("toCapsuleItem 拒绝缺字段、类型错与未知 id", () => {
    expect(toCapsuleItem(null)).toBeNull();
    expect(toCapsuleItem({})).toBeNull();
    expect(
      toCapsuleItem({ id: "x", label: "X", icon: "bold", order: "1" }),
    ).toBeNull();
    expect(
      toCapsuleItem({ id: "x", label: "X", icon: "bold", order: 1 }),
    ).toBeNull();
    expect(
      toCapsuleItem({ id: "format-bold", label: "", icon: "bold", order: 1 }),
    ).toBeNull();
    expect(toCapsuleItem({ id: "format-bold", label: "X", order: 1 })).toBeNull();
  });
});
