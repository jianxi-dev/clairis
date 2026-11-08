/* 选区轮盘工具条（selection-roulette，批准设计见
 * docs/design/approved/selection-roulette/README.md）。
 *
 * 以鼠标落点为圆心，根环 8 扇区；二级/三级只在父扇区方向就近展开；
 * 颜色为文字色 / 背景色双圈。旧的横向工具条已删除，不留双轨。
 */

import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { undo, redo } from "@codemirror/commands";
import {
  alignBlock,
  blockAt,
  toggleRangeSpan,
  toggleWrap,
} from "./toolbar-shared";
import { blockConvertChanges, type BlockConvertTarget } from "./block-convert";
import { useAiEntryStore } from "../../hooks/useAiEntry";
import {
  createRoulette,
  type RouletteActions,
  type RouletteItem,
} from "./roulette-view";

function selectionText(view: EditorView): string {
  const { from, to } = view.state.selection.main;
  return view.state.doc.sliceString(from, to);
}

function ensureWrap(view: EditorView, open: string, close: string): void {
  const text = selectionText(view);
  if (text.startsWith(open) && text.endsWith(close)) return;
  toggleWrap(view, open, close);
}

function blockTextOf(
  view: EditorView,
): { from: number; to: number; text: string } | null {
  const block = blockAt(view, view.state.selection.main.from);
  if (!block) return null;
  return {
    from: block.from,
    to: block.to,
    text: view.state.doc.sliceString(block.from, block.to),
  };
}

function replaceBlock(view: EditorView, text: string): void {
  const block = blockTextOf(view);
  if (!block || block.text === text) return;
  view.dispatch({ changes: { from: block.from, to: block.to, insert: text } });
}

function convertItem(
  view: EditorView,
  id: string,
  label: string,
  icon: RouletteItem["icon"],
  target: BlockConvertTarget | "warning" | "info" | "note" | "danger",
): RouletteItem {
  return {
    id,
    label,
    icon,
    run: () => {
      const block = blockAt(view, view.state.selection.main.from);
      if (!block) return;
      if (["warning", "info", "note", "danger"].includes(target)) {
        const text = view.state.doc.sliceString(block.from, block.to);
        const quoted = text
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
        view.dispatch({
          changes: {
            from: block.from,
            to: block.to,
            insert: `> [!${target}]\n${quoted}`,
          },
        });
        return;
      }
      const changes = blockConvertChanges(
        view.state.doc,
        block,
        target as BlockConvertTarget,
      );
      if (changes.length > 0) view.dispatch({ changes });
    },
  };
}

function setColumns(view: EditorView, n: number): void {
  const block = blockTextOf(view);
  if (!block) return;
  const unwrapped = block.text
    .replace(/^::: \{\.col-\d\}\n?/, "")
    .replace(/\n?:::$/, "");
  replaceBlock(view, `::: {.col-${n}}\n${unwrapped}\n:::`);
}

function adjustIndent(view: EditorView, delta: number): void {
  const block = blockTextOf(view);
  if (!block) return;
  const match = /^::: \{\.indent-(\d)\}\n([\s\S]*?)\n:::$/.exec(block.text);
  const current = match ? Number(match[1]) : 0;
  const body = match ? match[2] : block.text;
  const next = Math.min(4, Math.max(0, current + delta));
  replaceBlock(view, next === 0 ? body : `::: {.indent-${next}}\n${body}\n:::`);
}

