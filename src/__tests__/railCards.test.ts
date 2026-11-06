import { describe, expect, it, beforeEach } from "vitest";
import {
  CARD_MAX,
  CARD_MIN,
  CARD_RATIO_H,
  CARD_RATIO_W,
  DENSITY_HEIGHT,
  clampCardHeight,
  clearThumbCache,
  coverSrcOf,
  excerptOf,
  firstImageOf,
  mergeRecentFileList,
  metaLine,
  parentFolderNameOf,
  parentPathOf,
  plainTextOf,
  relativeDate,
  taskProgressOf,
  thumbCacheSize,
  thumbDescriptorOf,
  thumbKindOf,
  thumbnailBox,
} from "../lib/railCards";
import type { RecentFile } from "../types";

function file(
  path: string,
  excerpt?: string,
  openedAt = "2026-01-01T00:00:00.000Z",
): RecentFile {
  return {
    path,
    title: path.split("/").pop() ?? path,
    openedAt,
    excerpt,
  };
}

const NOW = Date.parse("2026-01-01T00:10:00.000Z");

beforeEach(() => clearThumbCache());

describe("railCards —— 密度与卡片高度", () => {
  it("三档高度严格为 32 / 56 / 112", () => {
    expect(DENSITY_HEIGHT).toEqual({
      compact: 32,
      comfortable: 56,
      card: 112,
    });
  });

  it("滑杆边界：87→88、161→160、NaN→112、小数取整", () => {
    expect(CARD_MIN).toBe(88);
    expect(CARD_MAX).toBe(160);
    expect(clampCardHeight(87)).toBe(88);
    expect(clampCardHeight(161)).toBe(160);
    expect(clampCardHeight(Number.NaN)).toBe(112);
    expect(clampCardHeight(120.4)).toBe(120);
    expect(clampCardHeight(120.6)).toBe(121);
    expect(clampCardHeight(88)).toBe(88);
    expect(clampCardHeight(160)).toBe(160);
  });

  it("缩略图盒严格 72×54（4:3）", () => {
    expect(thumbnailBox()).toEqual({ w: 72, h: 54 });
    expect(CARD_RATIO_W).toBe(72);
    expect(CARD_RATIO_H).toBe(54);
    expect(thumbnailBox().w / thumbnailBox().h).toBeCloseTo(4 / 3, 5);
  });
});

describe("railCards —— 路径与时间", () => {
  it("父路径去掉文件名；根目录回 /，无分隔符回空串", () => {
    expect(parentPathOf("/a/b/c.md")).toBe("/a/b");
    expect(parentPathOf("/c.md")).toBe("/");
    expect(parentPathOf("c.md")).toBe("");
    expect(parentPathOf("")).toBe("");
  });

  it("相对时间按注入的 now 计算", () => {
    expect(relativeDate("2026-01-01T00:09:30.000Z", NOW)).toBe("刚刚");
    expect(relativeDate("2026-01-01T00:00:00.000Z", NOW)).toBe("10 分钟前");
    expect(relativeDate("2025-12-31T23:10:00.000Z", NOW)).toBe("1 小时前");
    expect(relativeDate("2025-12-31T00:10:00.000Z", NOW)).toBe("昨天");
    expect(relativeDate("not-a-date", NOW)).toBe("");
  });
});

describe("railCards —— 父文件夹名", () => {
  it("只取父路径最后一段；根目录回 /，无分隔符回空串", () => {
    expect(parentFolderNameOf("/Users/x/Documents/Notes/a.md")).toBe("Notes");
    expect(parentFolderNameOf("/tmp/rc/cover.md")).toBe("rc");
    expect(parentFolderNameOf("/c.md")).toBe("/");
    expect(parentFolderNameOf("c.md")).toBe("");
    expect(parentFolderNameOf("")).toBe("");
  });
});

