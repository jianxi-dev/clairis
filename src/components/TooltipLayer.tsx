import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isOverlayOpen, subscribeOverlay } from "../lib/overlayGate";
import { useEditorStore } from "../stores/editorStore";

/** 未配置「提示时长」时的回退延迟（ms）。 */
const TIP_DELAY_FALLBACK_MS = 400;

/** 延迟上下限（ms）。 */
const TIP_DELAY_MIN_MS = 100;
const TIP_DELAY_MAX_MS = 10_000;

/** 顶栏高度：触发元素顶部小于该值时向下弹，避免遮挡相邻按钮。 */
const TIP_TOP_RESERVE = 80;
/** 视口左右各占该比例视为侧弹区（左半放右、右半放左）。 */
const TIP_SIDE_ZONE = 0.4;
/** 锚点夹取边距（px）。 */
const TIP_ANCHOR_MARGIN = 60;

/** 弹出方位：above=提示在触发元素上方（箭头朝下），其余同理。 */
type TipSide = "above" | "below" | "left" | "right";

interface TipState {
  main: string;
  hint: string | null;
  side: TipSide;
  x: number;
  y: number;
}

/** 动作 id → 提示元数据；键位显示口径 `⌘ + X` 见 R-26 锚点 A-26.2/A-26.3。 */
const TIP_META: Readonly<
  Record<string, { shortcut: string; markdown?: string }>
> = {
  "format-underline": { shortcut: "⌘ + U", markdown: "~文本~ 空格" },
  duplicate: { shortcut: "⌘ + C" },
};

/** 元素自身的可见文字（跳过 SVG 图标与 aria-hidden 节点）。 */
function visibleLabel(el: Element): string {
  let out = "";
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (tag === "svg" || tag === "script" || tag === "style") return;
    if (element.getAttribute("aria-hidden") === "true") return;
    for (const child of Array.from(element.childNodes)) walk(child);
  };
  for (const child of Array.from(el.childNodes)) walk(child);
  return out.trim();
}

/** 按触发元素在视口中的位置选弹出方位。 */
function tipSideFor(el: Element): TipSide {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const w = window.innerWidth;
  if (rect.top < TIP_TOP_RESERVE) return "below";
  if (cx < w * TIP_SIDE_ZONE) return "right";
  if (cx > w * (1 - TIP_SIDE_ZONE)) return "left";
  return "above";
}

/** 由触发元素推导提示内容：图标+文字只给快捷键；纯图标给名称 + 快捷键 + 用法。 */
function tipContentFor(
  el: Element,
  name: string,
): { main: string; hint: string | null } {
  const meta = TIP_META[el.getAttribute("data-action") ?? ""];
  if (!meta) return { main: name, hint: null };
  if (visibleLabel(el) !== "") return { main: meta.shortcut, hint: null };
  return {
    main: `${name} (${meta.shortcut})`,
    hint: meta.markdown ? `Markdown: ${meta.markdown}` : null,
  };
}

/** 把 value 夹进 [min, max]。 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 弹出锚点：above/below 取元素上下沿水平居中，left/right 取元素左右沿垂直居中。 */
function tipAnchorFor(el: Element, side: TipSide): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  if (side === "right" || side === "left") {
    return {
      x: side === "right" ? rect.right : rect.left,
      y: clamp(cy, TIP_ANCHOR_MARGIN, window.innerHeight - TIP_ANCHOR_MARGIN),
    };
  }
  return {
    x: clamp(cx, TIP_ANCHOR_MARGIN, window.innerWidth - TIP_ANCHOR_MARGIN),
    y: side === "above" ? rect.top : rect.bottom,
  };
}

