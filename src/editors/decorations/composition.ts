import { Transaction } from "@codemirror/state";

// TODO(Phase 1b): IME composition handler — detect compositionstart/end,
// temporarily show raw markdown syntax during IME input, restore
// decorations after composition ends.
export function compositionFilter(tr: Transaction): Transaction {
  return tr;
}
