import type { EditorView } from "@codemirror/view";

/**
 * Module-level reference to the active CM6 EditorView.
 * Set by ContentArea on creation, used by App.tsx for direct formatting commands.
 */
let activeEditorView: EditorView | null = null;

export function setActiveEditorView(view: EditorView | null) {
  activeEditorView = view;
}

export function getActiveEditorView(): EditorView | null {
  return activeEditorView;
}
