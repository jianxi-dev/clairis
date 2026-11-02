/* 编排层 hover 门控（md-orchestration 1.1，对应 design.md D5）。
 *
 * 统一管理「召唤与消退」：只有鼠标停留够久才显现，键盘输入 / 触摸 / 笔 / 拖拽中
 * 一律不触发。用注入时间驱动（`tick(now)`），不依赖真实定时器，因此可单测。
 */

export type PointerKind = "mouse" | "touch" | "pen";

/** 鼠标停留多久才显现。 */
export const SHOW_DELAY_MS = 300;
/** 离开后多久才收起（给「斜向移到菜单」留缓冲）。 */
export const HIDE_DELAY_MS = 150;

export class HoverGate {
  private pendingShowAt: number | null = null;
  private pendingHideAt: number | null = null;
  private open = false;
  private suppressed = false;

  /**
   * 进入触发区。
   *
   * 仅 `mouse` 生效；触摸 / 笔与抑制状态（键盘输入、拖拽中）不触发。
   * 已打开时再次进入只取消待关闭，不重新计时。
   */
  enter(kind: PointerKind, now: number): void {
    if (kind !== "mouse") return;
    this.pendingHideAt = null;
    if (this.open) return;
    if (this.suppressed) return;
    this.pendingShowAt = now + SHOW_DELAY_MS;
  }

  /**
   * 离开触发区。
   *
   * 取消待显现，并在已打开时安排延迟收起（`HIDE_DELAY_MS`）。
   */
  leave(kind: PointerKind, now: number): void {
    if (kind !== "mouse") return;
    this.pendingShowAt = null;
    if (this.open) {
      this.pendingHideAt = now + HIDE_DELAY_MS;
    }
  }

  /** 推进到 `now`：到点的待办返回 `"show"` / `"hide"`，否则返回 `null`。 */
  tick(now: number): "show" | "hide" | null {
    if (this.pendingShowAt !== null && now >= this.pendingShowAt) {
      this.pendingShowAt = null;
      this.pendingHideAt = null;
      this.open = true;
      return "show";
    }
    if (this.pendingHideAt !== null && now >= this.pendingHideAt) {
      this.pendingHideAt = null;
      this.open = false;
      return "hide";
    }
    return null;
  }

  /** 取消所有待办并立即收起。 */
  cancel(): void {
    this.pendingShowAt = null;
    this.pendingHideAt = null;
    this.open = false;
  }

  isOpen(): boolean {
    return this.open;
  }

  /** 抑制开关：键盘输入 / 拖拽进行中为 `true`，期间不触发 hover。 */
  suppress(active = true): void {
    this.suppressed = active;
    if (active) this.pendingShowAt = null;
  }
}
