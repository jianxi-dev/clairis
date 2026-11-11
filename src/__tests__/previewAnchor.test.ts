import { describe, expect, it } from "vitest";
import {
  HOVER_DELAY_MS,
  PREVIEW_LEAVE_CLOSE_MS,
  PREVIEW_GAP,
  PREVIEW_MIN_H,
  PREVIEW_MIN_W,
  RESIZE_EDGES,
  anchorFromGrid,
  anchorFromRail,
  clampPreviewSize,
  flipAnchor,
  gridTriggerOf,
  isRightHalfOfBox,
  pointInBox,
  resizePreview,
  shouldScheduleLeaveClose,
  type Box,
  type Rect,
  type ResizeEdge,
  type Viewport,
} from "../lib/previewAnchor";

const VIEW: Viewport = { width: 1200, height: 800 };
const SIZE = { w: 320, h: 240 };

describe("常量", () => {
  it("最小尺寸与间距与规格一致", () => {
    expect(PREVIEW_MIN_W).toBe(260);
    expect(PREVIEW_MIN_H).toBe(200);
    expect(PREVIEW_GAP).toBe(12);
    expect(HOVER_DELAY_MS).toBe(250);
  });

  it("8 个缩放手柄齐备且唯一", () => {
    expect(new Set(RESIZE_EDGES).size).toBe(8);
    expect([...RESIZE_EDGES].sort().join(",")).toBe("e,n,ne,nw,s,se,sw,w");
  });
});

describe("anchorFromRail", () => {
  it("x 恒为栏右缘 + 12，与行高无关", () => {
    const a = anchorFromRail({
      railRightX: 240,
      rowTopY: 100,
      rowHeight: 32,
      size: SIZE,
      viewport: VIEW,
    });
    expect(a.x).toBe(252);
    expect(a.y).toBe(100);
    expect(a.flipped.x).toBe(false);
  });

  it("x 绝不随指针横移变化——同一行不同指针位置结果一致", () => {
    const base = {
      railRightX: 240,
      rowTopY: 120,
      rowHeight: 56,
      size: SIZE,
      viewport: VIEW,
    };
    // 指针位置根本不进入参数，函数天然与指针无关；这里确认同一行恒定
    const a = anchorFromRail(base);
    const b = anchorFromRail({ ...base });
    expect(a.x).toBe(b.x);
    expect(a.x).toBe(252);
  });

  it("y 跟随悬停行：不同行得到不同 y，x 不变", () => {
    const row3 = anchorFromRail({
      railRightX: 240,
      rowTopY: 90,
      rowHeight: 112,
      size: SIZE,
      viewport: VIEW,
    });
    const row8 = anchorFromRail({
      railRightX: 240,
      rowTopY: 400,
      rowHeight: 112,
      size: SIZE,
      viewport: VIEW,
    });
    expect(row3.x).toBe(row8.x);
    expect(row3.y).toBe(90);
    expect(row8.y).toBe(400);
  });

  it("y 底部越界时夹进视口", () => {
    const a = anchorFromRail({
      railRightX: 240,
      rowTopY: 780,
      rowHeight: 56,
      size: SIZE,
      viewport: VIEW,
    });
    expect(a.y).toBe(VIEW.height - SIZE.h);
  });

  it("右侧放不下时翻到栏左缘另一侧并置 flipped.x", () => {
    const a = anchorFromRail({
      railRightX: 1100,
      rowTopY: 100,
      rowHeight: 32,
      size: SIZE,
      viewport: VIEW,
    });
    expect(a.flipped.x).toBe(true);
    // 1100 + 12 + 320 > 1200 → 翻到 1100 - 12 - 320
    expect(a.x).toBe(1100 - PREVIEW_GAP - SIZE.w);
  });
});

