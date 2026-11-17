import { describe, expect, it } from "vitest";
import { RESIZE_EDGES, type Rect, type ResizeEdge } from "../lib/previewAnchor";
import {
  SEARCH_FLOAT_MIN,
  clampSearchFloatSize,
  resizeSearchFloat,
} from "../lib/searchFloatResize";

const START: Rect = { x: 100, y: 100, w: 600, h: 460 };

describe("searchFloatResize 包装（D1：固定最小 320×240）", () => {
  it("最小尺寸常量为 320×240", () => {
    expect(SEARCH_FLOAT_MIN).toEqual({ w: 320, h: 240 });
  });

  it("默认 600×460 不被 previewAnchor 默认钳制（260×200）误钳", () => {
    expect(clampSearchFloatSize({ w: 600, h: 460 })).toEqual({
      w: 600,
      h: 460,
    });
    expect(resizeSearchFloat("se", START, 0, 0)).toEqual(START);
  });

  it("小于最小值时严格钳到 320×240，非有限值回最小", () => {
    expect(clampSearchFloatSize({ w: 100, h: 50 })).toEqual({
      w: 320,
      h: 240,
    });
    expect(clampSearchFloatSize({ w: 0, h: 0 })).toEqual({ w: 320, h: 240 });
    expect(
      clampSearchFloatSize({ w: Number.NaN, h: Number.POSITIVE_INFINITY }),
    ).toEqual({ w: 320, h: 240 });
  });

  it("东边拖拽只改宽，西边拖拽改 x 且东边锚死", () => {
    expect(resizeSearchFloat("e", START, 50, 0)).toEqual({
      x: 100,
      y: 100,
      w: 650,
      h: 460,
    });
    const west = resizeSearchFloat("w", START, 60, 0);
    expect(west.x).toBe(160);
    expect(west.w).toBe(540);
    expect(west.x + west.w).toBe(START.x + START.w);
  });

  it("南边拖拽只改高，北边拖拽改 y 且南边锚死", () => {
    expect(resizeSearchFloat("s", START, 0, 40)).toEqual({
      x: 100,
      y: 100,
      w: 600,
      h: 500,
    });
    const north = resizeSearchFloat("n", START, 0, 50);
    expect(north.y).toBe(150);
    expect(north.h).toBe(410);
    expect(north.y + north.h).toBe(START.y + START.h);
  });

  it("每个手柄向内拖到底：对应轴钳到 320×240，绝无负尺寸", () => {
    const shrink: Record<ResizeEdge, [number, number]> = {
      e: [-9999, 0],
      w: [9999, 0],
      s: [0, -9999],
      n: [0, 9999],
      ne: [-9999, 9999],
      nw: [9999, 9999],
      se: [-9999, -9999],
      sw: [9999, -9999],
    };
    for (const edge of RESIZE_EDGES) {
      const [dx, dy] = shrink[edge];
      const r = resizeSearchFloat(edge, START, dx, dy);
      // 单边手柄只控制一个轴；对角手柄两轴同时到底
      if (edge.includes("e") || edge.includes("w")) {
        expect(r.w).toBe(SEARCH_FLOAT_MIN.w);
      } else {
        expect(r.w).toBe(START.w);
      }
      if (edge.includes("n") || edge.includes("s")) {
        expect(r.h).toBe(SEARCH_FLOAT_MIN.h);
      } else {
        expect(r.h).toBe(START.h);
      }
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
    }
  });

  it("单边手柄只控制一个轴，对角手柄两轴同时到底", () => {
    const eastOnly = resizeSearchFloat("e", START, -9999, 0);
    expect(eastOnly.w).toBe(320);
    expect(eastOnly.h).toBe(START.h);

    const southOnly = resizeSearchFloat("s", START, 0, -9999);
    expect(southOnly.h).toBe(240);
    expect(southOnly.w).toBe(START.w);

    const corner = resizeSearchFloat("nw", START, 9999, 9999);
    expect(corner.w).toBe(320);
    expect(corner.h).toBe(240);
  });

  it("西北角缩到底：西边/北边锚死，x/y 相应内移", () => {
    const r = resizeSearchFloat("nw", START, 9999, 9999);
    expect(r.x).toBe(START.x + START.w - SEARCH_FLOAT_MIN.w);
    expect(r.y).toBe(START.y + START.h - SEARCH_FLOAT_MIN.h);
    expect(r.x + r.w).toBe(START.x + START.w);
    expect(r.y + r.h).toBe(START.y + START.h);
  });
});
