import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../../stores/index";

describe("场景路由与门户数据（layout-portal 2.1）", () => {
  beforeEach(() => {
    useStore.setState({
      tabs: {},
      activeTabId: null,
      recentFiles: [],
      scene: "portal",
      gridTypeFilter: null,
    });
  });

  it("默认停在门户", () => {
    expect(useStore.getState().scene).toBe("portal");
  });

  it("打开文件即离开门户并记录摘要", () => {
    useStore.getState().openFile("/lib/a.md", "# 标题\n正文内容");
    const s = useStore.getState();
    expect(s.scene).toBe("workspace");
    expect(s.recentFiles[0].path).toBe("/lib/a.md");
    expect(s.recentFiles[0].excerpt).toContain("正文内容");
  });

  it("后加的 addRecentFile 不会抹掉已有摘要", () => {
    useStore.getState().openFile("/lib/a.md", "原文摘要");
    useStore.getState().addRecentFile("/lib/a.md", "a.md");
    expect(useStore.getState().recentFiles[0].excerpt).toBe("原文摘要");
  });

  it("最近文件最多 10 条，重复打开只保留一条", () => {
    for (let i = 0; i < 12; i++) {
      useStore.getState().openFile(`/lib/${i}.md`, `内容 ${i}`);
    }
    useStore.getState().openFile("/lib/3.md", "重开");
    const list = useStore.getState().recentFiles;
    expect(list.length).toBe(10);
    expect(list.filter((f) => f.path === "/lib/3.md").length).toBe(1);
    expect(list[0].path).toBe("/lib/3.md");
  });

  it("磁贴过滤条件可设可清", () => {
    useStore.getState().setGridTypeFilter("markdown");
    useStore.getState().setScene("grid");
    expect(useStore.getState().gridTypeFilter).toBe("markdown");
    useStore.getState().setGridTypeFilter(null);
    useStore.getState().setScene("portal");
    expect(useStore.getState().gridTypeFilter).toBeNull();
    expect(useStore.getState().scene).toBe("portal");
  });
});
