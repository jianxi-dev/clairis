/**
 * 弹窗打开计数（#568）。
 *
 * 悬停胶囊由 TooltipLayer 事件委托驱动，弹窗（右键菜单、栏目菜单、状态栏
 * 弹层）打开时提示属于多余信息。用计数而非布尔，避免多个弹层并存时提前复位。
 */

type Listener = (open: boolean) => void;

let openCount = 0;
const listeners = new Set<Listener>();

function notify(): void {
  const open = openCount > 0;
  for (const listener of listeners) listener(open);
}

export function pushOverlay(): void {
  openCount += 1;
  notify();
}

export function popOverlay(): void {
  openCount = Math.max(0, openCount - 1);
  notify();
}

export function isOverlayOpen(): boolean {
  return openCount > 0;
}

export function subscribeOverlay(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
