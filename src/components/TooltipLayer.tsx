import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isOverlayOpen, subscribeOverlay } from "../lib/overlayGate";
import { ACTION_TIPS } from "../lib/action-tips";
import { useEditorStore } from "../stores/editorStore";
import { noticeDurationMs } from "../hooks/useConfig";
import {
  chooseTipSide,
  tipAnchorFor,
  type TipSide,
  type TipSize,
} from "../ui/primitives/tipPlacement";
import { useTipMeasure } from "../ui/primitives/useTipMeasure";

/** 嵌入式文档的 `title` 是它的无障碍名（如 HTML 可视化编辑 iframe）：
 *  摘掉会让控件失去可访问名，提示本身也只是噪音，保持原样不接管。 */
const KEEP_TITLE_SELECTOR = "iframe, object, embed";


interface TipState {
  main: string;
  hint: string | null;
  side: TipSide;
  x: number;
  y: number;
}

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

/** 由触发元素推导提示内容：图标+文字只给快捷键；纯图标给名称 + 快捷键 + 用法。 */
function tipContentFor(
  el: Element,
  name: string,
): { main: string; hint: string | null } {
  const meta = ACTION_TIPS[el.getAttribute("data-action") ?? ""];
  if (!meta) return { main: name, hint: null };
  if (visibleLabel(el) !== "") return { main: meta.shortcut, hint: null };
  return {
    main: `${name} (${meta.shortcut})`,
    hint: meta.markdown ? `Markdown: ${meta.markdown}` : null,
  };
}

/**
 * 全局胶囊提示（ui-polish-batch12 9.1；batch20 C1 收敛）。
 *
 * 事件委托捕获既有 `title` 属性：悬停满配置时长后显示自绘胶囊，并把原生
 * `title` 暂时摘除（避免系统矩形提示叠加）；指针离开 / 按下 / 弹层关闭时还原。
 * 一切带 `title` 的控件（含 `aria-haspopup` / `aria-expanded` / `data-no-tip`）
 * 都被接管，原生矩形无处出现；弹层打开期间只摘 title、不补胶囊。
 */
export default function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);
  const measure = useTipMeasure();
  const timerRef = useRef<number | null>(null);
  const currentRef = useRef<Element | null>(null);

  useEffect(() => {
    const cancelTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // 只藏胶囊、保留 title 摘除状态：弹层打开期间不放行原生 title。
    const hideTip = () => {
      cancelTimer();
      setTip(null);
    };
    const clear = () => {
      restore();
      hideTip();
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
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("[title]");
      if (!el || el === currentRef.current) return;
      if (el.matches(KEEP_TITLE_SELECTOR)) return;
      restore();
      const text = el.getAttribute("title") ?? "";
      if (!text.trim()) {
        currentRef.current = null;
        return;
      }
      currentRef.current = el;
      el.removeAttribute("title");
      el.setAttribute("data-tip", text);
      // 弹层打开期间只摘原生 title、不补胶囊（提示与浮层重复）。
      if (isOverlayOpen()) return;
      cancelTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (isOverlayOpen()) return;
        // 指针已离开（onDownRestore/restore 清空 currentRef）时不再补弹，
        // 否则会在轮盘扇区上冒出上一个控件的提示且无人收（#819）。
        const el = currentRef.current;
        if (!el) return;
        const content = tipContentFor(el, el.getAttribute("data-tip") ?? "");
        const size = measure(content.main, content.hint);
        const side = chooseTipSide(el, size);
        const { x, y } = tipAnchorFor(el, side, size);
        setTip({ ...content, side, x, y });
      }, noticeDurationMs(useEditorStore.getState().config.noticeDuration));
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
      clear();
    };

    const onDownRestore = () => {
      // 弹层打开期间不还原 title：指针停留会触发系统原生矩形提示（#945）。
      // 关闭弹层时由 subscribeOverlay(false) → restore() 统一还原。
      if (isOverlayOpen()) return;
      // 点击瞬间还原 title：既有序列化断言依赖它；胶囊保持显示，不做二次摘除。
      restore();
    };

    const unsubscribe = subscribeOverlay((open) => {
      if (open) hideTip();
      else restore();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      // Esc 会先移除悬停元素（轮盘 / 菜单），绕开 pointerout 留下孤儿胶囊（#819）。
      if (e.key === "Escape") clear();
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
      restore();
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
