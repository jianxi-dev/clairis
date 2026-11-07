import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SelectionRect } from "../../editors/html/bridge";
import { TAG_WHITELIST, type NodeInfo } from "../../editors/html/edit";

/**
 * HTML 可视化编辑工具条（E-19）。
 *
 * 画在主文档而不是 iframe 里（design D1）：iframe 内是用户文档的上下文，
 * 用户一条 `input { display: none }` 就能让工具条消失；主文档这边直接用
 * 应用主题 token 与原生控件。代价是位置得自己算——矩形由 iframe 上报（D2）。
 *
 * 所有改动只回传意图，由上层折算成 `content`（D3）；本组件不碰文档。
 */

const GAP = 8;
/** 字号档位。固定档位而不是自由输入，见 design D4。 */
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
const ALIGNS: { value: string; label: string }[] = [
  { value: "left", label: "左" },
  { value: "center", label: "中" },
  { value: "right", label: "右" },
];

export interface HtmlEditToolbarProps {
  nodeId: string;
  info: NodeInfo;
  /** 选中元素在主视口中的矩形（主侧已加 iframe 偏移） */
  anchor: SelectionRect;
  onReplaceTag: (tag: string) => void;
  onPatchStyle: (styles: Record<string, string | null>) => void;
  onPatchAttr: (attrs: Record<string, string | null>) => void;
  /** 进入区域截图模式（E-21） */
  onCapture: () => void;
  onClose: () => void;
}

/** `#abc` / `rgb(...)` 统一成 `input[type=color]` 认得的 `#rrggbb`。 */
function toHex(value: string | undefined): string {
  if (!value) return "#000000";
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) return `#${hex[1].toLowerCase()}`;
  const rgb = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!rgb) return "#000000";
  return `#${rgb
    .slice(1, 4)
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("")}`;
}

export default function HtmlEditToolbar({
  nodeId,
  info,
  anchor,
  onReplaceTag,
  onPatchStyle,
  onPatchAttr,
  onCapture,
  onClose,
}: HtmlEditToolbarProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 36 });

  // 初值来自 content；上层用 key={nodeId} 重挂载，所以换选中不会带着上一个
  // 元素的草稿。不另设 effect 回写——工具条自己是这些属性的唯一修改者。
  const [cls, setCls] = useState(info.attrs.class ?? "");
  const [id, setId] = useState(info.attrs.id ?? "");

  // 工具条宽度取决于渲染出来的控件，只能量过再定位；只量一次（选中变了控件不变）
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width !== size.w || rect.height !== size.h) {
      setSize({ w: rect.width, h: rect.height });
    }
  }, [nodeId, size.w, size.h]);

  const vw = typeof window === "undefined" ? 0 : window.innerWidth;
  const left = Math.max(GAP, Math.min(anchor.x, vw - size.w - GAP));
  const above = anchor.y - size.h - GAP;
  const top = above >= GAP ? above : anchor.y + anchor.height + GAP;

  const fontSize = info.style["font-size"] ?? "";
  const align = info.style["text-align"] ?? "";

  const commitAttr = (name: "class" | "id", value: string) => {
    const current = info.attrs[name] ?? "";
    if (value === current) return;
    onPatchAttr({ [name]: value });
  };

  const toolbar = (
    <div
      ref={ref}
      className="html-edit-toolbar"
      role="toolbar"
      aria-label="HTML 编辑工具条"
      data-cm-node-for={nodeId}
      style={{ left, top }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
          return;
        }
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          e.target.blur();
        }
      }}
    >
      <span className="html-edit-toolbar__tag">{info.tag}</span>
      <select
        aria-label="标签"
        value={info.tag}
        onChange={(e) => onReplaceTag(e.target.value)}
      >
        {info.tag && !TAG_WHITELIST.includes(info.tag as never) && (
          <option value={info.tag}>{info.tag}</option>
        )}
        {TAG_WHITELIST.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>

      <select
        aria-label="字号"
        value={fontSize}
        onChange={(e) => onPatchStyle({ "font-size": e.target.value || null })}
      >
        <option value="">字号</option>
        {fontSize && !FONT_SIZES.some((n) => `${n}px` === fontSize) && (
          <option value={fontSize}>{fontSize}</option>
        )}
        {FONT_SIZES.map((n) => (
          <option key={n} value={`${n}px`}>
            {n}
          </option>
        ))}
      </select>

      <input
        aria-label="文字颜色"
        type="color"
        value={toHex(info.style["color"])}
        onChange={(e) => onPatchStyle({ color: e.target.value })}
      />

      <span className="html-edit-toolbar__group">
        {ALIGNS.map((item) => (
          <button
            key={item.value}
            type="button"
            data-align={item.value}
            aria-label={`${item.label}对齐`}
            aria-pressed={align === item.value}
            className={
              align === item.value
                ? "html-edit-toolbar__btn is-active"
                : "html-edit-toolbar__btn"
            }
            onClick={() =>
              onPatchStyle({
                "text-align": align === item.value ? null : item.value,
              })
            }
          >
            {item.label}
          </button>
        ))}
      </span>

      <input
        aria-label="class"
        className="html-edit-toolbar__text"
        placeholder="class"
        value={cls}
        onChange={(e) => setCls(e.target.value)}
        onBlur={() => commitAttr("class", cls.trim())}
      />
      <input
        aria-label="id"
        className="html-edit-toolbar__text"
        placeholder="id"
        value={id}
        onChange={(e) => setId(e.target.value)}
        onBlur={() => commitAttr("id", id.trim())}
      />

      <button
        type="button"
        aria-label="截图"
        title="截图：拖出要截取的区域"
        className="html-edit-toolbar__btn"
        onClick={onCapture}
      >
        截图
      </button>

      <button
        type="button"
        aria-label="关闭工具条"
        className="html-edit-toolbar__btn"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );

  // 祖先里的 transform / overflow 会把 fixed 元素裁掉，portal 到 body 最稳
  return createPortal(toolbar, document.body);
}
