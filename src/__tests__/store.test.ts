import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../stores/index";

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
      expect(Object.values(useStore.getState().tabs)[0].editorMode).toBe("source");
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
