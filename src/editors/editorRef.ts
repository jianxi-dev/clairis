import type { EditorView } from "@codemirror/view";

/**
 * Map of panel ID → EditorView instance.
 * Panel "main" is the primary panel. Split panels get their own IDs.
 */
const editorViews = new Map<string, EditorView>();
let lastActivePanel: string | null = null;

/** Map of panel ID → preview scroll container (used for scroll position capture) */
const panelScrollEls = new Map<string, HTMLElement>();

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

/** Legacy alias for backward compatibility. */
export function setActiveEditorView(view: EditorView | null) {
  if (view) {
    editorViews.set("main", view);
  } else {
    editorViews.delete("main");
  }
}
