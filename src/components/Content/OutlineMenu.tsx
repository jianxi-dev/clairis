import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EditorView } from "@codemirror/view";
import { EditorView as CM } from "@codemirror/view";
import {
  applyOutlineOrder,
  extractHeadings,
  headingsFromDom,
  outlineHeadingId,
  readOutlineOrder,
  writeOutlineOrder,
  type OutlineHeading,
} from "../../lib/outline";
import { useStore } from "../../stores/index";

type OutlineMode = "edit" | "source" | "preview";

/** 拖动与点击的分界：位移不足 4px 仍按点击导航（AGENTS.md 硬约定）。 */
const DRAG_THRESHOLD_PX = 4;

interface OutlineMenuProps {
  mode: OutlineMode;
  /** 当前页签的 markdown 文本（编辑/源码模式解析用）。 */
  documentText: string;
  /** 当前页签的 CM6 实例（编辑/源码模式滚动用）。 */
  view: EditorView | null;
  /** 当前面板容器：预览模式在其范围内取 `.preview-content` 的 h1–h6。 */
  container: HTMLElement | null;
}

function positionOfLine(view: EditorView, line: number): number {
  const doc = view.state.doc;
  if (line < 0) return 0;
  return doc.line(Math.min(line + 1, doc.lines)).from;
}

function scrollInEditor(view: EditorView, line: number): void {
  const pos = positionOfLine(view, line);
  view.dispatch({
    selection: { anchor: pos },
    effects: CM.scrollIntoView(pos, { y: "start" }),
  });
  view.focus();
}

/**
 * 编辑器大纲浮层（移植自 md-bundle app-kit/outline/OutlineMenu.tsx）。
 *
 * 悬停展开、点击钉住、Esc 收起；列表跳过代码块内的 `#`；点击只做导航
 * （滚动到标题行），不做折叠/块拖拽。
 */
