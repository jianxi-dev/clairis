import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../stores/index";

describe("reading store — scrollPositions & immersive", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("openFile 初始化 scrollPos/contentHeight 为 0", () => {
    useStore.getState().openFile("/tmp/a.md", "# hi");
    const { tabs, activeTabId } = useStore.getState();
    const tab = activeTabId ? tabs[activeTabId] : null;
    expect(tab?.scrollPos).toBe(0);
    expect(tab?.contentHeight).toBe(0);
  });

  it("updateScrollPos 写入 tab 字段与 scrollPositions 缓存", () => {
    useStore.getState().openFile("/tmp/a.md", "# hi");
    const tabId = useStore.getState().activeTabId!;
    useStore.getState().updateScrollPos(tabId, 428, 2124);

    const { tabs, scrollPositions } = useStore.getState();
    expect(tabs[tabId]?.scrollPos).toBe(428);
    expect(tabs[tabId]?.contentHeight).toBe(2124);
    expect(scrollPositions["/tmp/a.md"]).toEqual({
      scrollPos: 428,
      contentHeight: 2124,
    });
  });

  it("无路径 tab 只写 tab 字段，不写 scrollPositions", () => {
    useStore.getState().newTab();
    const tabId = useStore.getState().activeTabId!;
    useStore.getState().updateScrollPos(tabId, 10, 100);
    expect(Object.keys(useStore.getState().scrollPositions)).toHaveLength(0);
    expect(useStore.getState().tabs[tabId]?.scrollPos).toBe(10);
  });

  it("setScrollPositions 恢复配置加载的缓存", () => {
    useStore.getState().setScrollPositions({
      "/tmp/a.md": { scrollPos: 88, contentHeight: 999 },
    });
    expect(useStore.getState().scrollPositions["/tmp/a.md"]).toEqual({
      scrollPos: 88,
      contentHeight: 999,
    });
  });

  it("setReadingMode 复位 immersiveChromeVisible", () => {
    useStore.getState().setReadingMode(true);
    useStore.getState().setImmersiveChromeVisible(true);
    expect(useStore.getState().immersiveChromeVisible).toBe(true);

    useStore.getState().setReadingMode(false);
    expect(useStore.getState().immersiveChromeVisible).toBe(false);
  });

  it("closeTab 保留 scrollPositions 缓存（关闭后再开可恢复）", () => {
    useStore.getState().openFile("/tmp/a.md", "# hi");
    const tabId = useStore.getState().activeTabId!;
    useStore.getState().updateScrollPos(tabId, 300, 1500);
    useStore.getState().closeTab(tabId);

    expect(useStore.getState().tabs[tabId]).toBeUndefined();
    expect(useStore.getState().scrollPositions["/tmp/a.md"]).toEqual({
      scrollPos: 300,
      contentHeight: 1500,
    });
  });
});
