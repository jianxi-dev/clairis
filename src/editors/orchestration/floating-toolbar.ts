/* 选区轮盘工具条（selection-roulette，批准设计见
 * docs/design/approved/selection-roulette/README.md）。
 *
 * 以鼠标落点为圆心，根环 8 扇区；二层/三层只在父扇区方向就近展开；
 * 颜色为文字色 / 背景色双圈。旧的横向工具条在 MD 编辑态不再渲染。
 */

import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { undo, redo } from "@codemirror/commands";
import {
  alignBlock,
  blockAt,
  expandRangeToSpans,
  spanPairs,
  toggleRangeSpan,
  toggleWrap,
} from "./toolbar-shared";
import { blockConvertChanges, type BlockConvertTarget } from "./block-convert";
import { useAiEntryStore } from "../../hooks/useAiEntry";
import { CALLOUT_EDIT_TYPES } from "../callout-types";
import {
  createRoulette,
  type RouletteActions,
  type RouletteHandle,
  type RouletteItem,
} from "./roulette-view";

const SHOW_DELAY_MS = 90;

type CalloutKind = string;

const CALLOUT_ICONS: Record<string, RouletteItem["icon"]> = {
  note: "callout",
  info: "info",
  abstract: "abstract",
  todo: "todo",
  tip: "bulb",
  success: "success",
  question: "question",
  warning: "warning",
  failure: "failure",
  danger: "danger",
  bug: "bug",
  example: "example",
  quote: "quote",
};

const CALLOUTS: ReadonlyArray<{
  kind: CalloutKind;
  label: string;
  icon: RouletteItem["icon"];
}> = CALLOUT_EDIT_TYPES.map((type) => ({
  kind: type.key,
  label: type.label,
  icon: CALLOUT_ICONS[type.key] ?? "callout",
}));

