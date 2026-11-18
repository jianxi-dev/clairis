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
} from "react";
import { createPortal } from "react-dom";
import { EditorView } from "@codemirror/view";
import {
  searchScan,
  searchHitSnippetWithRange,
  splitSearchBlocks,
  type SearchScanHit,
} from "../../lib/searchScan";
import {
  isMarkdownTable,
  plainTableSnippet,
} from "../../lib/searchSnippetText";
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
import { renderInlineWithHit } from "../../renderers/inline";
import Icon from "../Icon";
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

/** 结果行上下文片段半径，与 searchHitSnippet 的默认一致。 */
const SNIPPET_RADIUS = 44;

export const SEARCH_FLOAT_MAX_ROWS = 9;

/** 状态栏在「指针离开 + 失焦」同时满足后的自动隐藏延迟（S-6 / D2）。 */
const STATUS_BAR_HIDE_DELAY_MS = 2000;

interface SearchFloatStatusBarProps {
  rootRef: { current: HTMLDivElement | null };
}

function SearchFloatStatusBar({ rootRef }: SearchFloatStatusBarProps) {
  const [visible, setVisible] = useState(true);
  const pointerInRef = useRef(false);
  const focusInRef = useRef(true);
  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearHideTimer();
    setVisible(true);
  }, [clearHideTimer]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      if (!pointerInRef.current && !focusInRef.current) {
        setVisible(false);
      }
    }, STATUS_BAR_HIDE_DELAY_MS);
  }, [clearHideTimer]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onFocusIn = () => {
      focusInRef.current = true;
      show();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!root.contains(event.relatedTarget as Node | null)) {
        focusInRef.current = false;
        scheduleHide();
      }
    };
    const onPointerEnter = () => {
      pointerInRef.current = true;
      show();
    };
    const onPointerLeave = () => {
      pointerInRef.current = false;
      scheduleHide();
    };
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);
    return () => {
      clearHideTimer();
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("pointerenter", onPointerEnter);
      root.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [rootRef, show, scheduleHide, clearHideTimer]);

  return (
    <div
      className={`search-float-statusbar${
        visible ? "" : " search-float-statusbar-hidden"
      }`}
      data-testid="search-float-statusbar"
    >
      ↑↓ 切换 · ↵ 定位选中 · ⌘1~9 直达 · Esc 关闭
    </div>
  );
}

