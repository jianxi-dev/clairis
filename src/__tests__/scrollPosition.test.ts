import { describe, it, expect } from "vitest";
import { computeProgress, resolveScrollTarget } from "../utils/scrollPosition";
import type { ScrollPosition } from "../types";

describe("computeProgress", () => {
  it("顶部为 0", () => {
    expect(computeProgress(0, 2000, 800)).toBe(0);
  });

  it("底部为 1", () => {
    expect(computeProgress(1200, 2000, 800)).toBe(1);
  });

  it("中部按比例", () => {
    expect(computeProgress(600, 2000, 800)).toBeCloseTo(0.5);
  });

  it("不可滚动容器为 0，避免除零", () => {
    expect(computeProgress(0, 800, 800)).toBe(0);
  });

  it("越界值钳制到 [0,1]", () => {
    expect(computeProgress(-50, 2000, 800)).toBe(0);
    expect(computeProgress(9999, 2000, 800)).toBe(1);
  });
});

describe("resolveScrollTarget", () => {
  const record: ScrollPosition = { scrollPos: 600, contentHeight: 2000 };

  it("高度未变（±1px）按像素恢复", () => {
    const target = resolveScrollTarget(record, 2000, 800);
    expect(target).toBe(600);
  });

  it("高度变化按百分比恢复", () => {
    const target = resolveScrollTarget(record, 4000, 800);
    expect(target).toBeCloseTo(1200);
  });

  it("无记录返回 null（跳顶部）", () => {
    expect(resolveScrollTarget(undefined, 2000, 800)).toBeNull();
  });

  it("contentHeight 为 0 的记录视为无效", () => {
    expect(
      resolveScrollTarget({ scrollPos: 100, contentHeight: 0 }, 2000, 800),
    ).toBeNull();
  });

  it("目标超界钳制到最大可滚距离", () => {
    expect(
      resolveScrollTarget({ scrollPos: 5000, contentHeight: 2000 }, 2000, 800),
    ).toBe(1200);
  });

  it("当前不可滚动（内容不满一屏）返回 null", () => {
    expect(resolveScrollTarget(record, 800, 800)).toBeNull();
  });
});
