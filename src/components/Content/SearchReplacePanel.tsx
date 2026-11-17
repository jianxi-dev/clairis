import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EditorView } from "@codemirror/view";
import {
  searchScan,
  searchHitSnippet,
  splitSearchBlocks,
  type SearchScanHit,
} from "../../lib/searchScan";
import {
  applyReplaceChanges,
  buildReplaceChanges,
} from "../../lib/searchReplace";
import { RESIZE_EDGES, type ResizeEdge } from "../../lib/previewAnchor";
import {
  SEARCH_FLOAT_MIN,
  resizeSearchFloat,
} from "../../lib/searchFloatResize";
import { digitFromCode } from "../../lib/gridKeyboard";
import { activateLocalContext } from "../../lib/shortcuts";
import { useSearchFloatStore } from "../../stores/searchFloat";
import { getEditorView } from "../../editors/editorRef";
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

const EDGE_MARGIN = 24;
const DRAG_THRESHOLD_PX = 3;

/**
 * 8 向手柄的命中区与光标（呈现层，与 FloatingPreview 同构；
 * 几何计算不在此处——一律走 previewAnchor 的 resizeSearchFloat）。
 */
const RESIZE_HANDLE_CURSOR: Record<ResizeEdge, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

const RESIZE_HANDLE_STYLE: Record<ResizeEdge, CSSProperties> = {
  n: { top: 0, left: 12, right: 12, height: 8 },
  s: { bottom: 0, left: 12, right: 12, height: 8 },
  e: { right: 0, top: 12, bottom: 12, width: 8 },
  w: { left: 0, top: 12, bottom: 12, width: 8 },
  ne: { top: 0, right: 0, width: 16, height: 16 },
  nw: { top: 0, left: 0, width: 16, height: 16 },
  se: { bottom: 0, right: 0, width: 16, height: 16 },
  sw: { bottom: 0, left: 0, width: 16, height: 16 },
};

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

interface DragStateBase {
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  width: number;
  height: number;
  active: boolean;
}

type DragState = DragStateBase &
  ({ mode: "move"; edge: null } | { mode: "resize"; edge: ResizeEdge });

