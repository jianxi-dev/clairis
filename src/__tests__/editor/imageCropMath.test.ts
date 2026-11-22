/**
 * 图片裁剪坐标系纯函数测试（#1349 / E-44）。
 *
 * 裁剪框、拖动与写回共用一套显示坐标系：显示矩形 = 原图矩形 × scale，
 * 写回 = 显示矩形 ÷ scale（只换算一次）。这里钉死换算、整图阈值与
 * 保存/取消状态机（幂等：两路触发只写一次，Esc 后不再写）。
 */
import { describe, expect, it } from "vitest";
import {
  cancelCropSession,
  displayRectFromImageRect,
  imageRectFromDisplay,
  isFullImageRect,
  resolveCropTrigger,
  type CropSessionStatus,
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

describe("保存/取消状态机（幂等）", () => {
  const triggers = ["save", "pointerup"] as const;

  it("open 态下任意触发只写一次，随后转为 saved", () => {
    for (const trigger of triggers) {
      const first = resolveCropTrigger("open", trigger);
      expect(first).toEqual({ status: "saved", write: true });
      expect(resolveCropTrigger(first.status, trigger)).toEqual({
        status: "saved",
        write: false,
      });
    }
  });

  it("saved 态下重复触发（含取消）不再写回", () => {
    const saved: CropSessionStatus = "saved";
    for (const trigger of triggers) {
      expect(resolveCropTrigger(saved, trigger)).toEqual({
        status: "saved",
        write: false,
      });
    }
    expect(cancelCropSession(saved)).toEqual({
      status: "saved",
      write: false,
    });
  });

  it("Esc 取消后状态为 cancelled，任何触发都不写回", () => {
    expect(cancelCropSession("open")).toEqual({
      status: "cancelled",
      write: false,
    });
    for (const trigger of triggers) {
      expect(resolveCropTrigger("cancelled", trigger)).toEqual({
        status: "cancelled",
        write: false,
      });
    }
    expect(cancelCropSession("cancelled")).toEqual({
      status: "cancelled",
      write: false,
    });
  });
});
