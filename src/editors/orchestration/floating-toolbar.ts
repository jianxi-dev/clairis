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
import { saveAppConfig } from "../../hooks/useConfig";
import { isMacPlatform } from "../key-chord";
import { useEditorStore } from "../../stores/editorStore";
import { useStore } from "../../stores/index";
import { CALLOUT_EDIT_TYPES } from "../callout-types";
import {
  createRoulette,
  type RouletteActions,
  type RouletteForm,
  type RouletteHandle,
  type RouletteItem,
} from "./roulette-view";
import { createCapsuleToolbar, type CapsuleItem } from "./capsule-toolbar";
import { BACKGROUND_COLORS, FONT_COLORS } from "./color-palette";
import {
  ROULETTE_BOX,
  ROULETTE_HOTKEY_DEFAULT,
  ROOT_SECTORS,
  type SectorId,
} from "./roulette";
import { executeCommand, registerCommand } from "./commands";

const SHOW_DELAY_MS = 90;

interface ParsedHotkey {
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

function parseHotkey(chord: string): ParsedHotkey | null {
  const tokens = chord
    .split("+")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  let mod = false;
  let ctrl = false;
  let alt = false;
  let shift = false;
  let key = "";
  for (const token of tokens) {
    if (token === "mod" || token === "meta" || token === "cmd") mod = true;
    else if (token === "ctrl" || token === "control") ctrl = true;
    else if (token === "alt" || token === "option") alt = true;
    else if (token === "shift") shift = true;
    else if (token === "space") key = " ";
    else if (token.length === 1) key = token;
    else return null;
  }
  return key ? { mod, ctrl, alt, shift, key } : null;
}

function matchesHotkey(e: KeyboardEvent, chord: string): boolean {
  const parsed = parseHotkey(chord);
  if (!parsed) return false;
  const mod = isMacPlatform() ? e.metaKey : e.ctrlKey;
  return (
    mod === parsed.mod &&
    e.ctrlKey === parsed.ctrl &&
    e.altKey === parsed.alt &&
    e.shiftKey === parsed.shift &&
    e.key.toLowerCase() === parsed.key
  );
}

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
  target: BlockConvertTarget,
  calloutKind?: CalloutKind,
): RouletteItem {
  return {
    id,
    label,
    icon,
    run: () => {
      const block = blockAt(view, view.state.selection.main.from);
      if (!block) return;
      if (calloutKind) {
        const text = view.state.doc.sliceString(block.from, block.to);
        const quoted = text
          .split("\n")
          .map((line) => `> ${line.replace(/^>\s?/, "")}`)
          .join("\n");
        view.dispatch({
          changes: {
            from: block.from,
            to: block.to,
            insert: `> [!${calloutKind}]\n${quoted}`,
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

export function floatingToolbar(allowCapsule = false) {
  return ViewPlugin.define((view) => {
    let handle: RouletteHandle | null = null;
    let capsule: ReturnType<typeof createCapsuleToolbar> | null = null;
    let showTimer = 0;
    let paintTimer = 0;
    let pointer: { x: number; y: number } | null = null;
    let pointerDown = false;
    let marks: Marks | null = null;

    const ensureFor = (v: EditorView, open: string, close: string) => {
      const text = selectionText(v);
      if (text.startsWith(open) && text.endsWith(close)) return;
      toggleWrap(v, open, close);
    };
    registerCommand("format-link", ({ view: v }) =>
      ensureFor(v, "[", "](url)"),
    );
    registerCommand("format-underline", ({ view: v }) =>
      toggleWrap(v, "<u>", "</u>"),
    );
    registerCommand("format-italic", ({ view: v }) => toggleWrap(v, "*", "*"));
    registerCommand("format-bold", ({ view: v }) => toggleWrap(v, "**", "**"));
    registerCommand("format-code", ({ view: v }) => toggleWrap(v, "`", "`"));
    registerCommand("format-strike", ({ view: v }) =>
      toggleWrap(v, "~~", "~~"),
    );

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
      const paintColor = (prefix: string, className: string): boolean => {
        if (!className) return false;
        const sel = view.state.selection.main;
        if (sel.from === sel.to) return false;
        const doc = view.state.doc.toString();
        const selected = doc.slice(sel.from, sel.to);
        if (selected.includes(`class="${className}"`)) return false;
        const same = new RegExp(`^<span class="(${prefix}-[\\w-]+)">`).exec(
          selected,
        );
        if (same && selected.endsWith("</span>")) {
          if (same[1] === className) return false;
          const inner = selected.slice(same[0].length, -"</span>".length);
          const open = `<span class="${className}">`;
          view.dispatch({
            changes: {
              from: sel.from,
              to: sel.to,
              insert: `${open}${inner}</span>`,
            },
            selection: {
              anchor: sel.from + open.length,
              head: sel.from + open.length + inner.length,
            },
          });
          return true;
        }
        toggleRangeSpan(view, className, prefix);
        return true;
      };

      let changed = false;
      if (m.bold) changed = paintWrap("**", "**") || changed;
      if (m.italic) changed = paintWrap("*", "*") || changed;
      if (m.underline) changed = paintWrap("<u>", "</u>") || changed;
      if (m.strike) changed = paintWrap("~~", "~~") || changed;
      if (m.code) changed = paintWrap("`", "`") || changed;
      if (m.color) changed = paintColor("mdb-color", m.color) || changed;
      if (m.bg) changed = paintColor("mdb-bg", m.bg) || changed;
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
            convertItem(
              view,
              `convert-callout-${c.kind}`,
              c.label,
              c.icon,
              "callout",
              c.kind,
            ),
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
          id: "history-cut",
          label: "剪切",
          icon: "scissors",
          run: () => {
            void navigator.clipboard
              ?.writeText(selectionText(view))
              .catch(() => {});
            const { from, to } = view.state.selection.main;
            view.dispatch({ changes: { from, to, insert: "" } });
          },
        },
        {
          id: "history-redo",
          label: "前进",
          icon: "redo",
          run: () => redo(view),
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
          commandId: "format-link",
        },
        {
          id: "format-underline",
          label: "下划线",
          icon: "underline",
          keepOpen: true,
          commandId: "format-underline",
        },
        {
          id: "format-italic",
          label: "斜体",
          icon: "italic",
          keepOpen: true,
          commandId: "format-italic",
        },
        {
          id: "format-bold",
          label: "加粗",
          icon: "bold",
          keepOpen: true,
          commandId: "format-bold",
        },
        {
          id: "format-code",
          label: "行内代码",
          icon: "code",
          keepOpen: true,
          commandId: "format-code",
        },
        {
          id: "format-strike",
          label: "删除线",
          icon: "strike",
          keepOpen: true,
          commandId: "format-strike",
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

    const capsuleItems = (): {
      primary: CapsuleItem[];
      secondary: CapsuleItem[];
    } => {
      const format = (id: string) => actions.format.find((i) => i.id === id)!;
      const toCapsule = (item: RouletteItem): CapsuleItem => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        run: () => {
          if (item.run) item.run();
          else if (item.commandId) {
            executeCommand(item.commandId, { view });
          }
        },
      });
      const items: CapsuleItem[] = [];
      const push = (item?: RouletteItem) => {
        if (!item) return;
        if (item.children && item.children.length > 0) {
          item.children.forEach(push);
          return;
        }
        if (!item.run && !item.commandId) return;
        items.push(toCapsule(item));
      };
      for (const id of [
        "format-bold",
        "format-italic",
        "format-underline",
        "format-strike",
        "format-code",
        "format-link",
      ]) {
        push(format(id));
      }
      actions.smart.forEach(push);
      actions.convert().forEach(push);
      actions.align.forEach(push);
      actions.history.forEach(push);
      actions.columns.forEach(push);
      items.push({
        id: "capsule-font",
        label: "字色",
        icon: "tune",
        run: () => {},
      });
      items.push({
        id: "capsule-bg",
        label: "背景色",
        icon: "droplet",
        run: () => {},
      });
      push(actions.clear[0]);
      return { primary: items, secondary: [] };
    };

    const showCapsule = (point: { x: number; y: number }) => {
      const mode = useEditorStore.getState().config.selectionToolbar;
      if (!allowCapsule || mode !== "capsule") return false;
      hide();
      const { primary, secondary } = capsuleItems();
      capsule = createCapsuleToolbar(
        primary,
        secondary,
        () => {
          capsule = null;
        },
        {
          font: FONT_COLORS,
          background: BACKGROUND_COLORS,
          apply: (kind, className) => {
            if (kind === "font") actions.color("font", className);
            else actions.color("background", className);
          },
        },
        point,
      );
      return true;
    };

    const configuredSectors = (): SectorId[] | undefined => {
      const configured = useEditorStore.getState().config.rouletteSectors;
      if (!configured) return undefined;
      const valid = configured.filter((id): id is SectorId =>
        ROOT_SECTORS.some((sector) => sector.id === id),
      );
      return valid.length > 0 ? valid : undefined;
    };

    const show = () => {
      const config = useEditorStore.getState().config;
      const half = ROULETTE_BOX / 2;
      const stored = config.roulettePosition;
      let point: { x: number; y: number } | null = null;
      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
        point = {
          x: Math.min(Math.max(stored.x, half), window.innerWidth - half),
          y: Math.min(Math.max(stored.y, half), window.innerHeight - half),
        };
      }
      if (!point) point = anchorPoint();
      if (!point) return;
      if (showCapsule(point)) return;
      if (!handle) {
        handle = createRoulette(
          actions,
          () => {
            handle = null;
          },
          {
            commandContext: () => ({ view }),
            sectors: configuredSectors(),
            form: config.rouletteForm ?? "hub",
            onMove: (x, y) => {
              useEditorStore
                .getState()
                .setConfig({ roulettePosition: { x, y } });
              void saveAppConfig();
            },
            onFormChange: (next: RouletteForm) => {
              useEditorStore.getState().setConfig({ rouletteForm: next });
              void saveAppConfig();
            },
          },
        );
        document.body.appendChild(handle.element);
      }
      handle.setCenter(point.x, point.y);
      handle.setPainter(painterState.active, painterState.count);
    };

    /** 指针落在轮盘内部：这是操作轮盘，不是重选文字，不能改锚点。 */
    const insideWheel = (target: EventTarget | null): boolean =>
      (!!handle && target instanceof Node && handle.element.contains(target)) ||
      (!!capsule && target instanceof Node && capsule.element.contains(target));

    // 只有胶囊模式保留「选中文字即现」；轮盘只由显式快捷键召唤（ui-polish-batch15 2.1）。
    const scheduleShow = () => {
      window.clearTimeout(showTimer);
      showTimer = window.setTimeout(() => {
        if (pointerDown) return;
        if (handle?.element.matches(":hover")) return;
        if (useEditorStore.getState().config.selectionToolbar !== "capsule") {
          return;
        }
        const { from, to } = view.state.selection.main;
        if (from === to) return;
        show();
      }, SHOW_DELAY_MS);
    };

    const hide = () => {
      window.clearTimeout(showTimer);
      if (capsule) {
        capsule.destroy();
        capsule = null;
      }
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

    // 选中文字不再自动弹轮盘：改由显式快捷键召唤（ui-polish-batch15 2.1）。
    const isHotkeyScopeTarget = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return true;
      }
      if (target.isContentEditable && !target.closest?.(".cm-editor")) {
        return true;
      }
      return false;
    };
    const onHotkeyDown = (e: KeyboardEvent) => {
      const es = useEditorStore.getState();
      const activeTabId = useStore.getState().activeTabId;
      const activeTab = activeTabId
        ? useStore.getState().tabs[activeTabId]
        : null;
      if ((activeTab?.editorMode ?? "preview") !== "edit") return;
      if (isHotkeyScopeTarget(e.target as HTMLElement | null)) return;
      const chord = es.config.rouletteHotkey ?? ROULETTE_HOTKEY_DEFAULT;
      if (!matchesHotkey(e, chord)) return;
      e.preventDefault();
      e.stopPropagation();
      if (handle || capsule) {
        hide();
        return;
      }
      show();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keydown", onHotkeyDown, true);

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
        } else if (handle || capsule) {
          if (
            !painterState.active &&
            !handle?.element.matches(":hover") &&
            !capsule?.element.matches(":hover")
          ) {
            hide();
          }
        }
      },
      destroy(): void {
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("pointermove", onPointerMove, true);
        document.removeEventListener("pointerup", onPointerUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("keydown", onHotkeyDown, true);
        window.clearTimeout(paintTimer);
        window.clearTimeout(showTimer);
        hide();
      },
    };
  });
}
