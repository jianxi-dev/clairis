import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createElement, type RefCallback } from "react";
import { useAnchoredPosition } from "../../ui/primitives/useAnchoredPosition";

function rect(over: Partial<DOMRect>): DOMRect {
  return {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...over,
  } as DOMRect;
}

const VIEW_W = 1000;
const VIEW_H = 800;
const MARGIN = 8;

function setViewport(w: number, h: number): void {
  Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: h, configurable: true });
}

interface ProbeProps {
  anchor: { x: number; y: number } | null;
  options?: Parameters<typeof useAnchoredPosition>[1];
  size: { width: number; height: number };
}

function Probe({ anchor, options, size }: ProbeProps) {
  const { pos, ref, side } = useAnchoredPosition<HTMLDivElement>(anchor, options);
  const setRef: RefCallback<HTMLDivElement> = (el) => {
    (ref as { current: HTMLDivElement | null }).current = el;
    if (el) {
      el.getBoundingClientRect = () =>
        rect({
          left: 0,
          top: 0,
          right: size.width,
          bottom: size.height,
          width: size.width,
          height: size.height,
        });
    }
  };
  return createElement("div", {
    ref: setRef,
    "data-testid": "probe",
    "data-pos-x": pos ? String(pos.x) : "null",
    "data-pos-y": pos ? String(pos.y) : "null",
    "data-side": side ?? "",
  });
}

function probeEl(): HTMLElement {
  const el = document.querySelector('[data-testid="probe"]');
  if (!el) throw new Error("probe 未渲染");
  return el as HTMLElement;
}

function probeXY(el: HTMLElement): { x: number; y: number } {
  return { x: Number(el.dataset.posX), y: Number(el.dataset.posY) };
}

const SIDES_12 = [
  "below-start",
  "below-center",
  "below-end",
  "above-start",
  "above-center",
  "above-end",
  "right-start",
  "right-center",
  "right-end",
  "left-start",
  "left-center",
  "left-end",
] as const;

beforeEach(() => {
  setViewport(VIEW_W, VIEW_H);
});

afterEach(() => {
  cleanup();
});

describe("useAnchoredPosition clamp（与旧定位 hook 逐字等价）", () => {
  it("anchor 在视口内 → pos 等于 anchor", () => {
    render(<Probe anchor={{ x: 200, y: 150 }} size={{ width: 100, height: 60 }} />);
    const el = probeEl();
    expect(el.dataset.posX).toBe("200");
    expect(el.dataset.posY).toBe("150");
  });

  it("anchor 在右下角 → 右 / 下缘被夹进视口（margin 8）", () => {
    render(<Probe anchor={{ x: 2000, y: 2000 }} size={{ width: 100, height: 60 }} />);
    const el = probeEl();
    expect(Number(el.dataset.posX)).toBe(VIEW_W - 100 - MARGIN);
    expect(Number(el.dataset.posY)).toBe(VIEW_H - 60 - MARGIN);
  });

  it("anchor 在左上角（负值）→ 夹到 margin", () => {
    render(<Probe anchor={{ x: -50, y: -50 }} size={{ width: 100, height: 60 }} />);
    const el = probeEl();
    expect(Number(el.dataset.posX)).toBe(MARGIN);
    expect(Number(el.dataset.posY)).toBe(MARGIN);
  });

  it("anchor 为 null → pos 为 null", () => {
    render(<Probe anchor={null} size={{ width: 100, height: 60 }} />);
    const el = probeEl();
    expect(el.dataset.posX).toBe("null");
    expect(el.dataset.posY).toBe("null");
  });

  it("boundsOf 窄容器：右缘夹进容器右缘（#1017）", () => {
    const boundsEl = document.createElement("div");
    boundsEl.getBoundingClientRect = () => rect({ right: 300, bottom: 800 });
    document.body.appendChild(boundsEl);
    render(
      <Probe
        anchor={{ x: 290, y: 100 }}
        options={{ boundsOf: () => boundsEl }}
        size={{ width: 100, height: 60 }}
      />,
    );
    const el = probeEl();
    expect(Number(el.dataset.posX)).toBe(300 - 100 - MARGIN);
    boundsEl.remove();
  });

  it("clamp 模式不返回 side", () => {
    render(<Probe anchor={{ x: 200, y: 150 }} size={{ width: 100, height: 60 }} />);
    expect(probeEl().dataset.side).toBe("");
  });
});

