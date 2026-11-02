import { describe, expect, it } from "vitest";
import {
  PANEL_MAX_HEIGHT,
  resolvePlacement,
  type AnchorRect,
} from "../../editors/orchestration/anchor";

function rect(partial: Partial<AnchorRect>): AnchorRect {
  return {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    ...partial,
  };
}

const VIEWPORT = rect({
  left: 0,
  top: 0,
  right: 800,
  bottom: 600,
  width: 800,
  height: 600,
});
const PANEL = { width: 200, height: 100 };

describe("resolvePlacement", () => {
  it("空间充足时开在锚点下方且不翻转", () => {
    const anchor = rect({ left: 100, top: 100, right: 200, bottom: 120 });
    const r = resolvePlacement(anchor, PANEL, VIEWPORT, VIEWPORT);

    expect(r).toEqual({
      x: 100,
      y: 124,
      flippedX: false,
      flippedY: false,
      maxHeight: PANEL_MAX_HEIGHT,
    });
  });

  it("底部溢出翻到上方", () => {
    const anchor = rect({ left: 100, top: 540, right: 200, bottom: 580 });
    const r = resolvePlacement(anchor, PANEL, VIEWPORT, VIEWPORT);

    expect(r.flippedY).toBe(true);
    expect(r.y).toBe(540 - 100 - 4);
  });

  it("右侧溢出翻到锚点左边", () => {
    const anchor = rect({ left: 700, top: 100, right: 780, bottom: 120 });
    const r = resolvePlacement(anchor, PANEL, VIEWPORT, VIEWPORT);

    expect(r.flippedX).toBe(true);
    expect(r.x).toBe(780 - 200 - 4);
  });

  it("翻转后仍溢出则夹进容器", () => {
    const anchor = rect({ left: 40, top: 20, right: 60, bottom: 40 });
    const tall = { width: 600, height: 900 };
    const r = resolvePlacement(anchor, tall, VIEWPORT, VIEWPORT);

    expect(r.x).toBeGreaterThanOrEqual(8);
    expect(r.y).toBeGreaterThanOrEqual(8);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
  });

  it("可用高度封顶 min(360, 容器高 - 16)", () => {
    const short = rect({
      left: 0,
      top: 0,
      right: 800,
      bottom: 200,
      width: 800,
      height: 200,
    });
    const r = resolvePlacement(
      rect({ left: 10, top: 10, right: 20, bottom: 20 }),
      PANEL,
      short,
      short,
    );
    expect(r.maxHeight).toBe(184);

    const tallContainer = rect({
      left: 0,
      top: 0,
      right: 800,
      bottom: 2000,
      width: 800,
      height: 2000,
    });
    const r2 = resolvePlacement(
      rect({ left: 10, top: 10, right: 20, bottom: 20 }),
      PANEL,
      tallContainer,
      tallContainer,
    );
    expect(r2.maxHeight).toBe(PANEL_MAX_HEIGHT);
  });

  it("容器是视口与编辑器的交集，不越出编辑器", () => {
    const container = rect({
      left: 100,
      top: 100,
      right: 500,
      bottom: 400,
      width: 400,
      height: 300,
    });
    const anchor = rect({ left: 460, top: 120, right: 495, bottom: 140 });
    const r = resolvePlacement(anchor, PANEL, VIEWPORT, container);

    expect(r.x + PANEL.width).toBeLessThanOrEqual(container.right - 8);
  });

  it("零尺寸容器不产生 NaN 或负高度", () => {
    const zero = rect({ left: 50, top: 50, right: 50, bottom: 50 });
    const r = resolvePlacement(
      rect({ left: 50, top: 50, right: 50, bottom: 50 }),
      PANEL,
      zero,
      zero,
    );

    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
    expect(r.maxHeight).toBe(0);
  });
});
