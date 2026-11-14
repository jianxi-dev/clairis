import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SelectionRect } from "../../editors/html/bridge";
import { useAiEntryStore } from "../../hooks/useAiEntry";
import { renderIcon } from "../../editors/icons";

const GAP = 8;
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
const ALIGNS: {
  value: string;
  label: string;
  command: string;
}[] = [
  {
    value: "left",
    label: "左",
    command: "justifyLeft",
  },
  {
    value: "center",
    label: "中",
    command: "justifyCenter",
  },
  {
    value: "right",
    label: "右",
    command: "justifyRight",
  },
  {
    value: "justify",
    label: "两端",
    command: "justifyFull",
  },
];
const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: "serif", label: "衬线" },
  { value: "sans-serif", label: "无衬线" },
  { value: "monospace", label: "等宽" },
  { value: "cursive", label: "手写" },
  {
    value: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    label: "系统字体",
  },
];

/** 文字标签改图标按钮（D8）：renderIcon 返回 DOM 节点，用 ref 挂进按钮。 */
function ToolbarIcon({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.replaceChildren(renderIcon(name));
  }, [name]);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      style={{ display: "inline-flex", alignItems: "center" }}
    />
  );
}

/**
 * HTML 文字选区工具条（第十批）：与文字节点工具条同一套外观，命令走 iframe
 * 的 Range/execCommand，不经过选区轮盘。
 */
export default function HtmlRangeToolbar({
  anchor,
  text,
  align,
  onCommand,
  onClose,
}: {
  anchor: SelectionRect;
  text: string;
  align: string;
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

  const btn = (icon: string, command: string, title: string) => (
    <button
      type="button"
      aria-label={title}
      title={title}
      className="html-edit-toolbar__btn"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onCommand(command)}
    >
      <ToolbarIcon name={icon} />
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
        <ToolbarIcon name="AiEditOutlined" />
      </button>
      <span className="html-edit-toolbar__sep" />
      <input
        aria-label="背景色"
        type="color"
        defaultValue="#ffffff"
        onChange={(e) => onCommand("hiliteColor", e.target.value)}
      />
      <select
        aria-label="字体"
        defaultValue=""
        onChange={(e) => onCommand("fontName", e.target.value)}
      >
        <option value="">字体</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
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
        {btn("BoldOutlined", "bold", "粗体")}
        {btn("ItalicOutlined", "italic", "斜体")}
        {btn("UnderlineOutlined", "underline", "下划线")}
        {btn("StrikethroughOutlined", "strikeThrough", "删除线")}
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
        <ToolbarIcon name="GlobalLinkOutlined" />
      </button>
      <span className="html-edit-toolbar__sep" />
      <select
        aria-label="对齐"
        value={align || "left"}
        onMouseDown={(e) => e.preventDefault()}
        onChange={(e) => {
          const command = ALIGNS.find(
            (a) => a.value === e.target.value,
          )?.command;
          if (command) onCommand(command);
        }}
      >
        {ALIGNS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
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
        <ToolbarIcon name="DeleteTrashOutlined" />
      </button>
    </div>,
    document.body,
  );
}
