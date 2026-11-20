import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../stores/index";
import { parseFrontmatter } from "../lib/frontmatter";

describe("multi-tab store", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  describe("initial state", () => {
    it("starts with no tabs", () => {
      const state = useStore.getState();
      expect(state.tabs).toEqual({});
      expect(state.activeTabId).toBeNull();
      expect(state.sidebarLeftVisible).toBe(true);
      expect(state.sidebarRightVisible).toBe(false);
    });
  });

  describe("openFile", () => {
    it("creates a tab for .md file", () => {
      useStore.getState().openFile("/path/test.md", "# Hello");
      const state = useStore.getState();
      const tabIds = Object.keys(state.tabs);
      expect(tabIds).toHaveLength(1);

      const tab = state.tabs[tabIds[0]];
      expect(tab.title).toBe("test.md");
      expect(tab.path).toBe("/path/test.md");
      expect(tab.fileKind).toBe("markdown");
      expect(tab.content).toBe("# Hello");
      expect(tab.dirty).toBe(false);
      expect(tab.editorMode).toBe("preview");
      expect(state.activeTabId).toBe(tab.id);
    });

    it("creates a tab for .html file", () => {
      useStore.getState().openFile("/path/page.html", "<h1>Hi</h1>");
      const state = useStore.getState();
      const tab = Object.values(state.tabs)[0];
      expect(tab.fileKind).toBe("html");
    });

    it("creates a tab for .txt file", () => {
      useStore.getState().openFile("/path/notes.txt", "plain text");
      const tab = Object.values(useStore.getState().tabs)[0];
      expect(tab.fileKind).toBe("text");
    });

    it("multiple openFile creates multiple tabs", () => {
      useStore.getState().openFile("/path/a.md", "a");
      useStore.getState().openFile("/path/b.md", "b");
      const state = useStore.getState();
      expect(Object.keys(state.tabs)).toHaveLength(2);
    });

    it("opens same file path increments but does not duplicate", () => {
      useStore.getState().openFile("/path/a.md", "a");
      useStore.getState().openFile("/path/a.md", "b");
      const state = useStore.getState();
      expect(Object.keys(state.tabs)).toHaveLength(1);
      const tab = Object.values(state.tabs)[0];
      expect(tab.content).toBe("b");
    });
  });

  describe("switchTab", () => {
    it("switches active tab", () => {
      useStore.getState().openFile("/path/a.md", "a");
      useStore.getState().openFile("/path/b.md", "b");
      const tabIds = Object.keys(useStore.getState().tabs);
      const firstId = tabIds[0];

      useStore.getState().switchTab(firstId);
      expect(useStore.getState().activeTabId).toBe(firstId);
    });
  });

  describe("closeTab", () => {
    it("closes a tab and switches to another", () => {
      useStore.getState().openFile("/path/a.md", "a");
      useStore.getState().openFile("/path/b.md", "b");
      const tabIds = Object.keys(useStore.getState().tabs);

      useStore.getState().closeTab(tabIds[0]);
      const state = useStore.getState();
      expect(state.tabs[tabIds[0]]).toBeUndefined();
      expect(Object.keys(state.tabs)).toHaveLength(1);
    });

    it("closing last tab sets activeTabId to null", () => {
      useStore.getState().openFile("/path/a.md", "a");
      const id = Object.keys(useStore.getState().tabs)[0];
      useStore.getState().closeTab(id);
      expect(useStore.getState().activeTabId).toBeNull();
    });
  });

  describe("updateContent", () => {
    it("updates content and marks dirty", () => {
      useStore.getState().openFile("/path/a.md", "hello");
      const tab = Object.values(useStore.getState().tabs)[0];
      useStore.getState().updateContent("hello world");
      const updated = Object.values(useStore.getState().tabs)[0];
      expect(updated.content).toBe("hello world");
      expect(updated.dirty).toBe(true);
    });
  });

  describe("setEditorMode", () => {
    it("changes current tab editor mode", () => {
      useStore.getState().openFile("/path/a.md", "content");
      useStore.getState().setEditorMode("edit");
      const tab = Object.values(useStore.getState().tabs)[0];
      expect(tab.editorMode).toBe("edit");

      useStore.getState().setEditorMode("source");
      expect(Object.values(useStore.getState().tabs)[0].editorMode).toBe(
        "source",
      );
    });
  });

  describe("split panel", () => {
    beforeEach(() => {
      useStore.getState().reset();
    });

    describe("splitTab", () => {
      it("splits a tab into horizontal split panel", () => {
        useStore.getState().openFile("/path/a.md", "a");
        useStore.getState().openFile("/path/b.md", "b");
        const ids = Object.keys(useStore.getState().tabs);
        const targetId = ids[0];

        useStore.getState().splitTab(targetId, "horizontal");

        const state = useStore.getState();
        expect(state.splitDirection).toBe("horizontal");
        expect(state.splitTabIds).toContain(targetId);
        expect(state.splitActiveTabId).toBe(targetId);
        // Active tab should switch to remaining tab
        expect(state.activeTabId).not.toBe(targetId);
        expect(state.activeTabId).toBe(ids[1]);
      });

      it("splits the only tab sets activeTabId to null", () => {
        useStore.getState().openFile("/path/a.md", "a");
        const id = Object.keys(useStore.getState().tabs)[0];

        useStore.getState().splitTab(id, "vertical");

        const state = useStore.getState();
        expect(state.splitDirection).toBe("vertical");
        expect(state.splitActiveTabId).toBe(id);
        expect(state.activeTabId).toBeNull();
      });

      it("splitting a tab already in split panel keeps it in split", () => {
        useStore.getState().openFile("/path/a.md", "a");
        useStore.getState().openFile("/path/b.md", "b");
        const ids = Object.keys(useStore.getState().tabs);
        useStore.getState().splitTab(ids[0], "horizontal");

        // Split the same tab again — should stay in split, change direction
        useStore.getState().splitTab(ids[0], "vertical");
        const state = useStore.getState();
        expect(state.splitDirection).toBe("vertical");
        expect(state.splitTabIds).toContain(ids[0]);
      });
    });

    describe("unsplit", () => {
      it("clears split state", () => {
        useStore.getState().openFile("/path/a.md", "a");
        useStore.getState().openFile("/path/b.md", "b");
        const ids = Object.keys(useStore.getState().tabs);
        useStore.getState().splitTab(ids[0], "horizontal");

        useStore.getState().unsplit();

        const state = useStore.getState();
        expect(state.splitDirection).toBeNull();
        expect(state.splitTabIds).toEqual([]);
        expect(state.splitActiveTabId).toBeNull();
      });

      it("preserves horizontalSplitRatio after unsplit", () => {
        useStore.getState().openFile("/path/a.md", "a");
        useStore.getState().openFile("/path/b.md", "b");
        const ids = Object.keys(useStore.getState().tabs);
        useStore.getState().splitTab(ids[0], "horizontal");
        useStore.getState().setSplitRatio("horizontal", 0.7);

        useStore.getState().unsplit();

        // Ratio should persist for next horizontal split
        expect(useStore.getState().horizontalSplitRatio).toBe(0.7);
      });
    });

    describe("closeTab with split", () => {
      it("closing a tab in split panel removes it from splitTabIds", () => {
        useStore.getState().openFile("/path/a.md", "a");
        useStore.getState().openFile("/path/b.md", "b");
        const ids = Object.keys(useStore.getState().tabs);
        useStore.getState().splitTab(ids[0], "horizontal");

        // Close the split tab
        useStore.getState().closeTab(ids[0]);

        const state = useStore.getState();
        expect(state.tabs[ids[0]]).toBeUndefined();
        // splitTabIds still has the dead reference (cleaned up by ContentSplitView)
        expect(state.splitTabIds).toContain(ids[0]);
      });
    });

    describe("moveTabToSplit / moveTabToMain", () => {
      it("moves a tab to split panel", () => {
        useStore.getState().openFile("/path/a.md", "a");
        useStore.getState().openFile("/path/b.md", "b");
        const ids = Object.keys(useStore.getState().tabs);
        useStore.getState().splitTab(ids[0], "horizontal");

        useStore.getState().moveTabToSplit(ids[1]);

        const state = useStore.getState();
        expect(state.splitTabIds).toContain(ids[1]);
        expect(state.splitActiveTabId).toBe(ids[1]);
      });

      it("moves a tab from split back to main", () => {
        useStore.getState().openFile("/path/a.md", "a");
        useStore.getState().openFile("/path/b.md", "b");
        const ids = Object.keys(useStore.getState().tabs);
        useStore.getState().splitTab(ids[0], "horizontal");

        useStore.getState().moveTabToMain(ids[0]);

        const state = useStore.getState();
        expect(state.splitTabIds).not.toContain(ids[0]);
        expect(state.activeTabId).toBe(ids[0]);
      });
    });
  });

  describe("split ratios", () => {
    beforeEach(() => {
      useStore.getState().reset();
    });

    it("defaults to 0.5 for both directions", () => {
      const state = useStore.getState();
      expect(state.horizontalSplitRatio).toBe(0.5);
      expect(state.verticalSplitRatio).toBe(0.5);
    });

    it("setSplitRatio clamps to [0.1, 0.9]", () => {
      useStore.getState().setSplitRatio("horizontal", 0.05);
      expect(useStore.getState().horizontalSplitRatio).toBe(0.1);

      useStore.getState().setSplitRatio("horizontal", 0.95);
      expect(useStore.getState().horizontalSplitRatio).toBe(0.9);

      useStore.getState().setSplitRatio("vertical", 0.3);
      expect(useStore.getState().verticalSplitRatio).toBe(0.3);
    });

    it("setSplitRatios updates multiple directions at once", () => {
      useStore.getState().setSplitRatios({ horizontal: 0.7, vertical: 0.3 });
      const state = useStore.getState();
      expect(state.horizontalSplitRatio).toBe(0.7);
      expect(state.verticalSplitRatio).toBe(0.3);
    });

    it("setSplitRatios ignores undefined values", () => {
      useStore.getState().setSplitRatio("horizontal", 0.7);
      useStore.getState().setSplitRatios({ vertical: 0.3 });
      const state = useStore.getState();
      expect(state.horizontalSplitRatio).toBe(0.7); // unchanged
      expect(state.verticalSplitRatio).toBe(0.3);
    });
  });
});

