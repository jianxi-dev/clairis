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
  extractHeadings,
  headingsFromDom,
  type OutlineHeading,
} from "../../lib/outline";

type OutlineMode = "edit" | "source" | "preview";

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

  const visible = pinned || hovering;

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

  const currentIndex = useMemo(() => {
    if (headings.length === 0) return -1;
    if (mode === "preview") {
      return headings.findIndex((heading) => {
        if (!heading.element) return false;
        const rect = heading.element.getBoundingClientRect();
        return rect.top >= 0;
      });
    }
    if (!view) return 0;
    const viewportFrom = view.viewport.from;
    for (let i = headings.length - 1; i >= 0; i -= 1) {
      if (positionOfLine(view, headings[i].line) <= viewportFrom + 1) return i;
    }
    return 0;
  }, [headings, mode, view]);

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
              {headings.map((heading, index) => (
                <li key={`${heading.line}-${heading.text}-${index}`}>
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
                    onClick={() => jump(heading, index)}
                  >
                    <span className="biaoyue-outline-bar" aria-hidden="true" />
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
