import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import FloatingPreview from "../../../components/Preview/FloatingPreview";
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

function openPreview(path: string, source: "rail" | "grid" = "rail") {
  act(() => {
    useStore.getState().openPreview({
      path,
      title: path.split("/").pop() ?? path,
      x: 300,
      y: 100,
      w: 320,
      h: 240,
      flippedX: false,
      flippedY: false,
      source,
    });
  });
}

function movePointer(x: number, y: number) {
  act(() => {
    window.dispatchEvent(
      new MouseEvent("pointermove", {
        clientX: x,
        clientY: y,
        bubbles: true,
      }),
    );
  });
}

function previewEl(): HTMLElement {
  const el = document.querySelector<HTMLElement>(
    '[data-testid="floating-preview"]',
  );
  if (!el) throw new Error("预览窗未渲染");
  return el;
}

beforeEach(() => {
  useStore.getState().reset();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  document.querySelectorAll(".rail-root").forEach((el) => el.remove());
  vi.useRealTimers();
});

describe("FloatingPreview 离窗关闭（rail 源）", () => {
  it("指针离开预览窗与 rail 后 180ms 关闭；179ms 内保持", () => {
    openPreview("/tmp/a.md");
    render(<FloatingPreview onOpenPath={async () => {}} />);
    mockRect(previewEl(), { left: 300, top: 100, width: 320, height: 240 });

    movePointer(50, 50);
    expect(useStore.getState().preview).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(179);
    });
    expect(useStore.getState().preview).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useStore.getState().preview).toBeNull();
  });

  it("指针回到 rail 内不关闭", () => {
    openPreview("/tmp/a.md");
    render(<FloatingPreview onOpenPath={async () => {}} />);
    mockRect(previewEl(), { left: 300, top: 100, width: 320, height: 240 });
    const rail = document.createElement("div");
    rail.className = "rail-root";
    mockRect(rail, { left: 0, top: 0, width: 240, height: 800 });
    document.body.appendChild(rail);

    movePointer(120, 400);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(useStore.getState().preview).not.toBeNull();
  });

  it("钉住后指针离开也不关闭", () => {
    openPreview("/tmp/a.md");
    render(<FloatingPreview onOpenPath={async () => {}} />);
    mockRect(previewEl(), { left: 300, top: 100, width: 320, height: 240 });
    act(() => {
      useStore.getState().togglePreviewPin();
    });

    movePointer(50, 50);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(useStore.getState().preview).not.toBeNull();
  });
});

describe("FloatingPreview 媒体真实渲染", () => {
  it("图片渲染 img，src 走 asset://", () => {
    openPreview("/tmp/pic.png");
    render(<FloatingPreview onOpenPath={async () => {}} />);
    const img = document.querySelector('[data-testid="preview-media"] img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toContain("asset://");
    expect(
      document.querySelector('[data-testid="preview-media-placeholder"]'),
    ).toBeNull();
  });

  it("视频渲染 video，src 走 media:// 且带控件", () => {
    openPreview("/tmp/clip.mp4");
    render(<FloatingPreview onOpenPath={async () => {}} />);
    const video = document.querySelector('[data-testid="preview-media"] video');
    expect(video).not.toBeNull();
    expect(video!.getAttribute("src")).toContain("media://");
    expect(video!.hasAttribute("controls")).toBe(true);
  });

  it("音频渲染 audio，src 走 media:// 且带控件", () => {
    openPreview("/tmp/song.mp3");
    render(<FloatingPreview onOpenPath={async () => {}} />);
    const audio = document.querySelector('[data-testid="preview-media"] audio');
    expect(audio).not.toBeNull();
    expect(audio!.getAttribute("src")).toContain("media://");
    expect(audio!.hasAttribute("controls")).toBe(true);
  });

  it("PDF 仍显示占位，不渲染媒体元素", () => {
    openPreview("/tmp/doc.pdf");
    render(<FloatingPreview onOpenPath={async () => {}} />);
    expect(
      document.querySelector('[data-testid="preview-media-placeholder"]'),
    ).not.toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });

  it("非 Tauri 环境回退占位，不渲染真实媒体元素", () => {
    const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
    const saved = w.__TAURI_INTERNALS__;
    delete w.__TAURI_INTERNALS__;
    try {
      openPreview("/tmp/pic.png");
      render(<FloatingPreview onOpenPath={async () => {}} />);
      expect(
        document.querySelector('[data-testid="preview-media-placeholder"]'),
      ).not.toBeNull();
      expect(document.querySelector("img")).toBeNull();
    } finally {
      w.__TAURI_INTERNALS__ = saved;
    }
  });
});
