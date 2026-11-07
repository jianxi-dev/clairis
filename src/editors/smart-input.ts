/* 智能输入（移植自 md-bundle packages/editor/src/smart-input.ts）。
 *
 * 1. Markdown 快捷转换：`# ` → H1、`- ` → 列表、`1. ` → 有序列表等。
 * 2. 智能回车：列表续写/空项退出、引用续写、代码块保留缩进。
 * 3. 智能退格：行首取消列表/引用标记、标题降级。
 * 4. 自动配对：`**`、`` ` ``、`$`、`[`、`![` 包裹选区或成对插入。
 * 5. 中文标点配对：`「` → `「」`、`（` → `（）`。
 *
 * 快捷转换、回车/退格、标题 Tab 走 CM6 keymap；自动配对走
 * EditorView.inputHandler——keymap 无法表达 `**` 这类多字符触发，
 * 也无法表达 `[` 依赖前一个字符（`!`）的上下文。
 */

import {
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { EditorState, type Extension, Prec } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { isSlashMenuOpen, openSlashMenuAt, slashMenuRequest } from "./slash";

// --- IME 组合守卫 ------------------------------------------------------------

/**
 * 模块级组合标记。由 compositionGuardPlugin 的 DOM 事件写入，
 * 由自动配对 inputHandler 读取。IME 组合是浏览器单例，多编辑器实例安全。
 */
let composing = false;

// --- Markdown 快捷转换 -------------------------------------------------------

/** 处理 Markdown 快捷转换。命中并应用返回 true。 */
export function handleMarkdownShortcut(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const textBeforeCursor = line.text.slice(
    0,
    view.state.selection.main.head - line.from,
  );

  // 任务列表必须先于普通 bullet `- ` 判断。
  const taskMatch = textBeforeCursor.match(/^(- \[[ xX]\] )/);
  if (taskMatch) {
    const from = line.from;
    const to = view.state.selection.main.head;
    view.dispatch({
      changes: { from, to, insert: "" },
      selection: { anchor: from },
      scrollIntoView: true,
    });
    return true;
  }

  // 标题 `# `..`###### `：剥掉标记，光标留在行首继续输入标题文字。
  const headingMatch = textBeforeCursor.match(/^(#{1,6} )/);
  if (headingMatch) {
    const marker = headingMatch[1];
    const from = line.from;
    const to = view.state.selection.main.head;
    view.dispatch({
      changes: { from, to, insert: "" },
      selection: { anchor: from },
      scrollIntoView: true,
    });
    const level = marker.trim().length;
    setHeadingLevel(view, level);
    return true;
  }

  // 列表（-, *, +, 1.）——CM6 markdown 原生处理。
  if (/^[-*+] $/.test(textBeforeCursor) || /^\d+\. $/.test(textBeforeCursor)) {
    return true;
  }

  // 引用：`>` 加空格本身已是合法 markdown。
  if (textBeforeCursor === "> ") {
    return true;
  }

  // Callout 折叠：`> [!tip]-` / `> [!tip]+` / `> [!NOTE]-` 等。
  // 带不带尾随空格都匹配（keydown 时空格尚未插入）。
  const calloutFoldMatch = textBeforeCursor.match(
    /^> \[!([a-zA-Z]+)\]([+-]) ?$/,
  );
  if (calloutFoldMatch) {
    const type = calloutFoldMatch[1];
    const foldState = calloutFoldMatch[2];
    const from = line.from;
    const to = view.state.selection.main.head;
    const replacement = `> [!${type}]${foldState}\n> `;
    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: from + replacement.length },
      scrollIntoView: true,
    });
    return true;
  }

  // 代码围栏：``` 加空格展开为围栏块。
  if (textBeforeCursor === "``` ") {
    const from = line.from;
    const to = view.state.selection.main.head;
    view.dispatch({
      changes: { from, to, insert: "```\n\n```" },
      selection: { anchor: from + 3 },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

// --- 标题级别追踪 ------------------------------------------------------------

const headingLevels = new WeakMap<EditorView, number>();

function setHeadingLevel(view: EditorView, level: number): void {
  headingLevels.set(view, level);
}

function getHeadingLevel(view: EditorView): number | null {
  return headingLevels.get(view) ?? null;
}

/**
 * 从行文本识别标题级别（1-6），非标题返回 null。
 * 标题行 = 可选空白 + 1-6 个 `#` + 一个空格。
 */
function getHeadingLevelFromLine(lineText: string): number | null {
  const match = lineText.match(/^(\s*)#{1,6}\s/);
  if (!match) return null;
  const headingPart = lineText.trimStart();
  const hashMatch = headingPart.match(/^(#{1,6})/);
  return hashMatch ? hashMatch[1].length : null;
}

// --- 标题升降（Tab / Shift+Tab） ---------------------------------------------

/**
 * Tab：标题降级（H1→H2 …），封顶 H6。
 * 先按行文本识别（对已加载/已存在的标题有效），
 * 再回退到 WeakMap（快捷转换剥掉标记后行文本已无 `#`）。
 */
export function demoteHeading(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const lineText = line.text;

  let currentLevel = getHeadingLevelFromLine(lineText);
  if (currentLevel === null) {
    currentLevel = getHeadingLevel(view);
  }

  if (currentLevel === null || currentLevel === undefined) return false;
  if (currentLevel >= 6) return false;

  const newLevel = currentLevel + 1;
  const newMarker = "#".repeat(newLevel) + " ";

  const leadingWhitespaceMatch = lineText.match(/^(\s*)/);
  const leadingWhitespace = leadingWhitespaceMatch
    ? leadingWhitespaceMatch[1].length
    : 0;
  const from = line.from + leadingWhitespace;
  // 空行（标记已被快捷输入剥掉）时 from 与 line.to 相同，必须夹取，否则 RangeError。
  const to = Math.min(from + currentLevel + 1, line.to);

  view.dispatch({
    changes: { from, to, insert: newMarker },
    scrollIntoView: true,
  });
  headingLevels.set(view, newLevel);
  return true;
}

/** Shift+Tab：标题升级（H2→H1 …），封顶 H1。 */
export function promoteHeading(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  return promoteHeadingOnLine(view, line, line.text);
}

function promoteHeadingOnLine(
  view: EditorView,
  targetLine: { from: number; text: string },
  lineText: string,
): boolean {
  let currentLevel = getHeadingLevelFromLine(lineText);
  if (currentLevel === null) {
    currentLevel = getHeadingLevel(view);
  }

  if (currentLevel === null || currentLevel === undefined) return false;
  if (currentLevel <= 1) return false;

  const newLevel = currentLevel - 1;
  const newMarker = "#".repeat(newLevel) + " ";

  const leadingWhitespaceMatch = lineText.match(/^(\s*)/);
  const leadingWhitespace = leadingWhitespaceMatch
    ? leadingWhitespaceMatch[1].length
    : 0;
  const from = targetLine.from + leadingWhitespace;
  const to = Math.min(
    from + currentLevel + 1,
    targetLine.from + targetLine.text.length,
  );

  view.dispatch({
    changes: { from, to, insert: newMarker },
    scrollIntoView: true,
  });
  headingLevels.set(view, newLevel);
  return true;
}

// --- 智能回车 ----------------------------------------------------------------

/**
 * 智能回车：
 * - 列表内：续写标记（有序列表自增），空项则退出
 * - 引用内：续写引用标记
 * - 代码块内：保留缩进
 * - 其余：交回默认行为
 */
export function smartEnter(view: EditorView): boolean {
  if (isSlashMenuOpen(view)) return false;
  const { selection } = view.state;
  const { main } = selection;
  const line = view.state.doc.lineAt(main.head);
  const lineText = line.text;
  const cursorInLine = main.head - line.from;

  if (main.head !== line.to && cursorInLine < lineText.length) {
    return false;
  }

  // 任务项必须先于普通列表匹配：`- [ ] 甲` 的 marker 会被普通列表正则
  // 读成 `-`，续写就退化成无序列表（#106）。
  const taskMatch = lineText.match(/^(\s*)([-*+])\s+\[([ xX])\]\s?(.*)/);
  if (taskMatch) {
    const [, indent, marker, , content] = taskMatch;

    if (content.trim() === "") {
      view.dispatch({
        changes: [{ from: line.from, to: line.to, insert: "" }],
        selection: { anchor: line.from + indent.length },
        scrollIntoView: true,
      });
      return true;
    }

    // 新项一律未勾选：勾选态属于「这一件事做完了」，不该被续写继承。
    const insert = `\n${indent}${marker} [ ] `;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  const listMatch = lineText.match(/^(\s*)([-*+]|\d+\.)\s*(.*)/);
  if (listMatch) {
    const [, indent, marker, content] = listMatch;

    if (content.trim() === "") {
      view.dispatch({
        changes: [{ from: line.from, to: line.to, insert: "" }],
        selection: { anchor: line.from + indent.length },
        scrollIntoView: true,
      });
      return true;
    }

    const newMarker = /^\d+\./.test(marker)
      ? `${parseInt(marker) + 1}. `
      : `${marker} `;
    const insert = `\n${indent}${newMarker}`;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  const quoteMatch = lineText.match(/^(\s*)(>+)\s?(.*)/);
  if (quoteMatch) {
    const [, indent, markers, content] = quoteMatch;

    if (content.trim() === "") {
      view.dispatch({
        changes: [{ from: line.from, to: line.to, insert: "" }],
        selection: { anchor: line.from + indent.length },
        scrollIntoView: true,
      });
      return true;
    }

    const insert = `\n${indent}${markers} `;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  const codeMatch = lineText.match(/^(\s+)(.*)/);
  if (codeMatch && isInsideCodeBlock(view.state, main.head)) {
    const [, indent] = codeMatch;
    const insert = `\n${indent}`;
    view.dispatch({
      changes: { from: main.head, insert },
      selection: { anchor: main.head + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

function isInsideCodeBlock(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  const lineNum = line.number;
  let fenceCount = 0;
  for (let i = 1; i < lineNum; i++) {
    const prevLine = state.doc.line(i);
    if (prevLine.text.trim().startsWith("```")) {
      fenceCount++;
    }
  }
  return fenceCount % 2 === 1;
}

// --- 智能退格 ----------------------------------------------------------------

/**
 * 智能退格：
 * - 列表项行首：去掉列表标记
 * - 引用行首：去掉引用标记
 * - 标题行首：降一级；H1 变普通段落
 * - 其余：交回默认行为
 */
export function smartBackspace(view: EditorView): boolean {
  const { selection } = view.state;
  const { main } = selection;

  if (!main.empty) return false;

  const line = view.state.doc.lineAt(main.head);
  const lineText = line.text;
  const cursorInLine = main.head - line.from;

  const headingLevel = getHeadingLevelFromLine(lineText);
  if (headingLevel !== null && cursorInLine === 0) {
    const newLevel = headingLevel - 1;
    const insert = newLevel > 0 ? `${"#".repeat(newLevel)} ` : "";
    view.dispatch({
      changes: { from: line.from, to: line.from + headingLevel + 1, insert },
      selection: { anchor: line.from + insert.length },
      scrollIntoView: true,
    });
    return true;
  }

  const listMatch = lineText.match(/^(\s*)([-*+]|\d+\.)\s$/);
  if (listMatch && cursorInLine === lineText.length) {
    const [, indent] = listMatch;
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: indent },
      selection: { anchor: line.from + indent.length },
      scrollIntoView: true,
    });
    return true;
  }

  const quoteMatch = lineText.match(/^(\s*)>\s?$/);
  if (quoteMatch && cursorInLine === lineText.length) {
    const [, indent] = quoteMatch;
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: indent },
      selection: { anchor: line.from + indent.length },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

// --- 自动配对（inputHandler） ------------------------------------------------

/**
 * 自动配对触发字符（保留的公开 API）。实际配对逻辑在 autoPairInputHandler。
 */
const PAIR_MAP: Record<string, string> = {
  "**": "**",
  "`": "`",
  $: "$",
  "[": "]",
  "![": "](",
};

/**
 * 按字符自动配对（保留的公开 API）。实际配对逻辑在 autoPairInputHandler。
 */
export function handleAutoPair(view: EditorView, char: string): boolean {
  const pair = PAIR_MAP[char];
  if (!pair) return false;

  const { selection } = view.state;
  const { main } = selection;

  if (!main.empty) {
    const selectedText = view.state.doc.sliceString(main.from, main.to);
    const isImage = char === "![";
    const open = isImage ? "![" : char;
    const close = isImage ? "](url)" : pair;

    view.dispatch({
      changes: [
        { from: main.from, insert: open },
        { from: main.to, insert: close },
      ],
      selection: {
        anchor: main.from + open.length + selectedText.length + close.length,
      },
      scrollIntoView: true,
    });
    return true;
  }

  const insert = char + pair;
  view.dispatch({
    changes: { from: main.head, insert },
    selection: { anchor: main.head + char.length },
    scrollIntoView: true,
  });
  return true;
}

/** 中文标点配对表（保留的公开 API）。 */
const CHINESE_PAIRS: Record<string, string> = {
  "「": "」",
  "『": "』",
  "（": "）",
  "【": "】",
  "《": "》",
  "〈": "〉",
  "“": "”",
  "‘": "’",
};

/**
 * 中文标点自动配对（保留的公开 API）。实际配对逻辑在 autoPairInputHandler。
 */
export function handleChinesePair(view: EditorView, char: string): boolean {
  const close = CHINESE_PAIRS[char];
  if (!close) return false;

  const { selection } = view.state;
  const { main } = selection;

  if (!main.empty) {
    view.dispatch({
      changes: [
        { from: main.from, insert: char },
        { from: main.to, insert: close },
      ],
      selection: { anchor: main.to + 1 },
      scrollIntoView: true,
    });
    return true;
  }

  const insert = char + close;
  view.dispatch({
    changes: { from: main.head, insert },
    selection: { anchor: main.head + 1 },
    scrollIntoView: true,
  });
  return true;
}

const PAIR_CHARS: Record<string, string> = {
  "`": "`",
  $: "$",
  "「": "」",
  "『": "』",
  "（": "）",
  "【": "】",
  "《": "》",
  "〈": "〉",
  "“": "”",
  "‘": "’",
};

/**
 * 可自动配对的收尾字符。用于 type-over：用户键入的收尾字符若与
 * 下一个字符相同（来自之前的自动配对），跳过插入、光标越过它。
 */
const CLOSING_CHARS = new Set<string>(Object.values(PAIR_CHARS));
CLOSING_CHARS.add("]"); // 来自 '[' 配对

/**
 * 自动配对的 inputHandler，在 CM6 插入前拦截输入。
 * 返回 true 表示已消费（配对已应用），false 交回默认行为。
 *
 * - `*` 仅当前一个字符也是 `*` 时配对（产生 `**│**`）。
 * - `[` 配对为 `]`；前一个字符是 `!` 时配对为 `](url)`（图片链接）。
 * - 其余 PAIR_CHARS 插入空对，光标居中。
 * - 有选区时用配对包裹选区。
 * - IME 组合期原样放行。
 * - type-over：键入的收尾字符与下一字符相同时，光标越过而非插入。
 */
const autoPairInputHandler = EditorView.inputHandler.of(
  (view, from, to, text) => {
    if (composing) return false;
    if (text.length !== 1) return false;

    if (CLOSING_CHARS.has(text)) {
      const nextChar = view.state.sliceDoc(from, from + 1);
      if (nextChar === text) {
        view.dispatch({
          selection: { anchor: from + 1 },
          scrollIntoView: true,
        });
        return true;
      }
    }

    // `**`：仅当前一个字符也是 `*` 时配对
    if (text === "*") {
      const before = view.state.sliceDoc(Math.max(0, from - 1), from);
      if (before === "*") {
        const selected = view.state.sliceDoc(from, to);
        if (selected) {
          view.dispatch({
            changes: [
              { from, insert: "**" },
              { from: to, insert: "**" },
            ],
            selection: { anchor: from + 2 + selected.length },
            scrollIntoView: true,
          });
        } else {
          view.dispatch({
            changes: { from, to, insert: "*" },
            selection: { anchor: from },
            scrollIntoView: true,
          });
        }
        return true;
      }
      return false;
    }

    // `[`：配对为 `]`；前一个字符是 `!` 时配对为 `](url)`
    if (text === "[") {
      const before = view.state.sliceDoc(Math.max(0, from - 1), from);
      const isImage = before === "!";
      const close = isImage ? "](url)" : "]";
      const selected = view.state.sliceDoc(from, to);
      if (selected) {
        const open = isImage ? "![" : "[";
        view.dispatch({
          changes: [
            { from, insert: open },
            { from: to, insert: close },
          ],
          selection: { anchor: from + open.length + selected.length },
          scrollIntoView: true,
        });
      } else {
        view.dispatch({
          changes: { from, to, insert: text + close },
          selection: { anchor: from + 1 },
          scrollIntoView: true,
        });
      }
      return true;
    }

    const close = PAIR_CHARS[text];
    if (!close) return false;

    const selected = view.state.sliceDoc(from, to);
    if (selected) {
      view.dispatch({
        changes: [
          { from, insert: text },
          { from: to, insert: close },
        ],
        selection: { anchor: from + 1 + selected.length },
        scrollIntoView: true,
      });
    } else {
      view.dispatch({
        changes: { from, to, insert: text + close },
        selection: { anchor: from + 1 },
        scrollIntoView: true,
      });
    }
    return true;
  },
);

// --- keymap 扩展 -------------------------------------------------------------

const markdownShortcutKeymap = keymap.of([
  {
    key: " ",
    run: (view) => handleMarkdownShortcut(view),
  },
]);

const smartEnterKeymap = keymap.of([
  {
    key: "Enter",
    run: (view) => smartEnter(view),
  },
]);

const smartBackspaceKeymap = keymap.of([
  {
    key: "Backspace",
    run: (view) => smartBackspace(view),
  },
]);

/**
 * Tab：列表项缩进一级（2 空格）。匹配 bullet（-, *, +）、有序（1.）与任务列表。
 * 非列表行返回 false。
 */
function indentList(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const lineText = line.text;

  const listMatch = lineText.match(/^(\s*)([-*+]|\d+\.)\s/);
  if (!listMatch) return false;

  const [, leadingWhitespace] = listMatch;
  const from = line.from + leadingWhitespace.length;
  const indent = "  "; // 缩进单位 = 两个空格

  view.dispatch({
    changes: { from, insert: indent },
    selection: { anchor: from + indent.length },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Shift+Tab：缩进列表项减少一级。匹配 1-2 个空格或一个 tab 后跟列表标记。
 * 顶层列表或非列表行返回 false。
 */
function outdentList(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const lineText = line.text;

  const outdentMatch = lineText.match(/^(\t| {1,2})(?=\s*([-*+]|\d+\.)\s)/);
  if (!outdentMatch) return false;

  const indentToRemove = outdentMatch[1];
  const from = line.from;
  const to = line.from + indentToRemove.length;

  view.dispatch({
    changes: { from, to, insert: "" },
    selection: { anchor: from },
    scrollIntoView: true,
  });
  return true;
}

const headingTabKeymap = keymap.of([
  {
    key: "Tab",
    run: (view) => demoteHeading(view) || indentList(view),
  },
  {
    key: "Shift-Tab",
    run: (view) => promoteHeading(view) || outdentList(view),
  },
]);

// --- 全角标点归一 ------------------------------------------------------------

/** 中文输入法下最常打错的三个：全角逗号、全角斜杠与顿号。 */
const FULLWIDTH_TO_ASCII: Readonly<Record<string, string>> = {
  "，": ",",
  "／": "/",
  "、": "/",
};

/** 归一成 `/` 后要顺手唤起斜杠菜单的源字符（全角斜杠与顿号）。 */
const SLASH_TRIGGERS: ReadonlySet<string> = new Set(["／", "、"]);

/** 代码、行内代码、链接地址里的全角标点是有意为之，不能改。 */
function inProtectedRegion(state: EditorState, pos: number): boolean {
  let node = syntaxTree(state).resolveInner(pos, -1);
  while (node) {
    switch (node.name) {
      case "InlineCode":
      case "CodeText":
      case "FencedCode":
      case "CodeBlock":
      case "URL":
      case "Link":
        return true;
      default:
        break;
    }
    if (!node.parent) break;
    node = node.parent;
  }
  return false;
}

/**
 * 与 `insertSlashChar` 的词首判定一致：行首，或前一个字符是空白。
 * `prefix` 是本次插入里位于该字符之前的文本（pos 在 startState 里，多字符
 * 插入时后续字符的位置会超出原文档长度）。
 */
function isWordStart(state: EditorState, pos: number, prefix: string): boolean {
  const line = state.doc.lineAt(pos);
  const textBefore = line.text.slice(0, pos - line.from) + prefix;
  return textBefore.length === 0 || /\s$/.test(textBefore);
}

/**
 * 读取全角标点归一挂上的 `slashMenuRequest` 注解，打开斜杠菜单。
 *
 * 必须等到 update 周期之外（微任务）再开：ViewPlugin 的 update 跑在
 * `updateState == Updating` 期间，`coordsAtPos` 会抛「Reading the editor
 * layout isn't allowed during an update」，`positionMenu` 吞掉异常后菜单停在
 * 默认位置（左上角），正好盖住 `/`。微任务在 update 结束后落地，坐标可读。
 */
const openSlashMenuPlugin = ViewPlugin.define(() => ({
  update(u: ViewUpdate): void {
    for (const tr of u.transactions) {
      const pos = tr.annotation(slashMenuRequest);
      if (pos !== undefined) {
        queueMicrotask(() => openSlashMenuAt(u.view, pos));
      }
    }
  },
}));

/**
 * 全角 → 半角的事务过滤器。
 *
 * 用 `transactionFilter` 而不是 `inputHandler`：中文输入法的字符是
 * composition 结束后一次性落盘的，inputHandler 收不到；事务过滤器两种
 * 路径都能拦到，而且改写后仍是**一个**事务（一次 undo 回到全角）。
 *
 * 只替换「单字符纯插入」：1:1 等长替换，选择区间与后续映射都不受影响，
 * 可以直接复用原 spec。
 *
 * `／` 与 `、` 归一成 `/` 后，如果落在词首且不在受保护区，就挂上
 * `slashMenuRequest` 注解，由 `openSlashMenuPlugin` 开菜单。走注解而不是
 * 在过滤器里直接开：transactionFilter 拿不到 view，且菜单要等事务落地。
 * `，` 只归一，不挂注解，所以不会开菜单。
 */
export function fullwidthPunctuation(): Extension[] {
  return [
    EditorState.transactionFilter.of((tr) => {
      if (!tr.docChanged) return tr;
      // 只处理用户输入：打开文件、格式化等程序化变更不动。
      if (!tr.isUserEvent("input.type")) return tr;
      const replacements: { from: number; to: number; insert: string }[] = [];
      let slashPos: number | null = null;
      tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
        if (toA - fromA > 0) return; // 纯插入才处理
        const text = inserted.toString();
        if (!/[，／、]/.test(text)) return;
        if (inProtectedRegion(tr.startState, fromA)) return;
        // 逐字符 1:1 替换，长度不变，选择区间与原 spec 仍然成立。
        const converted = Array.from(
          text,
          (ch) => FULLWIDTH_TO_ASCII[ch] ?? ch,
        ).join("");
        replacements.push({ from: fromA, to: toA, insert: converted });
        if (slashPos !== null) return;
        let offset = 0;
        for (const ch of Array.from(text)) {
          if (
            SLASH_TRIGGERS.has(ch) &&
            isWordStart(tr.startState, fromA, text.slice(0, offset))
          ) {
            slashPos = fromA + offset;
            return;
          }
          offset += ch.length;
        }
      });
      if (replacements.length === 0) return tr;
      return tr.startState.update({
        changes: tr.startState.changes(replacements),
        selection: tr.selection,
        userEvent: "input.type",
        scrollIntoView: tr.scrollIntoView,
        annotations:
          slashPos === null ? undefined : slashMenuRequest.of(slashPos),
      });
    }),
    openSlashMenuPlugin,
  ];
}

/**
 * 通过 DOM 事件追踪 IME 组合状态的 ViewPlugin，写入模块级 `composing`，
 * 供自动配对 inputHandler 在组合期跳过。
 */
const compositionGuardPlugin = ViewPlugin.define(() => ({}), {
  eventHandlers: {
    compositionstart() {
      composing = true;
    },
    compositionend() {
      composing = false;
    },
  },
});

/** 组合式智能输入扩展，启用全部智能输入行为。 */
export function smartInput(): Extension {
  // Prec.highest：markdown() 自带 `Prec.high(keymap.of(markdownKeymap))`，
  // 同优先级下它排在前面会先吃掉 Enter，智能输入的列表退出/续写永远不生效。
  // 斜杠菜单打开时两个 handler 都让位（见 isSlashMenuOpen 守卫）。
  return [
    Prec.highest(markdownShortcutKeymap),
    Prec.highest(smartEnterKeymap),
    Prec.highest(smartBackspaceKeymap),
    autoPairInputHandler,
    ...fullwidthPunctuation(),
    Prec.high(headingTabKeymap),
    compositionGuardPlugin,
  ];
}
