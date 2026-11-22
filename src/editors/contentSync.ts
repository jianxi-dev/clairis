/**
 * 编辑器内容快照节流（ADR 0003 + design D3 / E-40）。
 *
 * 键入时不再每键把全文写 store：本模块按页签登记「当前 live view + 所属面板」，
 * 把内容快照的写入收敛成「300ms 防抖 + 2000ms 硬截止」。前者挡住连续键入的逐键
 * 重渲染，后者保证停顿前的最后一批字不会无限期滞留。
 *
 * 所有「以 store 快照为准」的出口（保存 / 另存为 / 导出 / 打印 / 切页签 / 进入
 * 预览 / 卸载 / 窗口关闭 / 外部回灌）都必须先 `flushTabContent(tabId)`，从 live
 * `EditorView.state.doc` 取全文再写 store，避免落盘到过期快照。
 *
 * store 只存纯文本（ADR 0004），本模块只持有 `EditorView` 引用，不把它放进 store。
 */
import type { EditorView } from "@codemirror/view";
import { useStore } from "../stores/index";

/** 防抖时长：连续键入时store 写入的最短间隔（ADR 0003 固化值）。 */
export const CONTENT_SYNC_DEBOUNCE_MS = 300;
/** 硬截止：自首个待写变更起，最长滞留时长（design D3 / ADR 0012）。 */
export const CONTENT_SYNC_MAX_DELAY_MS = 2000;

interface ContentSyncEntry {
  tabId: string;
  panelId: string;
  view: EditorView;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  deadlineTimer: ReturnType<typeof setTimeout> | null;
  /**
   * 写入完成回调（收新修订号）。ContentArea 用它更新本面板的
   * `lastWrittenRevisionRef`，让同步 effect 仍能识别「自己写出去的那一份」。
   */
  onFlush: ((revision: number) => void) | null;
}

/** 按页签登记：同一页签同时只应有一个真正接收输入的 live view。 */
const entries = new Map<string, ContentSyncEntry>();

function clearTimer(timer: ReturnType<typeof setTimeout> | null): void {
  if (timer !== null) clearTimeout(timer);
}

/** 落一份快照到 store 并收敛计时器；返回新修订号（内容未变时为原值）。 */
function flushEntry(entry: ContentSyncEntry): number {
  clearTimer(entry.debounceTimer);
  clearTimer(entry.deadlineTimer);
  entry.debounceTimer = null;
  entry.deadlineTimer = null;
  const text = entry.view.state.doc.toString();
  const revision = useStore
    .getState()
    .updateTabContent(entry.tabId, text, entry.panelId);
  entry.onFlush?.(revision);
  return revision;
}

/**
 * 登记一次内容变更并安排节流写入。
 *
 * 同一页签重复调用只重置防抖；硬截止从首个待写变更起算，不随后续键入顺延。
 * `view` / `panelId` 每次都用最新值覆盖：切页签复用同一 EditorView 时，登记的是
 * 当前真正持有该页签的那份。
 */
export function scheduleContentSync(
  view: EditorView,
  tabId: string,
  panelId: string,
  onFlush?: (revision: number) => void,
): void {
  let entry = entries.get(tabId);
  if (!entry) {
    entry = {
      tabId,
      panelId,
      view,
      debounceTimer: null,
      deadlineTimer: null,
      onFlush: onFlush ?? null,
    };
    entries.set(tabId, entry);
  } else {
    entry.view = view;
    entry.panelId = panelId;
    if (onFlush) entry.onFlush = onFlush;
  }

  clearTimer(entry.debounceTimer);
  entry.debounceTimer = setTimeout(() => {
    entry.debounceTimer = null;
    flushEntry(entry);
  }, CONTENT_SYNC_DEBOUNCE_MS);

  // 截止只在「首个待写变更」处起算：已有截止计时器说明还没收敛过。
  if (entry.deadlineTimer === null) {
    entry.deadlineTimer = setTimeout(() => {
      entry.deadlineTimer = null;
      flushEntry(entry);
    }, CONTENT_SYNC_MAX_DELAY_MS);
  }
}

/**
 * 立即把某页签的 live 全文写 store，取消待写计时器并重置截止。
 * 返回新修订号（内容未变时为原值；页签未登记时返回 0）。
 */
export function flushTabContent(tabId: string): number {
  const entry = entries.get(tabId);
  if (!entry) return 0;
  return flushEntry(entry);
}

/** 立即 flush 所有已登记页签（窗口关闭 / 全局兜底用）。 */
export function flushAllContent(): void {
  for (const entry of entries.values()) flushEntry(entry);
}

/** 取消某页签的待写计时器并注销（组件卸载用；卸载前应先 flush）。 */
export function cancelContentSync(tabId: string): void {
  const entry = entries.get(tabId);
  if (!entry) return;
  clearTimer(entry.debounceTimer);
  clearTimer(entry.deadlineTimer);
  entries.delete(tabId);
}

/**
 * 注销某个面板的所有登记（面板卸载用）。
 *
 * 一个面板只有一个 EditorView、被多个页签复用：切页签时旧页签的登记若只是留着，
 * 条目仍指向这个共享视图（此刻已显示新页签），之后 `flushAllContent` 或
 * `flushTabContent(旧页签)` 会把新页签的文本写进旧页签。故卸载时按 panelId 全清，
 * 只碰本面板的条目，不动同页签在另一面板的登记。
 */
export function cancelContentSyncForPanel(panelId: string): void {
  for (const [tabId, entry] of entries) {
    if (entry.panelId !== panelId) continue;
    clearTimer(entry.debounceTimer);
    clearTimer(entry.deadlineTimer);
    entries.delete(tabId);
  }
}
