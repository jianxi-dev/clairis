import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../../stores/index";

describe("sidebar state", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("left sidebar visible by default, right hidden", () => {
    const s = useStore.getState();
    expect(s.sidebarLeftVisible).toBe(true);
    expect(s.sidebarRightVisible).toBe(false);
  });

  it("toggleLeftSidebar flips visibility", () => {
    useStore.getState().toggleLeftSidebar();
    expect(useStore.getState().sidebarLeftVisible).toBe(false);
    useStore.getState().toggleLeftSidebar();
    expect(useStore.getState().sidebarLeftVisible).toBe(true);
  });

  it("toggleRightSidebar flips visibility", () => {
    useStore.getState().toggleRightSidebar();
    expect(useStore.getState().sidebarRightVisible).toBe(true);
    useStore.getState().toggleRightSidebar();
    expect(useStore.getState().sidebarRightVisible).toBe(false);
  });

  it("addRecentFile adds file and deduplicates", () => {
    useStore.getState().addRecentFile("/a/test.md", "test.md");
    useStore.getState().addRecentFile("/a/test.md", "test.md");
    useStore.getState().addRecentFile("/b/other.md", "other.md");
    const files = useStore.getState().recentFiles;
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("/b/other.md"); // most recent first
  });

  it("clearRecentFiles empties list", () => {
    useStore.getState().addRecentFile("/a/test.md", "test.md");
    useStore.getState().clearRecentFiles();
    expect(useStore.getState().recentFiles).toHaveLength(0);
  });

  it("recent files capped at 10", () => {
    for (let i = 0; i < 15; i++) {
      useStore.getState().addRecentFile(`/path/${i}.md`, `${i}.md`);
    }
    expect(useStore.getState().recentFiles).toHaveLength(10);
  });
});
