import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isOverlayOpen, subscribeOverlay } from "../lib/overlayGate";

/** 悬停满 1 分钟才提示：避免指针一滑过就弹。 */
const TIP_DELAY_MS = 60_000;

/** 会弹菜单/浮层的触发按钮：提示会与浮层重复，直接跳过。 */
const SKIP_TIP_SELECTOR = "[aria-haspopup], [aria-expanded], [data-no-tip]";

/**
 * 全局胶囊提示（ui-polish-batch12 9.1）。
 *
 * 事件委托捕获既有 `title` 属性：悬停满 60 秒后显示自绘胶囊，并把原生
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
        setTip({ text, x, y });
      }, TIP_DELAY_MS);
    };

    const onOut = (e: PointerEvent) => {
      const target = e.target;
      if (currentRef.current && target instanceof Element) {
        const related = e.relatedTarget;
        if (
          related instanceof Element &&
          currentRef.current.contains(related)
        ) {
          return;
        }
        restore();
        clear();
      }
    };

    const onDownRestore = () => {
      // 点击瞬间还原 title：既有序列化断言（如主题循环按钮）依赖它；
      // 胶囊保持显示，不做二次摘除。
      restore();
    };

    const unsubscribe = subscribeOverlay((open) => {
      if (open) clear();
    });

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("pointerdown", onDownRestore, true);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("blur", clear);
    return () => {
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerout", onOut, true);
      document.removeEventListener("pointerdown", onDownRestore, true);
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
