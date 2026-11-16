import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { EditorView } from "@codemirror/view";
import {
  searchScan,
  searchHitSnippet,
  splitSearchBlocks,
  type SearchScanHit,
} from "../../lib/searchScan";
import { digitFromCode } from "../../lib/gridKeyboard";
import { activateLocalContext } from "../../lib/shortcuts";
import { useSearchFloatStore } from "../../stores/searchFloat";
import { getActiveEditorView } from "../../editors/editorRef";
import type { EditorMode, SearchPanelDefaultPos } from "../../types";

const BLOCK_TYPE_LABELS: Record<string, string> = {
  heading: "标题",
  paragraph: "段落",
  fencedCode: "代码块",
  blockquote: "引用",
  list: "列表",
  frontmatter: "前置元数据",
  thematicBreak: "分隔线",
};

/** 与 shortcuts.ts 的 local-search-row-pick 条目一致。 */
const LOCAL_CONTEXT = "搜索浮窗打开且焦点在浮窗内";

const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const EDGE_MARGIN = 24;
const DRAG_THRESHOLD_PX = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(context: string, needle: string): ReactNode {
  if (!needle) return context;
  let matcher: RegExp;
  try {
    matcher = new RegExp(escapeRegExp(needle), "gi");
  } catch {
    return context;
  }
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(context)) !== null) {
    if (match[0].length === 0) {
      matcher.lastIndex += 1;
      continue;
    }
    parts.push(context.slice(last, match.index));
    parts.push(<mark key={key++}>{match[0]}</mark>);
    last = match.index + match[0].length;
  }
  parts.push(context.slice(last));
  return parts;
}

interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  width: number;
  height: number;
  mode: "move" | "resize";
  active: boolean;
}

interface SearchReplacePanelProps {
  open: boolean;
  content: string;
  mode: EditorMode;
  defaultPos: SearchPanelDefaultPos;
  container: HTMLElement | null;
  panelId: string;
}