describe("anchorFromGrid", () => {
  it("x = 卡右缘 + 12，y = 卡顶", () => {
    const a = anchorFromGrid({
      cardRightX: 300,
      cardTopY: 40,
      size: SIZE,
      viewport: VIEW,
    });
    expect(a.x).toBe(312);
    expect(a.y).toBe(40);
    expect(a.flipped.x).toBe(false);
  });

  it("右侧越界翻转", () => {
    const a = anchorFromGrid({
      cardRightX: 1180,
      cardTopY: 40,
      size: SIZE,
      viewport: VIEW,
    });
    expect(a.flipped.x).toBe(true);
    expect(a.x).toBe(1180 - PREVIEW_GAP - SIZE.w);
  });
});

describe("clampPreviewSize", () => {
  it("严格钳到 260×200", () => {
    expect(clampPreviewSize({ w: 100, h: 50 })).toEqual({ w: 260, h: 200 });
    expect(clampPreviewSize({ w: 0, h: 0 })).toEqual({ w: 260, h: 200 });
    expect(clampPreviewSize({ w: -999, h: -1 })).toEqual({ w: 260, h: 200 });
  });

  it("非有限值回最小尺寸", () => {
    expect(clampPreviewSize({ w: NaN, h: Infinity })).toEqual({
      w: 260,
      h: 200,
    });
  });

  it("大于最小值原样（取整）", () => {
    expect(clampPreviewSize({ w: 320.4, h: 240.6 })).toEqual({
      w: 320,
      h: 241,
    });
  });
});

describe("resizePreview", () => {
  const start: Rect = { x: 100, y: 100, w: 400, h: 300 };
  const move = (edge: ResizeEdge, dx: number, dy: number) =>
    resizePreview(edge, start, dx, dy);

  it("东边拖拽只改宽，x/y 不动", () => {
    expect(move("e", 50, 40)).toEqual({ x: 100, y: 100, w: 450, h: 300 });
  });

  it("南边拖拽只改高，x/y 不动", () => {
    expect(move("s", 50, 40)).toEqual({ x: 100, y: 100, w: 400, h: 340 });
  });

  it("西边拖拽改 x 同时收窄宽度（东边锚死）", () => {
    const r = move("w", 60, 0);
    expect(r.x).toBe(160);
    expect(r.w).toBe(340);
    // 东边不变
    expect(r.x + r.w).toBe(start.x + start.w);
  });

  it("北边拖拽改 y 同时收窄高度（南边锚死）", () => {
    const r = move("n", 0, 50);
    expect(r.y).toBe(150);
    expect(r.h).toBe(250);
    expect(r.y + r.h).toBe(start.y + start.h);
  });

  it("四角组合：nw 同时改 x/y/w/h，对边锚死", () => {
    const r = move("nw", 40, 30);
    expect(r.x).toBe(140);
    expect(r.y).toBe(130);
    expect(r.w).toBe(360);
    expect(r.h).toBe(270);
    expect(r.x + r.w).toBe(start.x + start.w);
    expect(r.y + r.h).toBe(start.y + start.h);
  });

  it("东南角放大", () => {
    expect(move("se", 20, 20)).toEqual({ x: 100, y: 100, w: 420, h: 320 });
  });

  it("西边收到底：宽度钳到 260，东边仍锚死，x 相应右移", () => {
    const r = move("w", 9999, 0);
    expect(r.w).toBe(PREVIEW_MIN_W);
    expect(r.x).toBe(start.x + start.w - PREVIEW_MIN_W);
  });

  it("北边收到底：高度钳到 200，南边锚死", () => {
    const r = move("n", 0, 9999);
    expect(r.h).toBe(PREVIEW_MIN_H);
    expect(r.y).toBe(start.y + start.h - PREVIEW_MIN_H);
  });

  it("东/南缩到负值也钳到最小值，绝无负尺寸", () => {
    const r = move("se", -9999, -9999);
    expect(r.w).toBe(PREVIEW_MIN_W);
    expect(r.h).toBe(PREVIEW_MIN_H);
    expect(r.x).toBe(start.x);
    expect(r.y).toBe(start.y);
  });

  it("每个手柄向内拖到底：对应轴钳到最小值，绝无负尺寸", () => {
    for (const edge of RESIZE_EDGES) {
      const east = edge.includes("e");
      const west = edge.includes("w");
      const south = edge.includes("s");
      const north = edge.includes("n");
      const dx = east ? -9999 : west ? 9999 : 0;
      const dy = south ? -9999 : north ? 9999 : 0;
      const r = resizePreview(edge, start, dx, dy);
      // 单边手柄只控制一个轴；对角手柄两轴同时到底
      if (east || west) expect(r.w).toBe(260);
      else expect(r.w).toBe(start.w);
      if (north || south) expect(r.h).toBe(200);
      else expect(r.h).toBe(start.h);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
    }
  });

  it("四角手柄向内拖到底即严格 260×200", () => {
    const cornerDelta: Record<string, [number, number]> = {
      ne: [-9999, 9999],
      nw: [9999, 9999],
      se: [-9999, -9999],
      sw: [9999, -9999],
    };
    for (const edge of ["ne", "nw", "se", "sw"] as const) {
      const [dx, dy] = cornerDelta[edge];
      const r = resizePreview(edge, start, dx, dy);
      expect({ w: r.w, h: r.h }).toEqual({ w: 260, h: 200 });
    }
  });
});

