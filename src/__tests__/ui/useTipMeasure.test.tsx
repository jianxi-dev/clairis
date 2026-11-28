import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  measureTipSize,
  useTipMeasure,
} from "../../ui/primitives/useTipMeasure";

describe("measureTipSize", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 32,
      top: 0,
      left: 0,
      right: 120,
      bottom: 32,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });

  it("返回探针实测尺寸", () => {
    expect(measureTipSize("保存", null)).toEqual({ width: 120, height: 32 });
  });

  it("带 hint 时同样返回尺寸", () => {
    expect(measureTipSize("保存", "Markdown: **粗体**")).toEqual({
      width: 120,
      height: 32,
    });
  });

  it("测量后不把探针留在 DOM 里", () => {
    measureTipSize("保存", "提示");
    expect(document.querySelectorAll(".app-tip").length).toBe(0);
    expect(document.body.childElementCount).toBe(0);
  });
});

describe("useTipMeasure", () => {
  it("跨重渲染返回同一函数引用（事件回调里可安全依赖）", () => {
    const { result, rerender } = renderHook(() => useTipMeasure());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
