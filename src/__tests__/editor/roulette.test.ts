import { describe, expect, it } from "vitest";
import {
  COLOR_BG_DEG,
  COLOR_BG_IN,
  COLOR_BG_OUT,
  COLOR_FONT_DEG,
  COLOR_FONT_IN,
  COLOR_FONT_OUT,
  FAN_IN,
  FAN_OUT,
  GAP_DEG,
  ITEM_DEG,
  ROOT_IN,
  ROOT_LABEL_RADIUS,
  ROOT_OUT,
  ROOT_SECTORS,
  ROULETTE_BOX,
  THIRD_IN,
  THIRD_OUT,
  angleOfPoint,
  clampBoxCenter,
  fanAngles,
  fanSpan,
  hitInBand,
  polar,
  ringAngles,
  sectorPath,
} from "../../editors/orchestration/roulette";

describe("roulette 几何常量", () => {
  it("与原型 1310–1315 行一致", () => {
    expect(ROULETTE_BOX).toBe(420);
    expect([ROOT_IN, ROOT_OUT]).toEqual([30, 86]);
    expect([FAN_IN, FAN_OUT]).toEqual([92, 122]);
    expect([THIRD_IN, THIRD_OUT]).toEqual([126, 152]);
    expect([COLOR_FONT_IN, COLOR_FONT_OUT]).toEqual([90, 106]);
    expect([COLOR_BG_IN, COLOR_BG_OUT]).toEqual([111, 127]);
    expect(ITEM_DEG).toBe(15);
    expect(GAP_DEG).toBeCloseTo(0.35, 5);
    expect(ROOT_LABEL_RADIUS).toBe(60);
  });

  it("根环 8 个 45° 扇区，12:00 起顺时针", () => {
    expect(ROOT_SECTORS).toHaveLength(8);
    expect(ROOT_SECTORS.map((s) => s.angle)).toEqual([
      0, 45, 90, 135, 180, 225, 270, 315,
    ]);
    expect(ROOT_SECTORS[0].id).toBe("smart");
    expect(ROOT_SECTORS[7].id).toBe("color");
  });
});

describe("极坐标与扇形", () => {
  it("0° 在正上方，90° 在右侧", () => {
    expect(polar(0, 10).x).toBeCloseTo(0, 5);
    expect(polar(0, 10).y).toBeCloseTo(-10, 5);
    expect(polar(90, 10).x).toBeCloseTo(10, 5);
    expect(polar(90, 10).y).toBeCloseTo(0, 5);
  });

  it("扇形 path 从外弧到内弧闭合", () => {
    const d = sectorPath(30, 86, -22.5, 22.5);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("A86 86");
    expect(d).toContain("A30 30");
    expect(d.endsWith("Z")).toBe(true);
  });

  it("等宽扇形按 (n-1)×15° 排中心，覆盖为 n×15°", () => {
    expect(fanAngles(270, 1)).toEqual([270]);
    expect(fanAngles(270, 6)).toEqual([
      232.5, 247.5, 262.5, 277.5, 292.5, 307.5,
    ]);
    expect(fanSpan(6)).toBe(90);
    expect(fanSpan(8)).toBe(120);
  });

  it("颜色环按段宽居中：内圈 9 段 18°，外圈 16 段 15°", () => {
    const inner = fanAngles(315, 9, COLOR_FONT_DEG);
    const outer = fanAngles(315, 16, COLOR_BG_DEG);
    expect(inner).toHaveLength(9);
    expect(outer).toHaveLength(16);
    expect(inner[0]).toBeCloseTo(315 - 72, 5);
    expect(outer[0]).toBeCloseTo(315 - 112.5, 5);
  });

  it("ringAngles 等分整圈", () => {
    expect(ringAngles(4)).toEqual([0, 90, 180, 270]);
  });
});

describe("夹取与命中", () => {
  it("贴近右下角时整轮不越界", () => {
    const p = clampBoxCenter(1000, 900, { width: 1000, height: 900 });
    expect(p.x).toBe(1000 - 210 - 8);
    expect(p.y).toBe(900 - 210 - 8);
  });

  it("贴近左上角时留 8px 安全边", () => {
    const p = clampBoxCenter(0, 0, { width: 1000, height: 900 });
    expect(p).toEqual({ x: 218, y: 218 });
  });

  it("指针角度 0° 向上，顺时针增大", () => {
    const center = { x: 0, y: 0 };
    expect(angleOfPoint(center, { x: 0, y: -10 })).toBeCloseTo(0, 5);
    expect(angleOfPoint(center, { x: 10, y: 0 })).toBeCloseTo(90, 5);
    expect(angleOfPoint(center, { x: 0, y: 10 })).toBeCloseTo(180, 5);
    expect(angleOfPoint(center, { x: -10, y: 0 })).toBeCloseTo(270, 5);
  });

  it("命中判定同时看半径与角度", () => {
    const center = { x: 0, y: 0 };
    expect(hitInBand({ x: 0, y: -100 }, center, 92, 122, -10, 10)).toBe(true);
    expect(hitInBand({ x: 0, y: -50 }, center, 92, 122, -10, 10)).toBe(false);
    expect(hitInBand({ x: 100, y: 0 }, center, 92, 122, -10, 10)).toBe(false);
  });
});
