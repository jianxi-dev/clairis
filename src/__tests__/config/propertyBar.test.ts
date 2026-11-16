import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
  convertFileSrc: (p: string) => p,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

import { normalizePropertyBar } from "../../lib/propertyBarConfig";
import { applyPropertyBarConfig } from "../../hooks/useConfig";
import { useDocPropertyPanelStore } from "../../stores/docPropertyPanel";

describe("文档属性面板配置归一化", () => {
  it("缺省回落默认值且无告警", () => {
    const { config, warnings } = normalizePropertyBar(undefined);
    expect(config).toEqual({
      displayStyle: "list",
      displayDefault: { preview: "show", edit: "show" },
      newDocVisible: true,
    });
    expect(warnings).toEqual([]);
  });

  it("保留合法枚举", () => {
    const { config, warnings } = normalizePropertyBar({
      displayStyle: "dual",
      displayDefault: { preview: "collapse", edit: "hide" },
      newDocVisible: false,
    });
    expect(config.displayStyle).toBe("dual");
    expect(config.displayDefault).toEqual({
      preview: "collapse",
      edit: "hide",
    });
    expect(config.newDocVisible).toBe(false);
    expect(warnings).toEqual([]);
  });

  it("未知枚举忽略并聚合告警", () => {
    const { config, warnings } = normalizePropertyBar({
      displayStyle: "stacked",
      displayDefault: { preview: "fold", edit: "show" },
      newDocVisible: true,
    });
    expect(config.displayStyle).toBe("list");
    expect(config.displayDefault.preview).toBe("show");
    expect(config.displayDefault.edit).toBe("show");
    expect(warnings).toHaveLength(2);
    const aggregated = warnings.join("；");
    expect(aggregated).toContain("显示样式");
    expect(aggregated).toContain("预览默认显隐");
  });

  it("非布尔 newDocVisible 回落默认", () => {
    const { config } = normalizePropertyBar({
      displayStyle: "list",
      displayDefault: { preview: "show", edit: "show" },
      newDocVisible: "yes" as unknown as boolean,
    });
    expect(config.newDocVisible).toBe(true);
  });
});

describe("文档属性面板样式桥接", () => {
  beforeEach(() => {
    useDocPropertyPanelStore.getState().setVariant("A");
  });

  it("dual 立即切到 B，list 切回 A", () => {
    applyPropertyBarConfig({
      displayStyle: "dual",
      displayDefault: { preview: "show", edit: "show" },
      newDocVisible: true,
    });
    expect(useDocPropertyPanelStore.getState().variant).toBe("B");

    applyPropertyBarConfig({
      displayStyle: "list",
      displayDefault: { preview: "show", edit: "show" },
      newDocVisible: true,
    });
    expect(useDocPropertyPanelStore.getState().variant).toBe("A");
  });
});
