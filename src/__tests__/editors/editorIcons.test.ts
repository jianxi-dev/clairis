import { describe, expect, it } from "vitest";
import { defaultCommands } from "../../editors/slash";

describe("编辑器插入菜单图标（#367）", () => {
  const iconOf = (label: string) =>
    defaultCommands.find((c) => c.label === label)?.icon ?? "";

  it("同族图标两两不同", () => {
    const labels = [
      "分栏",
      "表格",
      "数据看板",
      "插入 HTML",
      "插入 CSS",
      "流程图",
      "视频/文件",
      "内嵌网页",
    ];
    const icons = labels.map(iconOf).filter((name) => name.length > 0);
    expect(icons.length).toBeGreaterThan(0);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("表格换成封口网格、CSS 补图标、视频换摄像机", () => {
    expect(iconOf("表格")).toBe("TableGridOutlined");
    expect(iconOf("插入 CSS")).toBe("CssOutlined");
    expect(iconOf("插入 HTML")).toBe("CodeOutlined");
    expect(iconOf("视频/文件")).toBe("VideoOutlined");
    const columns = defaultCommands.find((c) => c.label === "分栏");
    expect(columns?.children?.every((c) => c.icon === "ColumnsOutlined")).toBe(
      true,
    );
  });
});