interface Placement {
  x: number;
  y: number;
  width: number;
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
  // 拖拽高度只在本次打开周期内覆盖默认高度；重开即回自适应。
  const [sessionHeight, setSessionHeight] = useState<number | null>(null);
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
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const prevOpenRef = useRef(false);
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const resultsRef = useRef<HTMLDivElement>(null);
  const [resultsMaxHeight, setResultsMaxHeight] = useState(0);
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);
  const firstVisibleIndexRef = useRef(0);

  const close = useCallback(() => {
    useSearchFloatStore.getState().close(panelId);
  }, [panelId]);

  const hits = useMemo(() => searchScan(content, query), [content, query]);
  const blocks = useMemo(() => splitSearchBlocks(content), [content]);
  const snippetHits = useMemo(
    () =>
      hits.map((hit) =>
        searchHitSnippetWithRange(content, hit, SNIPPET_RADIUS, blocks),
      ),
    [content, hits, blocks],
  );
  // 只有表格块在展示层文本化：命中区间经映射换算，高亮落点不变。
  const tableBlocks = useMemo(
    () =>
      new Set(
        blocks
          .filter((block) => isMarkdownTable(block.text))
          .map((b) => b.index),
      ),
    [blocks],
  );
  const displaySnippets = useMemo(
    () =>
      hits.map((hit, index) => {
        const entry = snippetHits[index];
        const raw = entry?.snippet ?? hit.context;
        if (!tableBlocks.has(hit.blockIndex)) {
          return { snippet: raw, hit: entry?.hit };
        }
        const plain = plainTableSnippet(raw);
        const range = entry?.hit;
        return {
          snippet: plain.text,
          hit: range
            ? { from: plain.map[range.from], to: plain.map[range.to] }
            : undefined,
        };
      }),
    [hits, snippetHits, tableBlocks],
  );
  const safeSelected =
    hits.length === 0 ? -1 : Math.min(selected, hits.length - 1);

  if (prevQuery !== query) {
    setPrevQuery(query);
    setSelected(0);
  }

  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setHover(null);
      setHoverPos(null);
      setSelected(0);
      setSessionHeight(null);
    } else {
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
      // 焦点落回浮窗外会让根的 capture 键处理与局部键上下文一起失效，↑↓ 随之失灵。
      inputRef.current?.focus();
    },
    [mode, container, panelId],
  );

  // 结果区首个完整可见行：键位列显示与 ⌘N 直达共用这一份索引，避免两处各算导致所见与所绑不一致。
  const syncFirstVisible = useCallback(() => {
    const el = resultsRef.current;
    if (!el) return;
    const rowEls = el.querySelectorAll<HTMLElement>(".search-float-hit");
    if (rowEls.length === 0) {
      firstVisibleIndexRef.current = 0;
      setFirstVisibleIndex((prev) => (prev === 0 ? prev : 0));
      return;
    }
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const top = rect.top + (parseFloat(style.paddingTop) || 0);
    const bottom = rect.bottom - (parseFloat(style.paddingBottom) || 0);
    let first = -1;
    for (let i = 0; i < rowEls.length; i++) {
      const r = rowEls[i].getBoundingClientRect();
      if (r.top >= top - 1 && r.bottom <= bottom + 1) {
        first = i;
        break;
      }
    }
    if (first < 0) {
      // 容器内没有完整行（行高超过容器）时退化为首个越过顶部的行。
      for (let i = 0; i < rowEls.length; i++) {
        const r = rowEls[i].getBoundingClientRect();
        if (r.bottom > top) {
          first = i;
          break;
        }
      }
    }
    if (first < 0) first = 0;
    firstVisibleIndexRef.current = first;
    setFirstVisibleIndex((prev) => (prev === first ? prev : first));
  }, []);

  useEffect(() => {
    const el = resultsRef.current;
    if (!el) return;
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        syncFirstVisible();
      });
    };
    syncFirstVisible();
    el.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", schedule);
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [syncFirstVisible, open, query, content, mode, replaceMode]);

  const keyTextFor = useCallback(
    (index: number): string => {
      if (index === safeSelected) return "↵";
      const rel = index - firstVisibleIndex;
      return rel >= 0 && rel < SEARCH_FLOAT_MAX_ROWS ? `⌘${rel + 1}` : "";
    },
    [safeSelected, firstVisibleIndex],
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
    setSelected(index);
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

  useLayoutEffect(() => {
    const results = resultsRef.current;
    if (!results) return;
    const measure = () => {
      const first = results.querySelector<HTMLElement>(".search-float-hit");
      if (!first) {
        setResultsMaxHeight(0);
        return;
      }
      const cs = getComputedStyle(results);
      const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const next =
        Math.min(hits.length, SEARCH_FLOAT_MAX_ROWS) *
          first.getBoundingClientRect().height +
        padding;
      setResultsMaxHeight((prev) =>
        Math.abs(prev - next) > 0.5 ? next : prev,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(results);
    const first = results.querySelector<HTMLElement>(".search-float-hit");
    if (first) observer.observe(first);
    return () => observer.disconnect();
  }, [open, query, content, hits, snippetHits, mode, replaceMode]);

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
          setSelected(
            Math.min(firstVisibleIndexRef.current + digit - 1, hits.length - 1),
          );
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
    setPlacement({ x, y, width: w });
    setSessionHeight(h);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
  };

  const style: CSSProperties = {
    position: "absolute",
    display: open ? "flex" : "none",
    ...(sessionHeight !== null
      ? { height: sessionHeight }
      : hits.length > SEARCH_FLOAT_MAX_ROWS
        ? { height: "auto" }
        : {}),
    ...(placement
      ? {
          left: placement.x,
          top: placement.y,
          width: placement.width,
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
        <span className="search-float-title">搜索和替换</span>
        <button
          type="button"
          className="search-float-close"
          data-testid="search-float-close"
          aria-label="关闭搜索"
          title="关闭搜索"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={close}
        >
          <Icon name="close" size={18} />
        </button>
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
        <div className={`search-float-inputbox${query ? " has-clear" : ""}`}>
          <input
            ref={inputRef}
            data-testid="search-float-input"
            type="text"
            value={query}
            placeholder="搜索当前文档"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query !== "" && (
            <button
              type="button"
              className="search-float-clear"
              data-testid="search-float-clear"
              aria-label="清空关键词"
              title="清空关键词"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
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
      </div>

      {canReplace && replaceMode && (
        <div
          className="search-float-replacerow"
          data-testid="search-float-replace-row"
        >
          <div
            className={`search-float-inputbox${replacement ? " has-clear" : ""}`}
          >
            <input
              ref={replaceInputRef}
              data-testid="search-float-replace-input"
              type="text"
              value={replacement}
              placeholder="替换为…"
              onChange={(event) => setReplacement(event.target.value)}
            />
            {replacement !== "" && (
              <button
                type="button"
                className="search-float-clear"
                data-testid="search-float-replace-clear"
                aria-label="清空替换词"
                title="清空替换词"
                onClick={() => {
                  setReplacement("");
                  replaceInputRef.current?.focus();
                }}
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
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

      <div
        ref={resultsRef}
        className="search-float-results"
        data-testid="search-float-results"
        style={
          resultsMaxHeight > 0
            ? { maxHeight: `${resultsMaxHeight}px` }
            : undefined
        }
      >
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
              <span
                className="search-float-context"
                dangerouslySetInnerHTML={{
                  __html: renderInlineWithHit(
                    displaySnippets[index]?.snippet ?? hit.context,
                    displaySnippets[index]?.hit,
                  ),
                }}
              />
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
            <span
              className="search-float-key"
              aria-label={index === safeSelected ? "回车" : undefined}
            >
              {keyTextFor(index)}
            </span>
          </button>
        ))}
      </div>

      {open && <SearchFloatStatusBar rootRef={rootRef} />}

      {status && (
        <div
          className="search-float-status"
          data-testid="search-float-status"
          role="status"
        >
          {status}
        </div>
      )}

      {open &&
        replaceMode &&
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
            <div
              className="search-float-hover-body"
              dangerouslySetInnerHTML={{
                __html: renderInlineWithHit(
                  hoverBlock?.text ?? hoverHit.context,
                  hoverBlock
                    ? { from: hoverLocalFrom, to: hoverLocalTo }
                    : undefined,
                ),
              }}
            />
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