export default function SearchReplacePanel({
  open,
  content,
  mode,
  defaultPos,
  container,
  panelId,
}: SearchReplacePanelProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [prevQuery, setPrevQuery] = useState(query);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const prevOpenRef = useRef(false);
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const close = useCallback(() => {
    useSearchFloatStore.getState().close(panelId);
  }, [panelId]);

  const hits = useMemo(() => searchScan(content, query), [content, query]);
  const blocks = useMemo(() => splitSearchBlocks(content), [content]);
  const snippets = useMemo(
    () => hits.map((hit) => searchHitSnippet(content, hit, 44, blocks)),
    [content, hits, blocks],
  );
  const safeSelected =
    hits.length === 0 ? -1 : Math.min(selected, hits.length - 1);

  if (prevQuery !== query) {
    setPrevQuery(query);
    setSelected(0);
  }

  const locate = useCallback((hit: SearchScanHit) => {
    if (mode === "preview") {
      const preview = container?.querySelector<HTMLElement>(".preview-content");
      if (!preview) return;
      const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
      const needle = hit.text.toLowerCase();
      let node = walker.nextNode();
      while (node) {
        if ((node.textContent ?? "").toLowerCase().includes(needle)) {
          (node.parentElement as HTMLElement | null)?.scrollIntoView({
            behavior: "auto",
            block: "center",
          });
          return;
        }
        node = walker.nextNode();
      }
      return;
    }
    const view = getActiveEditorView();
    if (!view) return;
    view.dispatch({
      selection: { anchor: hit.from, head: hit.to },
      effects: EditorView.scrollIntoView(hit.from, { y: "center" }),
    });
    view.focus();
  }, [mode, container]);

  useEffect(() => {
    if (!open || safeSelected < 0) return;
    rowRefs.current.get(safeSelected)?.scrollIntoView({ block: "nearest" });
  }, [safeSelected, open, hits.length]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (prevOpenRef.current) {
      getActiveEditorView()?.focus();
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  // 浮窗挂载即注册局部键上下文；焦点离开浮窗或关闭即归还，避免残留占用。
  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    let off = activateLocalContext(LOCAL_CONTEXT);
    let active = true;
    const onFocusOut = (event: FocusEvent) => {
      if (!active || !root) return;
      if (!root.contains(event.relatedTarget as Node | null)) {
        off();
        active = false;
      }
    };
    const onFocusIn = () => {
      if (active) return;
      off = activateLocalContext(LOCAL_CONTEXT);
      active = true;
    };
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      if (active) off();
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  // 浮窗根节点 capture 拦截：⌘1~9 直达、↑↓ 换选、Enter 定位、Esc 关闭，
  // stopPropagation 使全局「卡片直开 ⌘1–9」等 window 冒泡监听收不到。
  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    if (!root) return;
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      let handled = true;
      if (event.key === "ArrowDown") {
        if (hits.length === 0) handled = false;
        else setSelected((s) => Math.min(hits.length - 1, s + 1));
      } else if (event.key === "ArrowUp") {
        if (hits.length === 0) handled = false;
        else setSelected((s) => Math.max(0, s - 1));
      } else if (event.key === "Enter") {
        const hit = hits[safeSelected];
        if (hit) locate(hit);
        else handled = false;
      } else if (event.key === "Escape") {
        close();
      } else if (meta) {
        const digit = digitFromCode(event.code);
        if (digit !== null && digit >= 1 && digit <= hits.length) {
          setSelected(digit - 1);
        } else {
          handled = false;
        }
      } else {
        handled = false;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    root.addEventListener("keydown", onKey, true);
    return () => root.removeEventListener("keydown", onKey, true);
  }, [open, hits, safeSelected, close, locate]);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const root = rootRef.current;
    const host = root?.offsetParent as HTMLElement | null;
    if (!root || !host) return;
    const hostRect = host.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: rootRect.left - hostRect.left,
      origY: rootRect.top - hostRect.top,
      width: rootRect.width,
      height: rootRect.height,
      mode: "move",
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onResizePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const root = rootRef.current;
    const host = root?.offsetParent as HTMLElement | null;
    if (!root || !host) return;
    const hostRect = host.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: rootRect.left - hostRect.left,
      origY: rootRect.top - hostRect.top,
      width: rootRect.width,
      height: rootRect.height,
      mode: "resize",
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
    }
    const host = rootRef.current?.offsetParent as HTMLElement | null;
    if (!host) return;
    const hostRect = host.getBoundingClientRect();
    if (drag.mode === "move") {
      setPlacement({
        x: clamp(drag.origX + dx, 0, hostRect.width - drag.width),
        y: clamp(drag.origY + dy, 0, hostRect.height - drag.height),
        width: drag.width,
        height: drag.height,
      });
      return;
    }
    setPlacement({
      x: drag.origX,
      y: drag.origY,
      width: clamp(drag.width + dx, MIN_WIDTH, hostRect.width),
      height: clamp(drag.height + dy, MIN_HEIGHT, hostRect.height),
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
  };

  const style: CSSProperties = {
    position: "absolute",
    display: open ? "flex" : "none",
    ...(placement
      ? {
          left: placement.x,
          top: placement.y,
          width: placement.width,
          height: placement.height,
          transform: "none",
        }
      : defaultPos === "center"
        ? { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
        : defaultPos === "left"
          ? {
              left: EDGE_MARGIN,
              top: "50%",
              transform: "translateY(-50%)",
            }
          : {
              right: EDGE_MARGIN,
              top: "50%",
              transform: "translateY(-50%)",
            }),
  };

  return (
    <div
      ref={rootRef}
      className="search-float"
      data-testid="search-float"
      role="dialog"
      aria-label="搜索当前文档"
      style={style}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="search-float-handle"
        data-testid="search-float-handle"
        aria-hidden="true"
        onPointerDown={onHandlePointerDown}
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M8 6h8M8 12h8M8 18h8" />
        </svg>
      </div>

      <div className="search-float-inputrow">
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          data-testid="search-float-input"
          type="text"
          value={query}
          placeholder="搜索当前文档"
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="search-float-count" data-testid="search-float-count">
          {query ? `${hits.length} 处` : ""}
        </span>
        <button
          type="button"
          className="search-float-close"
          data-testid="search-float-close"
          aria-label="关闭搜索"
          onClick={close}
        >
          ×
        </button>
      </div>

      {hits.length > 0 && (
        <div
          className="search-float-dist"
          data-testid="search-float-dist"
          title="命中分布（点刻度跳转）"
        >
          {hits.map((hit, index) => (
            <button
              key={`dist-${hit.from}-${index}`}
              type="button"
              className={`search-float-dist-tick${
                index === safeSelected ? " cur" : ""
              }`}
              data-testid="search-float-dist-tick"
              data-index={index}
              style={{ left: `${((index + 0.5) / hits.length) * 100}%` }}
              title={`第 ${index + 1} 处 · L${hit.line}`}
              aria-label={`第 ${index + 1} 处 · L${hit.line}`}
              onClick={() => {
                setSelected(index);
                locate(hit);
              }}
            />
          ))}
        </div>
      )}

      <div className="search-float-results" data-testid="search-float-results">
        {query && hits.length === 0 && (
          <p className="search-float-empty">无命中</p>
        )}
        {!query && <p className="search-float-empty">输入关键词开始搜索</p>}
        {hits.map((hit, index) => (
          <button
            key={`${hit.from}-${index}`}
            type="button"
            className={`search-float-hit${
              index === safeSelected ? " search-float-hit-cur" : ""
            }`}
            data-testid="search-float-hit"
            data-index={index}
            ref={(el) => {
              if (el) rowRefs.current.set(index, el);
              else rowRefs.current.delete(index);
            }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setSelected(index);
              locate(hit);
            }}
          >
            <span className="search-float-main">
              <span className="search-float-top">
                <span className="search-float-loc">
                  L{hit.line} · {BLOCK_TYPE_LABELS[hit.blockType] ?? "段落"}
                </span>
                <span className="search-float-idx">
                  {index + 1}/{hits.length}
                </span>
              </span>
              <span className="search-float-context">
                {highlight(snippets[index] ?? hit.context, query.trim())}
              </span>
            </span>
            <span className="search-float-key">
              {index === safeSelected ? "⏎" : index < 9 ? `⌘${index + 1}` : ""}
            </span>
          </button>
        ))}
      </div>

      <div
        className="search-float-resize"
        data-testid="search-float-resize"
        aria-hidden="true"
        onPointerDown={onResizePointerDown}
      />
    </div>
  );
}
