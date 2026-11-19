import { describe, expect, it } from "vitest";
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  VOLUME_MAX,
  VOLUME_MIN,
  clampBrightness,
  clampVolume,
  wheelGestureSide,
  wheelGestureStep,
} from "../components/Content/videoGesture";

describe("wheelGestureSide 左右半判定", () => {
  const rect = { left: 100, width: 800 };

  it("中线以左为 left、以右为 right", () => {
    expect(wheelGestureSide(rect, 100)).toBe("left");
    expect(wheelGestureSide(rect, 499.9)).toBe("left");
    expect(wheelGestureSide(rect, 500)).toBe("right");
    expect(wheelGestureSide(rect, 900)).toBe("right");
  });
});

describe("wheelGestureStep 步进换算", () => {
  it("上滑为正、下滑为负", () => {
    expect(wheelGestureStep(-240)).toBeCloseTo(0.2);
    expect(wheelGestureStep(240)).toBeCloseTo(-0.2);
  });

  it("deltaMode 行/页折回像素量级", () => {
    expect(wheelGestureStep(-3, 1)).toBeCloseTo(0.04);
    expect(wheelGestureStep(-1, 2)).toBeCloseTo(100 / 1200);
  });

  it("零增量不产生步进", () => {
    expect(wheelGestureStep(0)).toBeCloseTo(0);
  });
});

describe("clampBrightness / clampVolume 边界", () => {
  it("亮度收敛到 0.3–2", () => {
    expect(clampBrightness(1)).toBe(1);
    expect(clampBrightness(0.05)).toBe(BRIGHTNESS_MIN);
    expect(clampBrightness(9)).toBe(BRIGHTNESS_MAX);
  });

  it("音量收敛到 0–1", () => {
    expect(clampVolume(0.7)).toBe(0.7);
    expect(clampVolume(-1)).toBe(VOLUME_MIN);
    expect(clampVolume(2)).toBe(VOLUME_MAX);
  });
});