describe("railCards —— HTML 摘要去标签", () => {
  it("去标签、去脚本样式、解实体、压空白", () => {
    expect(
      plainTextOf("<html><body><h1>页面</h1><p>HTML 预览</p></body></html>"),
    ).toBe("页面 HTML 预览");
    expect(plainTextOf("<script>var x=1;</script><p>正文</p>")).toBe("正文");
    expect(plainTextOf("<style>.a{}</style><p>正文</p>")).toBe("正文");
    expect(plainTextOf("<!-- 注释 --><p>正文</p>")).toBe("正文");
    expect(plainTextOf("<p>a &amp; b &lt;tag&gt; &nbsp; c</p>")).toBe(
      "a & b <tag> c",
    );
    expect(plainTextOf("<p>第一</p><p>第二</p>")).toBe("第一 第二");
    // 越界 / 代理区码点不能抛错，原样保留
    expect(plainTextOf("<p>&#x110000; &#xD800; &#65;</p>")).toBe(
      "&#x110000; &#xD800; A",
    );
  });

  it("excerptOf 只对 HTML 路径去标签，markdown 保留比较运算符", () => {
    expect(excerptOf("<p>Hello <b>world</b></p>", "/a/b.html")).toBe(
      "Hello world",
    );
    expect(excerptOf("<p>Hello</p>", "/a/b.htm")).toBe("Hello");
    expect(excerptOf("# 标题\n\n1 < 2 且 3 > 2", "/a/b.md")).toBe(
      "# 标题 1 < 2 且 3 > 2",
    );
    expect(excerptOf(undefined, "/a/b.html")).toBe("");
  });

  it("excerptOf 截到 160 字", () => {
    const long = "字".repeat(300);
    expect(excerptOf(long, "/a/b.html").length).toBe(160);
  });
});

