import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { smartInput } from "../../editors/smart-input";
import { slashKeymap, type SlashCommand } from "../../editors/slash";

export interface TestEditor {
  view: EditorView;
  destroy: () => void;
}

/**
 * 测试用编辑器：markdown 语法 + 智能输入 + 斜杠菜单。
 *
 * 真实消费者在 `slashKeymap()` 之前挂了 `basicSetup`（含 `defaultKeymap`）；
 * 这里不挂，斜杠菜单的 `Prec.high` 绑定优先级由 e2e 覆盖。
 */
export function createTestEditor(
  doc = "",
  options: { commands?: SlashCommand[]; withSlash?: boolean } = {},
): TestEditor {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const extensions = [
    markdown(),
    smartInput(),
    ...(options.withSlash === false
      ? []
      : [slashKeymap(options.commands ? { commands: options.commands } : {})]),
  ];
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc, extensions }),
  });
  return {
    view,
    destroy: () => {
      view.destroy();
      parent.remove();
    },
  };
}
