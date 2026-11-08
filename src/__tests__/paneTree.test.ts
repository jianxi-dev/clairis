import { describe, it, expect } from "vitest";
import {
  addTab,
  clampRatio,
  containsLeaf,
  createLeaf,
  createRootLeaf,
  findLeaf,
  generateBranchId,
  generateLeafId,
  leafCount,
  leafOfTab,
  listLeaves,
  MAX_PANE_DEPTH,
  parseSerializedLayout,
  removeLeaf,
  removeTab,
  restoreLayout,
  serializeLayout,
  setBranchRatio,
  siblingLeafId,
  splitLeaf,
  type PaneLayout,
} from "../lib/paneTree";

/** 建一棵：row [ main(ratio .5) | leaf-2 ] 的树。 */
function twoLeafTree(): PaneLayout {
  return splitLeaf(createRootLeaf(), "main", "row", createLeaf("leaf-2"));
}

describe("paneTree 模型", () => {
  describe("splitLeaf", () => {
    it("新分支 ratio 0.5，原 leaf 留在 children[0]", () => {
      const root = createRootLeaf();
      const next = splitLeaf(root, "main", "row", createLeaf("leaf-2"));
      expect(next.type).toBe("node");
      if (next.type !== "node") throw new Error("expected branch");
      expect(next.dir).toBe("row");
      expect(next.ratio).toBe(0.5);
      expect(next.children[0]).toMatchObject({ type: "leaf", id: "main" });
      expect(next.children[1]).toMatchObject({ type: "leaf", id: "leaf-2" });
      // 新 leaf 是全新的，由调用方决定是否聚焦
      expect((next.children[1] as { id: string }).id).toBe("leaf-2");
    });

    it("找不到 leafId 时原样返回", () => {
      const root = createRootLeaf();
      expect(splitLeaf(root, "nope", "col", createLeaf("x"))).toBe(root);
    });

    it("嵌套分裂：可对内部 leaf 继续分裂", () => {
      const t = splitLeaf(twoLeafTree(), "leaf-2", "col", createLeaf("leaf-3"));
      expect(leafCount(t)).toBe(3);
      expect(findLeaf(t, "leaf-3")).not.toBeNull();
      expect(containsLeaf(t, "main")).toBe(true);
    });
  });

  describe("removeLeaf", () => {
    it("删内部 leaf：父分支塌缩成兄弟", () => {
      const t = twoLeafTree();
      const { root, removed } = removeLeaf(t, "leaf-2");
      expect(removed).toBe(true);
      expect(root).toMatchObject({ type: "leaf", id: "main" });
      expect(leafCount(root)).toBe(1);
    });

    it("三格嵌套：删中间 leaf 后兄弟子树提升，剩两格", () => {
      // row [ main | col [ leaf-2 | leaf-3 ] ]
      const t = splitLeaf(twoLeafTree(), "leaf-2", "col", createLeaf("leaf-3"));
      const { root, removed } = removeLeaf(t, "leaf-2");
      expect(removed).toBe(true);
      expect(leafCount(root)).toBe(2);
      // col 分支塌缩成 leaf-3，直接挂在 row 的 children[1]
      expect(root).toMatchObject({ type: "node", dir: "row" });
      if (root.type !== "node") throw new Error("expected branch");
      expect(root.children[1]).toMatchObject({ type: "leaf", id: "leaf-3" });
    });

    it("根 leaf 不可删除", () => {
      const root = createRootLeaf();
      const res = removeLeaf(root, "main");
      expect(res.removed).toBe(false);
      expect(res.root).toBe(root);
    });

    it("不存在的 leaf 不删", () => {
      const t = twoLeafTree();
      expect(removeLeaf(t, "ghost").removed).toBe(false);
    });
  });

  describe("siblingLeafId", () => {
    it("返回最近兄弟子树的第一个 leaf", () => {
      const t = splitLeaf(twoLeafTree(), "leaf-2", "col", createLeaf("leaf-3"));
      expect(siblingLeafId(t, "leaf-2")).toBe("leaf-3");
      expect(siblingLeafId(t, "leaf-3")).toBe("leaf-2");
      // 深层 leaf-2 的直接兄弟是 leaf-3（不是整棵外层兄弟）
      expect(siblingLeafId(t, "main")).toBe("leaf-2");
    });

    it("根 leaf 没有兄弟", () => {
      expect(siblingLeafId(createRootLeaf(), "main")).toBeNull();
    });
  });

  describe("clampRatio", () => {
    it("无最小值时保留边缘比例", () => {
      expect(clampRatio(0.05, 1200)).toBeCloseTo(0.05, 6);
      expect(clampRatio(0.95, 1200)).toBeCloseTo(0.95, 6);
    });
    it("容器尺寸无效 → 0.5", () => {
      expect(clampRatio(0.3, 0)).toBe(0.5);
      expect(clampRatio(0.3, Number.NaN)).toBe(0.5);
    });
    it("区间内保持原值、NaN 比例退 0.5", () => {
      expect(clampRatio(0.5, 1200)).toBe(0.5);
      expect(clampRatio(Number.NaN, 1200)).toBe(0.5);
    });
  });

  describe("setBranchRatio / addTab / removeTab / leafOfTab", () => {
    it("setBranchRatio 更新比例并保持有限性", () => {
      const t = twoLeafTree();
      const branchId = (t as { id: string }).id;
      const next = setBranchRatio(t, branchId, 0.7);
      expect(next).toMatchObject({ ratio: 0.7 });
      const bad = setBranchRatio(t, branchId, Number.NaN);
      expect(bad).toMatchObject({ ratio: 0.5 });
    });

    it("重复 branch id 时只更新第一个分支（#272）", () => {
      const branchId = "branch-dup";
      const dup: PaneLayout = {
        type: "node",
        id: branchId,
        dir: "row",
        ratio: 0.5,
        children: [
          {
            type: "node",
            id: branchId,
            dir: "col",
            ratio: 0.5,
            children: [createLeaf("a"), createLeaf("b")],
          },
          createLeaf("c"),
        ],
      };
      const next = setBranchRatio(dup, branchId, 0.8);
      expect(next.type).toBe("node");
      if (next.type !== "node") throw new Error("expected branch");
      expect(next.ratio).toBe(0.8);
      const inner = next.children[0];
      expect(inner.type).toBe("node");
      if (inner.type !== "node") throw new Error("expected inner branch");
      expect(inner.ratio).toBe(0.5);
    });

    it("addTab / removeTab 维护 activeTabId", () => {
      let t: PaneLayout = createRootLeaf();
      t = addTab(t, "main", "t1");
      t = addTab(t, "main", "t2");
      expect(findLeaf(t, "main")).toMatchObject({
        tabs: ["t1", "t2"],
        activeTabId: "t2",
      });
      t = removeTab(t, "main", "t2");
      expect(findLeaf(t, "main")).toMatchObject({
        tabs: ["t1"],
        activeTabId: "t1",
      });
    });

    it("leafOfTab 找到持有该页签的 leaf", () => {
      let t = twoLeafTree();
      t = addTab(t, "leaf-2", "tab-x");
      expect(leafOfTab(t, "tab-x")?.id).toBe("leaf-2");
      expect(leafOfTab(t, "nope")).toBeNull();
    });
  });

  describe("serialize → parse → restore 往返", () => {
    const paths: Record<string, string> = {
      t1: "/docs/a.md",
      t2: "/docs/b.md",
    };
    const pathOf = (tabId: string | null) =>
      tabId ? (paths[tabId] ?? null) : null;

    function layoutWithTabs(): PaneLayout {
      let t = twoLeafTree();
      t = addTab(t, "main", "t1");
      t = addTab(t, "leaf-2", "t2");
      return t;
    }

    it("结构 / 比例 / 活动页签严格保持", () => {
      let t = layoutWithTabs();
      t = setBranchRatio(t, (t as { id: string }).id, 0.35);
      const serialized = serializeLayout(t, "leaf-2", pathOf);
      const parsed = parseSerializedLayout(JSON.stringify(serialized));
      expect(parsed).not.toBeNull();
      if (!parsed) throw new Error("parse failed");

      const ids = new Map([
        ["/docs/a.md", "t1"],
        ["/docs/b.md", "t2"],
      ]);
      const { root, focusedId } = restoreLayout(
        parsed,
        (p) => ids.get(p) ?? null,
      );
      expect(focusedId).toBe("leaf-2");
      expect(root).toMatchObject({ type: "node", ratio: 0.35 });
      expect(findLeaf(root, "main")).toMatchObject({
        tabs: ["t1"],
        activeTabId: "t1",
      });
      expect(findLeaf(root, "leaf-2")).toMatchObject({
        tabs: ["t2"],
        activeTabId: "t2",
      });
      // 再序列化一次应逐字节一致
      expect(serializeLayout(root, focusedId, pathOf)).toEqual(serialized);
    });

    it("无 path 的页签被丢弃", () => {
      let t: PaneLayout = createRootLeaf();
      t = addTab(t, "main", "t1");
      t = addTab(t, "main", "unsaved");
      const serialized = serializeLayout(t, "main", pathOf);
      const leaf = serialized.root;
      expect(leaf).toMatchObject({ tabs: ["/docs/a.md"] });
    });

    it("undo: 文件已不在（映射失败）→ 退化为默认单格", () => {
      const t = layoutWithTabs();
      const parsed = parseSerializedLayout(
        JSON.stringify(serializeLayout(t, "main", pathOf)),
      );
      if (!parsed) throw new Error("parse failed");
      const { root } = restoreLayout(parsed, () => null);
      expect(leafCount(root)).toBe(1);
      expect(root).toMatchObject({ type: "leaf", id: "main", tabs: [] });
    });

    it("空 leaf（非根）被塌缩掉", () => {
      let t = twoLeafTree();
      t = addTab(t, "main", "t1");
      // leaf-2 无页签
      const parsed = parseSerializedLayout(
        JSON.stringify(serializeLayout(t, "main", pathOf)),
      );
      if (!parsed) throw new Error("parse failed");
      const { root } = restoreLayout(parsed, (p) =>
        p === "/docs/a.md" ? "t1" : null,
      );
      expect(leafCount(root)).toBe(1);
      expect(findLeaf(root, "main")).toMatchObject({ tabs: ["t1"] });
    });
  });

  describe("parseSerializedLayout 拒绝非法输入", () => {
    const good = () =>
      JSON.parse(
        JSON.stringify(serializeLayout(createRootLeaf(), "main", () => null)),
      );

    it("坏 JSON → null", () => {
      expect(parseSerializedLayout("{not json")).toBeNull();
      expect(parseSerializedLayout("")).toBeNull();
    });

    it("版本不符 → null", () => {
      const v = good();
      v.version = 2;
      expect(parseSerializedLayout(JSON.stringify(v))).toBeNull();
    });

    it("缺 focusedId → null", () => {
      const v = good();
      delete v.focusedId;
      expect(parseSerializedLayout(JSON.stringify(v))).toBeNull();
    });

    it("id 重复 → null", () => {
      const v = {
        version: 1,
        focusedId: "main",
        root: {
          type: "node",
          id: "b",
          dir: "row",
          ratio: 0.5,
          children: [
            {
              type: "leaf",
              id: "dup",
              tabs: [],
              activePath: null,
              editorMode: "preview",
            },
            {
              type: "leaf",
              id: "dup",
              tabs: [],
              activePath: null,
              editorMode: "preview",
            },
          ],
        },
      };
      expect(parseSerializedLayout(JSON.stringify(v))).toBeNull();
    });

    it("分支子节点不是 2 个 → null", () => {
      const v = good();
      v.root = {
        type: "node",
        id: "b",
        dir: "row",
        ratio: 0.5,
        children: [
          {
            type: "leaf",
            id: "a",
            tabs: [],
            activePath: null,
            editorMode: "preview",
          },
        ],
      };
      expect(parseSerializedLayout(JSON.stringify(v))).toBeNull();
    });

    it("ratio 非有限数 → null", () => {
      const v = good();
      v.root = {
        type: "node",
        id: "b",
        dir: "row",
        ratio: Number.NaN,
        children: [
          {
            type: "leaf",
            id: "a",
            tabs: [],
            activePath: null,
            editorMode: "preview",
          },
          {
            type: "leaf",
            id: "c",
            tabs: [],
            activePath: null,
            editorMode: "preview",
          },
        ],
      };
      // JSON.stringify 把 NaN 变 null → 同样非法
      expect(parseSerializedLayout(JSON.stringify(v))).toBeNull();
      v.root.ratio = "0.5";
      expect(parseSerializedLayout(JSON.stringify(v))).toBeNull();
    });

    it("dir 非法 → null", () => {
      const v = good();
      v.root = {
        type: "node",
        id: "b",
        dir: "diagonal",
        ratio: 0.5,
        children: [
          {
            type: "leaf",
            id: "a",
            tabs: [],
            activePath: null,
            editorMode: "preview",
          },
          {
            type: "leaf",
            id: "c",
            tabs: [],
            activePath: null,
            editorMode: "preview",
          },
        ],
      };
      expect(parseSerializedLayout(JSON.stringify(v))).toBeNull();
    });

    it("嵌套过深 → null", () => {
      let node: Record<string, unknown> = {
        type: "leaf",
        id: "deep-leaf",
        tabs: [],
        activePath: null,
        editorMode: "preview",
      };
      for (let i = 0; i < MAX_PANE_DEPTH + 2; i++) {
        node = {
          type: "node",
          id: `b-${i}`,
          dir: "row",
          ratio: 0.5,
          children: [
            {
              type: "leaf",
              id: `l-${i}`,
              tabs: [],
              activePath: null,
              editorMode: "preview",
            },
            node,
          ],
        };
      }
      const v = { version: 1, focusedId: "main", root: node };
      expect(parseSerializedLayout(JSON.stringify(v))).toBeNull();
    });
  });

  describe("listLeaves / leafCount / mapLeaves 基本不变量", () => {
    it("三格树列出全部 leaf", () => {
      const t = splitLeaf(twoLeafTree(), "leaf-2", "col", createLeaf("leaf-3"));
      const ids = listLeaves(t).map((l) => l.id);
      expect(ids).toContain("main");
      expect(ids).toContain("leaf-2");
      expect(ids).toContain("leaf-3");
      expect(leafCount(t)).toBe(3);
    });
  });

  describe("AI 停靠叶（layout-portal 9.1）", () => {
    const paths: Record<string, string> = { t1: "/docs/a.md" };
    const pathOf = (id: string | null) => (id ? (paths[id] ?? null) : null);

    function treeWithAi(): PaneLayout {
      const withTab = addTab(createRootLeaf(), "main", "t1");
      return {
        type: "node",
        id: "b-ai",
        dir: "row",
        ratio: 0.72,
        children: [
          withTab,
          {
            type: "leaf",
            id: "ai",
            tabs: [],
            activeTabId: null,
            editorMode: "preview",
            kind: "ai",
          },
        ],
      };
    }

    it("serializeLayout 为 AI 叶输出 kind:ai，普通叶不带 kind", () => {
      const s = serializeLayout(treeWithAi(), "main", pathOf);
      if (s.root.type !== "node") throw new Error("expected branch");
      expect(s.root.children[1]).toMatchObject({
        type: "leaf",
        id: "ai",
        kind: "ai",
      });
      expect((s.root.children[0] as { kind?: string }).kind).toBeUndefined();
    });

    it("空 AI 叶恢复时保留，不塌缩、不退默认单格", () => {
      const parsed = parseSerializedLayout(
        JSON.stringify(serializeLayout(treeWithAi(), "main", pathOf)),
      );
      if (!parsed) throw new Error("parse failed");
      const { root } = restoreLayout(parsed, () => null);
      expect(root).toMatchObject({ type: "leaf", id: "ai", kind: "ai" });
      expect(leafCount(root)).toBe(1);
    });

    it("整棵树只有空 AI 叶时保留该叶", () => {
      const only: unknown = {
        version: 1,
        focusedId: "ai",
        root: {
          type: "leaf",
          id: "ai",
          tabs: [],
          activePath: null,
          editorMode: "preview",
          kind: "ai",
        },
      };
      const parsed = parseSerializedLayout(JSON.stringify(only));
      if (!parsed) throw new Error("parse failed");
      const { root } = restoreLayout(parsed, () => null);
      expect(root).toMatchObject({ type: "leaf", id: "ai", kind: "ai" });
    });

    it("非法 kind 被解析拒绝", () => {
      const bad: unknown = {
        version: 1,
        focusedId: "main",
        root: {
          type: "leaf",
          id: "main",
          tabs: [],
          activePath: null,
          editorMode: "preview",
          kind: "chat",
        },
      };
      expect(parseSerializedLayout(JSON.stringify(bad))).toBeNull();
    });

    it("老配置缺 kind 仍可解析", () => {
      const old: unknown = {
        version: 1,
        focusedId: "main",
        root: {
          type: "leaf",
          id: "main",
          tabs: [],
          activePath: null,
          editorMode: "preview",
        },
      };
      expect(parseSerializedLayout(JSON.stringify(old))).not.toBeNull();
    });
    describe("id 生成（#272）", () => {
      it("branch / leaf id 每次不同且带前缀", () => {
        const b1 = generateBranchId();
        const b2 = generateBranchId();
        expect(b1).not.toBe(b2);
        expect(b1.startsWith("branch-")).toBe(true);
        expect(b2.startsWith("branch-")).toBe(true);

        const p1 = generateLeafId();
        const p2 = generateLeafId();
        expect(p1).not.toBe(p2);
        expect(p1.startsWith("pane-")).toBe(true);
        expect(p2.startsWith("pane-")).toBe(true);
        // 旧持久化 id 的形态（branch-1 / pane-1）不再产生
        expect(b1).not.toBe("branch-1");
        expect(p1).not.toBe("pane-1");
      });
    });
  });
});
