/* 公式源码浮层（editor-batch3-lowcost D5 / E-43）。
 *
 * 点击编辑态公式 widget → 在公式下方开一个固定定位浮层：多行源码输入 +
 * 实时 KaTeX 预览。Esc / 点击外部提交（写回源码、光标回落公式后），
 * Enter 换行，按键不泄漏给编辑器 keymap。
 *
 * 锚定复用 orchestration 的 `createAnchorTracker` + `placeMenu`（与块菜单
 * 同一套几何），不新造浮层体系；样式内联在组件里，不改 editor.css。
 */
import type { Extension } from "@codemirror/state";
import { ViewPlugin, type EditorView } from "@codemirror/view";
import {
  isDisplayMath,
  renderMathHtml,
  renderMathInvalidPlaceholder,
} from "../../lib/math";
import { structureTransaction } from "../structure-history";
import { createAnchorTracker, placeMenu } from "./placement";
import type { AnchorRect } from "./anchor";

const PANEL_TESTID = "math-editor";
const INPUT_TESTID = "math-editor-input";
const PREVIEW_TESTID = "math-editor-preview";

/** 每个视图同一时刻只开一个浮层。 */
const sessions = new WeakMap<EditorView, Session>();

interface Session {
  commit: () => void;
  cancel: () => void;
}

interface MathSourceRange {
  from: number;
  to: number;
}

interface Preview {
  tex: string;
  display: boolean;
}

/** 从浮层源码里取出 tex 与分隔符形态；无法解析返回 null。 */
function parseSource(source: string): Preview | null {
  const s = source.trim();
  if (s.startsWith("$$")) {
    const end = s.indexOf("$$", 2);
    if (end < 0) return null;
    const tex = s.slice(2, end).trim();
    return { tex, display: true };
  }
  if (s.startsWith("$")) {
    const end = s.indexOf("$", 1);
    if (end < 0) return null;
    const tex = s.slice(1, end).trim();
    return { tex, display: false };
  }
  return null;
}

