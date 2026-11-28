import { useCallback } from "react";
import type { TipSize } from "./tipPlacement";

/**
 * 提示尺寸测量（ui-quality-primitives-v1 / 2.3）。
 *
 * 用与自绘胶囊同一外壳的隐藏探针量出真实尺寸：纯估算在长文案、带 hint、
 * 不同字号档下都会偏，导致方位判断与贴边夹取失准。探针遵循
 * 「append → 读 rect → remove」，不留在 DOM 里。
 *
 * 抽成模块而非留在组件内，是为了让其他胶囊类浮层复用同一测量口径；
 * 组件侧通过 `useTipMeasure()` 拿到稳定引用（事件回调里调用，不参与渲染）。
 */
export function measureTipSize(main: string, hint: string | null): TipSize {
  const probe = document.createElement("div");
  probe.className = "app-tip";
  probe.style.visibility = "hidden";
  probe.style.left = "-9999px";
  probe.style.top = "0";
  const text = document.createElement("span");
  text.className = "app-tip__text";
  text.textContent = main;
  probe.append(text);
  if (hint !== null) {
    const hintEl = document.createElement("span");
    hintEl.className = "app-tip__hint";
    hintEl.textContent = hint;
    probe.append(hintEl);
  }
  const arrow = document.createElement("span");
  arrow.className = "app-tip__arrow";
  probe.append(arrow);
  document.body.append(probe);
  const rect = probe.getBoundingClientRect();
  const size = { width: rect.width, height: rect.height };
  probe.remove();
  return size;
}

/** 返回稳定的测量函数引用，供事件回调使用。 */
export function useTipMeasure(): (main: string, hint: string | null) => TipSize {
  return useCallback((main: string, hint: string | null) => measureTipSize(main, hint), []);
}