describe("useAnchoredPosition flip（12 向）", () => {
  it("anchor 在视口中央 → below-start", () => {
    render(
      <Probe
        anchor={{ x: 500, y: 400 }}
        options={{ placement: "flip" }}
        size={{ width: 100, height: 60 }}
      />,
    );
    const el = probeEl();
    expect(el.dataset.side).toBe("below-start");
    expect(el.dataset.posX).toBe("500");
    expect(el.dataset.posY).toBe("400");
  });

  it("anchor 贴底缘 → 翻到 above-start", () => {
    render(
      <Probe
        anchor={{ x: 500, y: VIEW_H - 10 }}
        options={{ placement: "flip" }}
        size={{ width: 100, height: 60 }}
      />,
    );
    const el = probeEl();
    expect(el.dataset.side).toBe("above-start");
    expect(Number(el.dataset.posY)).toBe(VIEW_H - 10 - 60);
  });

  it("anchor 贴右缘 → 沿 below 主轴 shift，右缘留 margin 不贴边", () => {
    render(
      <Probe
        anchor={{ x: VIEW_W - 5, y: 400 }}
        options={{ placement: "flip" }}
        size={{ width: 100, height: 60 }}
      />,
    );
    const el = probeEl();
    expect(el.dataset.side).toBe("below-end");
    const { x } = probeXY(el);
    expect(x).toBe(VIEW_W - MARGIN - 100);
  });

  it("anchor 在左上角 → below-start（左留 margin）", () => {
    render(
      <Probe
        anchor={{ x: 0, y: 0 }}
        options={{ placement: "flip" }}
        size={{ width: 100, height: 60 }}
      />,
    );
    const el = probeEl();
    expect(el.dataset.side).toBe("below-start");
    expect(Number(el.dataset.posX)).toBe(MARGIN);
  });

  it("anchor 贴右下角 → 翻到 above-end（对侧，右 / 下留 margin）", () => {
    render(
      <Probe
        anchor={{ x: VIEW_W - 1, y: VIEW_H - 1 }}
        options={{ placement: "flip" }}
        size={{ width: 100, height: 60 }}
      />,
    );
    const el = probeEl();
    expect(el.dataset.side).toBe("above-end");
    const { x, y } = probeXY(el);
    expect(x).toBe(VIEW_W - MARGIN - 100);
    expect(y).toBe(VIEW_H - MARGIN - 60);
  });

  it("四角各自翻到对侧，side 至少 2 种", () => {
    const corners = [
      { x: 0, y: 0 },
      { x: VIEW_W - 1, y: 0 },
      { x: 0, y: VIEW_H - 1 },
      { x: VIEW_W - 1, y: VIEW_H - 1 },
    ];
    const sides = corners.map((c) => {
      const { unmount } = render(
        <Probe
          anchor={c}
          options={{ placement: "flip" }}
          size={{ width: 100, height: 60 }}
        />,
      );
      const s = probeEl().dataset.side;
      unmount();
      return s;
    });
    expect(new Set(sides).size).toBeGreaterThanOrEqual(2);
  });

  it("四角都落在 [margin, max] 内（右 / 下缘留 8px）", () => {
    const corners = [
      { x: 0, y: 0 },
      { x: VIEW_W - 1, y: 0 },
      { x: 0, y: VIEW_H - 1 },
      { x: VIEW_W - 1, y: VIEW_H - 1 },
    ];
    for (const c of corners) {
      const { unmount } = render(
        <Probe
          anchor={c}
          options={{ placement: "flip" }}
          size={{ width: 100, height: 60 }}
        />,
      );
      const { x, y } = probeXY(probeEl());
      expect(x).toBeGreaterThanOrEqual(MARGIN);
      expect(y).toBeGreaterThanOrEqual(MARGIN);
      expect(x + 100).toBeLessThanOrEqual(VIEW_W - MARGIN);
      expect(y + 60).toBeLessThanOrEqual(VIEW_H - MARGIN);
      unmount();
    }
  });

  it("放不下时选位移最小的 side（below-end），右缘留 margin", () => {
    render(
      <Probe
        anchor={{ x: 950, y: 400 }}
        options={{ placement: "flip" }}
        size={{ width: 100, height: 60 }}
      />,
    );
    const el = probeEl();
    expect(el.dataset.side).toBe("below-end");
    const { x } = probeXY(el);
    expect(x).toBe(950 - 100);
    expect(x + 100).toBeLessThanOrEqual(VIEW_W - MARGIN);
  });

  it("超大浮层（宽于视口）→ 永不越界，能 shift 的轴先 shift", () => {
    render(
      <Probe
        anchor={{ x: 900, y: 700 }}
        options={{ placement: "flip" }}
        size={{ width: VIEW_W, height: 500 }}
      />,
    );
    const { x, y } = probeXY(probeEl());
    expect(x).toBe(MARGIN);
    expect(x + VIEW_W).toBeLessThanOrEqual(VIEW_W - MARGIN + VIEW_W);
    expect(y).toBeLessThanOrEqual(VIEW_H - MARGIN - 500);
  });

  it("高浮层竖向放不下 → 选位移最小的侧（竖直候选优先）", () => {
    render(
      <Probe
        anchor={{ x: 500, y: 400 }}
        options={{ placement: "flip" }}
        size={{ width: 100, height: VIEW_H }}
      />,
    );
    const el = probeEl();
    expect(el.dataset.side).toBe("below-start");
    const { x, y } = probeXY(el);
    expect(x).toBe(500);
    expect(y).toBe(MARGIN);
  });

  it("返回的 side 必为 12 向之一", () => {
    const anchors = [
      { x: 0, y: 0 },
      { x: VIEW_W - 1, y: 0 },
      { x: 0, y: VIEW_H - 1 },
      { x: VIEW_W - 1, y: VIEW_H - 1 },
      { x: 500, y: 400 },
      { x: 999, y: 799 },
    ];
    for (const a of anchors) {
      const { unmount } = render(
        <Probe
          anchor={a}
          options={{ placement: "flip" }}
          size={{ width: 200, height: 120 }}
        />,
      );
      expect(SIDES_12).toContain(probeEl().dataset.side as (typeof SIDES_12)[number]);
      unmount();
    }
  });

  it("boundsOf 窄容器：flip 右缘不越容器（#1017）", () => {
    const boundsEl = document.createElement("div");
    boundsEl.getBoundingClientRect = () => rect({ right: 300, bottom: 800 });
    document.body.appendChild(boundsEl);
    render(
      <Probe
        anchor={{ x: 290, y: 100 }}
        options={{ placement: "flip", boundsOf: () => boundsEl }}
        size={{ width: 100, height: 60 }}
      />,
    );
    const { x } = probeXY(probeEl());
    expect(x + 100).toBeLessThanOrEqual(300 - MARGIN);
    boundsEl.remove();
  });
});