function selectionText(view: EditorView): string {
  const { from, to } = view.state.selection.main;
  return view.state.doc.sliceString(from, to);
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
  target: BlockConvertTarget | CalloutKind,
): RouletteItem {
  return {
    id,
    label,
    icon,
    run: () => {
      const block = blockAt(view, view.state.selection.main.from);
      if (!block) return;
      if (CALLOUTS.some((c) => c.kind === target)) {
        const text = view.state.doc.sliceString(block.from, block.to);
        const quoted = text
          .split("\n")
          .map((line) => `> ${line.replace(/^>\s?/, "")}`)
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

/** 清除格式：剥掉行内标记与颜色 span，保留链接。 */
function clearFormatting(view: EditorView): void {
  const sel = view.state.selection.main;
  if (sel.from === sel.to) return;
  const { from, to } = expandRangeToSpans(
    view.state.doc.toString(),
    sel.from,
    sel.to,
  );
  const text = view.state.sliceDoc(from, to);
  const stripped = text
    .replace(/<span class="mdb-(?:color|bg)-[\w-]+">/g, "")
    .replace(/<span[^>]*>/g, "")
    .replace(/<\/span>/g, "")
    .replace(/<\/?u>/g, "")
    .replace(/\*\*|~~|`/g, "")
    .replace(/(^|[^*])\*(?!\*)/g, "$1");
  if (stripped === text) return;
  view.dispatch({ changes: { from, to, insert: stripped } });
}

function colorAction(
  view: EditorView,
  kind: "font" | "background",
  className: string,
): void {
  const prefix = kind === "font" ? "mdb-color" : "mdb-bg";
  if (!className) {
    const sel = view.state.selection.main;
    if (sel.from === sel.to) return;
    const doc = view.state.doc.toString();
    const { from, to } = expandRangeToSpans(doc, sel.from, sel.to);
    const targets = spanPairs(doc).filter(
      (pair) =>
        pair.family === prefix && pair.openFrom >= from && pair.closeTo <= to,
    );
    if (targets.length === 0) return;
    view.dispatch({
      changes: targets.flatMap((pair) => [
        { from: pair.openFrom, to: pair.contentFrom },
        { from: pair.closeFrom, to: pair.closeTo },
      ]),
    });
    return;
  }
  toggleRangeSpan(view, className, prefix);
}

interface Marks {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  color: string;
  bg: string;
}

const painterState: {
  active: boolean;
  count: number;
  marks: Marks | null;
} = { active: false, count: 0, marks: null };

export function floatingToolbar() {
  return ViewPlugin.define((view) => {
    let handle: RouletteHandle | null = null;
    let showTimer = 0;
    let paintTimer = 0;
    let pointer: { x: number; y: number } | null = null;
    let pointerDown = false;
    let marks: Marks | null = null;

    const ensure = (open: string, close: string) => {
      const text = selectionText(view);
      if (text.startsWith(open) && text.endsWith(close)) return;
      toggleWrap(view, open, close);
    };

    const takeMarks = () => {
      const text = selectionText(view);
      marks = {
        bold: /\*\*/.test(text),
        italic: /(^|[^*])\*(?!\*)/.test(text) || /^\*[^*]/.test(text),
        underline: /<u>/.test(text),
        strike: /~~/.test(text),
        code: /`/.test(text),
        color: /mdb-color-[\w-]+/.exec(text)?.[0] ?? "",
        bg: /mdb-bg-[\w-]+/.exec(text)?.[0] ?? "",
      };
      painterState.marks = marks;
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
          icon: "edit",
          run: () => {
            const ai = useAiEntryStore.getState();
            ai.setInput(`请改写以下内容：\n\n${selectionText(view)}`);
            ai.openOverlay();
          },
        },
        {
          id: "ai-translate",
          label: "翻译",
          icon: "globe",
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
        items.push(
          convertItem(view, "convert-code", "代码块", "blockcode", "code"),
        );
        items.push(
          convertItem(view, "convert-table", "表格", "table", "table"),
        );
        items.push({
          id: "convert-heading-group",
          label: "标题",
          icon: "h1",
          children: ([1, 2, 3, 4, 5, 6] as const).map((n) =>
            convertItem(
              view,
              `convert-h${n}`,
              [
                "一级标题",
                "二级标题",
                "三级标题",
                "四级标题",
                "五级标题",
                "六级标题",
              ][n - 1],
              `h${n}` as RouletteItem["icon"],
              `h${n}` as BlockConvertTarget,
            ),
          ),
        });
        items.push({
          id: "convert-list-group",
          label: "列表",
          icon: "bullet",
          children: [
            convertItem(view, "convert-bullet", "无序列表", "bullet", "bullet"),
            convertItem(
              view,
              "convert-ordered",
              "有序列表",
              "ordered",
              "ordered",
            ),
            convertItem(view, "convert-todo", "待办", "todo", "todo"),
          ],
        });
        items.push({
          id: "convert-callout-group",
          label: "高亮",
          icon: "callout",
          children: CALLOUTS.map((c) =>
            convertItem(view, `convert-${c.kind}`, c.label, c.icon, c.kind),
          ),
        });
        items.push(
          convertItem(view, "convert-quote", "引用", "quote", "quote"),
        );
        items.push(
          convertItem(view, "convert-divider", "分割线", "divider", "divider"),
        );
        return items;
      },
      align: [
        {
          id: "align-left",
          label: "左对齐",
          icon: "alignLeft",
          run: () => {
            const block = blockAt(view, view.state.selection.main.from);
            if (block) alignBlock(view, block, "left");
          },
        },
        {
          id: "align-center",
          label: "居中",
          icon: "alignCenter",
          run: () => {
            const block = blockAt(view, view.state.selection.main.from);
            if (block) alignBlock(view, block, "center");
          },
        },
        {
          id: "align-right",
          label: "右对齐",
          icon: "alignRight",
          run: () => {
            const block = blockAt(view, view.state.selection.main.from);
            if (block) alignBlock(view, block, "right");
          },
        },
        {
          id: "indent-in",
          label: "增加缩进",
          icon: "indent",
          run: () => adjustIndent(view, 1),
        },
        {
          id: "indent-out",
          label: "减少缩进",
          icon: "outdent",
          run: () => adjustIndent(view, -1),
        },
      ],
      columns: [1, 2, 3, 4, 5].map((n) => ({
        id: `columns-${n}`,
        label: `${n} 栏`,
        icon: `columns${n}` as RouletteItem["icon"],
        run: () => setColumns(view, n),
      })),
      history: [
        {
          id: "history-undo",
          label: "后退",
          icon: "undo",
          run: () => undo(view),
        },
        {
          id: "history-redo",
          label: "前进",
          icon: "redo",
          run: () => redo(view),
        },
        {
          id: "history-copy",
          label: "复制",
          icon: "copy",
          run: () => {
            void navigator.clipboard
              ?.writeText(selectionText(view))
              .catch(() => {});
          },
        },
        {
          id: "history-delete",
          label: "删除",
          icon: "trash",
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
          icon: "brush",
          run: () => clearFormatting(view),
        },
      ],
      format: [
        {
          id: "format-link",
          label: "链接",
          icon: "link",
          keepOpen: true,
          run: () => ensure("[", "](url)"),
        },
        {
          id: "format-underline",
          label: "下划线",
          icon: "underline",
          keepOpen: true,
          run: () => toggleWrap(view, "<u>", "</u>"),
        },
        {
          id: "format-italic",
          label: "斜体",
          icon: "italic",
          keepOpen: true,
          run: () => toggleWrap(view, "*", "*"),
        },
        {
          id: "format-bold",
          label: "加粗",
          icon: "bold",
          keepOpen: true,
          run: () => toggleWrap(view, "**", "**"),
        },
        {
          id: "format-code",
          label: "行内代码",
          icon: "code",
          keepOpen: true,
          run: () => toggleWrap(view, "`", "`"),
        },
        {
          id: "format-strike",
          label: "删除线",
          icon: "strike",
          keepOpen: true,
          run: () => toggleWrap(view, "~~", "~~"),
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

    const anchorPoint = (): { x: number; y: number } | null => {
      if (pointer) return pointer;
      try {
        const coords = view.coordsAtPos(view.state.selection.main.head);
        if (coords) return { x: coords.left, y: coords.bottom };
      } catch {
        // jsdom
      }
      return null;
    };

    const show = () => {
      const point = anchorPoint();
      if (!point) return;
      if (!handle) {
        handle = createRoulette(actions, () => {
          handle = null;
        });
        document.body.appendChild(handle.element);
      }
      handle.setCenter(point.x, point.y);
      handle.setPainter(painterState.active, painterState.count);
    };

    /** 指针落在轮盘内部：这是操作轮盘，不是重选文字，不能改锚点。 */
    const insideWheel = (target: EventTarget | null): boolean =>
      !!handle && target instanceof Node && handle.element.contains(target);

    const scheduleShow = () => {
      window.clearTimeout(showTimer);
      showTimer = window.setTimeout(() => {
        if (pointerDown) return;
        if (handle?.element.matches(":hover")) return;
        const { from, to } = view.state.selection.main;
        if (from === to) return;
        show();
      }, SHOW_DELAY_MS);
    };

    const hide = () => {
      window.clearTimeout(showTimer);
      if (!handle) return;
      handle.destroy();
      handle = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (insideWheel(e.target)) return;
      pointerDown = true;
      window.clearTimeout(showTimer);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown || insideWheel(e.target)) return;
      pointer = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (insideWheel(e.target)) {
        pointerDown = false;
        return;
      }
      if (!pointerDown) return;
      pointerDown = false;
      pointer = { x: e.clientX, y: e.clientY };
      const { from, to } = view.state.selection.main;
      if (to > from) scheduleShow();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      pointer = null;
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("keydown", onKeyDown, true);

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
                handle?.setPainter(true, painterState.count);
              }
            }, 120);
          }
          if (!pointerDown) scheduleShow();
        } else if (handle) {
          if (!painterState.active && !handle.element.matches(":hover")) {
            hide();
          }
        }
      },
      destroy(): void {
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("pointermove", onPointerMove, true);
        document.removeEventListener("pointerup", onPointerUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        window.clearTimeout(paintTimer);
        window.clearTimeout(showTimer);
        hide();
      },
    };
  });
}
