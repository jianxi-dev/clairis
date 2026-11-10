import { describe, expect, it } from "vitest";
import { moveItem, reorderLeafTabs, type PaneLayout } from "../lib/paneTree";
import { PANE_MENU_ITEMS, nextPaneMode } from "../lib/paneHeaderMenu";

describe("moveItem（页签拖拽换位的纯逻辑）", () => {
  it("把元素移动到目标终态下标", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("原位返回等值副本，越界下标被钳制", () => {
    const arr = ["a", "b"];
    const same = moveItem(arr, 0, 0);
    expect(same).toEqual(arr);
    expect(same).not.toBe(arr);
    expect(moveItem(arr, 9, 0)).toEqual(arr);
    expect(moveItem(arr, 0, 9)).toEqual(["b", "a"]);
  });
});

describe("reorderLeafTabs", () => {
  const leaf: PaneLayout = {
    type: "leaf",
    id: "main",
    tabs: ["t1", "t2", "t3"],
    activeTabId: "t2",
    editorMode: "preview",
  };

  it("顺序与拖放目标严格相等且保留活动页签", () => {
    const next = reorderLeafTabs(leaf, "main", 0, 2);
    expect(next).not.toBe(leaf);
    if (next.type !== "leaf") throw new Error("应为 leaf");
    expect(next.tabs).toEqual(["t2", "t3", "t1"]);
    expect(next.activeTabId).toBe("t2");
  });

  it("原位 / 未知 leaf 返回原树引用（取消无副作用）", () => {
    expect(reorderLeafTabs(leaf, "main", 1, 1)).toBe(leaf);
    expect(reorderLeafTabs(leaf, "nope", 0, 1)).toBe(leaf);
  });
});

describe("⋯ 菜单定义", () => {
  it("恰好 8 项且顺序与名称严格相等", () => {
    expect(PANE_MENU_ITEMS.map((i) => i.label)).toEqual([
      "导出",
      "分享",
      "右分",
      "下分",
      "源码模式",
      "刷新",
      "定位",
      "打开所在文件夹",
    ]);
  });

  it("每项都带图标，且不含全屏项", () => {
    for (const item of PANE_MENU_ITEMS) {
      expect(item.icon).toBeTruthy();
    }
    expect(PANE_MENU_ITEMS.map((i) => i.label)).not.toContain("全屏");
    expect(PANE_MENU_ITEMS.map((i) => i.icon)).not.toContain("expand");
  });
});

describe("nextPaneMode（格头模式图标）", () => {
  it("只在预览↔编辑间切换", () => {
    expect(nextPaneMode("preview")).toBe("edit");
    expect(nextPaneMode("edit")).toBe("preview");
    expect(nextPaneMode("source")).toBe("preview");
  });

  it("任何输入都不会切到源码", () => {
    for (const mode of ["preview", "edit", "source"] as const) {
      expect(nextPaneMode(mode)).not.toBe("source");
    }
  });
});