/** 悬停提示延迟：取配置「提示时长」（秒），钳制 100–10000ms，未配置回退 400ms。 */
function tipDelayMs(): number {
  const seconds = useEditorStore.getState().config.noticeDuration;
  if (seconds == null || !Number.isFinite(seconds))
    return TIP_DELAY_FALLBACK_MS;
  const ms = Math.round(seconds * 1000);
  return Math.min(TIP_DELAY_MAX_MS, Math.max(TIP_DELAY_MIN_MS, ms));
}

/** 会弹菜单/浮层的触发按钮：提示会与浮层重复，直接跳过。 */
const SKIP_TIP_SELECTOR = "[aria-haspopup], [aria-expanded], [data-no-tip]";

/**
 * 全局胶囊提示（ui-polish-batch12 9.1）。
 *
 * 事件委托捕获既有 `title` 属性：悬停满配置时长后显示自绘胶囊，并把原生
 * `title` 暂时摘除（避免系统矩形提示叠加）；指针离开 / 按下时还原。
 * 会弹菜单/浮层的触发按钮跳过提示——提示与浮层信息重复。
 * 约 80 处既有 `title=` 无需逐个改造。
 */
export default function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);
  const timerRef = useRef<number | null>(null);
  const currentRef = useRef<Element | null>(null);

  useEffect(() => {
    const cancelTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const clear = () => {
      cancelTimer();
      setTip(null);
      currentRef.current = null;
    };
    const restore = () => {
      const el = currentRef.current;
      if (el) {
        const text = el.getAttribute("data-tip");
        if (text !== null && !el.hasAttribute("title")) {
          el.setAttribute("title", text);
        }
        el.removeAttribute("data-tip");
      }
      currentRef.current = null;
    };

    const onOver = (e: PointerEvent) => {
      if (isOverlayOpen()) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("[title]");
      if (!el || el === currentRef.current) return;
      restore();
      const text = el.getAttribute("title") ?? "";
      if (!text.trim() || el.closest(SKIP_TIP_SELECTOR)) {
        currentRef.current = null;
        return;
      }
      currentRef.current = el;
      el.removeAttribute("title");
      el.setAttribute("data-tip", text);
      cancelTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (isOverlayOpen()) return;
        // 指针已离开（onDownRestore/restore 清空 currentRef）时不再补弹，
        // 否则会在轮盘扇区上冒出上一个控件的提示且无人收（#819）。
        const el = currentRef.current;
        if (!el) return;
        const content = tipContentFor(el, el.getAttribute("data-tip") ?? "");
        const side = tipSideFor(el);
        const { x, y } = tipAnchorFor(el, side);
        setTip({ ...content, side, x, y });
      }, tipDelayMs());
    };

    const onOut = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const related = e.relatedTarget;
      if (
        currentRef.current &&
        related instanceof Element &&
        currentRef.current.contains(related)
      ) {
        return;
      }
      // currentRef 可能已被 onDownRestore 清空（title 已还原）；此时仍要清掉
      // 已排队的提示定时器，否则离开后提示会突然补弹并滞留（#819）。
      restore();
      clear();
    };

    const onDownRestore = () => {
      // 点击瞬间还原 title：既有序列化断言（如主题循环按钮）依赖它；
      // 胶囊保持显示，不做二次摘除。
      restore();
    };

    const unsubscribe = subscribeOverlay((open) => {
      if (open) clear();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      // Esc 会先移除悬停元素（轮盘 / 菜单），绕开 pointerout 留下孤儿胶囊（#819）。
      if (e.key === "Escape") {
        restore();
        clear();
      }
    };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("pointerdown", onDownRestore, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("blur", clear);
    return () => {
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerout", onOut, true);
      document.removeEventListener("pointerdown", onDownRestore, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("blur", clear);
      unsubscribe();
      cancelTimer();
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div
      className={`app-tip app-tip--${tip.side}`}
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      <span className="app-tip__text">{tip.main}</span>
      {tip.hint ? <span className="app-tip__hint">{tip.hint}</span> : null}
      <span className="app-tip__arrow" aria-hidden="true" />
    </div>,
    document.body,
  );
}
