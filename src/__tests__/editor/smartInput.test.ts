import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { history, undo } from "@codemirror/commands";
import {
  handleMarkdownShortcut,
  smartEnter,
  smartBackspace,
  handleAutoPair,
  handleChinesePair,
  demoteHeading,
  promoteHeading,
  smartInput,
} from "../../editors/smart-input";
import { createTestEditor, type TestEditor } from "./testEditor";

let editor: TestEditor;

beforeEach(() => {
  editor = createTestEditor();
});

afterEach(() => {
  editor.destroy();
});

function type(text: string): void {
  editor.view.dispatch({
    changes: { from: 0, insert: text },
    selection: { anchor: text.length },
  });
}

function visibleText(view: EditorView): string {
  return (view.dom as HTMLElement).textContent ?? "";
}

describe("markdown shortcuts", () => {
  it("converts '# ' to heading and caret stays inside block", () => {
    type("# ");
    expect(handleMarkdownShortcut(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
    expect(editor.view.state.selection.main.head).toBe(0);
  });

  it("converts '## ' to H2 and caret stays inside block", () => {
    type("## ");
    expect(handleMarkdownShortcut(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
    expect(editor.view.state.selection.main.head).toBe(0);
  });

  it("converts '###### ' to H6", () => {
    type("###### ");
    expect(handleMarkdownShortcut(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
  });

  it("bare '#' without space does NOT convert", () => {
    type("#");
    expect(handleMarkdownShortcut(editor.view)).toBe(false);
    expect(editor.view.state.doc.toString()).toBe("#");
  });

  it("converts '> ' to blockquote", () => {
    type("> ");
    expect(handleMarkdownShortcut(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("> ");
  });

  it("converts '``` ' to code fence", () => {
    type("``` ");
    expect(handleMarkdownShortcut(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("```\n\n```");
  });

  it("returns false for non-shortcut text", () => {
    type("hello ");
    expect(handleMarkdownShortcut(editor.view)).toBe(false);
  });

  it("converts '- [ ] ' to task item (not plain bullet)", () => {
    type("- [ ] ");
    expect(handleMarkdownShortcut(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
    expect(editor.view.state.selection.main.head).toBe(0);
  });

  it("converts '- [x] ' to checked task item", () => {
    type("- [x] ");
    expect(handleMarkdownShortcut(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
    expect(editor.view.state.selection.main.head).toBe(0);
  });

  it("converts '> [!tip]- ' to collapsible callout with caret in content", () => {
    type("> [!tip]- ");
    expect(handleMarkdownShortcut(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("> [!tip]-\n> ");
    expect(editor.view.state.selection.main.head).toBe(12);
  });

  it("converts '> [!tip]+ ' to expanded collapsible callout", () => {
    type("> [!tip]+ ");
    expect(handleMarkdownShortcut(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("> [!tip]+\n> ");
  });
});

describe("heading promote/demote", () => {
  it("Tab demotes H1 to H2", () => {
    type("# Title");
    expect(demoteHeading(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("## Title");
  });

  it("Tab demotes a heading created via shortcut (marker stripped)", () => {
    type("# ");
    handleMarkdownShortcut(editor.view);
    expect(editor.view.state.doc.toString()).toBe("");
    expect(demoteHeading(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("## ");
  });

  it("demote is clamped at H6", () => {
    type("###### Title");
    expect(demoteHeading(editor.view)).toBe(false);
    expect(editor.view.state.doc.toString()).toBe("###### Title");
  });

  it("Shift+Tab promotes H2 to H1", () => {
    type("## Title");
    expect(promoteHeading(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("# Title");
  });

  it("promote is clamped at H1", () => {
    type("# Title");
    expect(promoteHeading(editor.view)).toBe(false);
    expect(editor.view.state.doc.toString()).toBe("# Title");
  });

  it("returns false on a non-heading line", () => {
    type("plain text");
    expect(demoteHeading(editor.view)).toBe(false);
    expect(promoteHeading(editor.view)).toBe(false);
  });
});

describe("smart enter", () => {
  it("continues a bullet list", () => {
    type("- item");
    expect(smartEnter(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("- item\n- ");
  });

  it("continues an ordered list with incrementing number", () => {
    type("1. item");
    expect(smartEnter(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("1. item\n2. ");
  });

  it("exits list on empty item", () => {
    type("- ");
    expect(smartEnter(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
  });

  it("continues a blockquote", () => {
    type("> quoted text");
    expect(smartEnter(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("> quoted text\n> ");
  });

  it("exits blockquote on empty line", () => {
    type("> ");
    expect(smartEnter(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
  });

  it("preserves indentation in code block", () => {
    const doc = "```\n    indented code\n```";
    editor.view.dispatch({
      changes: { from: 0, insert: doc },
      selection: { anchor: doc.indexOf("code") + 4 },
    });
    expect(smartEnter(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toContain("\n    \n");
  });

  it("returns false for non-list paragraph", () => {
    type("Hello world");
    expect(smartEnter(editor.view)).toBe(false);
  });
});

describe("任务项回车（#106）", () => {
  it("续写未勾选的任务项", () => {
    type("- [ ] 第一件");
    expect(smartEnter(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("- [ ] 第一件\n- [ ] ");
  });

  it("已勾选的任务项续写为新未勾选项", () => {
    type("- [x] 已经做完");
    expect(smartEnter(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("- [x] 已经做完\n- [ ] ");
  });

  it("`*` 与 `+` 前缀同样续写", () => {
    type("* [ ] 星号");
    expect(smartEnter(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("* [ ] 星号\n* [ ] ");
  });

  it("空任务项回车退出列表且不留空格", () => {
    type("- [ ] ");
    expect(smartEnter(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
  });
});

describe("smart backspace", () => {
  it("removes list marker at start of empty list item", () => {
    type("- ");
    expect(smartBackspace(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
  });

  it("removes ordered list marker at start of empty item", () => {
    type("1. ");
    expect(smartBackspace(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
  });

  it("removes blockquote marker at start of empty quote", () => {
    type("> ");
    expect(smartBackspace(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("");
  });

  it("demotes an H2 heading to H1 at the start of the line", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "## Title" },
      selection: { anchor: 0 },
    });
    expect(smartBackspace(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("# Title");
  });

  it("drops an H1 heading to a paragraph at the start of the line", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "# Title" },
      selection: { anchor: 0 },
    });
    expect(smartBackspace(editor.view)).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("Title");
  });

  it("returns false for non-empty content", () => {
    type("- item");
    expect(smartBackspace(editor.view)).toBe(false);
  });
});

describe("auto-pairing", () => {
  it("wraps selection with bold markers", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "Hello world" },
      selection: { anchor: 0, head: 5 },
    });
    expect(handleAutoPair(editor.view, "**")).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("**Hello** world");
  });

  it("wraps selection with inline code", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "some code here" },
      selection: { anchor: 5, head: 9 },
    });
    expect(handleAutoPair(editor.view, "`")).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("some `code` here");
  });

  it("wraps selection with dollar signs (math)", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "E = mc^2" },
      selection: { anchor: 0, head: 8 },
    });
    expect(handleAutoPair(editor.view, "$")).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("$E = mc^2$");
  });

  it("wraps selection with brackets (link)", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "click here" },
      selection: { anchor: 0, head: 5 },
    });
    expect(handleAutoPair(editor.view, "[")).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("[click] here");
  });

  it("creates image link with ![]", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "alt text" },
      selection: { anchor: 0, head: 8 },
    });
    expect(handleAutoPair(editor.view, "![")).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("![alt text](url)");
  });

  it("inserts pair at cursor when no selection, caret centred", () => {
    type("hello");
    expect(handleAutoPair(editor.view, "**")).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("hello****");
    expect(editor.view.state.selection.main.head).toBe(7);
  });

  it("returns false for unregistered character", () => {
    type("hello");
    expect(handleAutoPair(editor.view, "#")).toBe(false);
  });
});

describe("chinese punctuation pairing", () => {
  it("pairs 「 with 」, caret centred", () => {
    type("hello");
    expect(handleChinesePair(editor.view, "「")).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("hello「」");
    expect(editor.view.state.selection.main.head).toBe(6);
  });

  it("pairs （ with ）", () => {
    type("hello");
    expect(handleChinesePair(editor.view, "（")).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("hello（）");
  });

  it("pairs 【 with 】", () => {
    type("hello");
    expect(handleChinesePair(editor.view, "【")).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("hello【】");
  });

  it("wraps selection with chinese brackets", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "hello world" },
      selection: { anchor: 0, head: 5 },
    });
    expect(handleChinesePair(editor.view, "「")).toBe(true);
    expect(editor.view.state.doc.toString()).toBe("「hello」 world");
  });

  it("returns false for non-chinese character", () => {
    type("hello");
    expect(handleChinesePair(editor.view, "(")).toBe(false);
  });
});

describe("auto-pairing via real inputHandler", () => {
  function input(view: EditorView, text: string): void {
    const { from, to } = view.state.selection.main;
    const handlers = view.state.facet(EditorView.inputHandler);
    const insert = () =>
      view.state.update({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
    const handled = handlers.some((h) => h(view, from, to, text, insert));
    if (!handled) {
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
    }
  }

  it("* twice pairs to ** with caret between", () => {
    input(editor.view, "*");
    input(editor.view, "*");
    expect(editor.view.state.doc.toString()).toBe("**");
    expect(editor.view.state.selection.main.head).toBe(1);
  });

  it("lone ! does not insert ![](", () => {
    input(editor.view, "!");
    expect(editor.view.state.doc.toString()).toBe("!");
  });

  it("! then [ inserts ![|](url)", () => {
    input(editor.view, "!");
    input(editor.view, "[");
    expect(editor.view.state.doc.toString()).toContain("![");
    expect(editor.view.state.doc.toString()).toContain("](url)");
  });

  it("` pairs with caret between", () => {
    input(editor.view, "`");
    expect(editor.view.state.doc.toString()).toBe("``");
    expect(editor.view.state.selection.main.head).toBe(1);
  });

  it("$ pairs with caret between", () => {
    input(editor.view, "$");
    expect(editor.view.state.doc.toString()).toBe("$$");
    expect(editor.view.state.selection.main.head).toBe(1);
  });

  it("[ pairs to [] with caret between", () => {
    input(editor.view, "[");
    expect(editor.view.state.doc.toString()).toBe("[]");
    expect(editor.view.state.selection.main.head).toBe(1);
  });

  it("「 pairs to 「」", () => {
    input(editor.view, "「");
    expect(editor.view.state.doc.toString()).toBe("「」");
  });

  it("（ pairs to （）", () => {
    input(editor.view, "（");
    expect(editor.view.state.doc.toString()).toBe("（）");
  });

  it("` wraps selected text", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "abc" },
      selection: { anchor: 0, head: 3 },
    });
    input(editor.view, "`");
    expect(editor.view.state.doc.toString()).toBe("`abc`");
  });

  it("[ wraps selected text", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "link" },
      selection: { anchor: 0, head: 4 },
    });
    input(editor.view, "[");
    expect(editor.view.state.doc.toString()).toBe("[link]");
  });

  it("「 wraps selected text", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "text" },
      selection: { anchor: 0, head: 4 },
    });
    input(editor.view, "「");
    expect(editor.view.state.doc.toString()).toBe("「text」");
  });
});

describe("red line 5: rendered text equals source", () => {
  it("heading shortcut keeps rendered text equal to source", () => {
    type("# ");
    handleMarkdownShortcut(editor.view);
    editor.view.dispatch({
      changes: { from: 0, insert: "标题" },
      selection: { anchor: 2 },
    });
    expect(editor.view.state.doc.toString()).toBe("标题");
    expect(visibleText(editor.view)).toBe("标题");
  });

  it("task item shortcut keeps rendered text equal to source", () => {
    type("- [ ] ");
    handleMarkdownShortcut(editor.view);
    editor.view.dispatch({
      changes: { from: 0, insert: "待办" },
      selection: { anchor: 2 },
    });
    expect(editor.view.state.doc.toString()).toBe("待办");
    expect(visibleText(editor.view)).toBe("待办");
  });

  it("list continuation keeps rendered text equal to source", () => {
    type("- item");
    smartEnter(editor.view);
    expect(editor.view.state.doc.toString()).toBe("- item\n- ");
    editor.view.dispatch({
      changes: { from: 9, insert: "second" },
      selection: { anchor: 15 },
    });
    expect(editor.view.state.doc.toString()).toBe("- item\n- second");
    expect(visibleText(editor.view)).toBe("- item- second");
  });

  it("auto-pair insertion keeps rendered text equal to source", () => {
    const handlers = editor.view.state.facet(EditorView.inputHandler);
    const insert = () =>
      editor.view.state.update({
        changes: { from: 0, to: 0, insert: "「" },
        selection: { anchor: 1 },
      });
    handlers.some((h) => h(editor.view, 0, 0, "「", insert));
    editor.view.dispatch({
      changes: { from: 1, insert: "引用" },
      selection: { anchor: 3 },
    });
    expect(editor.view.state.doc.toString()).toBe("「引用」");
    expect(visibleText(editor.view)).toBe("「引用」");
  });

  it("heading demote keeps rendered text equal to source", () => {
    type("# 标题");
    demoteHeading(editor.view);
    expect(editor.view.state.doc.toString()).toBe("## 标题");
    expect(visibleText(editor.view)).toBe("## 标题");
  });
});

describe("smartInput extension", () => {
  it("returns an array of extensions", () => {
    expect(Array.isArray(smartInput())).toBe(true);
  });
});

describe("全角标点归一（E-13）", () => {
  /** 模拟一次真实键入：userEvent 必须是 input.*，否则过滤器按程序化变更跳过。 */
  function typeAt(pos: number, text: string): number {
    let transactions = 0;
    const listener = EditorView.updateListener.of((update) => {
      if (update.docChanged) transactions += 1;
    });
    void listener;
    editor.view.dispatch({
      changes: { from: pos, insert: text },
      selection: { anchor: pos + text.length },
      userEvent: "input.type",
    });
    return transactions;
  }

  it("全角逗号落成半角，不开菜单", () => {
    typeAt(0, "你好，世界");
    expect(editor.view.state.doc.toString()).toBe("你好,世界");
    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("全角斜杠在词首落成半角并唤起斜杠菜单", async () => {
    typeAt(0, "／");
    // 菜单由 ViewPlugin 在微任务里开（update 期间不能读布局）。
    await Promise.resolve();
    expect(editor.view.state.doc.toString()).toBe("/");
    expect(editor.view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
  });

  it("全角斜杠在词中只落成半角，不开菜单", () => {
    typeAt(0, "a／b");
    expect(editor.view.state.doc.toString()).toBe("a/b");
    expect(editor.view.dom.querySelector(".mdb-slash-menu")).toBeNull();
  });

  it("顿号落成半角斜杠并唤起斜杠菜单", async () => {
    typeAt(0, "、");
    await Promise.resolve();
    expect(editor.view.state.doc.toString()).toBe("/");
    expect(editor.view.dom.querySelector(".mdb-slash-menu")).not.toBeNull();
  });

  it("围栏代码块内保留全角", () => {
    editor.view.dispatch({
      changes: { from: 0, insert: "正文\n\n```\n\n```\n" },
    });
    const fencePos = editor.view.state.doc.toString().indexOf("```") + 4;
    typeAt(fencePos, "，");
    expect(editor.view.state.doc.toString()).toContain("```\n，");
  });

  it("行内代码内保留全角", () => {
    editor.view.dispatch({ changes: { from: 0, insert: "`x`" } });
    // 插到反引号内部（`x` 的 x 之前）
    typeAt(1, "，");
    expect(editor.view.state.doc.toString()).toBe("`，x`");
  });

  it("一次 undo 回到键入前（单事务，不产生两条历史）", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "",
        extensions: [markdown(), smartInput(), history()],
      }),
    });
    view.dispatch({
      changes: { from: 0, insert: "，" },
      selection: { anchor: 1 },
      userEvent: "input.type",
    });
    expect(view.state.doc.toString()).toBe(",");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("");
    view.destroy();
    parent.remove();
  });
});
