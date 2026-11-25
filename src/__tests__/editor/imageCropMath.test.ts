/**
 * 图片裁剪坐标系纯函数测试（#1349 / E-44）。
 *
 * 裁剪框、拖动与写回共用一套显示坐标系：显示矩形 = 原图矩形 × scale，
 * 写回 = 显示矩形 ÷ scale（只换算一次）。这里钉死换算与整图阈值。
 */
import { describe, expect, it } from "vitest";
import {
  displayRectFromImageRect,
  imageRectFromDisplay,
  isFullImageRect,
} from "../../editors/decorations/imageCropMath";

describe("显示矩形 ↔ 原图矩形换算", () => {
  it("按 scale 双向换算并四舍五入到原图像素", () => {
    const scale = 0.5;
    const img = { left: 200, top: 140, width: 1600, height: 1120 };
    const display = displayRectFromImageRect(img, scale);
    expect(display).toEqual({
      left: 100,
      top: 70,
      width: 800,
      height: 560,
    });
    expect(imageRectFromDisplay(display, scale)).toEqual(img);
  });

  it("非二进制精确 scale 也可往返（写回取整）", () => {
    const scale = 0.56;
    const img = { left: 200, top: 140, width: 1600, height: 1120 };
    const display = displayRectFromImageRect(img, scale);
    for (const [key, value] of Object.entries(display)) {
      expect(value).toBeCloseTo(
        { left: 112, top: 78.4, width: 896, height: 627.2 }[
          key as keyof typeof display
        ],
        10,
      );
    }
    expect(imageRectFromDisplay(display, scale)).toEqual(img);
  });

  it("写回只换算一次：显示矩形 ÷ scale 还原原图矩形", () => {
    const scale = 0.25;
    const display = { left: 10, top: 20, width: 100, height: 50 };
    expect(imageRectFromDisplay(display, scale)).toEqual({
      left: 40,
      top: 80,
      width: 400,
      height: 200,
    });
  });

  it("scale 非正时返回零矩形，不产生 NaN/Infinity", () => {
    expect(
      imageRectFromDisplay({ left: 1, top: 1, width: 1, height: 1 }, 0),
    ).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(
      displayRectFromImageRect({ left: 1, top: 1, width: 1, height: 1 }, -1),
    ).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});

describe("整图阈值判定", () => {
  it("宽高都达到 99% 才视为拖回整图", () => {
    expect(
      isFullImageRect(
        { left: 0, top: 0, width: 1980, height: 1386 },
        2000,
        1400,
      ),
    ).toBe(true);
    expect(
      isFullImageRect(
        { left: 0, top: 0, width: 1979, height: 1386 },
        2000,
        1400,
      ),
    ).toBe(false);
    expect(
      isFullImageRect(
        { left: 0, top: 0, width: 1980, height: 1385 },
        2000,
        1400,
      ),
    ).toBe(false);
  });

  it("自定义阈值生效", () => {
    expect(
      isFullImageRect(
        { left: 0, top: 0, width: 90, height: 90 },
        100,
        100,
        0.9,
      ),
    ).toBe(true);
    expect(
      isFullImageRect(
        { left: 0, top: 0, width: 89, height: 90 },
        100,
        100,
        0.9,
      ),
    ).toBe(false);
  });
});

describe("逐轴缩放（声明 width/height 非等比拉伸）", () => {
  it("sx ≠ sy 时逐轴换算并可往返", () => {
    const scale = { x: 0.3, y: 0.45 };
    const img = { left: 100, top: 50, width: 1200, height: 800 };
    const display = displayRectFromImageRect(img, scale);
    expect(display).toEqual({
      left: 30,
      top: 22.5,
      width: 360,
      height: 360,
    });
    expect(imageRectFromDisplay(display, scale)).toEqual(img);
  });

  it("number 视为等比缩放（既有行为不变）", () => {
    expect(
      displayRectFromImageRect(
        { left: 10, top: 20, width: 100, height: 100 },
        0.5,
      ),
    ).toEqual({
      left: 5,
      top: 10,
      width: 50,
      height: 50,
    });
  });
});
