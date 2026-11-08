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
    const icons = labels.map(iconOf);
    expect(icons.every((name) => name.length > 0)).toBe(true);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("表格换成封口网格、CSS 与 HTML 各自成图", () => {
    expect(iconOf("表格")).toBe("TableGridOutlined");
    expect(iconOf("插入 CSS")).toBe("CssOutlined");
    expect(iconOf("插入 HTML")).toBe("CodeOutlined");
    expect(iconOf("视频/文件")).toBe("MediaFileOutlined");
  });
});
