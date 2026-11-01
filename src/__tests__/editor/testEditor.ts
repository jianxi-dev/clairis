import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { smartInput } from "../../editors/smart-input";

export interface TestEditor {
  view: EditorView;
  destroy: () => void;
}

export function createTestEditor(doc = ""): TestEditor {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc, extensions: [markdown(), smartInput()] }),
  });
  return {
    view,
    destroy: () => {
      view.destroy();
      parent.remove();
    },
  };
}
