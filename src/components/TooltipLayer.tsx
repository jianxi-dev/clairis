import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isOverlayOpen, subscribeOverlay } from "../lib/overlayGate";
import { useEditorStore } from "../stores/editorStore";

/** 未配置「提示时长」时的回退延迟（ms）。 */
const TIP_DELAY_FALLBACK_MS = 400;

/** 延迟上下限（ms）。 */
const TIP_DELAY_MIN_MS = 100;
const TIP_DELAY_MAX_MS = 10_000;

/** 提示外壳与触发元素之间的间隙（箭头尾 8px）。 */
const TIP_GAP = 8;
/** 提示与视口边缘的最小留白（px）。 */
const TIP_VIEWPORT_MARGIN = 4;
/**
 * 嵌入式文档的 `title` 是它的无障碍名（如 HTML 可视化编辑 iframe）：
 * 摘掉会让控件失去可访问名，提示本身也只是噪音，保持原样不接管。
 */
const KEEP_TITLE_SELECTOR = "iframe, object, embed";

interface TipSize {
  width: number;
  height: number;
}

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

/** 用与自绘胶囊同一外壳的隐藏探针量出提示尺寸，供方位判断使用。 */
function measureTip(main: string, hint: string | null): TipSize {
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

/** 按触发元素在视口中的位置选弹出方位：优先上，其次下，都放不下才侧弹。 */
function tipSideFor(el: Element, size: TipSize): TipSide {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const verticalNeed = size.height + TIP_GAP;
  if (rect.top - verticalNeed >= TIP_VIEWPORT_MARGIN) return "above";
  if (rect.bottom + verticalNeed <= window.innerHeight - TIP_VIEWPORT_MARGIN)
    return "below";
  const horizontalNeed = size.width + TIP_GAP;
  const fitsRight =
    rect.right + horizontalNeed <= window.innerWidth - TIP_VIEWPORT_MARGIN;
  const fitsLeft = rect.left - horizontalNeed >= TIP_VIEWPORT_MARGIN;
  if (fitsRight && fitsLeft) return cx < window.innerWidth / 2 ? "right" : "left";
  if (fitsRight) return "right";
  if (fitsLeft) return "left";
  return rect.left > window.innerWidth - rect.right ? "left" : "right";
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

/** 弹出锚点：above/below 取元素上下沿水平居中，left/right 取元素左右沿垂直居中。
 *  夹取范围按提示自身尺寸算，否则贴边长提示会被视口裁掉一半。 */
function tipAnchorFor(
  el: Element,
  side: TipSide,
  size: TipSize,
): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  if (side === "right" || side === "left") {
    const halfH = Math.min(size.height / 2, window.innerHeight / 2);
    return {
      x: side === "right" ? rect.right : rect.left,
      y: clamp(cy, halfH, window.innerHeight - halfH),
    };
  }
  const halfW = Math.min(size.width / 2, window.innerWidth / 2);
  return {
    x: clamp(cx, halfW, window.innerWidth - halfW),
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

/**
 * 全局胶囊提示（ui-polish-batch12 9.1）。
 *
 * 事件委托捕获既有 `title` 属性：悬停满配置时长后显示自绘胶囊，并把原生
 * `title` 暂时摘除（避免系统矩形提示叠加）；指针离开 / 按下时还原。
 * 带 `aria-haspopup` / `aria-expanded` / `data-no-tip` 的控件同样接管，
 * 不再放行原生矩形；弹层打开期间只接管 title、不弹自绘胶囊。
 * 嵌入式文档（iframe 等）例外：title 即其可访问名，保持原样。
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
    const dismiss = () => {
      cancelTimer();
      setTip(null);
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
    // 滚动/失焦时指针可能不再收到 pointerout，必须连带还原 title，
    // 否则该元素会永久失去 title 且再次悬停也不再出提示。
    const dismissAndRestore = () => {
      restore();
      dismiss();
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
      // data-no-tip 是显式「不要提示」：只摘原生 title，不弹胶囊。
      if (el.closest("[data-no-tip]")) {
        dismiss();
        return;
      }
      if (isOverlayOpen()) {
        dismiss();
        return;
      }
      cancelTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (isOverlayOpen()) return;
        // 指针已离开（onDownRestore/restore 清空 currentRef）时不再补弹，
        // 否则会在轮盘扇区上冒出上一个控件的提示且无人收（#819）。
        const el = currentRef.current;
        if (!el) return;
        const content = tipContentFor(el, el.getAttribute("data-tip") ?? "");
        const size = measureTip(content.main, content.hint);
        const side = tipSideFor(el, size);
        const { x, y } = tipAnchorFor(el, side, size);
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
      dismiss();
    };

    const onDownRestore = () => {
      // 点击瞬间还原 title：主题按钮等既有契约依赖它（跟进票 #945 处理
      // 弹层打开期间点击会短暂还原 title 的原生矩形风险）。
      restore();
    };

    const unsubscribe = subscribeOverlay((open) => {
      if (open) dismiss();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      // Esc 会先移除悬停元素（轮盘 / 菜单），绕开 pointerout 留下孤儿胶囊（#819）。
      if (e.key === "Escape") {
        restore();
        dismiss();
      }
    };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("pointerdown", onDownRestore, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", dismissAndRestore, true);
    window.addEventListener("blur", dismissAndRestore);
    return () => {
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerout", onOut, true);
      document.removeEventListener("pointerdown", onDownRestore, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", dismissAndRestore, true);
      window.removeEventListener("blur", dismissAndRestore);
      restore();
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
