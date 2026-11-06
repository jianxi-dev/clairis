import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import ReadingRail from "../../../components/Rail/ReadingRail";
import { useStore } from "../../../stores";

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
