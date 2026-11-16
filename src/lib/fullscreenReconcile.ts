/**
 * 全屏状态对账（#944）。
 *
 * 背景：`VideoPlayer` 的网页全屏（ArtPlayer `fullscreenWeb`）与 Tauri 窗口原生全屏
 * （`isFullscreen()`）是两套状态。既有同步只走「网页 → 窗口」单向
 * （`syncWindowFullscreen`），系统级退出原生全屏（Esc / 三指手势 / Cmd+Ctrl+F）
 * 不触发任何网页事件，于是网页状态残留、`setDecorations(false)` 遗留。
 *
 * 本模块只做纯决策：给出目标状态与需要执行的副作用，不碰窗口 API，
 * 由调用方按返回值动作。状态一致时全部返回 `null` / `false`，
 * 调用方据此跳过 → 连续 resize 事件天然幂等。
 */

/** 对账结果；`null` / `false` 一律表示「无需动作」。 */
export interface FullscreenReconcileResult {
  /** 目标网页全屏（ArtPlayer `fullscreenWeb`）；`null` = 不变 */
  webFullscreen: boolean | null;
  /** 目标窗口装饰（`setDecorations`）；`null` = 不变 */
  decorations: boolean | null;
  /** 目标原生全屏（`setFullscreen`）；`null` = 不变 */
  nativeFullscreen: boolean | null;
  /** 是否把宽度档复位到进入全屏前（由调用方持有该值） */
  resetWidthMode: boolean;
}

/** 无动作（两态一致）。 */
const IDLE: FullscreenReconcileResult = {
  webFullscreen: null,
  decorations: null,
  nativeFullscreen: null,
  resetWidthMode: false,
};

/**
 * 计算网页全屏与原生全屏的同步动作。
 *
 * 四组合：
 * - `(true, true)` / `(false, false)`：已同步 → 无动作。
 * - `(true, false)`：原生已被系统级退出而网页残留 → 复位网页状态、恢复装饰、复位宽度档。
 * - `(false, true)`：原生已被外部进入（窗口全屏按钮 / TabBar 空白双击）→ 补齐网页状态、去装饰。
 *
 * 注意：「网页全屏 true + 原生全屏 false」也是 `widthMode === "page"` 的合法设计态，
 * 调用方须先排除该档位再调用本函数，否则会把 page 档误判为漂移。
 */
export function reconcileFullscreen(
  webFullscreen: boolean,
  nativeFullscreen: boolean,
): FullscreenReconcileResult {
  if (webFullscreen === nativeFullscreen) {
    return IDLE;
  }
  if (webFullscreen) {
    // 原生全屏已退出（系统级 Esc / 手势 / Cmd+Ctrl+F）：反向复位。
    return {
      webFullscreen: false,
      decorations: true,
      nativeFullscreen: null,
      resetWidthMode: true,
    };
  }
  // 原生全屏已进入（外部入口）：补齐网页状态。
  return {
    webFullscreen: true,
    decorations: false,
    nativeFullscreen: null,
    resetWidthMode: false,
  };
}
