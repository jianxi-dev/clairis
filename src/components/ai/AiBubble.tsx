import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useAiEntryStore } from "../../hooks/useAiEntry";
import {
  RESIZE_EDGES,
  resizePreview,
  type ResizeEdge,
} from "../../lib/previewAnchor";
import Icon from "../Icon";
import AiConversation from "./AiConversation";

/** 小窗默认尺寸与距视口右/下的间距（严格，e2e 会量）。 */
export const AI_BUBBLE_W = 285;
export const AI_BUBBLE_H = 260;
export const AI_BUBBLE_GAP = 16;

const RESIZE_STYLES: Record<ResizeEdge, React.CSSProperties> = {
  n: { top: 0, left: 8, right: 8, height: 6, cursor: "ns-resize" },
  s: { bottom: 0, left: 8, right: 8, height: 6, cursor: "ns-resize" },
  e: { right: 0, top: 8, bottom: 8, width: 6, cursor: "ew-resize" },
  w: { left: 0, top: 8, bottom: 8, width: 6, cursor: "ew-resize" },
  ne: { top: 0, right: 0, width: 12, height: 12, cursor: "nesw-resize" },
  nw: { top: 0, left: 0, width: 12, height: 12, cursor: "nwse-resize" },
  se: { bottom: 0, right: 0, width: 12, height: 12, cursor: "nwse-resize" },
  sw: { bottom: 0, left: 0, width: 12, height: 12, cursor: "nesw-resize" },
};

/**
 * AI 小窗形态（layout-portal 9.1）：右下角默认 285×260、距边 16px，
 * 标题栏可拖动、四边四角可缩放、× 关闭。正文复用 AiConversation。
 */
export default function AiBubble() {
  const form = useAiEntryStore((s) => s.form);
  const bubbleOpen = useAiEntryStore((s) => s.bubbleOpen);
  const bubbleRect = useAiEntryStore((s) => s.bubbleRect);
  const rootRef = useRef<HTMLDivElement>(null);

  if (form !== "bubble" || !bubbleOpen) return null;

  const startDrag = (e: ReactPointerEvent) => {
    e.preventDefault();
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const move = (ev: PointerEvent) => {
      useAiEntryStore.getState().setBubbleRect({
        x: Math.round(rect.left + ev.clientX - startX),
        y: Math.round(rect.top + ev.clientY - startY),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (edge: ResizeEdge) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const start = {
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
    };
    const startX = e.clientX;
    const startY = e.clientY;
    const move = (ev: PointerEvent) => {
      useAiEntryStore
        .getState()
        .setBubbleRect(
          resizePreview(edge, start, ev.clientX - startX, ev.clientY - startY),
        );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const style: React.CSSProperties = bubbleRect
    ? {
        left: bubbleRect.x,
        top: bubbleRect.y,
        width: bubbleRect.w,
        height: bubbleRect.h,
      }
    : {
        right: AI_BUBBLE_GAP,
        bottom: AI_BUBBLE_GAP,
        width: AI_BUBBLE_W,
        height: AI_BUBBLE_H,
      };

  return (
    <div
      ref={rootRef}
      data-ai-bubble
      data-ai-form="bubble"
      role="dialog"
      aria-label="AI 助手"
      style={style}
      className="fixed z-[2147482700] flex flex-col overflow-hidden rounded-[14px] border border-black/10 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.16)] dark:border-white/10 dark:bg-[#1c1c1e]"
    >
      <div
        data-ai-drag-handle
        onPointerDown={startDrag}
        className="flex shrink-0 cursor-move items-center gap-1 border-b border-black/5 px-2.5 py-1.5 dark:border-white/10"
      >
        <Icon name="sparkle" size={18} color="var(--app-accent)" />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
          AI
        </span>
        <button
          type="button"
          data-ai-close
          aria-label="关闭 AI"
          title="关闭"
          onClick={() => useAiEntryStore.getState().closeBubble()}
          className="ml-auto rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <AiConversation form="bubble" />
      </div>

      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge}
          data-ai-resize={edge}
          onPointerDown={startResize(edge)}
          style={{ position: "absolute", ...RESIZE_STYLES[edge] }}
        />
      ))}
    </div>
  );
}
