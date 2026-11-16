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
import { searchScan, type SearchScanHit } from "../../lib/searchScan";
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
  const [placement, setPlacement] = useState<Placement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const prevOpenRef = useRef(false);

  const close = useCallback(() => {
    useSearchFloatStore.getState().close(panelId);
  }, [panelId]);

  const hits = useMemo(() => searchScan(content, query), [content, query]);

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

  const locate = (hit: SearchScanHit) => {
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

      <div className="search-float-results" data-testid="search-float-results">
        {query && hits.length === 0 && (
          <p className="search-float-empty">无命中</p>
        )}
        {!query && <p className="search-float-empty">输入关键词开始搜索</p>}
        {hits.map((hit, index) => (
          <button
            key={`${hit.from}-${index}`}
            type="button"
            className="search-float-hit"
            data-testid="search-float-hit"
            onClick={() => locate(hit)}
          >
            <span className="search-float-loc">
              L{hit.line} · {BLOCK_TYPE_LABELS[hit.blockType] ?? "段落"}
            </span>
            <span className="search-float-context">
              {highlight(hit.context, query.trim())}
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
