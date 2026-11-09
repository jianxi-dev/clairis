import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SelectionRect } from "../../editors/html/bridge";
import {
  nodeKindOf,
  toggleDecoration,
  type NodeInfo,
} from "../../editors/html/edit";
import { useAiEntryStore } from "../../hooks/useAiEntry";

/**
 * HTML 可视化编辑工具条（E-19 / E-22）。
 *
 * 画在主文档而不是 iframe 里（E-19 D1）：iframe 内是用户文档的上下文，
 * 一条 `input { display: none }` 就能让工具条消失；主文档这边直接用应用
 * 主题 token 与原生控件。位置由 iframe 上报矩形算（E-19 D2）。
 *
 * 按节点类型给**两套**控件（E-22）：文本块给排版操作（字号/粗体/斜体/
 * 下划线/删除线/链接/对齐/文字色），区块容器给容器操作（对齐/背景/边框）。
 * 给 `<section>` 加粗体和给 `<p>` 加背景框都不是常见诉求，混在一起只会让
 * 工具条又长又难读。
 */

const GAP = 8;
/** 字号档位。固定档位而不是自由输入，见 E-19 D4。 */
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
const ALIGNS: { value: string; label: string }[] = [
  { value: "left", label: "左" },
  { value: "center", label: "中" },
  { value: "right", label: "右" },
];
const BORDER = "1px solid rgba(0, 0, 0, 0.2)";