describe("新建默认与标题联动（P-7）", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("新建空文档写入标题占位 + 创建 / 修改日期", () => {
    useStore.getState().newTab();
    const tab = Object.values(useStore.getState().tabs)[0];
    expect(tab.path).toBeNull();
    const parsed = parseFrontmatter(tab.content);
    expect(parsed.present).toBe(true);
    expect(parsed.fields.map((f) => f.key)).toEqual([
      "title",
      "created",
      "updated",
    ]);
    expect(parsed.fields[0].value).toBe("");
  });

  it("新建时传入正文不覆盖", () => {
    useStore.getState().newTabWith("笔记", "# 正文");
    const tab = Object.values(useStore.getState().tabs)[0];
    expect(tab.content).toBe("# 正文");
  });

  it("打开既有文档不补写 frontmatter", () => {
    useStore.getState().openFile("/x.md", "# 只有正文");
    const tab = Object.values(useStore.getState().tabs)[0];
    expect(tab.content).toBe("# 只有正文");
  });

  it("页签重命名回写 frontmatter 标题；无 frontmatter 不写", () => {
    useStore.getState().newTab();
    const id = Object.keys(useStore.getState().tabs)[0];
    useStore.getState().renameTab(id, "会议纪要");
    const tab = useStore.getState().tabs[id];
    expect(tab.title).toBe("会议纪要");
    expect(parseFrontmatter(tab.content).fields[0].value).toBe("会议纪要");
    expect(tab.dirty).toBe(true);

    useStore.getState().openFile("/y.md", "# 无 frontmatter\n");
    const other = Object.values(useStore.getState().tabs).find(
      (t) => t.path === "/y.md",
    )!;
    useStore.getState().renameTab(other.id, "改名");
    const tab2 = useStore.getState().tabs[other.id];
    expect(tab2.title).toBe("改名");
    expect(tab2.content).toBe("# 无 frontmatter\n");
  });

  it("页签重命名保留扩展名，frontmatter 标题只写主名（#1263）", () => {
    useStore.getState().openFile("/n.md", "---\ntitle: 旧\n---\n");
    const id = Object.keys(useStore.getState().tabs)[0];
    useStore.getState().renameTab(id, "新名.md");
    const tab = useStore.getState().tabs[id];
    expect(tab.title).toBe("新名.md");
    expect(parseFrontmatter(tab.content).fields[0].value).toBe("新名");
    expect(tab.path).toBe("/n.md");
  });

  it("页签重命名回写别称标题键（标题）", () => {
    useStore.getState().openFile("/z.md", "---\n标题: 旧名\n---\n");
    const id = Object.keys(useStore.getState().tabs)[0];
    useStore.getState().renameTab(id, "新名");
    const tab = useStore.getState().tabs[id];
    expect(tab.title).toBe("新名");
    expect(tab.content).toContain("新名");
  });

  it("setTabTitle 只改页签，不动内容", () => {
    useStore.getState().newTab();
    const id = Object.keys(useStore.getState().tabs)[0];
    const before = useStore.getState().tabs[id].content;
    useStore.getState().setTabTitle(id, "新页签名");
    expect(useStore.getState().tabs[id].title).toBe("新页签名");
    expect(useStore.getState().tabs[id].content).toBe(before);
  });
});