function viewportRect(): AnchorRect {
  return {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function renderPreview(el: HTMLElement, source: string): void {
  if (source.trim() === "") {
    el.innerHTML = renderMathHtml("", false);
    return;
  }
  const parsed = parseSource(source);
  if (!parsed) {
    el.innerHTML = renderMathInvalidPlaceholder();
    return;
  }
  el.innerHTML = renderMathHtml(
    parsed.tex,
    parsed.display || isDisplayMath(parsed.tex),
  );
}

function cursorAfterFormula(
  oldDoc: string,
  from: number,
  to: number,
  next: string,
): number {
  const after = oldDoc.slice(0, from) + next + oldDoc.slice(to);
  const end = from + next.length;
  if (!next.trimStart().startsWith("$$")) return end;
  let lineEnd = end;
  while (lineEnd < after.length && after[lineEnd] !== "\n") lineEnd += 1;
  return lineEnd < after.length ? lineEnd + 1 : end;
}

/** 打开（或替换）该视图的公式浮层。 */
export function openMathEditor(
  view: EditorView,
  range: MathSourceRange,
): void {
  const existing = sessions.get(view);
  if (existing) {
    existing.commit();
  }

  const { from, to } = range;
  const source = view.state.sliceDoc(from, to);
  const tracker = createAnchorTracker(view, { from, to });

  const panel = document.createElement("div");
  panel.className = "math-editor";
  panel.dataset.testid = PANEL_TESTID;
  panel.style.cssText =
    "position:fixed;z-index:2147483000;width:480px;max-width:calc(100vw - 32px);" +
    "padding:8px;border:1px solid var(--app-border);border-radius:12px;" +
    "background:var(--app-surface);color:var(--app-text);" +
    "box-shadow:var(--shadow-panel);";

  const input = document.createElement("textarea");
  input.className = "math-editor-input";
  input.dataset.testid = INPUT_TESTID;
  input.value = source;
  input.rows = 3;
  input.setAttribute("aria-label", "公式源码");
  input.style.cssText =
    "width:100%;box-sizing:border-box;min-height:64px;resize:vertical;" +
    "padding:6px 8px;border:1px solid var(--app-border);border-radius:8px;" +
    "background:var(--app-surface);color:var(--app-text);" +
    "font-family:var(--type-font-mono);font-size:13px;line-height:1.5;outline:none;";

  const preview = document.createElement("div");
  preview.className = "math-editor-preview";
  preview.dataset.testid = PREVIEW_TESTID;
  preview.style.cssText =
    "min-height:48px;margin-top:8px;padding:6px 8px;overflow:auto;" +
    "border-top:1px solid var(--app-border);";

  const hint = document.createElement("div");
  hint.className = "math-editor-hint";
  hint.textContent = "Esc 提交";
  hint.style.cssText =
    "margin-top:6px;font-size:12px;opacity:.65;" +
    "color:var(--app-text-secondary, var(--app-text));";

  panel.appendChild(input);
  panel.appendChild(preview);
  panel.appendChild(hint);
  document.body.appendChild(panel);

  renderPreview(preview, source);

  let frame = 0;
  const place = (): void => {
    const box = panel.getBoundingClientRect();
    const placement = placeMenu(
      tracker(),
      { width: box.width, height: box.height },
      viewportRect(),
      8,
      "below",
    );
    panel.style.left = `${placement.left}px`;
    panel.style.top = `${placement.top}px`;
  };
  const schedulePlace = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      place();
    });
  };

  const cleanup = (): void => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    view.scrollDOM.removeEventListener("scroll", schedulePlace);
    window.removeEventListener("resize", schedulePlace);
    document.removeEventListener("pointerdown", onOutside, true);
    document.removeEventListener("keydown", onKey, true);
    panel.removeEventListener("keydown", onPanelKey);
    panel.remove();
    if (sessions.get(view)?.commit === commit) sessions.delete(view);
  };

  const commit = (): void => {
    const next = input.value;
    const anchor = cursorAfterFormula(
      view.state.doc.toString(),
      from,
      to,
      next,
    );
    cleanup();
    if (next === source) {
      view.focus();
      return;
    }
    view.dispatch(
      structureTransaction({
        changes: { from, to, insert: next },
        selection: { anchor },
        scrollIntoView: true,
      }),
    );
    view.focus();
  };

  const cancel = (): void => {
    cleanup();
    view.focus();
  };

  const onOutside = (event: PointerEvent): void => {
    if (panel.contains(event.target as Node)) return;
    event.preventDefault();
    commit();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    commit();
  };
  const onPanelKey = (event: KeyboardEvent): void => {
    event.stopPropagation();
  };

  view.scrollDOM.addEventListener("scroll", schedulePlace);
  window.addEventListener("resize", schedulePlace);
  document.addEventListener("pointerdown", onOutside, true);
  document.addEventListener("keydown", onKey, true);
  panel.addEventListener("keydown", onPanelKey);

  input.addEventListener("input", () => renderPreview(preview, input.value));

  sessions.set(view, { commit, cancel });
  place();
  input.focus();
  input.select();
}

/** 公式浮层扩展：捕获点击 math widget 的指针事件并唤起源码浮层。 */
export function mathEditor(): Extension {
  return ViewPlugin.define((view) => {
    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const target = event.target as Element | null;
      const widget = target?.closest?.("[data-math-from]") as HTMLElement | null;
      if (!widget) return;
      const from = Number(widget.dataset.mathFrom);
      const to = Number(widget.dataset.mathTo);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return;
      event.preventDefault();
      event.stopPropagation();
      openMathEditor(view, { from, to });
    };
    view.contentDOM.addEventListener("pointerdown", onPointerDown, true);
    return {
      destroy(): void {
        view.contentDOM.removeEventListener("pointerdown", onPointerDown, true);
        sessions.get(view)?.cancel();
      },
    };
  });
}
