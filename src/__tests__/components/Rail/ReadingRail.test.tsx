import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup, fireEvent } from "@testing-library/react";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (path: string) =>
    `asset://localhost/${encodeURIComponent(path)}`,
}));

import ReadingRail from "../../../components/Rail/ReadingRail";
import { useStore } from "../../../stores";
import type { SearchHit } from "../../../types";

function mockRect(el: HTMLElement, rect: Partial<DOMRect>): void {
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    }) as DOMRect;
}

function seed(count: number) {
  act(() => {
    useStore.getState().setRailState("pinned");
    for (let i = 0; i < count; i += 1) {
      useStore.getState().addRecentFile(`/tmp/rr${i}.md`, `文件${i}`);
    }
  });
}

function fireMove(el: HTMLElement, x: number, y: number) {
  act(() => {
    el.dispatchEvent(
      new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }),
    );
  });
}

beforeEach(() => {
  useStore.getState().reset();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ReadingRail 触发区", () => {
  it("左半区不打开；右半区 250ms 打开", () => {
    seed(3);
    render(<ReadingRail onOpenPath={async () => {}} />);
    const row = document.querySelector<HTMLElement>(
      '[data-testid="rail-item"]',
    );
    expect(row).not.toBeNull();
    mockRect(row!, { left: 0, top: 0, width: 240, height: 32 });

    fireMove(row!, 50, 16);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(useStore.getState().preview).toBeNull();

    fireMove(row!, 200, 16);
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(useStore.getState().preview).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useStore.getState().preview).not.toBeNull();
  });

  it("右半区打开后，移到左半区关闭（未钉住）", () => {
    seed(3);
    render(<ReadingRail onOpenPath={async () => {}} />);
    const row = document.querySelector<HTMLElement>(
      '[data-testid="rail-item"]',
    );
    mockRect(row!, { left: 0, top: 0, width: 240, height: 32 });

    fireMove(row!, 200, 16);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(useStore.getState().preview).not.toBeNull();

    fireMove(row!, 50, 16);
    expect(useStore.getState().preview).toBeNull();
  });

  it("钉住后移到左半区不关闭", () => {
    seed(3);
    render(<ReadingRail onOpenPath={async () => {}} />);
    const row = document.querySelector<HTMLElement>(
      '[data-testid="rail-item"]',
    );
    mockRect(row!, { left: 0, top: 0, width: 240, height: 32 });

    fireMove(row!, 200, 16);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(useStore.getState().preview).not.toBeNull();

    act(() => {
      useStore.getState().togglePreviewPin();
    });
    fireMove(row!, 50, 16);
    expect(useStore.getState().preview).not.toBeNull();
  });
});

describe("ReadingRail 列表回顶", () => {
  it("切换密度后滚动位置回到顶部", () => {
    seed(10);
    render(<ReadingRail onOpenPath={async () => {}} />);
    const scroll = document.querySelector<HTMLElement>(
      '[data-testid="rail-scroll"]',
    );
    expect(scroll).not.toBeNull();
    act(() => {
      scroll!.scrollTop = 200;
    });
    expect(scroll!.scrollTop).toBe(200);

    act(() => {
      useStore.getState().setRailDensity("compact");
    });
    expect(scroll!.scrollTop).toBe(0);
  });

  it("切换布局后滚动位置回到顶部", () => {
    seed(10);
    render(<ReadingRail onOpenPath={async () => {}} />);
    const scroll = document.querySelector<HTMLElement>(
      '[data-testid="rail-scroll"]',
    );
    act(() => {
      scroll!.scrollTop = 150;
    });
    act(() => {
      useStore.getState().setRailLayout("tabs");
    });
    expect(scroll!.scrollTop).toBe(0);
  });

  it("切换筛选 chip 后滚动位置回到顶部", () => {
    seed(10);
    render(<ReadingRail onOpenPath={async () => {}} />);
    act(() => {
      useStore.getState().setRailSection("category");
    });
    const scroll = document.querySelector<HTMLElement>(
      '[data-testid="rail-scroll"]',
    );
    act(() => {
      scroll!.scrollTop = 120;
    });
    act(() => {
      useStore.getState().setRailChip("markdown");
    });
    expect(scroll!.scrollTop).toBe(0);
  });
});

