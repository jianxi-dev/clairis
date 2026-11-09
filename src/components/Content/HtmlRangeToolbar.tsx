import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SelectionRect } from "../../editors/html/bridge";
import { useAiEntryStore } from "../../hooks/useAiEntry";

const GAP = 8;
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
const ALIGNS: { value: string; label: string; command: string }[] = [
  { value: "left", label: "左", command: "justifyLeft" },
  { value: "center", label: "中", command: "justifyCenter" },
  { value: "right", label: "右", command: "justifyRight" },
];

/**
 * HTML 文字选区工具条（第十批）：与文字节点工具条同一套外观，命令走 iframe
 * 的 Range/execCommand，不经过选区轮盘。
 */
export default function HtmlRangeToolbar({
  anchor,
  text,
  onCommand,
  onClose,
}: {
  anchor: SelectionRect;
  text: string;
  onCommand: (command: string, value?: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 36 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width !== size.w || rect.height !== size.h) {
      setSize({ w: rect.width, h: rect.height });
    }
  }, [size.w, size.h]);

  const vw = typeof window === "undefined" ? 0 : window.innerWidth;
  const left = Math.max(GAP, Math.min(anchor.x, vw - size.w - GAP));
  const above = anchor.y - size.h - GAP;
  const top = above >= GAP ? above : anchor.y + anchor.height + GAP;

  const btn = (label: string, command: string, title: string) => (
    <button
      type="button"
      aria-label={title}
      title={title}
      className="html-edit-toolbar__btn"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onCommand(command)}
    >
      {label}
    </button>
  );

  return createPortal(
    <div
      ref={ref}
      className="html-edit-toolbar"
      role="toolbar"
      aria-label="HTML 文字工具条"
      data-cm-range-toolbar="true"
      style={{ left, top }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <button
        type="button"
        aria-label="AI 编辑"
        title="AI 编辑"
        className="html-edit-toolbar__btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const ai = useAiEntryStore.getState();
          ai.setInput(
            `请改写下面的内容，只返回替换后的文本，不要解释：\n\n${text}`,
          );
          ai.openOverlay();
        }}
      >
        改写
      </button>
      <span className="html-edit-toolbar__sep" />
      <select
        aria-label="字号"
        defaultValue=""
        onChange={(e) => onCommand("fontSize", e.target.value)}
      >
        <option value="">字号</option>
        {FONT_SIZES.map((n) => (
          <option key={n} value={`${n}px`}>
            {n}
          </option>
        ))}
      </select>
      <span className="html-edit-toolbar__group">
        {btn("B", "bold", "粗体")}
        {btn("I", "italic", "斜体")}
        {btn("U", "underline", "下划线")}
        {btn("S", "strikeThrough", "删除线")}
      </span>
      <button
        type="button"
        aria-label="链接"
        title="链接"
        className="html-edit-toolbar__btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const url = window.prompt("链接地址");
          if (url) onCommand("createLink", url);
        }}
      >
        链接
      </button>
      <span className="html-edit-toolbar__sep" />
      <span className="html-edit-toolbar__group">
        {ALIGNS.map((item) => (
          <button
            key={item.value}
            type="button"
            data-align={item.value}
            aria-label={`${item.label}对齐`}
            className="html-edit-toolbar__btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCommand(item.command)}
          >
            {item.label}
          </button>
        ))}
      </span>
      <input
        aria-label="文字颜色"
        type="color"
        defaultValue="#000000"
        onChange={(e) => onCommand("foreColor", e.target.value)}
      />
      <span className="html-edit-toolbar__sep" />
      <button
        type="button"
        aria-label="删除元素"
        title="删除选中文字"
        className="html-edit-toolbar__btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onCommand("delete")}
      >
        删除
      </button>
    </div>,
    document.body,
  );
}