describe("railCards —— 合并最近文件", () => {
  it("按 path 去重、按 openedAt 倒序、截到 cap", () => {
    const merged = mergeRecentFileList(
      [
        {
          path: "/a/old.md",
          title: "old.md",
          openedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      [
        {
          path: "/a/new.md",
          title: "new.md",
          openedAt: "2026-01-03T00:00:00.000Z",
        },
        {
          path: "/a/mid.md",
          title: "mid.md",
          openedAt: "2026-01-02T00:00:00.000Z",
        },
        {
          path: "/a/old.md",
          title: "old.md",
          openedAt: "2025-12-31T00:00:00.000Z",
        },
      ],
      10,
    );
    expect(merged.map((f) => f.path)).toEqual([
      "/a/new.md",
      "/a/mid.md",
      "/a/old.md",
    ]);
  });

  it("同 path 保留历史摘要，只把时间推到更晚的一边", () => {
    const merged = mergeRecentFileList(
      [
        {
          path: "/a/page.html",
          title: "page.html",
          openedAt: "2026-01-01T00:00:00.000Z",
          excerpt: "真实摘要",
        },
      ],
      [
        {
          path: "/a/page.html",
          title: "page.html",
          openedAt: "2026-02-01T00:00:00.000Z",
        },
      ],
      10,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].excerpt).toBe("真实摘要");
    expect(merged[0].openedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("历史条目没有摘要时采纳扫描摘要，且不改动更晚的 openedAt", () => {
    const merged = mergeRecentFileList(
      [
        {
          path: "/a/page.html",
          title: "page.html",
          openedAt: "2026-02-01T00:00:00.000Z",
        },
      ],
      [
        {
          path: "/a/page.html",
          title: "page.html",
          openedAt: "2026-01-01T00:00:00.000Z",
          excerpt: "扫描到的正文",
        },
      ],
      10,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].excerpt).toBe("扫描到的正文");
    expect(merged[0].openedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("超过 cap 时保留最新的 cap 条", () => {
    const existing: RecentFile[] = Array.from({ length: 15 }, (_, i) => ({
      path: `/a/f${String(i).padStart(2, "0")}.md`,
      title: `f${i}.md`,
      openedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    }));
    const merged = mergeRecentFileList([], existing, 10);
    expect(merged).toHaveLength(10);
    expect(merged[0].path).toBe("/a/f14.md");
  });
});

describe("railCards —— meta 行", () => {
  it("有任务：任务进度优先，绝不出现阅读进度", () => {
    const item = file("/u/todo.md", "- [x] 完成\n- [ ] 未完成\n- [ ] 待办");
    const meta = metaLine(item, 42, NOW);
    expect(meta.kind).toBe("task");
    expect(meta.text).toBe("1/3");
    expect(meta.text).not.toContain("已读");
    expect(meta.path).toBe("/u");
    expect(meta.date).toBe("10 分钟前");
  });

  it("无任务：有阅读进度时显示已读百分比，且不含任务进度", () => {
    const item = file("/u/plain.md", "正文没有任何勾选框。");
    const meta = metaLine(item, 42, NOW);
    expect(meta.kind).toBe("read");
    expect(meta.text).toBe("已读 42%");
    expect(meta.text).not.toMatch(/\d+\/\d+/);
    expect(meta.text).not.toContain("任务");
  });

  it("无任务且无进度数据：kind=none，text 为空（不伪造 0%）", () => {
    const item = file("/u/plain.md", "正文没有任何勾选框。");
    const meta = metaLine(item, undefined, NOW);
    expect(meta).toEqual({
      kind: "none",
      text: "",
      date: "10 分钟前",
      path: "/u",
    });
  });

  it("任务语法只在确有勾选框时成立", () => {
    expect(taskProgressOf(undefined)).toBeNull();
    expect(taskProgressOf("普通段落")).toBeNull();
    expect(taskProgressOf("*- 不是任务")).toBeNull();
    expect(taskProgressOf("* [X] 大写完成\n+ [ ] 未完成")).toEqual({
      done: 1,
      total: 2,
    });
  });
});

describe("railCards —— 缩略图类型", () => {
  it("有首图 / 无首图 MD 分界清晰", () => {
    const withCover = file("/u/cover.md", "![封面](./cover.png)\n# 标题");
    const without = file("/u/no-cover.md", "# 只有文字\n\n没有图片。");
    expect(thumbKindOf(withCover)).toBe("md-cover");
    expect(coverSrcOf(withCover)).toBe("/u/cover.png");
    expect(thumbKindOf(without)).toBeNull();
    expect(coverSrcOf(without)).toBeNull();
  });

  it("六类来源各自命中，纯文本与代码无缩略图", () => {
    expect(thumbKindOf(file("/u/a.html", "<p>x</p>"))).toBe("html-page");
    expect(thumbKindOf(file("/u/a.pdf"))).toBe("pdf-page");
    expect(thumbKindOf(file("/u/a.mp4"))).toBe("video-poster");
    expect(thumbKindOf(file("/u/a.png"))).toBe("image");
    expect(thumbKindOf(file("/u/a.mp3"))).toBe("audio-wave");
    expect(thumbKindOf(file("/u/a.txt", "text"))).toBeNull();
    expect(thumbKindOf(file("/u/a.ts", "code"))).toBeNull();
  });

  it("首图解析：Markdown 优先，其次裸 img；远程 URL 不联网", () => {
    expect(firstImageOf('![a](x.png) <img src="y.png">')).toBe("x.png");
    expect(firstImageOf('<img src="y.png" />')).toBe("y.png");
    expect(firstImageOf("没有图")).toBeNull();

    const remote = file("/u/remote.md", "![a](https://example.com/a.png)");
    expect(thumbKindOf(remote)).toBeNull();
    expect(coverSrcOf(remote)).toBeNull();

    const absolute = file("/u/abs.md", "![a](/tmp/a.png)");
    expect(coverSrcOf(absolute)).toBe("/tmp/a.png");
  });

  it("描述对象按文件指纹缓存；openedAt 变化即换新对象", () => {
    const item = file("/u/a.png", undefined, "2026-01-01T00:00:00.000Z");
    const first = thumbDescriptorOf(item);
    const second = thumbDescriptorOf(item);
    expect(first).not.toBeNull();
    expect(first?.kind).toBe("image");
    expect(first?.src).toBe("/u/a.png");
    expect(second).toBe(first);
    expect(thumbCacheSize()).toBe(1);

    const changed = thumbDescriptorOf(
      file("/u/a.png", undefined, "2026-01-02T00:00:00.000Z"),
    );
    expect(changed).not.toBe(first);
    expect(thumbCacheSize()).toBe(2);
    expect(thumbDescriptorOf(file("/u/a.txt"))).toBeNull();
  });
});
