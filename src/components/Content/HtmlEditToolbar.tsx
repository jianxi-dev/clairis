import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SelectionRect } from "../../editors/html/bridge";
import {
  nodeKindOf,
  toggleDecoration,
  type NodeInfo,
} from "../../editors/html/edit";
import { useAiEntryStore } from "../../hooks/useAiEntry";
import { renderIcon } from "../../editors/icons";

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
  { value: "justify", label: "两端" },
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
  /** 删除选中节点（含子树） */
  onRemove: () => void;
  /** 清除选中节点的 inline 宽高，恢复原始尺寸 */
  onResetSize: () => void;
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
  onRemove,
  onResetSize,
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
  const fontFamily = info.style["font-family"] ?? "";
  // 未设置时按默认左对齐回显：select 没有空值选项，否则会显示空白。
  const align = info.style["text-align"] || "left";
  const decoration = readStyle(info.style, "text-decoration");
  const weight = Number(info.style["font-weight"] ?? 0);
  const bold = info.style["font-weight"] === "bold" || weight >= 600;
  const italic = info.style["font-style"] === "italic";
  const underline = decoration.split(/\s+/).includes("underline");
  const strike = decoration.includes("line-through") || info.tag === "s";
  const borderColor = toHex(info.style["border-color"]);

  const toggleButton = (
    icon: string,
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
      <ToolbarIcon name={icon} />
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
        <ToolbarIcon name="AiEditOutlined" />
      </button>

      {kind === "text" ? (
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
          <select
            aria-label="字体"
            value={fontFamily}
            onChange={(e) =>
              onPatchStyle(() => ({ "font-family": e.target.value || null }))
            }
          >
            <option value="">字体</option>
            {fontFamily &&
              !FONT_FAMILIES.some((f) => f.value === fontFamily) && (
                <option value={fontFamily}>{fontFamily}</option>
              )}
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
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
              "BoldOutlined",
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
              "ItalicOutlined",
              italic,
              () =>
                onPatchStyle((current) => ({
                  "font-style":
                    current["font-style"] === "italic" ? null : "italic",
                })),
              "斜体",
            )}
            {toggleButton(
              "UnderlineOutlined",
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
              "StrikethroughOutlined",
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
            <ToolbarIcon name="GlobalLinkOutlined" />
          </button>

          <span className="html-edit-toolbar__sep" />
          <select
            aria-label="对齐"
            value={align}
            onChange={(e) =>
              onPatchStyle(() => ({
                "text-align": e.target.value || null,
              }))
            }
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
          <input
            aria-label="边框色"
            type="color"
            value={borderColor}
            onChange={(e) =>
              onPatchStyle((current): Record<string, string | null> => {
                const color = e.target.value;
                return parseFloat(readStyle(current, "border") || "0") > 0
                  ? { "border-color": color }
                  : { border: `1px solid ${color}`, "border-color": color };
              })
            }
          />
          {(info.style.width || info.style.height) && (
            <button
              type="button"
              aria-label="恢复尺寸"
              title="清除宽高，恢复原始尺寸"
              className="html-edit-toolbar__btn"
              onClick={onResetSize}
            >
              恢复尺寸
            </button>
          )}
        </>
      )}

      <span className="html-edit-toolbar__sep" />
      <button
        type="button"
        aria-label="删除元素"
        title="删除这个元素"
        className="html-edit-toolbar__btn"
        onClick={onRemove}
      >
        <ToolbarIcon name="DeleteTrashOutlined" />
      </button>
    </div>
  );

  // 祖先里的 transform / overflow 会把 fixed 元素裁掉，portal 到 body 最稳
  return createPortal(toolbar, document.body);
}
