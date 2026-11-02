/* 编排层菜单栈（md-orchestration 1.1，对应 design.md D2）。
 *
 * 模块级单例，统一管理所有浮层的生命周期：滑入即显示、离栈即收、不 retarget。
 * 纯逻辑——不挂 DOM 监听，由调用方在 pointerenter / pointerleave 时驱动。
 *
 * 不 retarget：栈打开期间指针移到其它块时，`push` 返回 `null` 且不入栈。
 * 只有同 owner 的层才能入栈；同一层重入时返回已有 token，不重复触发 onClose。
 */

/** 浮层的归属块。`null` 表示无归属（如全局调色板）。 */
export type MenuOwner = { blockFrom: number; blockTo: number } | null;

export interface MenuEntry {
  id: string;
  owner: MenuOwner;
  element: HTMLElement;
  onClose: (reason: string) => void;
}

export type MenuToken = symbol;

/** owner 的等价键：`null` 视为同一 owner。 */
function ownerKey(owner: MenuOwner): string {
  return owner === null ? "null" : `${owner.blockFrom}:${owner.blockTo}`;
}

interface StackedEntry {
  entry: MenuEntry;
  token: MenuToken;
  closed: boolean;
}

export class MenuStack {
  private items: StackedEntry[] = [];
  private byToken = new Map<MenuToken, StackedEntry>();

  /**
   * 入栈。
   *
   * - 栈非空且 owner 与栈顶不同 → 返回 `null`，不入栈（不 retarget）。
   * - 同 owner 的同一层重入 → 返回已有 token，不重复入栈。
   * - 其余情况（栈空，或同 owner 的新层）→ 入栈并返回新 token。
   */
  push(entry: MenuEntry): MenuToken | null {
    const top = this.items[this.items.length - 1];
    if (top && ownerKey(top.entry.owner) !== ownerKey(entry.owner)) {
      return null;
    }

    const existing = this.items.find(
      (item) =>
        ownerKey(item.entry.owner) === ownerKey(entry.owner) &&
        item.entry.element === entry.element,
    );
    if (existing) return existing.token;

    const token = Symbol(entry.id);
    const item: StackedEntry = { entry, token, closed: false };
    this.items.push(item);
    this.byToken.set(token, item);
    return token;
  }

  /** 出栈。未知 token 返回 `false`；同一 entry 的 `onClose` 只调用一次。 */
  pop(token: MenuToken): boolean {
    const item = this.byToken.get(token);
    if (!item) return false;

    const index = this.items.indexOf(item);
    if (index !== -1) this.items.splice(index, 1);
    this.byToken.delete(token);
    this.close(item, "pop");
    return true;
  }

  /** 栈顶条目；空栈返回 `null`（keymap 只问它，栈空一律返回 false）。 */
  top(): MenuEntry | null {
    const item = this.items[this.items.length - 1];
    return item ? item.entry : null;
  }

  size(): number {
    return this.items.length;
  }

  has(owner: MenuOwner): boolean {
    const key = ownerKey(owner);
    return this.items.some((item) => ownerKey(item.entry.owner) === key);
  }

  /** 自顶向下关闭并清空。 */
  closeAll(reason: string): void {
    const items = this.items;
    this.items = [];
    this.byToken.clear();
    for (let i = items.length - 1; i >= 0; i--) {
      this.close(items[i], reason);
    }
  }

  /** 静默清空（测试 reset 用，不触发 `onClose`）。 */
  clear(): void {
    this.items = [];
    this.byToken.clear();
  }

  private close(item: StackedEntry, reason: string): void {
    if (item.closed) return;
    item.closed = true;
    item.entry.onClose(reason);
  }
}

/** 模块级单例。 */
export const menuStack = new MenuStack();

/** 测试用：重置模块级单例。 */
export function resetMenuStack(): void {
  menuStack.clear();
}
