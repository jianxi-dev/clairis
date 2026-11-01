import { Compartment, Extension, StateField } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { FileKind } from "../types";
import { createHeadingDecorations } from "./decorations/heading";
import { createBoldItalicDecorations } from "./decorations/boldItalic";
import { createListDecorations } from "./decorations/list";
import { createQuoteDecorations } from "./decorations/quote";
import { createCodeDecorations } from "./decorations/code";
import { smartInput } from "./smart-input";
import { slashKeymap } from "./slash";

const SOURCE_MODE_LIMIT = 500 * 1024;

function buildDecorationSet(docText: string): DecorationSet {
  return Decoration.set(
    [
      ...createHeadingDecorations(docText),
      ...createBoldItalicDecorations(docText),
      ...createListDecorations(docText),
      ...createQuoteDecorations(docText),
      ...createCodeDecorations(docText),
    ],
    true,
  );
}

const decorationField = StateField.define<DecorationSet>({
  create(state) {
    return Decoration.none;
  },
  update(decos, tr) {
    if (!tr.docChanged) return decos.map(tr.changes);
    return buildDecorationSet(tr.state.doc.toString());
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const decorCompartment = new Compartment();

export function fullDecorations(): Extension[] {
  return [decorationField];
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