export default function OutlineMenu({
  mode,
  documentText,
  view,
  container,
}: OutlineMenuProps) {
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  /**
   * 收起延迟。按钮与面板之间有一条缝，指针跨过去时会先触发一次 mouseleave——
   * 立即收起的话面板在指针到达前就没了（#107）。留一点时间让指针走进面板，
   * 进去即取消。
   */
  const closeTimer = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [domHeadings, setDomHeadings] = useState<OutlineHeading[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // 持久化键按文档路径隔离；未保存页签（path 为 null）只做会话内排序。
  const docPath = useStore((s) => {
    const id = s.activeTabId;
    const tab = id ? s.tabs[id] : undefined;
    return tab?.path ?? null;
  });
  const [savedOrder, setSavedOrder] = useState<string[] | null>(() =>
    docPath ? readOutlineOrder(docPath) : null,
  );
  const [dragOrder, setDragOrder] = useState<OutlineHeading[] | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    itemHeight: number;
    fromIndex: number;
    order: OutlineHeading[];
    moved: OutlineHeading;
    active: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const visible = pinned || hovering;

  useEffect(() => {
    setSavedOrder(docPath ? readOutlineOrder(docPath) : null);
  }, [docPath]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setHovering(false);
    }, 200);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  // 预览的 DOM 在 commit 阶段才更新，必须在布局效果里读，避免拿到上一份文档的标题。
  useLayoutEffect(() => {
    if (mode !== "preview" || !container) {
      setDomHeadings([]);
      return;
    }
    const preview = container.querySelector<HTMLElement>(".preview-content");
    setDomHeadings(preview ? headingsFromDom(preview) : []);
  }, [mode, documentText, container]);

  const headings = useMemo(
    () => (mode === "preview" ? domHeadings : extractHeadings(documentText)),
    [mode, documentText, domHeadings],
  );

  // 拖拽重排要求 key 稳定：编辑/源码用行号，预览用标题在文档中的序号。
  const docIndex = useMemo(() => {
    const map = new Map<OutlineHeading, number>();
    headings.forEach((heading, index) => map.set(heading, index));
    return map;
  }, [headings]);

  const orderedHeadings = useMemo(
    () => applyOutlineOrder(headings, savedOrder),
    [headings, savedOrder],
  );
  const shownHeadings = dragOrder ?? orderedHeadings;

  const currentIndex = useMemo(() => {
    if (shownHeadings.length === 0) return -1;
    if (mode === "preview") {
      return shownHeadings.findIndex((heading) => {
        if (!heading.element) return false;
        const rect = heading.element.getBoundingClientRect();
        return rect.top >= 0;
      });
    }
    if (!view) return 0;
    const viewportFrom = view.viewport.from;
    for (let i = shownHeadings.length - 1; i >= 0; i -= 1) {
      if (positionOfLine(view, shownHeadings[i].line) <= viewportFrom + 1) {
        return i;
      }
    }
    return 0;
  }, [shownHeadings, mode, view]);

  const jump = useCallback(
    (heading: OutlineHeading, index: number) => {
      setActiveIndex(index);
      if (mode === "preview") {
        heading.element?.scrollIntoView({
          behavior: "instant",
          block: "start",
        });
        return;
      }
      if (view) scrollInEditor(view, heading.line);
    },
    [mode, view],
  );

  const onItemPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, index: number) => {
      if (event.button !== 0) return;
      const element = event.currentTarget;
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        itemHeight: element.getBoundingClientRect().height,
        fromIndex: index,
        order: shownHeadings,
        moved: shownHeadings[index],
        active: false,
      };
      suppressClickRef.current = false;
      element.setPointerCapture(event.pointerId);
    },
    [shownHeadings],
  );

  const onItemPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const deltaY = event.clientY - drag.startY;
      if (!drag.active) {
        if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) return;
        drag.active = true;
        suppressClickRef.current = true;
      }
      const height = drag.itemHeight > 0 ? drag.itemHeight : 1;
      const to = Math.min(
        Math.max(drag.fromIndex + Math.round(deltaY / height), 0),
        drag.order.length - 1,
      );
      const rest = drag.order.filter((heading) => heading !== drag.moved);
      const next = rest.slice();
      next.splice(to, 0, drag.moved);
      if (next.every((heading, i) => heading === drag.order[i])) return;
      drag.order = next;
      setDragOrder(next);
    },
    [],
  );

  const onItemPointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (!drag.active) return;
      const ids = drag.order.map(outlineHeadingId);
      if (docPath) writeOutlineOrder(docPath, ids);
      setSavedOrder(ids);
      setDragOrder(null);
    },
    [docPath],
  );

  useEffect(() => {
    setActiveIndex(-1);
  }, [documentText, mode]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPinned(false);
      setHovering(false);
      btnRef.current?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setPinned(false);
      setHovering(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [visible]);

  // 面板底/标题行 pointer-events:none 后，指针在其上不触发 mouseenter；
  // 改用几何判定：指针在按钮或面板盒内即保留，出盒才延迟收起。
  useEffect(() => {
    if (!visible) return;
    const onMove = (event: PointerEvent) => {
      const btn = btnRef.current?.getBoundingClientRect();
      const panel = menuRef.current?.getBoundingClientRect();
      const { clientX: x, clientY: y } = event;
      const inside =
        !!(
          btn &&
          x >= btn.left &&
          x <= btn.right &&
          y >= btn.top &&
          y <= btn.bottom
        ) ||
        !!(
          panel &&
          x >= panel.left &&
          x <= panel.right &&
          y >= panel.top &&
          y <= panel.bottom
        );
      if (inside) cancelClose();
      else scheduleClose();
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [visible, cancelClose, scheduleClose]);

  const highlighted = activeIndex >= 0 ? activeIndex : currentIndex;

  // 没有大纲就没有入口：一个点开是「无标题」的按钮只是噪声。
  if (headings.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      className="biaoyue-outline"
      data-testid="outline-wrap"
      onMouseEnter={() => {
        cancelClose();
        setHovering(true);
      }}
      onMouseLeave={() => {
        if (pinned) return;
        scheduleClose();
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className="biaoyue-outline-button"
        data-testid="outline-btn"
        data-pinned={pinned ? "true" : "false"}
        title="大纲"
        aria-label="大纲"
        aria-expanded={visible}
        onClick={() => setPinned((prev) => !prev)}
      >
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
          <path d="M4 6h10M4 12h10M4 18h10M18 6h2M18 12h2M18 18h2" />
        </svg>
      </button>

      {visible && (
        <div
          ref={menuRef}
          className="biaoyue-outline-panel"
          data-pinned={pinned ? "true" : "false"}
          data-testid="outline-menu"
          role="menu"
          aria-label="文档大纲"
        >
          <div className="biaoyue-outline-head">
            <span className="biaoyue-outline-title">文档大纲</span>
            <span className="biaoyue-outline-hint">点击图标钉住</span>
          </div>
          {headings.length === 0 ? (
            <p className="biaoyue-outline-empty">无标题</p>
          ) : (
            <ul role="list">
              {shownHeadings.map((heading, index) => (
                <li
                  key={
                    heading.line >= 0
                      ? `L${heading.line}`
                      : `D${docIndex.get(heading) ?? 0}`
                  }
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="biaoyue-outline-item"
                    data-testid={`outline-item-${index}`}
                    data-current={index === highlighted ? "true" : "false"}
                    data-level={heading.level}
                    style={{
                      paddingInlineStart: `${(heading.level - 1) * 12 + 10}px`,
                    }}
                    onPointerDown={(event) => onItemPointerDown(event, index)}
                    onPointerMove={onItemPointerMove}
                    onPointerUp={onItemPointerUp}
                    onClick={() => {
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
                      jump(heading, index);
                    }}
                  >
                    <span
                      className="biaoyue-outline-level"
                      data-outline-level={`H${heading.level}`}
                    >
                      {`H${heading.level}`}
                    </span>
                    <span className="biaoyue-outline-text">{heading.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
