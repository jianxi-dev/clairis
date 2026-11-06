import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../../stores/index";

describe("本机最近文件合并", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("打开 HTML 文件时摘要去标签，卡片不露源码", () => {
    useStore
      .getState()
      .openFile(
        "/tmp/page.html",
        "<html><body><h1>页面</h1><p>HTML 预览</p></body></html>",
      );
    const files = useStore.getState().recentFiles;
    expect(files).toHaveLength(1);
    expect(files[0].excerpt).toBe("页面 HTML 预览");
    expect(files[0].excerpt).not.toContain("<");
  });

  it("打开 markdown 时保留比较运算符，不被当标签切掉", () => {
    useStore.getState().openFile("/tmp/note.md", "# 标题\n\n1 < 2 且 3 > 2");
    expect(useStore.getState().recentFiles[0].excerpt).toContain("1 < 2");
  });

  it("mergeRecentFiles 合并去重并按 openedAt 倒序", () => {
    const store = useStore.getState();
    store.mergeRecentFiles([
      {
        path: "/a/old.md",
        title: "old.md",
        openedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        path: "/a/new.md",
        title: "new.md",
        openedAt: "2026-01-03T00:00:00.000Z",
      },
    ]);
    store.mergeRecentFiles([
      {
        path: "/a/mid.md",
        title: "mid.md",
        openedAt: "2026-01-02T00:00:00.000Z",
      },
      {
        path: "/a/new.md",
        title: "new.md",
        openedAt: "2026-01-04T00:00:00.000Z",
      },
    ]);
    expect(useStore.getState().recentFiles.map((f) => f.path)).toEqual([
      "/a/new.md",
      "/a/mid.md",
      "/a/old.md",
    ]);
  });

  it("同一 path 再次扫描时保留已有摘要", () => {
    const store = useStore.getState();
    store.openFile("/a/page.html", "<p>真实摘要</p>");
    store.mergeRecentFiles([
      {
        path: "/a/page.html",
        title: "page.html",
        openedAt: "2020-02-01T00:00:00.000Z",
      },
    ]);
    const files = useStore.getState().recentFiles;
    expect(files).toHaveLength(1);
    expect(files[0].excerpt).toBe("真实摘要");
  });

  it("扫描时间更晚时把时间推到扫描值，仍保留摘要", () => {
    useStore.setState({
      recentFiles: [
        {
          path: "/a/page.html",
          title: "page.html",
          openedAt: "2026-01-01T00:00:00.000Z",
          excerpt: "真实摘要",
        },
      ],
    });
    useStore.getState().mergeRecentFiles([
      {
        path: "/a/page.html",
        title: "page.html",
        openedAt: "2026-02-01T00:00:00.000Z",
      },
    ]);
    const files = useStore.getState().recentFiles;
    expect(files).toHaveLength(1);
    expect(files[0].excerpt).toBe("真实摘要");
    expect(files[0].openedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("合并结果最多 10 条，保留最新", () => {
    useStore.getState().mergeRecentFiles(
      Array.from({ length: 15 }, (_, i) => ({
        path: `/a/f${i}.md`,
        title: `f${i}.md`,
        openedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      })),
    );
    const files = useStore.getState().recentFiles;
    expect(files).toHaveLength(10);
    expect(files[0].path).toBe("/a/f14.md");
  });

  it("空扫描结果不改动现有列表", () => {
    const store = useStore.getState();
    store.openFile("/a/x.md", "正文");
    store.mergeRecentFiles([]);
    expect(useStore.getState().recentFiles).toHaveLength(1);
  });
});
