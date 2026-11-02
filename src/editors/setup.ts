import { Compartment, EditorState, Extension } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import { searchKeymap } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import type { FileKind } from "../types";
import { editorDecorations } from "./decorations";
import type { EditorDecorationsOptions } from "./decorations";
import { smartInput } from "./smart-input";
import { slashKeymap } from "./slash";

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

/**
 * 编辑态基础扩展集。
 *
 * 刻意**不用** `basicSetup`：它带进来的行号槽、折叠箭头、活动行高亮、自动
 * 补全把文档编辑器渲染成代码面板，与「在预览态里编辑」的产品目标相反（上游
 * md-bundle 的编辑器同样只装显式扩展集）。这里只保留正文编辑真正需要的：
 * 折行、选区绘制、撤销历史、缩进、括号匹配与基础键位映射。
 *
 * 不要在这里加回 `lineNumbers()` / `foldGutter()` / `highlightActiveLine()`：
 * 编辑态的「当前块」由装饰层的 `cm-block-active` 表达，不是行号。
 */
export function baseEditorExtensions(): Extension[] {
  return [
    EditorView.lineWrapping,
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    history(),
    indentOnInput(),
    bracketMatching(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    // searchKeymap 保留 Cmd+F 查找：basicSetup 撤掉后这是唯一还需要的面板键位。
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
  ];
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
  const base = [...baseEditorExtensions(), ...commonExtensions()];

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
