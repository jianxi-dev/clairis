import { describe, expect, it } from "vitest";
import { reconcileFullscreen } from "../../lib/fullscreenReconcile";

/**
 * 全屏状态对账（#944）。
 *
 * webFullscreen = ArtPlayer fullscreenWeb（网页全屏，铺满 webview）
 * nativeFullscreen = Tauri 窗口原生全屏（isFullscreen()）
 *
 * 合法态：同真（整屏全屏）、同假（普通窗口）、以及「网页全屏 + 窗口非全屏」
 * （widthMode === "page"，由调用方在墙外排除，不属本纯函数职责）。
 * 漂移态：网页残留 true 而原生已退出（系统级 Esc / 手势 / Cmd+Ctrl+F）。
 * #1148：原生被外部进入（窗口全屏按钮 / TabBar 空白双击）只做窗口级全屏，
 * 不再对账成网页全屏（视频保持原位）。
 */
describe("reconcileFullscreen 全屏状态对账", () => {
  it("同真：整屏全屏已同步，无需任何动作", () => {
    expect(reconcileFullscreen(true, true)).toEqual({
      webFullscreen: null,
      decorations: null,
      nativeFullscreen: null,
      resetWidthMode: false,
    });
  });

  it("同假：普通窗口已同步，无需任何动作", () => {
    expect(reconcileFullscreen(false, false)).toEqual({
      webFullscreen: null,
      decorations: null,
      nativeFullscreen: null,
      resetWidthMode: false,
    });
  });

  it("网页 true / 原生 false：系统级退出原生全屏 → 反向复位网页状态 + 恢复装饰 + 复位宽度档", () => {
    expect(reconcileFullscreen(true, false)).toEqual({
      webFullscreen: false,
      decorations: true,
      // 原生已退出，不重复调用 setFullscreen
      nativeFullscreen: null,
      resetWidthMode: true,
    });
  });

  it("网页 false / 原生 true：外部进入原生全屏只做窗口级全屏，不联动视频（#1148）", () => {
    expect(reconcileFullscreen(false, true)).toEqual({
      webFullscreen: null,
      decorations: null,
      // 原生已激活，不重复调用 setFullscreen
      nativeFullscreen: null,
      resetWidthMode: false,
    });
  });

  it("幂等：按返回值执行后，再次对账必定无动作（连续 resize 不抖动）", () => {
    for (const [web, native] of [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ] as const) {
      const first = reconcileFullscreen(web, native);
      const nextWeb = first.webFullscreen ?? web;
      const nextNative = first.nativeFullscreen ?? native;
      expect(reconcileFullscreen(nextWeb, nextNative)).toEqual({
        webFullscreen: null,
        decorations: null,
        nativeFullscreen: null,
        resetWidthMode: false,
      });
    }
  });
});
