import { describe, it, expect } from "vitest";
import {
  fileDropIntent,
  hitTestPane,
  hitTestWindowEdge,
  resolvePaneDrop,
} from "../lib/paneDrop";
import {
  createLeaf,
  createRootLeaf,
  moveLeaf,
  moveLeafToRoot,
  setBranchRatio,
  splitLeaf,
  splitLeafSide,
  swapLeaves,
  updateLeaf,
  type PaneLayout,
} from "../lib/paneTree";

/** 只看结构：剥掉随机生成的 branch id，留 dir/ratio 与 leaf 自带的页签状态。 */
function shape(n: PaneLayout): unknown {
  if (n.type === "leaf") {
    return { leaf: n.tabs, active: n.activeTabId, mode: n.editorMode };
  }
  return {
    dir: n.dir,
    ratio: n.ratio,
    children: [shape(n.children[0]), shape(n.children[1])],
  };
}

/**
 * row.5[ main(a,edit) | col.5[ leaf-2(b) | leaf-3(c,source) ] ]
 * 三格、两层：够测「中间塌缩 + 侧插」。
 */
function nested(): PaneLayout {
  let t: PaneLayout = updateLeaf(createRootLeaf(), "main", {
    tabs: ["a"],
    activeTabId: "a",
    editorMode: "edit",
  });
  t = splitLeaf(t, "main", "row", createLeaf("leaf-2"));
  t = updateLeaf(t, "leaf-2", { tabs: ["b"], activeTabId: "b" });
  t = splitLeaf(t, "leaf-2", "col", createLeaf("leaf-3"));
  t = updateLeaf(t, "leaf-3", {
    tabs: ["c"],
    activeTabId: "c",
    editorMode: "source",
  });
  return t;
}

describe("hitTestPane", () => {
  const rect = { x: 0, y: 0, width: 100, height: 100 };

  it("中心 50% 命中 center", () => {
    expect(hitTestPane({ x: 50, y: 50 }, rect)).toBe("center");
    expect(hitTestPane({ x: 30, y: 70 }, rect)).toBe("center");
  });

  it("各边 25% 带命中对应边", () => {
    expect(hitTestPane({ x: 5, y: 50 }, rect)).toBe("left");
    expect(hitTestPane({ x: 95, y: 50 }, rect)).toBe("right");
    expect(hitTestPane({ x: 50, y: 5 }, rect)).toBe("top");
    expect(hitTestPane({ x: 50, y: 95 }, rect)).toBe("bottom");
  });

  it("角上取归一化最近边，同距按 左→右→上→下", () => {
    expect(hitTestPane({ x: 5, y: 5 }, rect)).toBe("left");
    expect(hitTestPane({ x: 95, y: 5 }, rect)).toBe("right");
    expect(hitTestPane({ x: 5, y: 95 }, rect)).toBe("left");
    expect(hitTestPane({ x: 95, y: 95 }, rect)).toBe("right");
    // 非对称：更贴近顶边就取 top（同列宽度归一后比较）
    expect(hitTestPane({ x: 5, y: 2 }, rect)).toBe("top");
  });

  it("矩形外返回 null；退化尺寸返回 null", () => {
    expect(hitTestPane({ x: 150, y: 50 }, rect)).toBe(null);
    expect(hitTestPane({ x: -1, y: 50 }, rect)).toBe(null);
    expect(
      hitTestPane({ x: 5, y: 5 }, { x: 0, y: 0, width: 0, height: 100 }),
    ).toBe(null);
  });

  it("centerRatio 可调：收窄中心带把原本的中心判成边", () => {
    expect(hitTestPane({ x: 30, y: 50 }, rect)).toBe("center");
    expect(hitTestPane({ x: 30, y: 50 }, rect, { centerRatio: 0.2 })).toBe(
      "left",
    );
  });

  it("偏移矩形用相对坐标判定", () => {
    const off = { x: 200, y: 100, width: 100, height: 100 };
    expect(hitTestPane({ x: 205, y: 150 }, off)).toBe("left");
    expect(hitTestPane({ x: 250, y: 150 }, off)).toBe("center");
    expect(hitTestPane({ x: 100, y: 150 }, off)).toBe(null);
  });
});

