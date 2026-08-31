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
