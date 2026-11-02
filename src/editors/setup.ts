import { Compartment, Extension } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { EditorView } from "@codemirror/view";
import type { FileKind } from "../types";
import { editorDecorations } from "./decorations";
import type { EditorDecorationsOptions } from "./decorations";
import { smartInput } from "./smart-input";
import { slashKeymap } from "./slash";

const SOURCE_MODE_LIMIT = 500 * 1024;

export const decorCompartment = new Compartment();

/**
 * 编辑态装饰扩展。
 *
 * 装配模型（见 `decorations/index.ts`）：StateField 按活跃块两态构建，IME
 * 组合期与指针冻结期有守卫，不再整篇重建。保留函数名，调用方（ContentArea
 * 与 source 模式切换）无需改动。
 */
export function fullDecorations(
  options?: EditorDecorationsOptions,
): Extension[] {
  return [editorDecorations(options)];
}

/** Common base extensions shared by all file kinds */
function commonExtensions(): Extension[] {
  return [
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        // Content sync is handled by ContentArea's listener
      }
    }),
  ];
}

/**
 * Create editor extensions based on file kind.
 */
export function createExtensions(fileKind: FileKind): Extension[] {
  const base = [basicSetup, ...commonExtensions()];

  switch (fileKind) {
    case "markdown":
      return [
        ...base,
        markdown({ base: markdownLanguage }),
        smartInput(),
        // 斜杠菜单：`Prec.high` 绑定优先于 defaultKeymap，菜单关闭时全部返回 false。
        slashKeymap(),
        decorCompartment.of(fullDecorations()),
      ];
    case "html":
      return [...base, html()];
    case "text":
      return base; // Plain text, no language extension
    default:
      return base;
  }
}

// Legacy function — kept for backward compat, delegates to createExtensions("markdown")
export function createEditorSetup(): Extension[] {
  return createExtensions("markdown");
}
