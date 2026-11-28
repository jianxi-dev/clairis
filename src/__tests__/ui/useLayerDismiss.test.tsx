import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { createElement, useRef, useState } from "react";
import { useLayerDismiss } from "../../ui/primitives/useLayerDismiss";

interface LayerProps {
  onDismiss: () => void;
  enabled?: boolean;
  dismissOnOutside?: boolean;
  dismissOnScroll?: boolean;
  label: string;
  scroller?: boolean;
}

function Layer({
  onDismiss,
  enabled,
  dismissOnOutside,
  dismissOnScroll,
  label,
  scroller,
}: LayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayerDismiss({ ref, onDismiss, enabled, dismissOnOutside, dismissOnScroll });
  return createElement(
    "div",
    { ref, "data-testid": `layer-${label}` } as Record<string, unknown>,
    scroller
      ? createElement(
          "div",
          { "data-testid": `scroller-${label}` },
          createElement("div", { style: { height: 400 } }),
        )
      : null,
  );
}

function esc(): void {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
}

function pointerDownOn(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
}

function scrollOn(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("useLayerDismiss 层栈语义", () => {
  it("Esc 只关栈顶，下层保留", () => {
    const a = vi.fn();
    const b = vi.fn();
    function App() {
      const [showB, setShowB] = useState(true);
      return (
        <>
          <Layer label="a" onDismiss={a} />
          {showB && (
            <Layer
              label="b"
              onDismiss={() => {
                b();
                setShowB(false);
              }}
            />
          )}
        </>
      );
    }
    render(<App />);
    esc();
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
    esc();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("下层重渲染（新 onDismiss 引用）不升栈顶：Esc 仍关栈顶", () => {
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = render(
      <>
        <Layer label="a" onDismiss={a} />
        <Layer label="b" onDismiss={b} />
      </>,
    );
    rerender(
      <>
        <Layer label="a" onDismiss={a} />
        <Layer label="b" onDismiss={() => b()} />
      </>,
    );
    esc();
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it("点外部先关栈顶，不一次关完", () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <>
        <Layer label="a" onDismiss={a} />
        <Layer label="b" onDismiss={b} />
      </>,
    );
    pointerDownOn(document.body);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it("点菜单内部不关闭", () => {
    const a = vi.fn();
    render(<Layer label="a" onDismiss={a} />);
    const el = document.querySelector('[data-testid="layer-a"]') as HTMLElement;
    pointerDownOn(el);
    expect(a).not.toHaveBeenCalled();
  });

  it("本层内后代滚动（菜单自身滚动列表）不关闭", () => {
    const a = vi.fn();
    render(<Layer label="a" onDismiss={a} scroller />);
    const scroller = document.querySelector(
      '[data-testid="scroller-a"]',
    ) as HTMLElement;
    scrollOn(scroller);
    expect(a).not.toHaveBeenCalled();
  });

  it("window 滚动关闭栈顶", () => {
    const a = vi.fn();
    render(<Layer label="a" onDismiss={a} />);
    scrollOn(window);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("document 滚动关闭栈顶", () => {
    const a = vi.fn();
    render(<Layer label="a" onDismiss={a} />);
    scrollOn(document);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("enabled:false 不响应 Esc 与点外", () => {
    const a = vi.fn();
    render(<Layer label="a" onDismiss={a} enabled={false} />);
    esc();
    pointerDownOn(document.body);
    expect(a).not.toHaveBeenCalled();
  });

  it("dismissOnScroll:false 时滚动不关，resize 仍关", () => {
    const a = vi.fn();
    render(<Layer label="a" onDismiss={a} dismissOnScroll={false} />);
    scrollOn(window);
    expect(a).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("卸载后不误删他层（栈按注册序出栈）", () => {
    const a = vi.fn();
    const b = vi.fn();
    const { unmount } = render(
      <>
        <Layer label="a" onDismiss={a} />
        <Layer label="b" onDismiss={b} />
      </>,
    );
    unmount();
    esc();
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("卸载栈顶后，下层升为栈顶并可响应 Esc", () => {
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = render(
      <>
        <Layer label="a" onDismiss={a} />
        <Layer label="b" onDismiss={b} />
      </>,
    );
    rerender(<Layer label="a" onDismiss={a} />);
    esc();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("Esc 只 stopPropagation 不 preventDefault", () => {
    const a = vi.fn();
    render(<Layer label="a" onDismiss={a} />);
    const ev = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      document.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(false);
  });
});
