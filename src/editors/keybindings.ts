import { keymap, type EditorView, type KeyBinding } from "@codemirror/view";
import { redo, undo } from "@codemirror/commands";

/**
 * CM6 markdown formatting keybindings: Cmd+B (bold), Cmd+I (italic).
 */
export function formattingKeymap() {
  return keymap.of([
    {
      key: "Mod-b",
      run: toggleBold,
    },
    {
      key: "Mod-i",
      run: toggleItalic,
    },
  ]);
}

/**
 * historyKeymap 只绑定 `Mod-`（macOS 上是 Command）。这里补 Control 变体，
 * 让习惯 Ctrl 的用户不必去够 Command；两者指向同一组 undo/redo 命令。
 */
export const ctrlHistoryBindings: KeyBinding[] = [
  { key: "Ctrl-z", run: undo, preventDefault: true },
  { key: "Ctrl-Shift-z", run: redo, preventDefault: true },
  { key: "Ctrl-y", run: redo, preventDefault: true },
];

export function toggleBold(view: EditorView): boolean {
  toggleFormatting(view, "**");
  return true;
}

export function toggleItalic(view: EditorView): boolean {
  toggleFormatting(view, "*");
  return true;
}

function toggleFormatting(view: EditorView, delimiter: string) {
  const { from, to, empty } = view.state.selection.main;
  const doc = view.state.doc.toString();

  if (empty) {
    // No selection: insert delimiter pair, cursor in middle
    view.dispatch({
      changes: { from, to, insert: delimiter + delimiter },
      selection: {
        anchor: from + delimiter.length,
        head: from + delimiter.length,
      },
    });
    return;
  }

  const selected = doc.slice(from, to);
  const len = delimiter.length;

  // Check if already wrapped
  if (
    selected.startsWith(delimiter) &&
    selected.endsWith(delimiter) &&
    selected.length >= len * 2
  ) {
    const inner = selected.slice(len, -len);
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    });
  } else {
    view.dispatch({
      changes: { from, to, insert: delimiter + selected + delimiter },
      selection: { anchor: from + len, head: from + len + selected.length },
    });
  }
}