function clearFormatting(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  if (from === to) return;
  const stripped = selectionText(view)
    .replace(/<span class="mdb-(?:color|bg)-[\w-]+">/g, "")
    .replace(/<\/span>/g, "")
    .replace(/<\/?u>/g, "")
    .replace(/\*\*|~~|`/g, "")
    .replace(/(^|[^*])\*(?!\*)/g, "$1");
  if (stripped === selectionText(view)) return;
  view.dispatch({ changes: { from, to, insert: stripped } });
}

function colorAction(
  view: EditorView,
  kind: "font" | "background",
  className: string,
): void {
  const prefix = kind === "font" ? "mdb-color" : "mdb-bg";
  if (!className) {
    const { from, to } = view.state.selection.main;
    if (from === to) return;
    const stripped = selectionText(view)
      .replace(new RegExp(`<span class="${prefix}-[\\w-]+">`, "g"), "")
      .replace(/<\/span>/g, "");
    if (stripped !== selectionText(view)) {
      view.dispatch({ changes: { from, to, insert: stripped } });
    }
    return;
  }
  toggleRangeSpan(view, className, prefix);
}

let sharedHandle: ReturnType<typeof createRoulette> | null = null;
const painterState: {
  active: boolean;
  count: number;
  marks: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    code: boolean;
    color: string;
    bg: string;
  } | null;
} = { active: false, count: 0, marks: null };

export function floatingToolbar() {
  return ViewPlugin.define((view) => {
    let handle: ReturnType<typeof createRoulette> | null = sharedHandle;
    let paintTimer = 0;
    let marks: {
      bold: boolean;
      italic: boolean;
      underline: boolean;
      strike: boolean;
      code: boolean;
      color: string;
      bg: string;
    } | null = null;

    const ensure = (open: string, close: string) =>
      ensureWrap(view, open, close);

    const takeMarks = () => {
      const text = selectionText(view);
      const next = {
        bold: /\*\*/.test(text),
        italic: /(^|[^*])\*(?!\*)/.test(text) || /^\*[^*]/.test(text),
        underline: /<u>/.test(text),
        strike: /~~/.test(text),
        code: /`/.test(text),
        color: /<span class="mdb-color-[\w-]+">/.test(text)
          ? (text.match(/mdb-color-[\w-]+/)?.[0] ?? "")
          : "",
        bg: /<span class="mdb-bg-[\w-]+">/.test(text)
          ? (text.match(/mdb-bg-[\w-]+/)?.[0] ?? "")
          : "",
      };
      marks = next;
      painterState.marks = next;
    };

    const applyMarks = () => {
      const m = marks ?? painterState.marks;
      if (!m) return false;
      const paintWrap = (open: string, close: string): boolean => {
        const sel = view.state.selection.main;
        if (sel.from === sel.to) return false;
        let end = sel.to;
        while (
          end > sel.from &&
          view.state.doc.sliceString(end - 1, end) === "\n"
        ) {
          end -= 1;
        }
        const text = view.state.doc.sliceString(sel.from, end);
        if (text.startsWith(open) && text.endsWith(close)) return false;
        view.dispatch({
          changes: [
            { from: sel.from, insert: open },
            { from: end, insert: close },
          ],
          selection: {
            anchor: sel.from + open.length,
            head: end + open.length,
          },
        });
        return true;
      };
      let changed = false;
      if (m.bold) changed = paintWrap("**", "**") || changed;
      if (m.italic) changed = paintWrap("*", "*") || changed;
      if (m.underline) changed = paintWrap("<u>", "</u>") || changed;
      if (m.strike) changed = paintWrap("~~", "~~") || changed;
      if (m.code) changed = paintWrap("`", "`") || changed;
      return changed;
    };

    const actions: RouletteActions = {
      smart: [
        {
          id: "ai-rewrite",
          label: "改写",
          icon: "pencil",
          run: () => {
            const ai = useAiEntryStore.getState();
            ai.setInput(`请改写以下内容：\n\n${selectionText(view)}`);
            ai.openOverlay();
          },
        },
        {
          id: "ai-translate",
          label: "翻译",
          icon: "share",
          run: () => {
            const ai = useAiEntryStore.getState();
            ai.setInput(`请翻译以下内容：\n\n${selectionText(view)}`);
            ai.openOverlay();
          },
        },
        {
          id: "ai-polish",
          label: "润色",
          icon: "sparkle",
          run: () => {
            const ai = useAiEntryStore.getState();
            ai.setInput(`请润色以下内容：\n\n${selectionText(view)}`);
            ai.openOverlay();
          },
        },
      ],
      convert: () => {
        const block = blockTextOf(view);
        const isHeading = block ? /^#{1,6}\s/.test(block.text) : false;
        const items: RouletteItem[] = [];
        if (isHeading) {
          items.push(
            convertItem(view, "convert-paragraph", "正文", "text", "paragraph"),
          );
        }
        items.push({
          id: "convert-heading-group",
          label: "标题",
          icon: "file",
          children: [
            convertItem(view, "convert-h1", "一级标题", "file", "h1"),
            convertItem(view, "convert-h2", "二级标题", "file", "h2"),
            convertItem(view, "convert-h3", "三级标题", "file", "h3"),
            convertItem(view, "convert-h4", "四级标题", "file", "h3"),
          ],
        });
        items.push({
          id: "convert-list-group",
          label: "列表",
          icon: "grid",
          children: [
            convertItem(view, "convert-bullet", "无序列表", "grid", "bullet"),
            convertItem(view, "convert-ordered", "有序列表", "grid", "ordered"),
            convertItem(view, "convert-todo", "待办", "check", "todo"),
          ],
        });
        items.push({
          id: "convert-callout-group",
          label: "高亮",
          icon: "warning",
          children: [
            convertItem(view, "convert-note", "提示", "warning", "note"),
            convertItem(view, "convert-info", "信息", "warning", "info"),
            convertItem(view, "convert-warning", "警告", "warning", "warning"),
            convertItem(view, "convert-danger", "危险", "warning", "danger"),
          ],
        });
        items.push(
          convertItem(view, "convert-quote", "引用", "markdown", "quote"),
        );
        items.push(convertItem(view, "convert-code", "代码块", "code", "code"));
        items.push(
          convertItem(view, "convert-hr", "分割线", "text", "paragraph"),
        );
        return items;
      },
      align: [
        {
          id: "align-left",
          label: "左对齐",
          icon: "text",
          run: () => {
            const block = blockAt(view, view.state.selection.main.from);
            if (block) alignBlock(view, block, "left");
          },
        },
        {
          id: "align-center",
          label: "居中",
          icon: "text",
          run: () => {
            const block = blockAt(view, view.state.selection.main.from);
            if (block) alignBlock(view, block, "center");
          },
        },
        {
          id: "align-right",
          label: "右对齐",
          icon: "text",
          run: () => {
            const block = blockAt(view, view.state.selection.main.from);
            if (block) alignBlock(view, block, "right");
          },
        },
        {
          id: "indent-in",
          label: "增加缩进",
          icon: "chevronRight",
          run: () => adjustIndent(view, 1),
        },
        {
          id: "indent-out",
          label: "减少缩进",
          icon: "chevronLeft",
          run: () => adjustIndent(view, -1),
        },
      ],
      columns: [1, 2, 3, 4, 5].map((n) => ({
        id: `columns-${n}`,
        label: `${n} 栏`,
        icon: n === 1 ? "file" : "splitRight",
        run: () => setColumns(view, n),
      })),
      history: [
        {
          id: "history-undo",
          label: "后退",
          icon: "chevronLeft",
          run: () => undo(view),
        },
        {
          id: "history-redo",
          label: "前进",
          icon: "chevronRight",
          run: () => redo(view),
        },
        {
          id: "history-copy",
          label: "复制",
          icon: "copyPath",
          run: () => {
            void navigator.clipboard
              ?.writeText(selectionText(view))
              .catch(() => {});
          },
        },
        {
          id: "history-delete",
          label: "删除",
          icon: "close",
          run: () => {
            const { from, to } = view.state.selection.main;
            view.dispatch({ changes: { from, to, insert: "" } });
          },
        },
      ],
      clear: [
        {
          id: "clear-format",
          label: "清除格式",
          icon: "close",
          run: () => clearFormatting(view),
        },
      ],
      format: [
        {
          id: "format-bold",
          label: "加粗",
          icon: "text",
          keepOpen: true,
          run: () => toggleWrap(view, "**", "**"),
        },
        {
          id: "format-italic",
          label: "斜体",
          icon: "pencil",
          keepOpen: true,
          run: () => toggleWrap(view, "*", "*"),
        },
        {
          id: "format-underline",
          label: "下划线",
          icon: "text",
          keepOpen: true,
          run: () => toggleWrap(view, "<u>", "</u>"),
        },
        {
          id: "format-strike",
          label: "删除线",
          icon: "close",
          keepOpen: true,
          run: () => toggleWrap(view, "~~", "~~"),
        },
        {
          id: "format-code",
          label: "行内代码",
          icon: "code",
          keepOpen: true,
          run: () => toggleWrap(view, "`", "`"),
        },
        {
          id: "format-link",
          label: "链接",
          icon: "share",
          keepOpen: true,
          run: () => toggleWrap(view, "[", "](url)"),
        },
      ],
      color: (kind, className) => colorAction(view, kind, className),
      painter: {
        toggle: () => {
          if (painterState.active) {
            painterState.active = false;
            painterState.count = 0;
            painterState.marks = null;
            marks = null;
            return;
          }
          painterState.active = true;
          painterState.count = 0;
          takeMarks();
        },
        count: () => painterState.count,
        active: () => painterState.active,
      },
    };

    const position = () => {
      if (!handle) return;
      try {
        view.requestMeasure({
          read: (v) => {
            const { from, to } = v.state.selection.main;
            const pos = to > from ? to : from;
            return v.coordsAtPos(pos);
          },
          write: (coords) => {
            if (!coords || !handle) return;
            handle.setCenter(coords.left, coords.bottom);
          },
        });
      } catch {
        // jsdom：保持默认位置
      }
    };

    const show = () => {
      if (!handle) {
        handle = createRoulette(actions, () => {
          handle = null;
        });
        if (
          view.dom.style.position === "static" ||
          view.dom.style.position === ""
        ) {
          view.dom.style.position = "relative";
        }
        document.body.appendChild(handle.element);
        handle.element.style.position = "fixed";
        handle.element.style.zIndex = "3000";
      }
      sharedHandle?.setPainter(painterState.active, painterState.count);
      position();
    };

    const hide = () => {
      if (!handle) return;
      handle.destroy();
      sharedHandle = null;
      handle = null;
    };

    return {
      update(u: ViewUpdate): void {
        if (!u.selectionSet) return;
        const { from, to } = u.state.selection.main;
        if (from !== to) {
          if (
            painterState.active &&
            (marks ?? painterState.marks) &&
            !u.docChanged
          ) {
            window.clearTimeout(paintTimer);
            paintTimer = window.setTimeout(() => {
              if (!painterState.active) return;
              if (applyMarks()) {
                painterState.count += 1;
                const el = document.querySelector<HTMLElement>(
                  '[data-testid="roulette-center"]',
                );
                if (el) {
                  el.textContent = String(painterState.count);
                  el.dataset.painter = "true";
                }
              }
            }, 120);
          }
          if (!handle) show();
          else position();
        } else if (handle) {
          if (!painterState.active && !handle.element.matches(":hover")) hide();
        }
        return true as unknown as void;
      },
      destroy(): void {
        if (painterState.active) return;
        hide();
      },
    };
  });
}