const SEARCH_HITS: SearchHit[] = [
  {
    path: "/tmp/Documents/架构笔记.md",
    title: "架构笔记",
    openedAt: new Date().toISOString(),
    excerpt: "…正文片段包含关键词…",
    matchedIn: "content",
  },
  {
    path: "/tmp/Documents/会议纪要.md",
    title: "会议纪要",
    openedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    excerpt: "关键词出现在这里。",
    matchedIn: "content",
  },
  {
    path: "/tmp/Desktop/页面.html",
    title: "页面",
    openedAt: new Date().toISOString(),
    excerpt: "HTML 里的关键词。",
    matchedIn: "content",
  },
];

function mockSearch(hits: SearchHit[] = SEARCH_HITS) {
  invokeMock.mockImplementation((cmd: string) =>
    cmd === "search_documents" ? Promise.resolve(hits) : Promise.resolve(null),
  );
}

function runSearch(query: string) {
  act(() => {
    useStore.getState().setRailQuery(query);
  });
  act(() => {
    vi.advanceTimersByTime(300);
  });
}

async function flushSearch() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function searchRows(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-testid="rail-search-results"] [data-testid="rail-item"]',
    ),
  );
}

describe("ReadingRail 本机检索", () => {
  it("去抖 300ms 后才调用，命中片段渲染高亮", async () => {
    mockSearch();
    seed(0);
    render(<ReadingRail onOpenPath={async () => {}} />);

    act(() => {
      useStore.getState().setRailQuery("关键词");
    });
    expect(invokeMock).not.toHaveBeenCalledWith(
      "search_documents",
      expect.anything(),
    );
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(invokeMock).not.toHaveBeenCalledWith(
      "search_documents",
      expect.anything(),
    );
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(invokeMock).toHaveBeenCalledWith("search_documents", {
      query: "关键词",
      limit: 30,
    });
    await flushSearch();

    const marks = document.querySelectorAll(
      '[data-testid="rail-search-results"] [data-testid="rail-hit"]',
    );
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent).toBe("关键词");
  });

  it("类型筛选只保留该类型条目", async () => {
    mockSearch();
    seed(0);
    render(<ReadingRail onOpenPath={async () => {}} />);
    runSearch("关键词");
    await flushSearch();
    expect(searchRows()).toHaveLength(3);

    const chip = document.querySelector<HTMLElement>(
      '[data-testid="rail-search-results"] [data-testid="rail-chip"][data-chip="markdown"]',
    );
    expect(chip).not.toBeNull();
    act(() => {
      fireEvent.click(chip!);
    });

    const rows = searchRows();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.getAttribute("data-kind")).toBe("markdown");
    }
  });

  it("时间筛选：今天只保留今日条目", async () => {
    mockSearch();
    seed(0);
    render(<ReadingRail onOpenPath={async () => {}} />);
    runSearch("关键词");
    await flushSearch();

    const today = document.querySelector<HTMLElement>(
      '[data-testid="rail-search-results"] [data-testid="rail-search-time"][data-time="today"]',
    );
    expect(today).not.toBeNull();
    act(() => {
      fireEvent.click(today!);
    });

    const paths = searchRows().map((r) => r.getAttribute("data-rail-path"));
    expect(paths).toContain("/tmp/Documents/架构笔记.md");
    expect(paths).toContain("/tmp/Desktop/页面.html");
    expect(paths).not.toContain("/tmp/Documents/会议纪要.md");
  });

  it("无命中时显示空态", async () => {
    mockSearch([]);
    seed(0);
    render(<ReadingRail onOpenPath={async () => {}} />);
    runSearch("关键词");
    await flushSearch();

    expect(
      document.querySelector('[data-testid="rail-search-empty"]'),
    ).not.toBeNull();
    expect(searchRows()).toHaveLength(0);
  });
});
