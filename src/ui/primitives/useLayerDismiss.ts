import { useEffect, useRef } from "react";

interface LayerEntry {
  ref: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  enabled: boolean;
  dismissOnOutside: boolean;
  dismissOnScroll: boolean;
  isInsideExtra?: (target: Node) => boolean;
}

const stack: LayerEntry[] = [];

function topLayer(): LayerEntry | undefined {
  return stack[stack.length - 1];
}

function isInside(entry: LayerEntry, target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  if (entry.ref.current?.contains(target)) return true;
  return entry.isInsideExtra?.(target) ?? false;
}

/**
 * 层栈关闭仲裁（ui-quality-primitives-v1 / 2.2）。
 *
 * 模块级栈：挂载注册、卸载注销。Esc / 点外 / 滚动 / resize 都只作用于**栈顶**，
 * 对齐 `docs/design/system/interaction.md` §4「Esc 只退场」——非栈顶层不得响应。
 *
 * entry 在挂载时创建一次、整个挂载期身份稳定：回调与开关经 ref 读最新值，
 * effect 只在 `enabled` 变化时重挂——否则调用点传内联箭头会让下层重渲染后
 * 被重新压到栈顶，抢走 Esc。滚动 / 指针事件目标落在本层内（含菜单自身可滚动
 * 列表等后代）时忽略。
 */
export function useLayerDismiss(options: {
  ref: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  enabled?: boolean;
  dismissOnOutside?: boolean;
  dismissOnScroll?: boolean;
  /** 判定「点内」的额外宿主（如菜单触发器），缺省只看 ref */
  isInside?: (target: EventTarget | null) => boolean;
}): void {
  const { ref, enabled = true } = options;
  const optsRef = useRef(options);
  optsRef.current = options;
  const onDismissRef = useRef(options.onDismiss);
  onDismissRef.current = options.onDismiss;

  useEffect(() => {
    const entry: LayerEntry = {
      ref,
      onDismiss: () => onDismissRef.current(),
      enabled,
      dismissOnOutside: optsRef.current.dismissOnOutside ?? true,
      dismissOnScroll: optsRef.current.dismissOnScroll ?? true,
      isInsideExtra: (target) => optsRef.current.isInside?.(target) ?? false,
    };
    stack.push(entry);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!entry.enabled) return;
      if (topLayer() !== entry) return;
      e.stopPropagation();
      entry.onDismiss();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!entry.dismissOnOutside) return;
      if (!entry.enabled) return;
      if (topLayer() !== entry) return;
      if (isInside(entry, e.target)) return;
      entry.onDismiss();
    };

    const onScroll = (e: Event) => {
      if (!entry.dismissOnScroll) return;
      if (!entry.enabled) return;
      if (topLayer() !== entry) return;
      if (isInside(entry, e.target)) return;
      entry.onDismiss();
    };

    const onResize = () => {
      if (!entry.enabled) return;
      if (topLayer() !== entry) return;
      entry.onDismiss();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [ref, enabled]);
}