describe("flipAnchor", () => {
  it("完全在视口内不翻", () => {
    expect(flipAnchor({ x: 100, y: 100, w: 320, h: 240 }, VIEW)).toEqual({
      x: false,
      y: false,
    });
  });

  it("越过右缘 → 仅 x 翻", () => {
    expect(flipAnchor({ x: 1150, y: 100, w: 320, h: 240 }, VIEW)).toEqual({
      x: true,
      y: false,
    });
  });

  it("越过下缘 → 仅 y 翻", () => {
    expect(flipAnchor({ x: 100, y: 700, w: 320, h: 240 }, VIEW)).toEqual({
      x: false,
      y: true,
    });
  });

  it("同时越过右下 → 两轴都翻", () => {
    expect(flipAnchor({ x: 1150, y: 700, w: 320, h: 240 }, VIEW)).toEqual({
      x: true,
      y: true,
    });
  });

  it("贴边（含 gap）即视为越界", () => {
    // 100 + 1089 + 12 > 1200 → 翻
    expect(flipAnchor({ x: 100, y: 10, w: 1089, h: 200 }, VIEW).x).toBe(true);
  });
});

describe("gridTriggerOf（网格触发）", () => {
  it("hover：悬停与点击都触发", () => {
    expect(gridTriggerOf("hover")).toEqual({ onHover: true, onClick: true });
  });

  it("click：仅点击触发", () => {
    expect(gridTriggerOf("click")).toEqual({ onHover: false, onClick: true });
  });

  it("off：都不触发", () => {
    expect(gridTriggerOf("off")).toEqual({ onHover: false, onClick: false });
  });
});

describe("锚定契约一致性", () => {
  it("anchorFromRail 的翻转与 flipAnchor 对同一矩形判定一致", () => {
    const input = {
      railRightX: 1150,
      rowTopY: 60,
      rowHeight: 32,
      size: SIZE,
      viewport: VIEW,
    };
    const a = anchorFromRail(input);
    // 翻转后左侧落点应不再越界
    expect(flipAnchor({ x: a.x, y: a.y, ...SIZE }, VIEW).x).toBe(false);
  });
});

describe("触发区判定（右半区）", () => {
  const box: Box = { left: 100, top: 0, width: 200, height: 40 };

  it("中线归右：右半区 true、左半区 false", () => {
    expect(isRightHalfOfBox({ x: 200, y: 20 }, box)).toBe(true);
    expect(isRightHalfOfBox({ x: 201, y: 20 }, box)).toBe(true);
    expect(isRightHalfOfBox({ x: 199, y: 20 }, box)).toBe(false);
    expect(isRightHalfOfBox({ x: 100, y: 20 }, box)).toBe(false);
  });

  it("与指针 y 无关，只看 x", () => {
    expect(isRightHalfOfBox({ x: 250, y: 9999 }, box)).toBe(true);
    expect(isRightHalfOfBox({ x: 50, y: 9999 }, box)).toBe(false);
  });

  it("奇数宽度：中线所在列归右（居中悬停必须触发）", () => {
    const odd: Box = { left: 0, top: 0, width: 239, height: 32 };
    expect(isRightHalfOfBox({ x: 119, y: 16 }, odd)).toBe(true);
    expect(isRightHalfOfBox({ x: 118, y: 16 }, odd)).toBe(false);
  });
});

