import { describe, expect, it } from "vitest";
import { autoLayoutPanes } from "../lib/paneAutoLayout";
import type { PaneLayout, PaneLeaf } from "../lib/paneTree";
import { listLeaves } from "../lib/paneTree";

function leaf(id: string): PaneLeaf {
  return {
    type: "leaf",
    id,
    tabs: [`tab-${id}`],
    activeTabId: `tab-${id}`,
    editorMode: "preview",
  };
}

function tree(ids: string[]): PaneLayout {
  const leaves = ids.map(leaf);
  return leaves.reduce(
    (acc, cur) =>
      acc
        ? {
            type: "node" as const,
            id: `b-${Math.random().toString(36).slice(2, 8)}`,
            dir: "col" as const,
            ratio: 0.5,
            children: [acc, cur] as [PaneLayout, PaneLayout],
          }
        : cur,
    undefined as unknown as PaneLayout,
  );
}

const shape = (node: PaneLayout): unknown =>
  node.type === "leaf"
    ? node.id
    : {
        dir: node.dir,
        ratio: node.ratio,
        children: node.children.map(shape),
      };

const noMedia = () => false;

describe("autoLayoutPanes", () => {
  it("单栏保持原树", () => {
    const root = leaf("main");
    expect(autoLayoutPanes({ root, isMedia: noMedia })).toBe(root);
  });

  it("两栏左右均分", () => {
    const next = autoLayoutPanes({ root: tree(["a", "b"]), isMedia: noMedia });
    expect(shape(next)).toEqual({
      dir: "row",
      ratio: 0.5,
      children: ["a", "b"],
    });
  });

  it("两栏里媒体占 62%", () => {
    const next = autoLayoutPanes({
      root: tree(["doc", "media"]),
      isMedia: (l) => l.id === "media",
    });
    expect(shape(next)).toEqual({
      dir: "row",
      ratio: 0.62,
      children: ["media", "doc"],
    });
  });

  it("三栏为左主栏 + 右侧上下", () => {
    const next = autoLayoutPanes({
      root: tree(["a", "b", "c"]),
      isMedia: noMedia,
    });
    expect(shape(next)).toEqual({
      dir: "row",
      ratio: 0.5,
      children: ["a", { dir: "col", ratio: 0.5, children: ["b", "c"] }],
    });
  });

  it("四栏为 2×2", () => {
    const next = autoLayoutPanes({
      root: tree(["a", "b", "c", "d"]),
      isMedia: noMedia,
    });
    expect(shape(next)).toEqual({
      dir: "row",
      ratio: 0.5,
      children: [
        { dir: "col", ratio: 0.5, children: ["a", "b"] },
        { dir: "col", ratio: 0.5, children: ["c", "d"] },
      ],
    });
  });

  it("页签归属、选中态与编辑模式原样保留", () => {
    const root = tree(["a", "b", "c"]);
    const next = autoLayoutPanes({ root, isMedia: noMedia });
    const before = listLeaves(root);
    const after = listLeaves(next);
    expect(after.map((l) => l.id).sort()).toEqual(
      before.map((l) => l.id).sort(),
    );
    for (const l of after) {
      const src = before.find((b) => b.id === l.id)!;
      expect(l.tabs).toEqual(src.tabs);
      expect(l.activeTabId).toBe(src.activeTabId);
      expect(l.editorMode).toBe(src.editorMode);
    }
  });
});
