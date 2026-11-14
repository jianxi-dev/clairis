import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isOverlayOpen, subscribeOverlay } from "../lib/overlayGate";
import { useEditorStore } from "../stores/editorStore";

/** 未配置「提示时长」时的回退延迟（ms）。 */
const TIP_DELAY_FALLBACK_MS = 400;

/** 延迟上下限（ms）。 */
const TIP_DELAY_MIN_MS = 100;
const TIP_DELAY_MAX_MS = 10_000;

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
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(
    null,
  );
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
      const x = e.clientX;
      const y = e.clientY;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (isOverlayOpen()) return;
        // 指针已离开（onDownRestore/restore 清空 currentRef）时不再补弹，
        // 否则会在轮盘扇区上冒出上一个控件的提示且无人收（#819）。
        if (!currentRef.current) return;
        setTip({ text, x, y });
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
  const below = tip.y < 64;
  return createPortal(
    <div
      className={`app-tip ${below ? "app-tip--below" : "app-tip--above"}`}
      style={{
        left: Math.min(Math.max(tip.x, 60), window.innerWidth - 60),
        top: tip.y,
      }}
      role="tooltip"
    >
      {tip.text}
    </div>,
    document.body,
  );
}
