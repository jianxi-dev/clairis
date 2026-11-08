/* 编排层菜单栈（md-orchestration 1.1，对应 design.md D2）。
 *
 * 模块级单例，统一管理所有浮层的生命周期：滑入即显示、离栈即收、不 retarget。
 * 纯逻辑——不挂 DOM 监听，由调用方在 pointerenter / pointerleave 时驱动。
 *
 * 不 retarget：栈打开期间指针移到其它块时，`push` 返回 `null` 且不入栈。
 * 只有同 owner 的层才能入栈；同一层重入时返回已有 token，不重复触发 onClose。
 *
 * 作用域（`scope`）把「不 retarget」限制在同一个编辑视图 / 面板内：分栏时两个
 * 面板各自一套栈，互不阻塞；缺省作用域为全局。
 */

/** 浮层的归属块。`null` 表示无归属（如全局调色板）。 */
export type MenuOwner = { blockFrom: number; blockTo: number } | null;

export interface MenuEntry {
  id: string;
  owner: MenuOwner;
  element: HTMLElement;
  onClose: (reason: string) => void;
  /** 浮层所属的编辑视图或面板；不同作用域的栈彼此独立。 */
  scope?: object;
}

export type MenuToken = symbol;

const scopeIds = new WeakMap<object, number>();
let nextScopeId = 1;

/** 作用域的稳定键：同一对象永远得到同一个编号。 */
function scopeKey(scope: object | undefined): string {
  if (scope === undefined) return "-";
  const known = scopeIds.get(scope);
  if (known !== undefined) return String(known);
  const id = nextScopeId++;
  scopeIds.set(scope, id);
  return String(id);
}

/** 条目等价键：作用域 + owner（`null` 视为同一 owner）。 */
function entryKey(entry: MenuEntry): string {
  const block =
    entry.owner === null
      ? "null"
      : `${entry.owner.blockFrom}:${entry.owner.blockTo}`;
  return `${scopeKey(entry.scope)}|${block}`;
}

interface StackedEntry {
  entry: MenuEntry;
  token: MenuToken;
  closed: boolean;
}

export class MenuStack {
  private items: StackedEntry[] = [];
  private byToken = new Map<MenuToken, StackedEntry>();
  private keepOpenScopes = new Set<string>();

  /**
   * 钉住某作用域的菜单：置位期间指针离开父面板不关闭菜单，二级色板才不会
   * 在指针穿过缝隙的一瞬间连父带子一起消失。由二级面板的开关成对调用。
   */
  setKeepOpen(scope: object | undefined, keepOpen: boolean): void {
    const key = scopeKey(scope);
    if (keepOpen) this.keepOpenScopes.add(key);
    else this.keepOpenScopes.delete(key);
  }

  isKeepOpen(scope?: object): boolean {
    return this.keepOpenScopes.has(scopeKey(scope));
  }

  private topOfScope(scope: object | undefined): StackedEntry | undefined {
    const key = scopeKey(scope);
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (scopeKey(this.items[i].entry.scope) === key) return this.items[i];
    }
    return undefined;
  }

  /**
   * 入栈。
   *
   * - 同作用域内栈非空且 owner 与栈顶不同 → 返回 `null`，不入栈（不 retarget）。
   * - 同 owner 的同一层重入 → 返回已有 token，不重复入栈。
   * - 其余情况（作用域内栈空，或同 owner 的新层）→ 入栈并返回新 token。
   */
  push(entry: MenuEntry): MenuToken | null {
    const top = this.topOfScope(entry.scope);
    if (top && entryKey(top.entry) !== entryKey(entry)) {
      return null;
    }

    const existing = this.items.find(
      (item) =>
        entryKey(item.entry) === entryKey(entry) &&
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

  /**
   * 栈顶条目；空栈返回 `null`（keymap 只问它，栈空一律返回 false）。
   * 传 `scope` 时返回该作用域的栈顶。
   */
  top(scope?: object): MenuEntry | null {
    const item =
      scope === undefined
        ? this.items[this.items.length - 1]
        : this.topOfScope(scope);
    return item ? item.entry : null;
  }

  size(): number {
    return this.items.length;
  }

  has(owner: MenuOwner, scope?: object): boolean {
    return this.items.some((item) => {
      if (scopeKey(item.entry.scope) !== scopeKey(scope)) return false;
      const block =
        item.entry.owner === null
          ? null
          : `${item.entry.owner.blockFrom}:${item.entry.owner.blockTo}`;
      const wanted =
        owner === null ? null : `${owner.blockFrom}:${owner.blockTo}`;
      return block === wanted;
    });
  }

  /** 节点是否落在已登记层的子树里（D1 点击委托的「内部」判定）。 */
  containsElement(node: Node | null): boolean {
    if (node === null) return false;
    return this.items.some(
      (item) =>
        item.entry.element === node || item.entry.element.contains(node),
    );
  }

  /**
   * 自顶向下关闭并清空。
   * `match` 传入时只关闭命中的层（例如只收某个视图的菜单），其余保留。
   */
  closeAll(reason: string, match?: (entry: MenuEntry) => boolean): void {
    const closing = match
      ? this.items.filter((item) => match(item.entry))
      : this.items.slice();
    if (closing.length === 0) return;

    this.items = this.items.filter((item) => !closing.includes(item));
    for (const item of closing) this.byToken.delete(item.token);
    for (let i = closing.length - 1; i >= 0; i--) {
      this.close(closing[i], reason);
    }
  }

  /** 关闭某个作用域里的全部层（滚动即收用）。 */
  closeScope(scope: object, reason: string): void {
    this.closeAll(reason, (entry) => entry.scope === scope);
  }

  /** 静默清空（测试 reset 用，不触发 `onClose`）。 */
  clear(): void {
    this.items = [];
    this.byToken.clear();
    this.keepOpenScopes.clear();
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