interface HoverAnchor {
  index: number;
  x: number;
  y: number;
  altX: number;
  bounds: { left: number; top: number; right: number; bottom: number };
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
  const [replacement, setReplacement] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [status, setStatus] = useState("");
  const [hover, setHover] = useState<HoverAnchor | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [wasOpen, setWasOpen] = useState(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
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

  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setReplacement("");
      setReplaceMode(false);
      setHover(null);
      setHoverPos(null);
      setStatus("");
    }
  }

  const locate = useCallback(
    (hit: SearchScanHit) => {
      if (mode === "preview") {
        const preview =
          container?.querySelector<HTMLElement>(".preview-content");
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
      const view = getEditorView(panelId);
      if (!view) return;
      view.dispatch({
        selection: { anchor: hit.from, head: hit.to },
        effects: EditorView.scrollIntoView(hit.from, { y: "center" }),
      });
      view.focus();
    },
    [mode, container, panelId],
  );

  const canReplace = mode !== "preview";

  const toggleReplace = () => {
    const next = !replaceMode;
    setReplaceMode(next);
    if (!next) {
      setReplacement("");
      setHover(null);
      setHoverPos(null);
    }
  };

  const replaceOne = () => {
    const view = getEditorView(panelId);
    const hit = hits[safeSelected];
    if (!view || !hit) return;
    const changes = buildReplaceChanges([hit], replacement);
    if (changes.length === 0) return;
    const nextContent = applyReplaceChanges(content, changes);
    const nextHits = searchScan(nextContent, query);
    const nextFrom = hit.from + replacement.length;
    let nextIndex = nextHits.findIndex((h) => h.from >= nextFrom);
    if (nextIndex < 0) nextIndex = Math.max(0, nextHits.length - 1);
    const nextHit = nextHits[nextIndex];
    setSelected(nextHits.length > 0 ? nextIndex : 0);
    setHover(null);
    setHoverPos(null);
    view.dispatch(
      nextHit
        ? { changes, selection: { anchor: nextHit.from, head: nextHit.to } }
        : { changes },
    );
  };

  const replaceAll = () => {
    const view = getEditorView(panelId);
    if (!view || hits.length === 0) return;
    const changes = buildReplaceChanges(hits, replacement);
    if (changes.length === 0) return;
    view.dispatch({ changes });
    setSelected(0);
    setHover(null);
    setHoverPos(null);
    setStatus(`已替换 ${changes.length} 处`);
  };

  const onHitMouseEnter = (
    event: ReactMouseEvent<HTMLElement>,
    index: number,
  ) => {
    if (!replaceMode || !canReplace || !container) return;
    const b = container.getBoundingClientRect();
    const r = event.currentTarget.getBoundingClientRect();
    setHoverPos(null);
    setHover({
      index,
      x: r.right + 8,
      y: r.top,
      altX: r.left,
      bounds: { left: b.left, top: b.top, right: b.right, bottom: b.bottom },
    });
  };

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  useLayoutEffect(() => {
    if (!hover) return;
    const card = cardRef.current;
    if (!card) return;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const m = 8;
    let x = hover.x + w <= hover.bounds.right - m ? hover.x : hover.altX - w;
    if (x < hover.bounds.left + m) x = hover.bounds.left + m;
    let y = hover.y;
    if (y + h > hover.bounds.bottom - m) y = hover.bounds.bottom - m - h;
    if (y < hover.bounds.top + m) y = hover.bounds.top + m;
    setHoverPos((prev) =>
      prev && prev.x === x && prev.y === y ? prev : { x, y },
    );
  }, [hover]);

  const hoverHit = hover ? hits[hover.index] : null;
  const hoverBlock = hoverHit
    ? (blocks.find((b) => b.index === hoverHit.blockIndex) ?? null)
    : null;
  const hoverLocalFrom =
    hoverHit && hoverBlock ? Math.max(0, hoverHit.from - hoverBlock.from) : 0;
  const hoverLocalTo =
    hoverHit && hoverBlock
      ? Math.min(hoverBlock.text.length, hoverHit.to - hoverBlock.from)
      : 0;

  useEffect(() => {
    if (!open || safeSelected < 0) return;
    rowRefs.current.get(safeSelected)?.scrollIntoView({ block: "nearest" });
  }, [safeSelected, open, hits.length]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (prevOpenRef.current) {
      getEditorView(panelId)?.focus();
    }
    prevOpenRef.current = open;
  }, [open, panelId]);

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
      edge: null,
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onResizePointerDown = (
    edge: ResizeEdge,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
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
      edge,
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
    const rect = resizeSearchFloat(
      drag.edge,
      { x: drag.origX, y: drag.origY, w: drag.width, h: drag.height },
      dx,
      dy,
    );
    // host 边界钳制：先钳尺寸保持锚定边，再钳位置保持对边锚死。
    // 南/东向：北/西边锚死（x/y 不动），尺寸上限 = host 剩余空间（不低于最小尺寸）。
    // 北/西向：南/东边锚死——先钳位置再收回尺寸，保证对边精确不动。
    let { x, y, w, h } = rect;
    if (drag.edge.includes("s")) {
      h = Math.min(h, Math.max(SEARCH_FLOAT_MIN.h, hostRect.height - y));
    }
    if (drag.edge.includes("e")) {
      w = Math.min(w, Math.max(SEARCH_FLOAT_MIN.w, hostRect.width - x));
    }
    if (drag.edge.includes("n")) {
      const south = y + h;
      y = Math.max(0, y);
      h = Math.min(h, south - y);
    }
    if (drag.edge.includes("w")) {
      const east = x + w;
      x = Math.max(0, x);
      w = Math.min(w, east - x);
    }
    setPlacement({ x, y, width: w, height: h });
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
        {canReplace && (
          <button
            type="button"
            className={`search-float-replace-toggle${replaceMode ? " on" : ""}`}
            data-testid="search-float-replace-toggle"
            aria-label="切换替换"
            aria-pressed={replaceMode}
            title="切换替换"
            onClick={toggleReplace}
          >
            ⇄
          </button>
        )}
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

      {canReplace && replaceMode && (
        <div
          className="search-float-replacerow"
          data-testid="search-float-replace-row"
        >
          <input
            data-testid="search-float-replace-input"
            type="text"
            value={replacement}
            placeholder="替换为…"
            onChange={(event) => setReplacement(event.target.value)}
          />
          <button
            type="button"
            className="search-float-replace-btn"
            data-testid="search-float-replace-one"
            onClick={replaceOne}
          >
            逐个替换
          </button>
          <button
            type="button"
            className="search-float-replace-btn primary"
            data-testid="search-float-replace-all"
            onClick={replaceAll}
          >
            全部替换
          </button>
        </div>
      )}

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
            onMouseEnter={(event) => onHitMouseEnter(event, index)}
            onMouseLeave={() => setHover(null)}
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
              {canReplace && replaceMode && (
                <span
                  className="search-float-diff"
                  data-testid="search-float-diff"
                >
                  <del>{hit.text}</del>
                  {replacement && (
                    <>
                      <span
                        className="search-float-diff-arrow"
                        aria-hidden="true"
                      >
                        →
                      </span>
                      <ins>{replacement}</ins>
                    </>
                  )}
                </span>
              )}
            </span>
            <span className="search-float-key">
              {index === safeSelected ? "⏎" : index < 9 ? `⌘${index + 1}` : ""}
            </span>
          </button>
        ))}
      </div>

      {status && (
        <div
          className="search-float-status"
          data-testid="search-float-status"
          role="status"
        >
          {status}
        </div>
      )}

      {replaceMode &&
        hover &&
        hoverHit &&
        createPortal(
          <div
            ref={cardRef}
            className="search-float-hover"
            data-testid="search-float-hover-card"
            style={{
              left: `${(hoverPos ?? hover).x}px`,
              top: `${(hoverPos ?? hover).y}px`,
            }}
          >
            <div className="search-float-hover-head">
              <b>
                L{hoverHit.line} ·{" "}
                {BLOCK_TYPE_LABELS[hoverHit.blockType] ?? "段落"}
              </b>
              <span>悬浮预览</span>
            </div>
            <div className="search-float-hover-body">
              {(hoverBlock?.text ?? hoverHit.context).slice(0, hoverLocalFrom)}
              <mark>
                {(hoverBlock?.text ?? hoverHit.context).slice(
                  hoverLocalFrom,
                  hoverLocalTo,
                )}
              </mark>
              {(hoverBlock?.text ?? hoverHit.context).slice(hoverLocalTo)}
            </div>
          </div>,
          document.body,
        )}

      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge}
          className="search-float-resize-handle"
          data-testid={`search-float-resize-${edge}`}
          aria-hidden="true"
          onPointerDown={(event) => onResizePointerDown(edge, event)}
          style={{
            cursor: RESIZE_HANDLE_CURSOR[edge],
            ...RESIZE_HANDLE_STYLE[edge],
          }}
        />
      ))}
    </div>
  );
}
