/**
 * HTML 源码编辑态 / 代码文件的横向文字工具条。
 *
 * HTML 不适合径向轮盘（批准设计由维护者裁定），源码编辑态改用横条：
 * AI 改写/翻译/润色 + 加粗/斜体/下划线/删除线/行内代码/链接/对齐/文字色/清除格式。
 * 横条只做选区级格式；块结构仍走斜杠菜单与块手柄。
 */

import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { iconSvg, type IconName } from "../../ui/icons";
import { FONT_COLORS } from "./color-palette";
import {
  alignBlock,
  blockAt,
  expandRangeToSpans,
  spanPairs,
  toggleRangeSpan,
  toggleWrap,
} from "./toolbar-shared";
import { useAiEntryStore } from "../../hooks/useAiEntry";

const SHOW_DELAY_MS = 90;

function selectionText(view: EditorView): string {
  const { from, to } = view.state.selection.main;
  return view.state.doc.sliceString(from, to);
}

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

function wrapSelection(view: EditorView, open: string, close: string): void {
  const sel = view.state.selection.main;
  let end = sel.to;
  while (end > sel.from && view.state.doc.sliceString(end - 1, end) === "\n") {
    end -= 1;
  }
  if (end === sel.from) return;
  const doc = view.state.doc;
  const text = doc.sliceString(sel.from, end);
  const before = doc.sliceString(Math.max(0, sel.from - open.length), sel.from);
  const after = doc.sliceString(end, Math.min(doc.length, end + close.length));
  const italicInsideBold =
    open === "*" &&
    (doc.sliceString(Math.max(0, sel.from - 2), sel.from) === "**" ||
      doc.sliceString(end, Math.min(doc.length, end + 2)) === "**");
  if (before === open && after === close && !italicInsideBold) {
    view.dispatch({
      changes: [
        { from: sel.from - open.length, to: sel.from, insert: "" },
        { from: end, to: end + close.length, insert: "" },
      ],
    });
    return;
  }
  if (text.startsWith(open) && text.endsWith(close)) {
    view.dispatch({
      changes: [
        { from: sel.from, to: sel.from + open.length, insert: "" },
        { from: end - close.length, to: end, insert: "" },
      ],
    });
    return;
  }
  view.dispatch({
    changes: [
      { from: sel.from, insert: open },
      { from: end, insert: close },
    ],
    selection: { anchor: sel.from + open.length, head: end + open.length },
  });
}

function applyColor(view: EditorView, className: string): void {
  const { from, to } = view.state.selection.main;
  if (from === to) return;
  if (className) {
    toggleRangeSpan(view, className, "mdb-color");
    return;
  }
  const doc = view.state.doc.toString();
  const range = expandRangeToSpans(doc, from, to);
  const targets = spanPairs(doc).filter(
    (pair) =>
      pair.family === "mdb-color" &&
      pair.openFrom >= range.from &&
      pair.closeTo <= range.to,
  );
  if (targets.length === 0) return;
  view.dispatch({
    changes: targets.flatMap((pair) => [
      { from: pair.openFrom, to: pair.contentFrom },
      { from: pair.closeFrom, to: pair.closeTo },
    ]),
  });
}

interface BarAction {
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
}

function toolButton(action: BarAction): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "cm-toolbar-btn";
  b.dataset.action = action.id;
  b.title = action.label;
  b.setAttribute("aria-label", action.label);
  b.innerHTML = iconSvg(action.icon, 14);
  b.addEventListener("pointerdown", (e) => e.preventDefault());
  b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    action.run();
  });
  return b;
}

function aiActions(view: EditorView): BarAction[] {
  const run = (prompt: string) => () => {
    const ai = useAiEntryStore.getState();
    ai.setInput(`${prompt}\n\n${selectionText(view)}`);
    ai.openOverlay();
  };
  return [
    {
      id: "ai-rewrite",
      label: "改写",
      icon: "edit",
      run: run("请改写以下内容："),
    },
    {
      id: "ai-translate",
      label: "翻译",
      icon: "globe",
      run: run("请翻译以下内容："),
    },
    {
      id: "ai-polish",
      label: "润色",
      icon: "sparkle",
      run: run("请润色以下内容："),
    },
  ];
}

function formatActions(view: EditorView): BarAction[] {
  return [
    {
      id: "format-bold",
      label: "粗体",
      icon: "bold",
      run: () => wrapSelection(view, "**", "**"),
    },
    {
      id: "format-italic",
      label: "斜体",
      icon: "italic",
      run: () => wrapSelection(view, "*", "*"),
    },
    {
      id: "format-underline",
      label: "下划线",
      icon: "underline",
      run: () => wrapSelection(view, "<u>", "</u>"),
    },
    {
      id: "format-strike",
      label: "删除线",
      icon: "strike",
      run: () => wrapSelection(view, "~~", "~~"),
    },
    {
      id: "format-code",
      label: "行内代码",
      icon: "code",
      run: () => wrapSelection(view, "`", "`"),
    },
    {
      id: "format-link",
      label: "链接",
      icon: "link",
      run: () => wrapSelection(view, "[", "](url)"),
    },
  ];
}

