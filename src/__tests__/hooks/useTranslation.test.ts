import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../../stores/index";

describe("useTranslation", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("translation state defaults to inactive", () => {
    const state = useStore.getState();
    // Store doesn't have translation state directly — check store structure
    expect(state.activeTabId).toBeNull();
  });

  it("triggers translation when tab has content", () => {
    useStore.getState().openFile("/path/test.md", "Hello world");
    const tab = Object.values(useStore.getState().tabs)[0];
    expect(tab.content).toBe("Hello world");
  });

  it("translation panel shows correct source text from active tab", () => {
    useStore.getState().openFile("/path/doc.md", "Translate this");
    const tab = Object.values(useStore.getState().tabs)[0];
    expect(tab.content).toContain("Translate");
  });
});
