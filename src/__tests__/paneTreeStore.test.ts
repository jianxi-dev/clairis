import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../stores/index";
import { findLeaf, leafCount, listLeaves } from "../lib/paneTree";

function tabIdByPath(path: string): string {
  const tab = Object.values(useStore.getState().tabs).find(
    (t) => t.path === path,
  );
  if (!tab) throw new Error(`no tab for ${path}`);
  return tab.id;
}

describe("pane 递归树 store（layout-portal 3.1）", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("openFile 落进聚焦格", () => {
    useStore.getState().openFile("/a.md", "a");
    const s = useStore.getState();
    const leaf = findLeaf(s.paneRoot, "main");
    expect(leaf?.tabs).toEqual([tabIdByPath("/a.md")]);
    expect(s.focusedPaneId).toBe("main");
  });

  it("两次分裂得到 3 格，新格获得焦点", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().splitPane("row");
    const afterFirst = useStore.getState().focusedPaneId;
    expect(leafCount(useStore.getState().paneRoot)).toBe(2);
    expect(afterFirst).not.toBe("main");

    useStore.getState().splitPane("col");
    const s = useStore.getState();
    expect(leafCount(s.paneRoot)).toBe(3);
    expect(s.focusedPaneId).not.toBe("main");
    expect(s.focusedPaneId).not.toBe(afterFirst);
  });

  it("moveTabToPane 把页签搬到新格，源格保留剩余页签", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().openFile("/b.md", "b");
    const aId = tabIdByPath("/a.md");
    useStore.getState().splitPane("row");
    const targetId = useStore.getState().focusedPaneId;

    useStore.getState().moveTabToPane(aId, targetId);

    const s = useStore.getState();
    expect(findLeaf(s.paneRoot, "main")?.tabs).not.toContain(aId);
    expect(findLeaf(s.paneRoot, "main")?.tabs).toContain(tabIdByPath("/b.md"));
    expect(findLeaf(s.paneRoot, targetId)?.tabs).toContain(aId);
    expect(s.focusedPaneId).toBe(targetId);
    expect(s.scene).toBe("workspace");
    // 源格搬空后仍保留（分屏持久）
    expect(leafCount(s.paneRoot)).toBe(2);
  });

  it("新页签落进聚焦格（不是根格）", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().splitPane("row");
    const focused = useStore.getState().focusedPaneId;
    useStore.getState().openFile("/b.md", "b");
    const s = useStore.getState();
    expect(findLeaf(s.paneRoot, focused)?.tabs).toEqual([tabIdByPath("/b.md")]);
    expect(findLeaf(s.paneRoot, "main")?.tabs).toEqual([tabIdByPath("/a.md")]);
  });

  it("关掉非根格最后一签：删格，兄弟扩展，焦点回到兄弟", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().splitPane("row");
    useStore.getState().openFile("/b.md", "b");
    const bId = tabIdByPath("/b.md");

    useStore.getState().closeTab(bId);
    const s = useStore.getState();
    expect(leafCount(s.paneRoot)).toBe(1);
    expect(s.paneRoot).toMatchObject({ type: "leaf", id: "main" });
    expect(s.focusedPaneId).toBe("main");
    // 兄弟扩展后仍持有原页签
    expect(findLeaf(s.paneRoot, "main")?.tabs).toEqual([tabIdByPath("/a.md")]);
    // 被删格的页签从全局记录移除
    expect(s.tabs[bId]).toBeUndefined();
  });

  it("closePane 删除整格并连带关掉它的页签", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().splitPane("row");
    const leafId = useStore.getState().focusedPaneId;
    useStore.getState().openFile("/b.md", "b");
    const bId = tabIdByPath("/b.md");

    useStore.getState().closePane(leafId);
    const s = useStore.getState();
    expect(leafCount(s.paneRoot)).toBe(1);
    expect(s.tabs[bId]).toBeUndefined();
    expect(s.focusedPaneId).toBe("main");
  });

  it("根 leaf 不能被 closePane 删除", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().closePane("main");
    expect(leafCount(useStore.getState().paneRoot)).toBe(1);
  });

  it("全屏状态可切换", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().toggleFullscreenPane();
    expect(useStore.getState().fullscreenPaneId).toBe("main");
    useStore.getState().toggleFullscreenPane();
    expect(useStore.getState().fullscreenPaneId).toBeNull();
  });

  it("扁平 activeTabId 镜像聚焦格；switchTab 会切换聚焦格", () => {
    useStore.getState().openFile("/a.md", "a");
    const aId = tabIdByPath("/a.md");
    useStore.getState().openFile("/b.md", "b");

    useStore.getState().splitPane("row");
    // 新格为空 → 扁平 activeTabId 为 null
    expect(useStore.getState().activeTabId).toBeNull();
    expect(useStore.getState().focusedPaneId).not.toBe("main");

    useStore.getState().openFile("/c.md", "c");
    const cId = tabIdByPath("/c.md");
    expect(useStore.getState().activeTabId).toBe(cId);

    // 切到根格的 a → 聚焦格跟随
    useStore.getState().switchTab(aId);
    expect(useStore.getState().focusedPaneId).toBe("main");
    expect(useStore.getState().activeTabId).toBe(aId);
  });

  it("setPaneRatio / restorePaneLayout / collapsePanes", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().splitPane("row");
    const branchId = (useStore.getState().paneRoot as { id: string }).id;
    useStore.getState().setPaneRatio(branchId, 0.3);
    expect(useStore.getState().paneRoot).toMatchObject({ ratio: 0.3 });

    // collapse 回单格，保留全部页签
    useStore.getState().splitPane("col");
    useStore.getState().openFile("/b.md", "b");
    useStore.getState().collapsePanes();
    const s = useStore.getState();
    expect(s.paneRoot).toMatchObject({ type: "leaf", id: "main" });
    expect((s.paneRoot as { tabs: string[] }).tabs.length).toBe(2);

    // restore 覆盖布局
    useStore.getState().restorePaneLayout(
      {
        type: "node",
        id: "branch-restore",
        dir: "col",
        ratio: 0.25,
        children: [
          {
            type: "leaf",
            id: "main",
            tabs: [tabIdByPath("/a.md")],
            activeTabId: tabIdByPath("/a.md"),
            editorMode: "preview",
          },
          {
            type: "leaf",
            id: "pane-r",
            tabs: [tabIdByPath("/b.md")],
            activeTabId: tabIdByPath("/b.md"),
            editorMode: "edit",
          },
        ],
      },
      "pane-r",
    );
    const r = useStore.getState();
    expect(leafCount(r.paneRoot)).toBe(2);
    expect(r.focusedPaneId).toBe("pane-r");
    expect(r.activeTabId).toBe(tabIdByPath("/b.md"));
  });

  it("paneLayoutJson 用文件路径序列化，丢弃未保存页签", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().newTab(); // path=null
    const json = useStore.getState().paneLayoutJson();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.root.tabs).toEqual(["/a.md"]);
  });

  it("每个页签只属于一个 leaf", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().openFile("/b.md", "b");
    useStore.getState().splitPane("row");
    useStore.getState().openFile("/c.md", "c");

    const leaves = listLeaves(useStore.getState().paneRoot);
    const seen = new Set<string>();
    for (const leaf of leaves) {
      for (const id of leaf.tabs) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
    expect(seen.size).toBe(Object.keys(useStore.getState().tabs).length);
  });

  it("splitPaneWithTab 把页签搬进新格，原格不再保留（#272）", () => {
    useStore.getState().openFile("/a.md", "a");
    useStore.getState().openFile("/b.md", "b");
    const aId = tabIdByPath("/a.md");
    const bId = tabIdByPath("/b.md");

    useStore.getState().splitPaneWithTab("row", aId);

    const s = useStore.getState();
    expect(leafCount(s.paneRoot)).toBe(2);
    expect(findLeaf(s.paneRoot, "main")?.tabs).toEqual([bId]);
    const newLeaf = findLeaf(s.paneRoot, s.focusedPaneId);
    expect(newLeaf?.tabs).toEqual([aId]);
    expect(s.activeTabId).toBe(aId);
  });

  it("dropFileOnPane：文件已在目标格时不复制栏目（#272）", () => {
    useStore.getState().openFile("/a.md", "a");
    const aId = tabIdByPath("/a.md");
    const before = leafCount(useStore.getState().paneRoot);

    useStore.getState().dropFileOnPane("/a.md", "a2", "main", "right");

    const s = useStore.getState();
    expect(leafCount(s.paneRoot)).toBe(before);
    expect(findLeaf(s.paneRoot, "main")?.tabs).toEqual([aId]);
    expect(s.tabs[aId]?.content).toBe("a2");
    expect(s.focusedPaneId).toBe("main");
  });

  it("dropFileOnPane：文件在别的格时搬入新格并塌缩空源格（#272）", () => {
    useStore.getState().openFile("/b.md", "b");
    const bId = tabIdByPath("/b.md");
    useStore.getState().splitPane("row");
    const targetId = useStore.getState().focusedPaneId;
    useStore.getState().openFile("/c.md", "c");
    expect(leafCount(useStore.getState().paneRoot)).toBe(2);

    useStore.getState().dropFileOnPane("/b.md", "b2", targetId, "right");

    const s = useStore.getState();
    // 源格 main 被搬空并塌缩（-1），目标右侧新增一格（+1）→ 总数不变
    expect(leafCount(s.paneRoot)).toBe(2);
    expect(findLeaf(s.paneRoot, "main")).toBeNull();
    const leaves = listLeaves(s.paneRoot);
    const holder = leaves.find((leaf) => leaf.tabs.includes(bId));
    expect(holder).toBeTruthy();
    expect(holder?.tabs).toEqual([bId]);
    expect(s.tabs[bId]?.content).toBe("b2");
  });

  it("恢复旧布局后新建分栏的 id 不与持久化 id 撞车（#272）", () => {
    useStore.getState().openFile("/a.md", "a");
    const aId = tabIdByPath("/a.md");
    useStore.getState().restorePaneLayout(
      {
        type: "node",
        id: "branch-1",
        dir: "row",
        ratio: 0.5,
        children: [
          {
            type: "leaf",
            id: "pane-1",
            tabs: [aId],
            activeTabId: aId,
            editorMode: "preview",
          },
          {
            type: "leaf",
            id: "main",
            tabs: [],
            activeTabId: null,
            editorMode: "preview",
          },
        ],
      },
      "pane-1",
    );

    useStore.getState().splitPane("row");

    const collect = (node: unknown, out: string[]): void => {
      const n = node as { type: string; id: string; children?: unknown[] };
      out.push(n.id);
      if (n.type === "node" && n.children) {
        collect(n.children[0], out);
        collect(n.children[1], out);
      }
    };
    const ids: string[] = [];
    collect(useStore.getState().paneRoot, ids);
    // 全部 id 唯一
    expect(new Set(ids).size).toBe(ids.length);
    // 旧持久化 id 仍在，新 id 不与它们相等
    expect(ids).toContain("branch-1");
    expect(ids).toContain("pane-1");
    expect(ids.filter((id) => id.startsWith("branch-")).length).toBe(2);
  });
});
