import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import defaultMenus from "../../../src-tauri/src/resources/menus.default.json";
import {
  getMenuItems,
  getSurfaceWarnings,
  resetSurfaces,
  setSurfaces,
} from "../../lib/dataSurfaces/store";
import { normalizeSurface, toMenuItem, type SurfacePayload } from "../../lib/dataSurfaces/loader";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  convertFileSrc: (p: string) => p,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

const HERE = dirname(fileURLToPath(import.meta.url));

function menusPayload(overrides: Partial<SurfacePayload> = {}): SurfacePayload {
  return {
    id: "menus",
    items: defaultMenus.items as SurfacePayload["items"],
    warnings: [],
    ...overrides,
  };
}

describe("菜单面（menus）", () => {
  beforeEach(() => resetSurfaces());

  it("默认态：六组分组齐全，项数与默认源一致", () => {
    setSurfaces([menusPayload()]);
    const groups = [
      "pane-header",
      "ai-pane",
      "export-submenu",
      "tab-context",
      "preview-context",
      "ai-float-presets",
    ] as const;
    const counts: Record<string, number> = {};
    for (const group of groups) {
      counts[group] = getMenuItems(group).length;
    }
    expect(counts).toEqual({
      "pane-header": 6,
      "ai-pane": 1,
      "export-submenu": 6,
      "tab-context": 12,
      "preview-context": 4,
      "ai-float-presets": 6,
    });
  });

  it("格头组顺序与文案严格等于现值（回归红线）", () => {
    setSurfaces([menusPayload()]);
    expect(getMenuItems("pane-header").map((i) => i.label)).toEqual([
      "新建文件",
      "分享",
      "右分",
      "下分",
      "源码模式",
      "定位",
    ]);
  });

  it("导出组顺序为 Word/.mdpkg/图片/PDF/HTML/ZIP", () => {
    setSurfaces([menusPayload()]);
    expect(getMenuItems("export-submenu").map((i) => i.label)).toEqual([
      "Word",
      ".mdpkg",
      "图片",
      "PDF",
      "HTML",
      "ZIP",
    ]);
  });

  it("覆盖改名生效：源码模式 → 查看源码", () => {
    const overridden = normalizeSurface(menusPayload(), [
      "pane-source",
      "pane-new-file",
    ]);
    setSurfaces([overridden]);
    const labels = getMenuItems("pane-header").map((i) => i.label);
    expect(labels).toContain("源码模式");
    expect(labels).not.toContain("查看源码");

    const renamed: SurfacePayload = {
      id: "menus",
      items: (defaultMenus.items as Record<string, unknown>[]).map((item) =>
        item.id === "pane-source" ? { ...item, label: "查看源码" } : item,
      ) as SurfacePayload["items"],
      warnings: [],
    };
    setSurfaces([renamed]);
    const next = getMenuItems("pane-header").map((i) => i.label);
    expect(next).toContain("查看源码");
    expect(next).not.toContain("源码模式");
  });

  it("停用某项后该项不出现", () => {
    const disabled: SurfacePayload = {
      id: "menus",
      items: (defaultMenus.items as Record<string, unknown>[]).map((item) =>
        item.id === "pane-source" ? { ...item, enabled: false } : item,
      ) as SurfacePayload["items"],
      warnings: [],
    };
    setSurfaces([disabled]);
    expect(getMenuItems("pane-header").map((i) => i.id)).not.toContain(
      "pane-source",
    );
    expect(getMenuItems("pane-header")).toHaveLength(5);
  });

  it("空覆盖回落完整默认集合", () => {
    const empty = normalizeSurface(menusPayload(), []);
    setSurfaces([empty]);
    expect(getMenuItems("pane-header")).toHaveLength(6);
    expect(getMenuItems("tab-context")).toHaveLength(12);
  });

  it("坏项（缺 action / 未知 group）在加载时被过滤", () => {
    const bad: SurfacePayload = {
      id: "menus",
      items: [
        ...(defaultMenus.items as Record<string, unknown>[]),
        { id: "x", group: "pane-header", order: 99, label: "X", icon: "file", enabled: true },
        { id: "y", group: "nope", order: 1, label: "Y", icon: "file", action: "a", enabled: true },
      ] as SurfacePayload["items"],
      warnings: [],
    };
    setSurfaces([bad]);
    const ids = getMenuItems("pane-header").map((i) => i.id);
    expect(ids).not.toContain("x");
    expect(ids).not.toContain("y");
    expect(ids).toHaveLength(6);
  });

  it("未知 id 覆盖被过滤并聚合一条告警", () => {
    const result = normalizeSurface(menusPayload(), [
      "pane-new-file",
      "nope",
      "pane-share",
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("nope");
    setSurfaces([result]);
    expect(getMenuItems("pane-header").map((i) => i.id)).toEqual([
      "pane-new-file",
      "pane-share",
    ]);
  });

  it("六处消费端同源：一次写入六处同时呈现", () => {
    setSurfaces([menusPayload()]);
    const total =
      getMenuItems("pane-header").length +
      getMenuItems("ai-pane").length +
      getMenuItems("export-submenu").length +
      getMenuItems("tab-context").length +
      getMenuItems("preview-context").length +
      getMenuItems("ai-float-presets").length;
    expect(total).toBe(defaultMenus.items.length);
  });

  it("AI 浮窗预设与 SPEC_PRESETS 逐值一致（对账）", () => {
    const source = readFileSync(
      resolve(HERE, "../../lib/aiViewSpec.ts"),
      "utf8",
    );
    const block = source.match(/export const SPEC_PRESETS[^=]*=\s*\[([\s\S]*?)\n\];/);
    expect(block).not.toBeNull();
    const ids = [...block![1].matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
    const labels = [...block![1].matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    setSurfaces([menusPayload()]);
    const presets = getMenuItems("ai-float-presets");
    expect(presets.map((i) => i.action.slice("preset:".length))).toEqual(ids);
    expect(presets.map((i) => i.label)).toEqual(labels);
  });

  it("告警透传", () => {
    setSurfaces([menusPayload({ warnings: ["未知菜单动作: nope"] })]);
    expect(getSurfaceWarnings("menus")).toEqual(["未知菜单动作: nope"]);
  });

  it("未加载过的分组返回空数组，不猜", () => {
    expect(getMenuItems("pane-header")).toEqual([]);
  });

  it("toMenuItem 拒绝缺字段与类型错", () => {
    expect(toMenuItem(null)).toBeNull();
    expect(toMenuItem({})).toBeNull();
    expect(
      toMenuItem({
        id: "x",
        group: "pane-header",
        order: "1",
        label: "X",
        icon: "file",
        action: "a",
        enabled: true,
      }),
    ).toBeNull();
    expect(
      toMenuItem({
        id: "x",
        group: "pane-header",
        order: 1,
        label: "X",
        icon: "file",
        action: "a",
        enabled: "true",
      }),
    ).toBeNull();
  });
});
