import { describe, expect, it } from "vitest";

import { normalizeSearchPanel } from "../../lib/searchPanelConfig";

describe("搜索浮窗配置归一化", () => {
  it("缺省回落居中且无告警", () => {
    const { config, warnings } = normalizeSearchPanel(undefined);
    expect(config).toEqual({ defaultPos: "center" });
    expect(warnings).toEqual([]);
  });

  it("保留合法枚举", () => {
    for (const defaultPos of ["left", "center", "right"] as const) {
      const { config, warnings } = normalizeSearchPanel({ defaultPos });
      expect(config.defaultPos).toBe(defaultPos);
      expect(warnings).toEqual([]);
    }
  });

  it("未知枚举忽略并告警", () => {
    const { config, warnings } = normalizeSearchPanel({
      defaultPos: "top",
    });
    expect(config.defaultPos).toBe("center");
    expect(warnings).toHaveLength(1);
    expect(warnings.join("；")).toContain("搜索浮窗默认位置");
  });
});
