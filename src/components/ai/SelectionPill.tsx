import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { getActiveEditorView } from "../../editors/editorRef";
import { invoke } from "@tauri-apps/api/core";
import { humanizeAgentError } from "../../lib/aiErrors";
import { useAiEntryStore } from "../../hooks/useAiEntry";
import { detectSelectionPillMode } from "../../lib/selectionPillMode";
import DiffView from "./DiffView";

type PillMode = "editor" | "preview";

interface PillSelection {
  mode: PillMode;
  text: string;
  x: number;
  y: number;
  from: number;
  to: number;
}

interface DiffResult {
  before: string;
  after: string;
  from: number;
  to: number;
}

interface EditorAction {
  key: string;
  label: string;
  prompt: (t: string) => string;
}

const EDITOR_ACTIONS: readonly EditorAction[] = [
  {
    key: "rewrite",
    label: "改写",
    prompt: (t) => `请改写下面的文本，只返回替换后的文本，不要解释：\n\n${t}`,
  },
  {
    key: "translate",
    label: "翻译",
    prompt: (t) => `请把下面的文本翻译成中文，只返回译文，不要解释：\n\n${t}`,
  },
  {
    key: "polish",
    label: "润色",
    prompt: (t) =>
      `请润色下面的文本，保持原意，只返回润色后的文本，不要解释：\n\n${t}`,
  },
];

type PreviewAction =
  | { key: "copy"; label: "复制" }
  | { key: "explain"; label: "解释"; prompt: string }
  | { key: "translate"; label: "翻译"; prompt: string };

const PREVIEW_ACTIONS: readonly PreviewAction[] = [
  { key: "copy", label: "复制" },
  {
    key: "explain",
    label: "解释",
    prompt: "请解释下面这段文字，说明它的含义与上下文：",
  },
  {
    key: "translate",
    label: "翻译",
    prompt: "请把下面这段文字翻译成中文，只返回译文：",
  },
];

function previewRoots(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".preview-content"));
}