describe("pointInBox", () => {
  const box: Box = { left: 10, top: 20, width: 100, height: 50 };

  it("边界含在内", () => {
    expect(pointInBox({ x: 10, y: 20 }, box)).toBe(true);
    expect(pointInBox({ x: 110, y: 70 }, box)).toBe(true);
    expect(pointInBox({ x: 10, y: 70 }, box)).toBe(true);
  });

  it("越界为 false；空矩形为 false", () => {
    expect(pointInBox({ x: 9, y: 20 }, box)).toBe(false);
    expect(pointInBox({ x: 111, y: 20 }, box)).toBe(false);
    expect(pointInBox({ x: 50, y: 19 }, box)).toBe(false);
    expect(pointInBox({ x: 50, y: 71 }, box)).toBe(false);
    expect(pointInBox({ x: 50, y: 50 }, null)).toBe(false);
  });
});

describe("shouldScheduleLeaveClose（离窗关闭判定）", () => {
  const pointer: { x: number; y: number } = { x: 1000, y: 700 };
  const previewBox: Box = { left: 300, top: 100, width: 320, height: 240 };
  const railBox: Box = { left: 0, top: 0, width: 240, height: 800 };
  const base = {
    pointer,
    previewBox,
    railBox,
    pinned: false,
    interacting: false,
  };

  it("指针在两者之外 → 安排关闭", () => {
    expect(shouldScheduleLeaveClose(base)).toBe(true);
  });

  it("指针在预览窗与 rail 之间的空隙（容差带内）→ 不关", () => {
    // rail 右缘 240、预览窗左缘 300，12px 间隙；指针 288 距窗 12px。
    expect(
      shouldScheduleLeaveClose({ ...base, pointer: { x: 288, y: 200 } }),
    ).toBe(false);
    // 距 rail 右缘 10px 同样在桥接带内。
    expect(
      shouldScheduleLeaveClose({ ...base, pointer: { x: 250, y: 200 } }),
    ).toBe(false);
  });

  it("指针超出容差带 → 安排关闭", () => {
    // rail 桥接带止于 260，预览窗桥接带始于 280；272 在两者之间的死区。
    expect(
      shouldScheduleLeaveClose({ ...base, pointer: { x: 272, y: 200 } }),
    ).toBe(true);
  });

  it("钉住 / 拖拽缩放中 → 不关", () => {
    expect(shouldScheduleLeaveClose({ ...base, pinned: true })).toBe(false);
    expect(shouldScheduleLeaveClose({ ...base, interacting: true })).toBe(
      false,
    );
  });

  it("指针在预览窗内 → 不关", () => {
    expect(
      shouldScheduleLeaveClose({
        ...base,
        pointer: { x: 400, y: 200 },
      }),
    ).toBe(false);
  });

  it("指针在 rail 内 → 不关", () => {
    expect(
      shouldScheduleLeaveClose({
        ...base,
        pointer: { x: 120, y: 400 },
      }),
    ).toBe(false);
  });

  it("无 rail 矩形时只按预览窗判定", () => {
    expect(
      shouldScheduleLeaveClose({
        ...base,
        railBox: null,
        pointer: { x: 120, y: 400 },
      }),
    ).toBe(true);
  });
});

describe("离窗关闭延迟", () => {
  it("PREVIEW_LEAVE_CLOSE_MS 为 180", () => {
    expect(PREVIEW_LEAVE_CLOSE_MS).toBe(180);
  });
});
