import { Compartment, EditorState, Extension } from "@codemirror/state";
import { ctrlHistoryBindings } from "./keybindings";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { classHighlighter } from "@lezer/highlight";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import { searchKeymap } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import type { FileKind } from "../types";
import { editorDecorations } from "./decorations";
import type { EditorDecorationsOptions } from "./decorations";
import { smartInput } from "./smart-input";
import { slashKeymap } from "./slash";
import { floatingToolbar } from "./orchestration/floating-toolbar";
import { blockToolbar } from "./orchestration/block-toolbar";

export const decorCompartment = new Compartment();

/**
 * 撤销历史隔层（#321）。
 *
 * 每个面板只有一个 EditorView，却服务多个页签；历史是 EditorState 的一部分，
 * 不清空的话 A 页签的编辑会让 B 页签的 Ctrl+Z 退回 A 的内容。切页签时由
 * ContentArea 做「摘掉再装回」的重配置来清空它：`history()` 每次返回的是
 * 同一个 StateField 实例，只 reconfigure 成另一个 `history()` 会走
 * StateField 的 reconfigure 分支、原样保留旧值，历史不会重置；必须先
 * reconfigure 成 `[]` 让字段地址消失，再装回才会重新 `create()`。
 */
export const historyCompartment = new Compartment();

/**
 * 编辑态扩展集。
 *
 * 装配模型（见 `decorations/index.ts`）：StateField 按活跃块两态构建，IME
 * 组合期与指针冻结期有守卫，不再整篇重建。保留函数名，调用方（ContentArea
 * 与 source 模式切换）无需改动。
 *
 * 选区工具条与块工具条（shell-editor-batch5 D16）也挂在这里：它们是编辑态
 * 专属界面，随 `decorCompartment` 在 edit / source 之间切换，避免在
 * ContentArea 的装配里再开一个工具条隔层。
 */
export function fullDecorations(
  options?: EditorDecorationsOptions,
): Extension[] {
  return [editorDecorations(options), floatingToolbar(), blockToolbar()];
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
    // 撤销历史不在这里：它由 `historyCompartment` 提供，ContentArea 才能在
    // 切页签时清空（#321）。`createExtensions` 与 ContentArea 都要显式装回。
    indentOnInput(),
    bracketMatching(),
    // classHighlighter 只输出 `.tok-*`，与预览共用一套 token 配色；换成
    // defaultHighlightStyle 会给 `tags.heading` 加下划线与字重，压住装饰层排版。
    syntaxHighlighting(classHighlighter),
    // searchKeymap 保留 Cmd+F 查找：basicSetup 撤掉后这是唯一还需要的面板键位。
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...ctrlHistoryBindings,
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
  const base = [
    ...baseEditorExtensions(),
    historyCompartment.of(history()),
    ...commonExtensions(),
  ];

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