export default function SelectionPill() {
  const [pill, setPill] = useState<PillSelection | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const busyRef = useRef<string | null>(null);
  const diffRef = useRef<DiffResult | null>(null);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    diffRef.current = diff;
  }, [diff]);

  useEffect(() => {
    const onSelectionChange = () => {
      if (busyRef.current || diffRef.current) {
        setPill(null);
        return;
      }
      const s = window.getSelection();
      const view = getActiveEditorView();
      const mode = detectSelectionPillMode(
        s,
        view?.dom ?? null,
        previewRoots(),
      );
      if (!mode || !s) {
        setPill(null);
        return;
      }
      const text = s.toString();
      if (!text.trim()) {
        setPill(null);
        return;
      }
      const rect = s.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;
      const x = rect.left + rect.width / 2;
      const y = rect.top;

      if (mode === "preview") {
        setPill({ mode, text, x, y, from: 0, to: 0 });
        return;
      }

      try {
        const from = view!.posAtDOM(s.anchorNode!, s.anchorOffset);
        const to = view!.posAtDOM(s.focusNode!, s.focusOffset);
        setPill({
          mode,
          text,
          x,
          y,
          from: Math.min(from, to),
          to: Math.max(from, to),
        });
      } catch {
        setPill(null);
      }
    };
    const onHide = () => {
      if (!busyRef.current && !diffRef.current) setPill(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (busyRef.current || diffRef.current) return;
      setPill(null);
    };
    const onDocMouseDown = (e: MouseEvent) => {
      if (busyRef.current || diffRef.current) return;
      const pillEl = document.querySelector<HTMLElement>(
        "[data-selection-pill]",
      );
      if (pillEl?.contains(e.target as Node)) return;
      setPill(null);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mousedown", onDocMouseDown, true);
    window.addEventListener("scroll", onHide, { capture: true });
    window.addEventListener("resize", onHide);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mousedown", onDocMouseDown, true);
      window.removeEventListener("scroll", onHide, { capture: true });
      window.removeEventListener("resize", onHide);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function closeAll(): void {
    setPill(null);
    setDiff(null);
    setNotice(null);
  }

  function copySelection(text: string): void {
    // 剪贴板不可用（如非安全上下文）时静默；胶囊仍按预期关闭
    navigator.clipboard?.writeText(text).catch(() => {});
    closeAll();
  }

  function askAi(prompt: string, text: string): void {
    const ai = useAiEntryStore.getState();
    ai.setInput(`${prompt}\n\n${text}`);
    ai.openOverlay();
    closeAll();
  }

  function runPreviewAction(action: PreviewAction): void {
    if (!pill) return;
    if (action.key === "copy") {
      copySelection(pill.text);
      return;
    }
    askAi(action.prompt, pill.text);
  }

  async function run(action: EditorAction): Promise<void> {
    if (!pill || busyRef.current) return;
    const selection = pill;
    setBusy(action.key);
    setNotice(null);
    try {
      const reply = await invoke<{ text: string }>("run_agent_turn", {
        messages: [{ role: "user", content: action.prompt(selection.text) }],
      });
      const after = (reply.text || "").trim();
      if (!after) {
        setNotice("没有拿到结果，请重试。");
      } else {
        setDiff({
          before: selection.text,
          after,
          from: selection.from,
          to: selection.to,
        });
      }
    } catch (err) {
      setNotice(humanizeAgentError(err));
    } finally {
      setBusy(null);
      setPill(null);
    }
  }

  async function applyResult(): Promise<void> {
    if (!diff) return;
    const target = diff;
    let view: EditorView | null = getActiveEditorView();
    if (!view) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      view = getActiveEditorView();
    }
    if (view) {
      const len = view.state.doc.length;
      const from = Math.max(0, Math.min(target.from, len));
      const to = Math.max(0, Math.min(target.to, len));
      view.dispatch({ changes: { from, to, insert: target.after } });
      closeAll();
      return;
    }
    try {
      await navigator.clipboard.writeText(target.after);
      setNotice("无法直接替换，已把结果复制到剪贴板。");
    } catch {
      setNotice("无法替换选区，请手动复制结果。");
    }
    setDiff(null);
    setPill(null);
  }

  return (
    <>
      {pill && !busy && !diff && (
        <div
          data-selection-pill
          data-selection-pill-mode={pill.mode}
          className="app-capsule fixed z-[2147482960] flex items-center gap-0.5 -translate-x-1/2 border border-black/6 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-sm shadow-lg px-1.5 py-1"
          style={{ left: pill.x, top: Math.max(8, pill.y - 44) }}
        >
          {pill.mode === "editor"
            ? EDITOR_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void run(a)}
                  className="px-2 py-0.5 rounded-full text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {a.label}
                </button>
              ))
            : PREVIEW_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runPreviewAction(a)}
                  className="px-2 py-0.5 rounded-full text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {a.label}
                </button>
              ))}
        </div>
      )}

      {(busy || diff || notice) && (
        <div
          data-selection-diff
          className="fixed bottom-16 left-1/2 z-[2147482970] w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-[14px] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.06)] border border-black/6 dark:border-white/10 p-3"
        >
          {busy && (
            <p
              className="text-xs text-gray-500 dark:text-gray-400"
              role="status"
            >
              正在处理…
            </p>
          )}
          {diff && <DiffView before={diff.before} after={diff.after} />}
          {diff && (
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                data-diff-cancel
                onClick={closeAll}
                className="px-2.5 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-200 text-xs"
              >
                取消
              </button>
              <button
                type="button"
                data-diff-apply
                onClick={() => void applyResult()}
                className="px-2.5 py-1 rounded-md bg-[#0071e3] text-white text-xs font-medium"
              >
                应用
              </button>
            </div>
          )}
          {notice && (
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {notice}
              <button
                type="button"
                onClick={closeAll}
                className="ml-2 text-[#0071e3] hover:underline"
              >
                关闭
              </button>
            </p>
          )}
        </div>
      )}
    </>
  );
}