describe("hitTestWindowEdge", () => {
  const viewport = { width: 1000, height: 800 };

  it("四边 24px 内命中对应根层落区", () => {
    expect(hitTestWindowEdge({ x: 10, y: 400 }, viewport)).toBe("root-left");
    expect(hitTestWindowEdge({ x: 990, y: 400 }, viewport)).toBe("root-right");
    expect(hitTestWindowEdge({ x: 500, y: 10 }, viewport)).toBe("root-top");
    expect(hitTestWindowEdge({ x: 500, y: 790 }, viewport)).toBe("root-bottom");
  });

  it("中央返回 null", () => {
    expect(hitTestWindowEdge({ x: 500, y: 400 }, viewport)).toBe(null);
  });

  it("角上取像素最近边，同距按 左→右→上→下", () => {
    expect(hitTestWindowEdge({ x: 10, y: 10 }, viewport)).toBe("root-left");
    expect(hitTestWindowEdge({ x: 990, y: 10 }, viewport)).toBe("root-right");
    // 距底边 5px < 距左边 10px → 取底边
    expect(hitTestWindowEdge({ x: 10, y: 795 }, viewport)).toBe("root-bottom");
  });

  it("边带宽可调", () => {
    expect(hitTestWindowEdge({ x: 30, y: 400 }, viewport)).toBe(null);
    expect(hitTestWindowEdge({ x: 30, y: 400 }, viewport, 40)).toBe(
      "root-left",
    );
  });
});

describe("resolvePaneDrop", () => {
  it("中心=互换（不同格）", () => {
    expect(resolvePaneDrop("a", "b", "center")).toEqual({ kind: "swap" });
  });

  it("四边=移动到目标该侧", () => {
    expect(resolvePaneDrop("a", "b", "left")).toEqual({
      kind: "move",
      dir: "row",
      side: "left",
    });
    expect(resolvePaneDrop("a", "b", "right")).toEqual({
      kind: "move",
      dir: "row",
      side: "right",
    });
    expect(resolvePaneDrop("a", "b", "top")).toEqual({
      kind: "move",
      dir: "col",
      side: "top",
    });
    expect(resolvePaneDrop("a", "b", "bottom")).toEqual({
      kind: "move",
      dir: "col",
      side: "bottom",
    });
  });

  it("窗口边=提根层", () => {
    expect(resolvePaneDrop("a", "b", "root-left")).toEqual({
      kind: "root",
      side: "left",
    });
    expect(resolvePaneDrop("a", "b", "root-bottom")).toEqual({
      kind: "root",
      side: "bottom",
    });
  });

  it("空落区、拖到自身都无意图", () => {
    expect(resolvePaneDrop("a", "b", null)).toBe(null);
    expect(resolvePaneDrop("a", "a", "center")).toBe(null);
    expect(resolvePaneDrop("a", "a", "left")).toBe(null);
  });
});

describe("fileDropIntent", () => {
  it("四向=在该侧分裂，center 视为 right", () => {
    expect(fileDropIntent("center")).toEqual({
      kind: "split",
      dir: "row",
      side: "right",
    });
    expect(fileDropIntent("right")).toEqual({
      kind: "split",
      dir: "row",
      side: "right",
    });
    expect(fileDropIntent("left")).toEqual({
      kind: "split",
      dir: "row",
      side: "left",
    });
    expect(fileDropIntent("top")).toEqual({
      kind: "split",
      dir: "col",
      side: "top",
    });
    expect(fileDropIntent("bottom")).toEqual({
      kind: "split",
      dir: "col",
      side: "bottom",
    });
  });

  it("空落区无意图", () => {
    expect(fileDropIntent(null)).toBe(null);
  });
});

describe("swapLeaves", () => {
  it("互换位置：页签/activeTabId/模式随 leaf 搬走，结构与 ratio 不变", () => {
    const before = nested();
    const after = swapLeaves(before, "main", "leaf-3");
    expect(shape(after)).toEqual({
      dir: "row",
      ratio: 0.5,
      children: [
        { leaf: ["c"], active: "c", mode: "source" },
        {
          dir: "col",
          ratio: 0.5,
          children: [
            { leaf: ["b"], active: "b", mode: "preview" },
            { leaf: ["a"], active: "a", mode: "edit" },
          ],
        },
      ],
    });
  });

  it("ratio 锚在结构位置，不随 leaf 走", () => {
    let t: PaneLayout = splitLeaf(
      createRootLeaf(),
      "main",
      "row",
      createLeaf("leaf-2"),
    );
    t = setBranchRatio(t, t.type === "node" ? t.id : "", 0.3);
    const after = swapLeaves(t, "main", "leaf-2");
    expect(after.type).toBe("node");
    if (after.type !== "node") throw new Error("expected branch");
    expect(after.ratio).toBe(0.3);
    expect(after.children[0]).toMatchObject({ type: "leaf", id: "leaf-2" });
    expect(after.children[1]).toMatchObject({ type: "leaf", id: "main" });
  });

  it("同 id 或缺失 id 原样返回同一引用", () => {
    const t = nested();
    expect(swapLeaves(t, "main", "main")).toBe(t);
    expect(swapLeaves(t, "main", "nope")).toBe(t);
    expect(swapLeaves(t, "nope", "main")).toBe(t);
  });
});

