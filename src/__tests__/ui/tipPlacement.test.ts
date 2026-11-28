import { describe, expect, it } from "vitest";
import {
  chooseTipSide,
  tipAnchorFor,
  type TipSize,
} from "../../ui/primitives/tipPlacement";

const VIEWPORT = { width: 1000, height: 800 };
const SIZE: TipSize = { width: 120, height: 30 };

function elWithRect(
  rect: Partial<DOMRect>,
  containerClass?: string,
): { el: Element; host: HTMLElement } {
  const host = document.createElement("div");
  if (containerClass) host.className = containerClass;
  const el = document.createElement("span");
  host.append(el);
  document.body.append(host);
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    }) as DOMRect;
  return { el, host };
}

describe("chooseTipSide", () => {
  it("贴视口顶缘时翻到下方", () => {
    const { el } = elWithRect({ left: 400, right: 440, top: 6, bottom: 26, width: 40, height: 20 });
    expect(chooseTipSide(el, SIZE, VIEWPORT)).toBe("below");
  });

  it("贴视口底缘时翻到上方", () => {
    const { el } = elWithRect({ left: 400, right: 440, top: 740, bottom: 770, width: 40, height: 30 });
    expect(chooseTipSide(el, SIZE, VIEWPORT)).toBe("above");
  });

  it("上下都放不下时侧弹，并选离中线更近的一侧", () => {
    const tall: TipSize = { width: 120, height: 800 };
    const leftEl = elWithRect({ left: 100, right: 140, top: 300, bottom: 340, width: 40, height: 40 });
    expect(chooseTipSide(leftEl.el, tall, VIEWPORT)).toBe("right");
    const rightEl = elWithRect({ left: 880, right: 920, top: 300, bottom: 340, width: 40, height: 40 });
    expect(chooseTipSide(rightEl.el, tall, VIEWPORT)).toBe("left");
  });

  it("浮层菜单内的行不侧弹：上方无空间时落在下方", () => {
    const { el } = elWithRect(
      { left: 100, right: 240, top: 20, bottom: 50, width: 140, height: 30 },
      "context-menu",
    );
    expect(chooseTipSide(el, SIZE, VIEWPORT)).toBe("below");
  });

  it("浮层菜单内的行上方有空间时落在上方", () => {
    const { el } = elWithRect(
      { left: 100, right: 240, top: 400, bottom: 430, width: 140, height: 30 },
      "tab-context-menu",
    );
    expect(chooseTipSide(el, SIZE, VIEWPORT)).toBe("above");
  });
});

describe("tipAnchorFor", () => {
  it("above 取元素上沿、水平居中", () => {
    const { el } = elWithRect({ left: 400, right: 440, top: 200, bottom: 230, width: 40, height: 30 });
    expect(tipAnchorFor(el, "above", SIZE, VIEWPORT)).toEqual({ x: 420, y: 200 });
  });

  it("below 取元素下沿", () => {
    const { el } = elWithRect({ left: 400, right: 440, top: 200, bottom: 230, width: 40, height: 30 });
    expect(tipAnchorFor(el, "below", SIZE, VIEWPORT)).toEqual({ x: 420, y: 230 });
  });

  it("left / right 取元素左右沿、垂直居中", () => {
    const { el } = elWithRect({ left: 400, right: 440, top: 200, bottom: 230, width: 40, height: 30 });
    expect(tipAnchorFor(el, "right", SIZE, VIEWPORT)).toEqual({ x: 440, y: 215 });
    expect(tipAnchorFor(el, "left", SIZE, VIEWPORT)).toEqual({ x: 400, y: 215 });
  });

  it("贴左边时水平锚点被夹住，不探出视口", () => {
    const { el } = elWithRect({ left: 0, right: 40, top: 200, bottom: 230, width: 40, height: 30 });
    expect(tipAnchorFor(el, "above", SIZE, VIEWPORT).x).toBe(60);
  });
});
