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
      expect(state.sidebarOpen).toBe(true);
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
});