function alignActions(view: EditorView): BarAction[] {
  return (["left", "center", "right"] as const).map((kind) => ({
    id: `align-${kind}`,
    label: kind === "left" ? "左对齐" : kind === "center" ? "居中" : "右对齐",
    icon:
      kind === "left"
        ? ("alignLeft" as const)
        : kind === "center"
          ? ("alignCenter" as const)
          : ("alignRight" as const),
    run: () => {
      const block = blockAt(view, view.state.selection.main.from);
      if (block) alignBlock(view, block, kind);
    },
  }));
}

export function horizontalToolbar() {
  return ViewPlugin.define((view) => {
    let bar: HTMLDivElement | null = null;
    let timer = 0;
    let pointerDown = false;
    let pointer: { x: number; y: number } | null = null;

    const build = (): HTMLDivElement => {
      const root = document.createElement("div");
      root.className = "cm-floating-toolbar";
      root.dataset.testid = "selection-toolbar";
      root.setAttribute("role", "toolbar");
      root.setAttribute("aria-label", "文字工具条");

      const group = (actions: BarAction[]) => {
        for (const action of actions) root.appendChild(toolButton(action));
      };
      group(aiActions(view));
      root.appendChild(separator());
      group(formatActions(view));
      root.appendChild(separator());
      group(alignActions(view));
      root.appendChild(separator());

      const select = document.createElement("select");
      select.className = "cm-toolbar-color";
      select.setAttribute("aria-label", "文字颜色");
      for (const color of FONT_COLORS) {
        const option = document.createElement("option");
        option.value = color.className;
        option.textContent = color.label;
        select.appendChild(option);
      }
      select.addEventListener("pointerdown", (e) => e.stopPropagation());
      select.addEventListener("change", () => applyColor(view, select.value));
      root.appendChild(select);

      const clear = toolButton({
        id: "clear-format",
        label: "清除格式",
        icon: "brush",
        run: () => clearFormatting(view),
      });
      root.appendChild(clear);

      root.addEventListener("pointerdown", (e) => e.stopPropagation());
      document.body.appendChild(root);
      return root;
    };

    const place = () => {
      if (!bar) return;
      const { from, to } = view.state.selection.main;
      let startCoords: { left: number; top: number } | null = null;
      let endCoords: { right: number; top: number } | null = null;
      try {
        startCoords = view.coordsAtPos(from);
        endCoords = view.coordsAtPos(to);
      } catch {
        startCoords = null;
        endCoords = null;
      }
      const rect = bar.getBoundingClientRect();
      const anchorTop = Math.min(
        startCoords?.top ?? Number.POSITIVE_INFINITY,
        endCoords?.top ?? Number.POSITIVE_INFINITY,
      );
      const anchorY = Number.isFinite(anchorTop)
        ? anchorTop
        : (pointer?.y ?? 0);
      const anchorX = pointer?.x ?? startCoords?.left ?? 0;
      let left = anchorX - rect.width / 2;
      let barTop = anchorY - rect.height - 8;
      left = Math.min(Math.max(left, 8), window.innerWidth - rect.width - 8);
      if (barTop < 8) barTop = anchorY + 20;
      bar.style.left = `${Math.round(left)}px`;
      bar.style.top = `${Math.round(barTop)}px`;
    };

    const show = () => {
      if (!bar) bar = build();
      place();
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (pointerDown) return;
        const { from, to } = view.state.selection.main;
        if (from === to) return;
        show();
      }, SHOW_DELAY_MS);
    };

    const hide = () => {
      window.clearTimeout(timer);
      bar?.remove();
      bar = null;
    };

    const onPointerDown = () => {
      pointerDown = true;
      window.clearTimeout(timer);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      pointer = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDown) return;
      pointerDown = false;
      pointer = { x: e.clientX, y: e.clientY };
      const { from, to } = view.state.selection.main;
      if (to > from) schedule();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
      else if (!e.metaKey && !e.ctrlKey && !e.altKey) pointer = null;
    };
    const onOutside = (e: PointerEvent) => {
      if (bar?.contains(e.target as Node)) return;
      hide();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onOutside, true);

    return {
      update(u: ViewUpdate): void {
        if (!u.selectionSet) return;
        const { from, to } = u.state.selection.main;
        if (from !== to) {
          if (!pointerDown) schedule();
        } else hide();
      },
      destroy(): void {
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("pointermove", onPointerMove, true);
        document.removeEventListener("pointerup", onPointerUp, true);
        document.removeEventListener("keydown", onKey, true);
        document.removeEventListener("pointerdown", onOutside, true);
        window.clearTimeout(timer);
        hide();
      },
    };
  });
}

function separator(): HTMLElement {
  const el = document.createElement("span");
  el.className = "cm-toolbar-sep";
  el.setAttribute("aria-hidden", "true");
  return el;
}
