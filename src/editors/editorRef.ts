import type { EditorView } from "@codemirror/view";

/**
 * Map of panel ID → EditorView instance.
 * Panel "main" is the primary panel. Split panels get their own IDs.
 */
const editorViews = new Map<string, EditorView>();
let lastActivePanel: string | null = null;

/** Map of panel ID → preview scroll container (used for scroll position capture) */
const panelScrollEls = new Map<string, HTMLElement>();

/**
 * 每个 EditorView 已应用到的（页签, 修订号）。
 *
 * 修订号是**页签内**单调的，跨页签不可比：一个 view 会在切页签时复用，若只记
 * 修订号，A 页签的修订号会高于 B 页签，B 的首次装载反而被当成陈旧回灌挡掉。
 * 所以必须连同页签一起记，页签不符即视为「本页签尚未装载」。
 *
 * 用模块级 WeakMap 而不是 EditorView 上的字段：EditorView 没有对外可扩展的
 * 槽位，挂字段等于改第三方类的形状。view 销毁后条目自动回收。
 */
const lastAppliedRevisions = new WeakMap<
  EditorView,
  { tabId: string; revision: number }
>();

export function setPanelScrollEl(panelId: string, el: HTMLElement | null) {
  if (el) {
    panelScrollEls.set(panelId, el);
  } else {
    panelScrollEls.delete(panelId);
  }
}

export function getPanelScrollEl(panelId: string): HTMLElement | null {
  return panelScrollEls.get(panelId) || null;
}

export function setEditorView(panelId: string, view: EditorView | null) {
  if (view) {
    editorViews.set(panelId, view);
  } else {
    editorViews.delete(panelId);
  }
}

export function getEditorView(panelId: string): EditorView | null {
  return editorViews.get(panelId) || null;
}

/** Get the most recently focused editor. */
export function getActiveEditorView(): EditorView | null {
  if (lastActivePanel) {
    const v = editorViews.get(lastActivePanel);
    if (v) return v;
  }
  // Fallback to main panel
  return editorViews.get("main") || null;
}

/**
 * 取指定格的编辑器视图，未注册时回退全局活动视图。
 *
 * 按格渲染的 UI（属性面板等）必须用本格视图提交变更：`getActiveEditorView()`
 * 只认「最后一次获得 CM6 焦点的格」，分屏下从非聚焦格操作会把变更派发到别的
 * 文档上（#1016：面板所在格删不掉，另一格被串写）。
 */
export function getPanelEditorView(panelId: string): EditorView | null {
  if (panelId) {
    const v = editorViews.get(panelId);
    if (v) return v;
  }
  return getActiveEditorView();
}

export function setActivePanel(panelId: string) {
  lastActivePanel = panelId;
}

/** `null` = 这份 view 还没装载过该页签（首次装载 / 刚切过来）。 */
export function getLastAppliedRevision(
  view: EditorView,
  tabId: string,
): number | null {
  const applied = lastAppliedRevisions.get(view);
  return applied && applied.tabId === tabId ? applied.revision : null;
}

export function setLastAppliedRevision(
  view: EditorView,
  tabId: string,
  revision: number,
): void {
  lastAppliedRevisions.set(view, { tabId, revision });
}

/** Legacy alias for backward compatibility. */
export function setActiveEditorView(view: EditorView | null) {
  if (view) {
    editorViews.set("main", view);
  } else {
    editorViews.delete("main");
  }
}