export interface HtmlEditToolbarProps {
  nodeId: string;
  info: NodeInfo;
  /** 选中元素在主视口中的矩形（主侧已加 iframe 偏移） */
  anchor: SelectionRect;
  /** 选中节点的纯文本，供 AI 入口预填。 */
  aiText: string;
  /**
   * 改样式。接收的是**基于最新文档状态**求值的函数，不是成品对象：
   * 连点两个开关时，第二次点击若拿渲染期的样式去算，会覆盖掉第一次的结果
   * （实测：勾下划线再勾删除线，下划线消失）。
   */
  onPatchStyle: (
    patch: (current: Record<string, string>) => Record<string, string | null>,
  ) => void;
  /** 给节点加链接 */
  onLink: (href: string) => void;
  /** 进入区域截图模式（E-21） */
  onCapture: () => void;
  /** 删除选中节点（含子树） */
  onRemove: () => void;
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

/**
 * 读样式值，简写属性带子属性回退。
 *
 * 浏览器把 `style` 里的简写拆成子属性暴露（`text-decoration` 变
 * `text-decoration-line`、`border` 变 `border-top-width` 等），直接读简写
 * 名字会拿到空串——表现为「勾了下划线，再勾删除线，下划线没了」。
 */
function readStyle(style: Record<string, string>, key: string): string {
  if (style[key]) return style[key];
  if (key === "text-decoration") return style["text-decoration-line"] ?? "";
  if (key === "border") return style["border-top-width"] ?? "";
  return "";
}

/** `transparent` / 缺省都算没设过背景，颜色块要显示成白的而不是黑的。 */
function backgroundHex(value: string | undefined): string {
  if (!value || value === "transparent") return "#ffffff";
  return toHex(value);
}

export default function HtmlEditToolbar({
  nodeId,
  info,
  anchor,
  aiText,
  onPatchStyle,
  onLink,
  onCapture,
  onRemove,
  onClose,
}: HtmlEditToolbarProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 36 });

  // 初值来自 content；上层用 key={nodeId} 重挂载，所以换选中不会带着上一个
  // 元素的草稿。不另设 effect 回写——工具条自己是这些属性的唯一修改者。
  const href = info.attrs.href ?? "";

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

  const kind = nodeKindOf(info.tag);
  const fontSize = info.style["font-size"] ?? "";
  const align = info.style["text-align"] ?? "";
  const decoration = readStyle(info.style, "text-decoration");
  const weight = Number(info.style["font-weight"] ?? 0);
  const bold = info.style["font-weight"] === "bold" || weight >= 600;
  const italic = info.style["font-style"] === "italic";
  const underline = decoration.split(/\s+/).includes("underline");
  const strike = decoration.includes("line-through") || info.tag === "s";
  const hasBorder = parseFloat(readStyle(info.style, "border") || "0") > 0;

  const toggleButton = (
    label: string,
    active: boolean,
    onClick: () => void,
    title: string,
  ) => (
    <button
      type="button"
      aria-label={title}
      title={title}
      aria-pressed={active}
      className={
        active ? "html-edit-toolbar__btn is-active" : "html-edit-toolbar__btn"
      }
      onClick={onClick}
    >
      {label}
    </button>
  );

  const toolbar = (
    <div
      ref={ref}
      className="html-edit-toolbar"
      role="toolbar"
      aria-label="HTML 编辑工具条"
      data-cm-node-for={nodeId}
      data-cm-node-kind={kind}
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
      <button
        type="button"
        aria-label="AI 编辑"
        title="AI 编辑"
        className="html-edit-toolbar__btn"
        onClick={() => {
          const ai = useAiEntryStore.getState();
          ai.setInput(
            `请改写下面的内容，只返回替换后的文本，不要解释：\n\n${aiText}`,
          );
          ai.openOverlay();
        }}
      >
        改写
      </button>

      {kind === "text" ? (
        <>
          <span className="html-edit-toolbar__sep" />
          <select
            aria-label="字号"
            value={fontSize}
            onChange={(e) =>
              onPatchStyle(() => ({ "font-size": e.target.value || null }))
            }
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

          <span className="html-edit-toolbar__group">
            {toggleButton(
              "B",
              bold,
              () =>
                onPatchStyle((current) => ({
                  "font-weight":
                    current["font-weight"] === "bold" ||
                    Number(current["font-weight"]) >= 600
                      ? null
                      : "bold",
                })),
              "粗体",
            )}
            {toggleButton(
              "I",
              italic,
              () =>
                onPatchStyle((current) => ({
                  "font-style":
                    current["font-style"] === "italic" ? null : "italic",
                })),
              "斜体",
            )}
            {toggleButton(
              "U",
              underline,
              () =>
                onPatchStyle((current) => ({
                  "text-decoration": toggleDecoration(
                    readStyle(current, "text-decoration"),
                    "underline",
                  ),
                })),
              "下划线",
            )}
            {toggleButton(
              "S",
              strike,
              () =>
                onPatchStyle((current) => ({
                  "text-decoration": toggleDecoration(
                    readStyle(current, "text-decoration"),
                    "line-through",
                  ),
                })),
              "删除线",
            )}
          </span>

          <button
            type="button"
            aria-label="链接"
            title="链接"
            className="html-edit-toolbar__btn"
            onClick={() => {
              const url = window.prompt("链接地址", href);
              if (url) onLink(url);
            }}
          >
            链
          </button>

          <span className="html-edit-toolbar__sep" />
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
                  onPatchStyle((current) => ({
                    "text-align":
                      current["text-align"] === item.value ? null : item.value,
                  }))
                }
              >
                {item.label}
              </button>
            ))}
          </span>
          <input
            aria-label="文字颜色"
            type="color"
            value={toHex(info.style["color"])}
            onChange={(e) => onPatchStyle(() => ({ color: e.target.value }))}
          />
        </>
      ) : (
        <>
          <span className="html-edit-toolbar__sep" />
          <input
            aria-label="背景色"
            type="color"
            value={backgroundHex(info.style["background-color"])}
            onChange={(e) =>
              onPatchStyle(() => ({ "background-color": e.target.value }))
            }
          />
          {toggleButton(
            "▢",
            hasBorder,
            () =>
              onPatchStyle((current) => ({
                border:
                  parseFloat(readStyle(current, "border") || "0") > 0
                    ? null
                    : BORDER,
              })),
            "边框色",
          )}
        </>
      )}

      <span className="html-edit-toolbar__sep" />
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
        aria-label="删除元素"
        title="删除这个元素"
        className="html-edit-toolbar__btn"
        onClick={onRemove}
      >
        🗑
      </button>
    </div>
  );

  // 祖先里的 transform / overflow 会把 fixed 元素裁掉，portal 到 body 最稳
  return createPortal(toolbar, document.body);
}