describe("moveLeaf", () => {
  it("三格：源从原位置塌缩摘除，作为目标右侧兄弟重插", () => {
    const after = moveLeaf(nested(), "leaf-2", "main", "right");
    expect(shape(after)).toEqual({
      dir: "row",
      ratio: 0.5,
      children: [
        {
          dir: "row",
          ratio: 0.5,
          children: [
            { leaf: ["a"], active: "a", mode: "edit" },
            { leaf: ["b"], active: "b", mode: "preview" },
          ],
        },
        { leaf: ["c"], active: "c", mode: "source" },
      ],
    });
  });

  it("各 side 决定新格在目标的哪一侧", () => {
    const base = splitLeaf(
      createRootLeaf(),
      "main",
      "row",
      createLeaf("leaf-2"),
    );

    const left = moveLeaf(base, "leaf-2", "main", "left");
    if (left.type !== "node") throw new Error("expected branch");
    expect(left.dir).toBe("row");
    expect((left.children[0] as { id: string }).id).toBe("leaf-2");
    expect((left.children[1] as { id: string }).id).toBe("main");

    const top = moveLeaf(base, "leaf-2", "main", "top");
    if (top.type !== "node") throw new Error("expected branch");
    expect(top.dir).toBe("col");
    expect((top.children[0] as { id: string }).id).toBe("leaf-2");

    const bottom = moveLeaf(base, "leaf-2", "main", "bottom");
    if (bottom.type !== "node") throw new Error("expected branch");
    expect((bottom.children[0] as { id: string }).id).toBe("main");
    expect((bottom.children[1] as { id: string }).id).toBe("leaf-2");
  });

  it("同 id / 缺失 id 原样返回同一引用", () => {
    const t = nested();
    expect(moveLeaf(t, "main", "main", "right")).toBe(t);
    expect(moveLeaf(t, "main", "nope", "right")).toBe(t);
    expect(moveLeaf(t, "nope", "main", "right")).toBe(t);
  });
});

describe("moveLeafToRoot", () => {
  it("源成为根层独立格：新根把整棵剩余树与源并排", () => {
    const after = moveLeafToRoot(nested(), "leaf-3", "right");
    expect(shape(after)).toEqual({
      dir: "row",
      ratio: 0.5,
      children: [
        {
          dir: "row",
          ratio: 0.5,
          children: [
            { leaf: ["a"], active: "a", mode: "edit" },
            { leaf: ["b"], active: "b", mode: "preview" },
          ],
        },
        { leaf: ["c"], active: "c", mode: "source" },
      ],
    });
  });

  it("根就是单个 leaf / 缺失 id 原样返回同一引用", () => {
    const root = createRootLeaf();
    expect(moveLeafToRoot(root, "main", "right")).toBe(root);
    const t = nested();
    expect(moveLeafToRoot(t, "nope", "right")).toBe(t);
  });
});

describe("splitLeafSide", () => {
  it("left/top 把新格放在目标前，right/bottom 放在后", () => {
    const root = createRootLeaf();
    const left = splitLeafSide(root, "main", "left", createLeaf("leaf-x"));
    if (left.type !== "node") throw new Error("expected branch");
    expect(left.dir).toBe("row");
    expect((left.children[0] as { id: string }).id).toBe("leaf-x");

    const top = splitLeafSide(root, "main", "top", createLeaf("leaf-x"));
    if (top.type !== "node") throw new Error("expected branch");
    expect(top.dir).toBe("col");
    expect((top.children[0] as { id: string }).id).toBe("leaf-x");

    const right = splitLeafSide(root, "main", "right", createLeaf("leaf-x"));
    if (right.type !== "node") throw new Error("expected branch");
    expect((right.children[1] as { id: string }).id).toBe("leaf-x");
  });

  it("目标不存在原样返回同一引用", () => {
    const root = createRootLeaf();
    expect(splitLeafSide(root, "nope", "right", createLeaf("leaf-x"))).toBe(
      root,
    );
  });
});
